export interface ChunkedSequence<T> {
  readonly length: number
  get(index: number): T | undefined
  replace(start: number, deleteCount: number, replacement: readonly T[]): void
  toArray(): T[]
}

export function createChunkedSequence<T>(
  values: readonly T[],
  chunkSize = 256,
): ChunkedSequence<T> {
  const size = Math.max(1, Math.trunc(chunkSize))
  let chunks: T[][] = []
  let chunkStarts: number[] = []
  let length = 0

  const rebuild = (source: readonly T[]): void => {
    chunks = []
    chunkStarts = []
    for (let index = 0; index < source.length; index += size) {
      chunkStarts.push(index)
      chunks.push(source.slice(index, index + size))
    }
    length = source.length
  }

  const findChunk = (index: number): number => {
    let low = 0
    let high = chunkStarts.length - 1
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      if (chunkStarts[middle]! <= index) {
        low = middle + 1
      } else {
        high = middle - 1
      }
    }
    return Math.max(0, high)
  }

  const locate = (index: number): { chunk: number; offset: number } => {
    const normalized = Math.max(0, Math.min(length, Math.trunc(index)))
    if (normalized === length) {
      return { chunk: chunks.length, offset: 0 }
    }
    const chunk = findChunk(normalized)
    return { chunk, offset: normalized - chunkStarts[chunk]! }
  }

  rebuild(values)

  return {
    get length() {
      return length
    },
    get(index) {
      if (!Number.isInteger(index) || index < 0 || index >= length) return undefined
      const chunkIndex = findChunk(index)
      return chunks[chunkIndex]?.[index - chunkStarts[chunkIndex]!]
    },
    replace(start, deleteCount, replacement) {
      const from = locate(start)
      const to = locate(start + Math.max(0, Math.trunc(deleteCount)))
      const before = chunks.slice(0, from.chunk)
      const first = chunks[from.chunk]?.slice(0, from.offset) ?? []
      const after = chunks.slice(to.chunk)
      const last = to.offset > 0 ? (after.shift()?.slice(to.offset) ?? []) : []
      const middle = [...first, ...replacement, ...last]
      const nextChunks = before
      for (let index = 0; index < middle.length; index += size) {
        nextChunks.push(middle.slice(index, index + size))
      }
      chunks = nextChunks.concat(after)
      length += replacement.length - Math.max(0, Math.trunc(deleteCount))
      chunkStarts = []
      let chunkStart = 0
      for (const chunk of chunks) {
        chunkStarts.push(chunkStart)
        chunkStart += chunk.length
      }
    },
    toArray() {
      return chunks.flat()
    },
  }
}
