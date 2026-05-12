import type { DataGridViewportRange } from "../rowModel.js"

export type DataGridRangeCacheIndexState = "missing" | "loading" | "loaded" | "error"

export interface DataGridRangeCacheLoadToken {
  readonly id: number
  readonly generation: number
  readonly range: DataGridViewportRange
  readonly chunkIndexes: readonly number[]
}

export interface DataGridRangeCacheReadEntry<T> {
  index: number
  state: DataGridRangeCacheIndexState
  row?: T
  error?: Error
}

export interface DataGridRangeCacheDiagnostics {
  chunkSize: number
  maxChunks: number
  chunks: number
  rows: number
  loadingChunks: number
  errorChunks: number
  generation: number
}

export interface DataGridRangeCache<T> {
  beginLoad(range: DataGridViewportRange): DataGridRangeCacheLoadToken
  completeLoad(token: DataGridRangeCacheLoadToken, rows?: readonly { index: number; row: T }[]): boolean
  failLoad(token: DataGridRangeCacheLoadToken, error: Error): boolean
  cancelLoad(token: DataGridRangeCacheLoadToken): boolean
  reset(): void
  clear(): void
  setRow(index: number, row: T): void
  getRow(index: number): T | undefined
  hasRow(index: number): boolean
  deleteRow(index: number): boolean
  readIndex(index: number): DataGridRangeCacheReadEntry<T>
  readRange(range: DataGridViewportRange): DataGridRangeCacheReadEntry<T>[]
  getDiagnostics(): DataGridRangeCacheDiagnostics
}

export interface CreateDataGridRangeCacheOptions {
  chunkSize?: number
  maxChunks?: number
}

interface ChunkRecord<T> {
  index: number
  state: DataGridRangeCacheIndexState
  rows: Map<number, T>
  loadingTokens: Set<number>
  generation: number
  lastAccess: number
  error: Error | null
}

const DEFAULT_CHUNK_SIZE = 256
const DEFAULT_MAX_CHUNKS = 16

function normalizeIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function normalizeRange(range: DataGridViewportRange): DataGridViewportRange {
  const start = normalizeIndex(range.start)
  const end = normalizeIndex(range.end)
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  }
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function createDataGridRangeCache<T>(
  options: CreateDataGridRangeCacheOptions = {},
): DataGridRangeCache<T> {
  const chunkSize = Number.isFinite(options.chunkSize) && (options.chunkSize as number) > 0
    ? Math.max(1, Math.trunc(options.chunkSize as number))
    : DEFAULT_CHUNK_SIZE
  const maxChunks = Number.isFinite(options.maxChunks) && (options.maxChunks as number) > 0
    ? Math.max(1, Math.trunc(options.maxChunks as number))
    : DEFAULT_MAX_CHUNKS

  const chunks = new Map<number, ChunkRecord<T>>()
  let generation = 0
  let tokenCounter = 0
  let accessCounter = 0

  function touch(chunk: ChunkRecord<T>): ChunkRecord<T> {
    accessCounter += 1
    chunk.lastAccess = accessCounter
    return chunk
  }

  function getChunkIndex(index: number): number {
    return Math.floor(normalizeIndex(index) / chunkSize)
  }

  function getChunkIndexes(range: DataGridViewportRange): number[] {
    const normalized = normalizeRange(range)
    const startChunk = getChunkIndex(normalized.start)
    const endChunk = getChunkIndex(normalized.end)
    const indexes: number[] = []
    for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex += 1) {
      indexes.push(chunkIndex)
    }
    return indexes
  }

  function createChunk(index: number): ChunkRecord<T> {
    return {
      index,
      state: "missing",
      rows: new Map(),
      loadingTokens: new Set(),
      generation,
      lastAccess: 0,
      error: null,
    }
  }

  function ensureChunk(index: number): ChunkRecord<T> {
    const existing = chunks.get(index)
    if (existing) {
      return touch(existing)
    }
    const next = touch(createChunk(index))
    chunks.set(index, next)
    evictChunks()
    return next
  }

  function readChunk(index: number): ChunkRecord<T> | undefined {
    const chunk = chunks.get(index)
    return chunk ? touch(chunk) : undefined
  }

  function resolveChunkState(chunk: ChunkRecord<T>): DataGridRangeCacheIndexState {
    if (chunk.loadingTokens.size > 0) {
      return "loading"
    }
    if (chunk.error) {
      return "error"
    }
    return chunk.rows.size > 0 ? "loaded" : chunk.state
  }

  function evictChunks(): void {
    while (chunks.size > maxChunks) {
      let candidate: ChunkRecord<T> | null = null
      for (const chunk of chunks.values()) {
        if (chunk.loadingTokens.size > 0) {
          continue
        }
        if (!candidate || chunk.lastAccess < candidate.lastAccess) {
          candidate = chunk
        }
      }
      if (!candidate) {
        return
      }
      chunks.delete(candidate.index)
    }
  }

  function finishToken(
    token: DataGridRangeCacheLoadToken,
    nextState: DataGridRangeCacheIndexState,
    error: Error | null,
  ): boolean {
    if (token.generation !== generation) {
      return false
    }
    let applied = false
    for (const chunkIndex of token.chunkIndexes) {
      const chunk = chunks.get(chunkIndex)
      if (!chunk || chunk.generation !== token.generation) {
        continue
      }
      chunk.loadingTokens.delete(token.id)
      if (chunk.loadingTokens.size === 0) {
        chunk.error = error
        chunk.state = error ? "error" : chunk.rows.size > 0 ? "loaded" : nextState
      }
      touch(chunk)
      applied = true
    }
    evictChunks()
    return applied
  }

  function setRow(index: number, row: T): void {
    const normalized = normalizeIndex(index)
    const chunk = ensureChunk(getChunkIndex(normalized))
    chunk.rows.set(normalized, row)
    chunk.error = null
    if (chunk.loadingTokens.size === 0) {
      chunk.state = "loaded"
    }
  }

  function getRow(index: number): T | undefined {
    const normalized = normalizeIndex(index)
    return readChunk(getChunkIndex(normalized))?.rows.get(normalized)
  }

  function deleteRow(index: number): boolean {
    const normalized = normalizeIndex(index)
    const chunk = readChunk(getChunkIndex(normalized))
    if (!chunk) {
      return false
    }
    const deleted = chunk.rows.delete(normalized)
    if (deleted && chunk.rows.size === 0 && chunk.loadingTokens.size === 0) {
      chunk.state = "missing"
      chunk.error = null
    }
    return deleted
  }

  function readIndex(index: number): DataGridRangeCacheReadEntry<T> {
    const normalized = normalizeIndex(index)
    const chunk = readChunk(getChunkIndex(normalized))
    if (!chunk) {
      return { index: normalized, state: "missing" }
    }
    if (chunk.rows.has(normalized)) {
      return { index: normalized, state: "loaded", row: chunk.rows.get(normalized) as T }
    }
    const state = resolveChunkState(chunk)
    if (state === "error" && chunk.error) {
      return { index: normalized, state, error: chunk.error }
    }
    return { index: normalized, state: state === "loaded" ? "missing" : state }
  }

  return {
    beginLoad(range) {
      const normalized = normalizeRange(range)
      const token: DataGridRangeCacheLoadToken = {
        id: ++tokenCounter,
        generation,
        range: normalized,
        chunkIndexes: getChunkIndexes(normalized),
      }
      for (const chunkIndex of token.chunkIndexes) {
        const chunk = ensureChunk(chunkIndex)
        chunk.generation = generation
        chunk.loadingTokens.add(token.id)
        chunk.state = "loading"
        chunk.error = null
      }
      return token
    },
    completeLoad(token, rows = []) {
      if (token.generation !== generation) {
        return false
      }
      for (const entry of rows) {
        setRow(entry.index, entry.row)
      }
      return finishToken(token, "missing", null)
    },
    failLoad(token, error) {
      return finishToken(token, "error", normalizeError(error))
    },
    cancelLoad(token) {
      return finishToken(token, "missing", null)
    },
    reset() {
      generation += 1
      chunks.clear()
    },
    clear() {
      chunks.clear()
    },
    setRow,
    getRow,
    hasRow(index) {
      const normalized = normalizeIndex(index)
      return Boolean(readChunk(getChunkIndex(normalized))?.rows.has(normalized))
    },
    deleteRow,
    readIndex,
    readRange(range) {
      const normalized = normalizeRange(range)
      const entries: DataGridRangeCacheReadEntry<T>[] = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        entries.push(readIndex(index))
      }
      return entries
    },
    getDiagnostics() {
      let rows = 0
      let loadingChunks = 0
      let errorChunks = 0
      for (const chunk of chunks.values()) {
        rows += chunk.rows.size
        if (chunk.loadingTokens.size > 0) {
          loadingChunks += 1
        }
        if (chunk.error) {
          errorChunks += 1
        }
      }
      return {
        chunkSize,
        maxChunks,
        chunks: chunks.size,
        rows,
        loadingChunks,
        errorChunks,
        generation,
      }
    },
  }
}
