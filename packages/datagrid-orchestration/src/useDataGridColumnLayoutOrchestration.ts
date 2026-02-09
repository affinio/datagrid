export interface DataGridColumnLayoutColumn {
  key: string
  pin?: string | null
}

export interface DataGridColumnLayoutMetric {
  key: string
  columnIndex: number
  start: number
  width: number
  end: number
}

export interface DataGridVisibleColumnsWindow {
  start: number
  end: number
  total: number
  keys: string
}

export type DataGridColumnLayerKey = "left" | "scroll" | "right"

export interface DataGridColumnLayer<TColumn extends DataGridColumnLayoutColumn> {
  key: DataGridColumnLayerKey
  columns: readonly TColumn[]
  templateColumns: string
  width: number
}

export interface UseDataGridColumnLayoutOrchestrationOptions<TColumn extends DataGridColumnLayoutColumn> {
  columns: readonly TColumn[]
  resolveColumnWidth: (column: TColumn) => number
  viewportWidth: number
  scrollLeft: number
}

export interface DataGridColumnLayoutSnapshot<TColumn extends DataGridColumnLayoutColumn> {
  orderedColumns: readonly TColumn[]
  orderedColumnMetrics: readonly DataGridColumnLayoutMetric[]
  templateColumns: string
  stickyLeftOffsets: Map<string, number>
  stickyRightOffsets: Map<string, number>
  visibleColumnsWindow: DataGridVisibleColumnsWindow
}

export function orderDataGridColumns<TColumn extends DataGridColumnLayoutColumn>(
  columns: readonly TColumn[],
): readonly TColumn[] {
  const left: TColumn[] = []
  const center: TColumn[] = []
  const right: TColumn[] = []
  for (const column of columns) {
    if (column.pin === "left") {
      left.push(column)
      continue
    }
    if (column.pin === "right") {
      right.push(column)
      continue
    }
    center.push(column)
  }
  return [...left, ...center, ...right]
}

export function buildDataGridColumnMetrics<TColumn extends DataGridColumnLayoutColumn>(
  columns: readonly TColumn[],
  resolveColumnWidth: (column: TColumn) => number,
): readonly DataGridColumnLayoutMetric[] {
  let start = 0
  return columns.map((column, columnIndex) => {
    const width = resolveColumnWidth(column)
    const metric = {
      key: column.key,
      columnIndex,
      start,
      width,
      end: start + width,
    } satisfies DataGridColumnLayoutMetric
    start += width
    return metric
  })
}

function buildStickyLeftOffsets<TColumn extends DataGridColumnLayoutColumn>(
  columns: readonly TColumn[],
  resolveColumnWidth: (column: TColumn) => number,
): Map<string, number> {
  const offsets = new Map<string, number>()
  let offset = 0
  for (const column of columns) {
    if (column.pin !== "left") continue
    offsets.set(column.key, offset)
    offset += resolveColumnWidth(column)
  }
  return offsets
}

function buildStickyRightOffsets<TColumn extends DataGridColumnLayoutColumn>(
  columns: readonly TColumn[],
  resolveColumnWidth: (column: TColumn) => number,
): Map<string, number> {
  const offsets = new Map<string, number>()
  let offset = 0
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index]
    if (!column || column.pin !== "right") continue
    offsets.set(column.key, offset)
    offset += resolveColumnWidth(column)
  }
  return offsets
}

function buildVisibleColumnsWindow(
  columns: readonly DataGridColumnLayoutMetric[],
  viewportWidth: number,
  scrollLeft: number,
): DataGridVisibleColumnsWindow {
  if (!columns.length) {
    return { start: 0, end: 0, total: 0, keys: "none" }
  }

  const windowStart = Math.max(0, scrollLeft)
  const windowEnd = windowStart + Math.max(1, viewportWidth)
  let offset = 0
  let startIndex = 0
  let endIndex = columns.length - 1
  let found = false

  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]
    if (!column) continue
    const columnStart = offset
    const columnEnd = columnStart + column.width
    const intersects = columnEnd > windowStart && columnStart < windowEnd
    if (intersects && !found) {
      startIndex = index
      found = true
    }
    if (intersects) {
      endIndex = index
    }
    offset = columnEnd
  }

  if (!found) {
    startIndex = Math.max(0, columns.length - 1)
    endIndex = startIndex
  }

  return {
    start: startIndex + 1,
    end: endIndex + 1,
    total: columns.length,
    keys: columns.slice(startIndex, endIndex + 1).map(column => column.key).join(" • ") || "none",
  }
}

