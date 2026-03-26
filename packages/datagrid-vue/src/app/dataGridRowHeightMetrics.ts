export interface DataGridAppRowHeightMetricsOptions {
  totalRows: () => number
  resolveBaseRowHeight: () => number
  resolveRowHeightOverride: (rowIndex: number) => number | null
  resolveRowHeightVersion?: () => number
  hasRowHeightOverrides?: () => boolean
  resolveRowHeightOverridesSnapshot?: () => ReadonlyMap<number, number> | null
  resolveLastRowHeightMutation?: () => DataGridAppRowHeightMutation | null
}

export interface DataGridAppRowHeightMetrics {
  resolveRowHeight: (rowIndex: number) => number
  resolveRowOffset: (rowIndex: number) => number
  resolveRowIndexAtOffset: (offset: number) => number
  resolveViewportRange: (scrollTop: number, clientHeight: number, overscan: number) => {
    start: number
    end: number
  }
  resolveTotalHeight: () => number
}

export interface DataGridAppRowHeightMutation {
  version: number
  kind: "set" | "clear" | "clear-all"
  rowIndex: number | null
  previousHeight: number | null
  nextHeight: number | null
}

interface CachedMetrics {
  totalRows: number
  baseRowHeight: number
  version: number
  prefixOffsets: number[] | null
  chunkSize: number
  chunkDeltas: number[] | null
  chunkPrefixDeltas: number[] | null
  chunkRowDeltas: Array<Map<number, number> | undefined> | null
  totalHeight: number
}

const ROW_HEIGHT_CHUNK_SIZE = 256

function normalizeRowHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }
  return Math.max(1, Math.trunc(value))
}

