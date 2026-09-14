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
  let length = 0

  const rebuild = (source: readonly T[]): void => {
    chunks = []
    for (let index = 0; index < source.length; index += size) {
      chunks.push(source.slice(index, index + size))
    }
    length = source.length
  }

  const locate = (index: number): { chunk: number; offset: number } => {
    const normalized = Math.max(0, Math.min(length, Math.trunc(index)))
    return { chunk: Math.floor(normalized / size), offset: normalized % size }
  }

  rebuild(values)

  return {
    get length() {
      return length
    },
    get(index) {
      if (!Number.isInteger(index) || index < 0 || index >= length) return undefined
      const chunk = chunks[Math.floor(index / size)]
      return chunk?.[index % size]
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
    },
    toArray() {
      return chunks.flat()
    },
  }
}