export function resolveDataGridColumnCellStyle(
  snapshot: DataGridColumnLayoutSnapshot<DataGridColumnLayoutColumn>,
  columnKey: string,
): Record<string, string> {
  const leftOffset = snapshot.stickyLeftOffsets.get(columnKey)
  if (typeof leftOffset === "number") {
    return { left: `${leftOffset}px` }
  }
  const rightOffset = snapshot.stickyRightOffsets.get(columnKey)
  if (typeof rightOffset === "number") {
    return { right: `${rightOffset}px` }
  }
  return {}
}

export function isDataGridStickyColumn(
  snapshot: DataGridColumnLayoutSnapshot<DataGridColumnLayoutColumn>,
  columnKey: string,
): boolean {
  return snapshot.stickyLeftOffsets.has(columnKey) || snapshot.stickyRightOffsets.has(columnKey)
}

export function buildDataGridColumnLayers<TColumn extends DataGridColumnLayoutColumn>(
  snapshot: DataGridColumnLayoutSnapshot<TColumn>,
): readonly DataGridColumnLayer<TColumn>[] {
  const leftColumns: TColumn[] = []
  const scrollColumns: TColumn[] = []
  const rightColumns: TColumn[] = []

  const leftWidths: number[] = []
  const scrollWidths: number[] = []
  const rightWidths: number[] = []

  for (let index = 0; index < snapshot.orderedColumns.length; index += 1) {
    const column = snapshot.orderedColumns[index]
    const metric = snapshot.orderedColumnMetrics[index]
    if (!column || !metric) {
      continue
    }
    const width = Math.max(0, metric.width)
    if (column.pin === "left") {
      leftColumns.push(column)
      leftWidths.push(width)
      continue
    }
    if (column.pin === "right") {
      rightColumns.push(column)
      rightWidths.push(width)
      continue
    }
    scrollColumns.push(column)
    scrollWidths.push(width)
  }

  const layers: DataGridColumnLayer<TColumn>[] = [
    {
      key: "left",
      columns: leftColumns,
      templateColumns: leftWidths.map(width => `${width}px`).join(" "),
      width: leftWidths.reduce((total, width) => total + width, 0),
    },
    {
      key: "scroll",
      columns: scrollColumns,
      templateColumns: scrollWidths.map(width => `${width}px`).join(" "),
      width: scrollWidths.reduce((total, width) => total + width, 0),
    },
    {
      key: "right",
      columns: rightColumns,
      templateColumns: rightWidths.map(width => `${width}px`).join(" "),
      width: rightWidths.reduce((total, width) => total + width, 0),
    },
  ]

  return layers.filter(layer => layer.key === "scroll" || layer.columns.length > 0)
}

export function resolveDataGridLayerTrackTemplate<TColumn extends DataGridColumnLayoutColumn>(
  layers: readonly DataGridColumnLayer<TColumn>[],
): string {
  return layers.map(layer => `${Math.max(0, layer.width)}px`).join(" ")
}

export function useDataGridColumnLayoutOrchestration<TColumn extends DataGridColumnLayoutColumn>(
  options: UseDataGridColumnLayoutOrchestrationOptions<TColumn>,
): DataGridColumnLayoutSnapshot<TColumn> {
  const orderedColumns = orderDataGridColumns(options.columns)
  const orderedColumnMetrics = buildDataGridColumnMetrics(orderedColumns, options.resolveColumnWidth)
  return {
    orderedColumns,
    orderedColumnMetrics,
    templateColumns: orderedColumnMetrics.map(metric => `${metric.width}px`).join(" "),
    stickyLeftOffsets: buildStickyLeftOffsets(orderedColumns, options.resolveColumnWidth),
    stickyRightOffsets: buildStickyRightOffsets(orderedColumns, options.resolveColumnWidth),
    visibleColumnsWindow: buildVisibleColumnsWindow(
      orderedColumnMetrics,
      options.viewportWidth,
      options.scrollLeft,
    ),
  }
}