export function createDataGridAppRowHeightMetrics(
  options: DataGridAppRowHeightMetricsOptions,
): DataGridAppRowHeightMetrics {
  let cachedMetrics: CachedMetrics | null = null

  const createConstantMetrics = (
    totalRows: number,
    baseRowHeight: number,
    version: number,
  ): CachedMetrics => ({
    totalRows,
    baseRowHeight,
    version,
    prefixOffsets: null,
    chunkSize: ROW_HEIGHT_CHUNK_SIZE,
    chunkDeltas: null,
    chunkPrefixDeltas: null,
    chunkRowDeltas: null,
    totalHeight: totalRows * baseRowHeight,
  })

  const buildSparseMetrics = (
    totalRows: number,
    baseRowHeight: number,
    version: number,
    overridesSnapshot: ReadonlyMap<number, number>,
  ): CachedMetrics => {
    const chunkSize = ROW_HEIGHT_CHUNK_SIZE
    const chunkCount = Math.ceil(totalRows / chunkSize)
    const chunkDeltas = new Array<number>(chunkCount).fill(0)
    const chunkPrefixDeltas = new Array<number>(chunkCount + 1).fill(0)
    const chunkRowDeltas = new Array<Map<number, number> | undefined>(chunkCount)
    let totalHeight = totalRows * baseRowHeight

    for (const [rowIndexRaw, overrideRaw] of overridesSnapshot.entries()) {
      const rowIndex = Math.trunc(rowIndexRaw)
      if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= totalRows) {
        continue
      }
      const override = normalizeRowHeight(overrideRaw)
      const delta = override - baseRowHeight
      if (delta === 0) {
        continue
      }
      const chunkIndex = Math.floor(rowIndex / chunkSize)
      const withinChunkIndex = rowIndex - (chunkIndex * chunkSize)
      chunkDeltas[chunkIndex] = (chunkDeltas[chunkIndex] ?? 0) + delta
      const rowDeltas = chunkRowDeltas[chunkIndex] ?? new Map<number, number>()
      rowDeltas.set(withinChunkIndex, delta)
      chunkRowDeltas[chunkIndex] = rowDeltas
      totalHeight += delta
    }

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      chunkPrefixDeltas[chunkIndex + 1] = chunkPrefixDeltas[chunkIndex] + (chunkDeltas[chunkIndex] ?? 0)
    }

    return {
      totalRows,
      baseRowHeight,
      version,
      prefixOffsets: null,
      chunkSize,
      chunkDeltas,
      chunkPrefixDeltas,
      chunkRowDeltas,
      totalHeight,
    }
  }

  const applySparseMutation = (
    metrics: CachedMetrics,
    version: number,
    mutation: DataGridAppRowHeightMutation,
  ): CachedMetrics | null => {
    if (
      metrics.chunkDeltas == null
      || metrics.chunkPrefixDeltas == null
      || metrics.chunkRowDeltas == null
      || mutation.kind === "clear-all"
      || mutation.rowIndex == null
      || mutation.rowIndex < 0
      || mutation.rowIndex >= metrics.totalRows
    ) {
      return null
    }

    const rowIndex = Math.trunc(mutation.rowIndex)
    const previousHeight = mutation.previousHeight == null
      ? metrics.baseRowHeight
      : normalizeRowHeight(mutation.previousHeight)
    const nextHeight = mutation.nextHeight == null
      ? metrics.baseRowHeight
      : normalizeRowHeight(mutation.nextHeight)
    const previousDelta = previousHeight - metrics.baseRowHeight
    const nextDelta = nextHeight - metrics.baseRowHeight
    const deltaDiff = nextDelta - previousDelta
    const chunkIndex = Math.floor(rowIndex / metrics.chunkSize)
    const withinChunkIndex = rowIndex - (chunkIndex * metrics.chunkSize)

    const rowDeltas = metrics.chunkRowDeltas[chunkIndex] ?? new Map<number, number>()
    if (nextDelta === 0) {
      rowDeltas.delete(withinChunkIndex)
      metrics.chunkRowDeltas[chunkIndex] = rowDeltas.size > 0 ? rowDeltas : undefined
    }
    else {
      rowDeltas.set(withinChunkIndex, nextDelta)
      metrics.chunkRowDeltas[chunkIndex] = rowDeltas
    }

    if (deltaDiff !== 0) {
      metrics.chunkDeltas[chunkIndex] = (metrics.chunkDeltas[chunkIndex] ?? 0) + deltaDiff
      for (let index = chunkIndex + 1; index < metrics.chunkPrefixDeltas.length; index += 1) {
        metrics.chunkPrefixDeltas[index] += deltaDiff
      }
      metrics.totalHeight += deltaDiff
    }
    metrics.version = version
    return metrics
  }

  const resolveCachedMetrics = (): CachedMetrics => {
    const totalRows = Math.max(0, Math.trunc(options.totalRows()))
    const baseRowHeight = normalizeRowHeight(options.resolveBaseRowHeight())
    const version = options.resolveRowHeightVersion?.() ?? 0
    const hasRowHeightOverrides = options.hasRowHeightOverrides?.() ?? true
    const overridesSnapshot = options.resolveRowHeightOverridesSnapshot?.() ?? null
    const lastRowHeightMutation = options.resolveLastRowHeightMutation?.() ?? null

    if (
      cachedMetrics
      && cachedMetrics.totalRows === totalRows
      && cachedMetrics.baseRowHeight === baseRowHeight
      && cachedMetrics.version === version
    ) {
      return cachedMetrics
    }

    if (
      cachedMetrics
      && cachedMetrics.totalRows === totalRows
      && cachedMetrics.baseRowHeight === baseRowHeight
      && overridesSnapshot != null
      && version === cachedMetrics.version + 1
      && lastRowHeightMutation != null
      && lastRowHeightMutation.version === version
    ) {
      const updatedMetrics = applySparseMutation(cachedMetrics, version, lastRowHeightMutation)
      if (updatedMetrics) {
        cachedMetrics = updatedMetrics
        return updatedMetrics
      }
    }

    if (!hasRowHeightOverrides) {
      cachedMetrics = createConstantMetrics(totalRows, baseRowHeight, version)
      return cachedMetrics
    }

    if (overridesSnapshot != null) {
      if (overridesSnapshot.size === 0) {
        cachedMetrics = createConstantMetrics(totalRows, baseRowHeight, version)
        return cachedMetrics
      }
      cachedMetrics = buildSparseMetrics(totalRows, baseRowHeight, version, overridesSnapshot)
      return cachedMetrics
    }

    let prefixOffsets: number[] | null = null
    if (hasRowHeightOverrides) {
      prefixOffsets = new Array<number>(totalRows + 1)
      prefixOffsets[0] = 0
      for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
        const override = options.resolveRowHeightOverride(rowIndex)
        const previousOffset = prefixOffsets[rowIndex] ?? 0
        prefixOffsets[rowIndex + 1] = previousOffset + normalizeRowHeight(override ?? baseRowHeight)
      }
    }

    cachedMetrics = {
      totalRows,
      baseRowHeight,
      version,
      prefixOffsets,
      chunkSize: ROW_HEIGHT_CHUNK_SIZE,
      chunkDeltas: null,
      chunkPrefixDeltas: null,
      chunkRowDeltas: null,
      totalHeight: prefixOffsets == null
        ? totalRows * baseRowHeight
        : (prefixOffsets[totalRows] ?? (totalRows * baseRowHeight)),
    }
    return cachedMetrics
  }

  const resolveRowHeight = (rowIndex: number): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return metrics.baseRowHeight
    }
    if (metrics.chunkRowDeltas != null) {
      const normalizedIndex = Math.max(0, Math.min(metrics.totalRows - 1, Math.trunc(rowIndex)))
      const chunkIndex = Math.floor(normalizedIndex / metrics.chunkSize)
      const withinChunkIndex = normalizedIndex - (chunkIndex * metrics.chunkSize)
      const delta = metrics.chunkRowDeltas[chunkIndex]?.get(withinChunkIndex) ?? 0
      return metrics.baseRowHeight + delta
    }
    if (metrics.prefixOffsets == null) {
      return metrics.baseRowHeight
    }
    const normalizedIndex = Math.max(0, Math.min(metrics.totalRows - 1, Math.trunc(rowIndex)))
    const start = metrics.prefixOffsets[normalizedIndex] ?? 0
    const end = metrics.prefixOffsets[normalizedIndex + 1] ?? (start + metrics.baseRowHeight)
    return end - start
  }

  const resolveRowOffset = (rowIndex: number): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return 0
    }
    const normalizedIndex = Math.max(0, Math.min(metrics.totalRows, Math.trunc(rowIndex)))
    if (
      metrics.chunkDeltas != null
      && metrics.chunkPrefixDeltas != null
      && metrics.chunkRowDeltas != null
    ) {
      const chunkIndex = Math.floor(normalizedIndex / metrics.chunkSize)
      let offset = normalizedIndex * metrics.baseRowHeight + (metrics.chunkPrefixDeltas[chunkIndex] ?? 0)
      const withinChunkIndex = normalizedIndex - (chunkIndex * metrics.chunkSize)
      if (withinChunkIndex > 0) {
        const rowDeltas = metrics.chunkRowDeltas[chunkIndex]
        if (rowDeltas) {
          for (let row = 0; row < withinChunkIndex; row += 1) {
            offset += rowDeltas.get(row) ?? 0
          }
        }
      }
      return offset
    }
    if (metrics.prefixOffsets == null) {
      return normalizedIndex * metrics.baseRowHeight
    }
    return metrics.prefixOffsets[normalizedIndex] ?? 0
  }

  const resolveRowIndexAtOffset = (offset: number): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return 0
    }
    if (
      metrics.chunkDeltas != null
      && metrics.chunkPrefixDeltas != null
      && metrics.chunkRowDeltas != null
    ) {
      if (metrics.totalHeight <= 0) {
        return 0
      }
      const clampedOffset = Math.max(0, Math.min(metrics.totalHeight - 1, offset))
      let low = 0
      let high = metrics.chunkDeltas.length - 1

      while (low <= high) {
        const middle = Math.floor((low + high) / 2)
        const chunkStartOffset = (middle * metrics.chunkSize * metrics.baseRowHeight)
          + (metrics.chunkPrefixDeltas[middle] ?? 0)
        const chunkRowEnd = Math.min(metrics.totalRows, (middle + 1) * metrics.chunkSize)
        const chunkEndOffset = (chunkRowEnd * metrics.baseRowHeight)
          + (metrics.chunkPrefixDeltas[middle + 1] ?? 0)

        if (clampedOffset < chunkStartOffset) {
          high = middle - 1
          continue
        }
        if (clampedOffset >= chunkEndOffset) {
          low = middle + 1
          continue
        }

        const chunkStartRow = middle * metrics.chunkSize
        const rowDeltas = metrics.chunkRowDeltas[middle]
        let rowStartOffset = chunkStartOffset
        for (let rowOffset = 0; rowOffset < chunkRowEnd - chunkStartRow; rowOffset += 1) {
          const rowHeight = metrics.baseRowHeight + (rowDeltas?.get(rowOffset) ?? 0)
          const rowEndOffset = rowStartOffset + rowHeight
          if (clampedOffset < rowEndOffset) {
            return chunkStartRow + rowOffset
          }
          rowStartOffset = rowEndOffset
        }
        return Math.max(0, chunkRowEnd - 1)
      }

      return Math.max(0, Math.min(metrics.totalRows - 1, low * metrics.chunkSize))
    }
    if (metrics.prefixOffsets == null) {
      const normalizedHeight = Math.max(1, metrics.baseRowHeight)
      return Math.max(
        0,
        Math.min(metrics.totalRows - 1, Math.floor(Math.max(0, offset) / normalizedHeight)),
      )
    }
    const totalHeight = metrics.prefixOffsets[metrics.totalRows] ?? 0
    if (totalHeight <= 0) {
      return 0
    }
    const clampedOffset = Math.max(0, Math.min(totalHeight - 1, offset))
    let low = 0
    let high = metrics.totalRows - 1
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const rowStart = metrics.prefixOffsets[middle] ?? 0
      const rowEnd = metrics.prefixOffsets[middle + 1] ?? totalHeight
      if (clampedOffset < rowStart) {
        high = middle - 1
        continue
      }
      if (clampedOffset >= rowEnd) {
        low = middle + 1
        continue
      }
      return middle
    }
    return Math.max(0, Math.min(metrics.totalRows - 1, low))
  }

  const resolveViewportRange = (scrollTop: number, clientHeight: number, overscan: number) => {
    const metrics = resolveCachedMetrics()
    if (metrics.totalRows <= 0) {
      return { start: 0, end: 0 }
    }
    const normalizedOverscan = Math.max(0, Math.trunc(overscan))
    const start = Math.max(0, resolveRowIndexAtOffset(scrollTop) - normalizedOverscan)
    const visibleBottomOffset = Math.max(0, scrollTop + Math.max(1, clientHeight) - 1)
    const end = Math.min(
      metrics.totalRows - 1,
      resolveRowIndexAtOffset(visibleBottomOffset) + normalizedOverscan,
    )
    return { start, end }
  }

  const resolveTotalHeight = (): number => {
    const metrics = resolveCachedMetrics()
    if (metrics.chunkDeltas != null) {
      return metrics.totalHeight
    }
    if (metrics.prefixOffsets == null) {
      return metrics.totalRows * metrics.baseRowHeight
    }
    return metrics.prefixOffsets[metrics.totalRows] ?? 0
  }

  return {
    resolveRowHeight,
    resolveRowOffset,
    resolveRowIndexAtOffset,
    resolveViewportRange,
    resolveTotalHeight,
  }
}
