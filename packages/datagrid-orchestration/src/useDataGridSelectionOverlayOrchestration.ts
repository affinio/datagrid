export interface DataGridOverlayRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridOverlayColumnLike {
  pin?: string | null
}

export interface DataGridOverlayColumnMetricLike {
  start: number
  end: number
}

export interface DataGridSelectionOverlaySegment {
  key: string
  mode: "scroll"
  style: {
    top: string
    left: string
    width: string
    height: string
  }
}

export interface UseDataGridSelectionOverlayOrchestrationOptions {
  headerHeight: number
  rowHeight: number
  orderedColumns: readonly DataGridOverlayColumnLike[]
  orderedColumnMetrics: readonly DataGridOverlayColumnMetricLike[]
  cellSelectionRange: DataGridOverlayRange | null
  fillPreviewRange: DataGridOverlayRange | null
  fillBaseRange: DataGridOverlayRange | null
  rangeMovePreviewRange: DataGridOverlayRange | null
  rangeMoveBaseRange: DataGridOverlayRange | null
  isRangeMoving: boolean
  resolveDevicePixelRatio?: () => number
}

export interface DataGridSelectionOverlaySnapshot {
  cellSelectionOverlaySegments: readonly DataGridSelectionOverlaySegment[]
  fillPreviewOverlaySegments: readonly DataGridSelectionOverlaySegment[]
  rangeMoveOverlaySegments: readonly DataGridSelectionOverlaySegment[]
}

function rangesEqual(a: DataGridOverlayRange | null, b: DataGridOverlayRange | null): boolean {
  if (!a || !b) {
    return false
  }
  return (
    a.startRow === b.startRow &&
    a.endRow === b.endRow &&
    a.startColumn === b.startColumn &&
    a.endColumn === b.endColumn
  )
}

function snapOverlayValue(value: number, resolveDevicePixelRatio?: () => number): number {
  const rawDpr = resolveDevicePixelRatio?.() ?? 1
  const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1
  return Math.round(value * dpr) / dpr
}

function buildScrollOverlaySegments(
  range: DataGridOverlayRange | null,
  keyPrefix: string,
  headerHeight: number,
  rowHeight: number,
  orderedColumns: readonly DataGridOverlayColumnLike[],
  orderedColumnMetrics: readonly DataGridOverlayColumnMetricLike[],
  resolveDevicePixelRatio?: () => number,
): DataGridSelectionOverlaySegment[] {
  if (!range) {
    return []
  }
  const top = headerHeight + range.startRow * rowHeight
  const height = (range.endRow - range.startRow + 1) * rowHeight

  const segments: Array<{ start: number; end: number; mode: "pinned-left" | "scroll" }> = []
  let currentMode: "pinned-left" | "scroll" | null = null
  let currentStart = range.startColumn

  for (let index = range.startColumn; index <= range.endColumn; index += 1) {
    const column = orderedColumns[index]
    const mode: "pinned-left" | "scroll" = column?.pin === "left" ? "pinned-left" : "scroll"
    if (!currentMode) {
      currentMode = mode
      currentStart = index
      continue
    }
    if (mode === currentMode) {
      continue
    }
    segments.push({ start: currentStart, end: index - 1, mode: currentMode })
    currentMode = mode
    currentStart = index
  }

  if (currentMode) {
    segments.push({ start: currentStart, end: range.endColumn, mode: currentMode })
  }

  return segments
    .map(segment => {
      if (segment.mode !== "scroll") {
        return null
      }
      const startMetric = orderedColumnMetrics[segment.start]
      const endMetric = orderedColumnMetrics[segment.end]
      if (!startMetric || !endMetric) {
        return null
      }
      const left = snapOverlayValue(startMetric.start, resolveDevicePixelRatio)
      const width = snapOverlayValue(endMetric.end - startMetric.start, resolveDevicePixelRatio)
      const snappedTop = snapOverlayValue(top, resolveDevicePixelRatio)
      const snappedHeight = snapOverlayValue(height, resolveDevicePixelRatio)

      return {
        key: `${keyPrefix}-${segment.mode}-${segment.start}-${segment.end}`,
        mode: "scroll",
        style: {
          top: `${Math.max(0, snappedTop)}px`,
          left: `${Math.max(0, left)}px`,
          width: `${Math.max(1, width)}px`,
          height: `${Math.max(1, snappedHeight)}px`,
        },
      } satisfies DataGridSelectionOverlaySegment
    })
    .filter((segment): segment is DataGridSelectionOverlaySegment => segment !== null)
}

export function useDataGridSelectionOverlayOrchestration(
  options: UseDataGridSelectionOverlayOrchestrationOptions,
): DataGridSelectionOverlaySnapshot {
  const cellSelectionOverlaySegments = buildScrollOverlaySegments(
    options.cellSelectionRange,
    "selection",
    options.headerHeight,
    options.rowHeight,
    options.orderedColumns,
    options.orderedColumnMetrics,
    options.resolveDevicePixelRatio,
  )

  const fillPreviewOverlaySegments = !options.fillPreviewRange ||
    !options.fillBaseRange ||
    rangesEqual(options.fillPreviewRange, options.fillBaseRange)
    ? []
    : buildScrollOverlaySegments(
      options.fillPreviewRange,
      "fill-preview",
      options.headerHeight,
      options.rowHeight,
      options.orderedColumns,
      options.orderedColumnMetrics,
      options.resolveDevicePixelRatio,
    )

  const rangeMoveOverlaySegments = !options.isRangeMoving ||
    !options.rangeMovePreviewRange ||
    !options.rangeMoveBaseRange ||
    rangesEqual(options.rangeMovePreviewRange, options.rangeMoveBaseRange)
    ? []
    : buildScrollOverlaySegments(
      options.rangeMovePreviewRange,
      "move-preview",
      options.headerHeight,
      options.rowHeight,
      options.orderedColumns,
      options.orderedColumnMetrics,
      options.resolveDevicePixelRatio,
    )

  return {
    cellSelectionOverlaySegments,
    fillPreviewOverlaySegments,
    rangeMoveOverlaySegments,
  }
}
