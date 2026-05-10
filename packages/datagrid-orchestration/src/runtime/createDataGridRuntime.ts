import {
  createClientRowModel,
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
  type CreateClientRowModelOptions,
  type CreateDataGridCoreOptions,
  type CreateDataGridColumnModelOptions,
  type DataGridApi,
  type DataGridApiPluginDefinition,
  type DataGridColumnModel,
  type DataGridCore,
  type DataGridCoreServiceRegistry,
  type DataGridRowModel,
  type DataGridViewportCellTarget,
  type DataGridViewportColumnTarget,
  type DataGridViewportPositionSnapshot,
  type DataGridViewportRange,
  type DataGridViewportRowTarget,
} from "@affino/datagrid-core"

export type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

export interface CreateDataGridRuntimeOptions<TRow = unknown> {
  rows?: readonly TRow[]
  rowModel?: DataGridRowModel<TRow>
  plugins?: readonly DataGridApiPluginDefinition<TRow>[]
  clientRowModelOptions?: Omit<CreateClientRowModelOptions<TRow>, "rows">
  columns: CreateDataGridColumnModelOptions["columns"]
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
}

export interface DataGridRuntime<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  core: DataGridCore
  api: DataGridApi<TRow>
}

function normalizeIndex(value: unknown): number | null {
  if (!Number.isFinite(value)) {
    return null
  }
  const normalized = Math.trunc(value as number)
  return normalized >= 0 ? normalized : null
}

function normalizeRange(start: unknown, end: unknown, total: number): DataGridViewportRange {
  if (total <= 0) {
    return { start: 0, end: 0 }
  }
  const normalizedStart = normalizeIndex(start) ?? 0
  const normalizedEnd = normalizeIndex(end) ?? normalizedStart
  const safeStart = Math.max(0, Math.min(total - 1, normalizedStart))
  const safeEnd = Math.max(safeStart, Math.min(total - 1, normalizedEnd))
  return { start: safeStart, end: safeEnd }
}

function normalizeScrollOffset(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, value as number) : 0
}

export function createDataGridRuntime<TRow = unknown>(
  options: CreateDataGridRuntimeOptions<TRow>,
): DataGridRuntime<TRow> {
  const rowModel = options.rowModel ?? createClientRowModel<TRow>({
    ...(options.clientRowModelOptions ?? {}),
    rows: options.rows ?? [],
  })
  const columnModel = createDataGridColumnModel({ columns: options.columns })
  let viewportRange: DataGridViewportRange = { start: 0, end: 0 }
  let viewportColumnIndex = 0
  let viewportScroll = { top: 0, left: 0 }
  let virtualizationEnabled = true
  let baseRowHeight = 31
  const rowHeightOverrides = new Map<number, number>()
  let rowHeightVersion = 0
  let lastRowHeightMutation: {
    version: number
    kind: "set" | "clear" | "clear-all"
    rowIndex: number | null
    previousHeight: number | null
    nextHeight: number | null
  } | null = null

  const resolveRowIndex = (target: DataGridViewportRowTarget): number | null => {
    const rowId = target.rowId
    if (rowId != null) {
      const count = rowModel.getRowCount()
      for (let index = 0; index < count; index += 1) {
        if (rowModel.getRow(index)?.rowId === rowId) {
          return index
        }
      }
    }
    const rowIndex = normalizeIndex(target.rowIndex)
    if (rowIndex == null) {
      return null
    }
    return Math.min(rowIndex, Math.max(0, rowModel.getRowCount() - 1))
  }

  const resolveColumnIndex = (target: DataGridViewportColumnTarget): number | null => {
    const visibleColumns = columnModel.getSnapshot().visibleColumns
    if (typeof target.columnKey === "string") {
      const keyIndex = visibleColumns.findIndex(column => column.key === target.columnKey)
      if (keyIndex >= 0) {
        return keyIndex
      }
    }
    const columnIndex = normalizeIndex(target.columnIndex)
    if (columnIndex == null) {
      return null
    }
    return Math.min(columnIndex, Math.max(0, visibleColumns.length - 1))
  }

  const resolveViewportAnchor = (): DataGridViewportPositionSnapshot["anchor"] => {
    const rowIndex = normalizeRange(viewportRange.start, viewportRange.end, rowModel.getRowCount()).start
    const visibleColumns = columnModel.getSnapshot().visibleColumns
    const columnIndex = Math.min(viewportColumnIndex, Math.max(0, visibleColumns.length - 1))
    const row = rowModel.getRow(rowIndex)
    const column = visibleColumns[columnIndex]
    return {
      rowId: row?.rowId ?? null,
      rowIndex,
      columnKey: column?.key ?? null,
      columnIndex: visibleColumns.length > 0 ? columnIndex : null,
    }
  }

  const setViewportRowIndex = (rowIndex: number): void => {
    const rowCount = rowModel.getRowCount()
    viewportRange = normalizeRange(rowIndex, rowIndex, rowCount)
    rowModel.setViewportRange(viewportRange)
  }

  const setViewportColumnIndex = (columnIndex: number): void => {
    const visibleColumnCount = columnModel.getSnapshot().visibleColumns.length
    viewportColumnIndex = normalizeRange(columnIndex, columnIndex, visibleColumnCount).start
  }

  const defaultViewportService: DataGridCoreServiceRegistry["viewport"] & {
    setVirtualizationEnabled: (enabled: boolean) => void
    getVirtualizationEnabled: () => boolean
    getVirtualWindow: () => {
      rowStart: number
      rowEnd: number
      rowTotal: number
      colStart: number
      colEnd: number
      colTotal: number
      overscan: { top: number; bottom: number; left: number; right: number }
    }
  } = {
    name: "viewport",
    setViewportRange(range) {
      viewportRange = normalizeRange(range.start, range.end, rowModel.getRowCount())
      rowModel.setViewportRange(viewportRange)
    },
    getViewportRange() {
      return viewportRange
    },
    getViewportPosition() {
      return {
        version: 1,
        range: viewportRange,
        anchor: resolveViewportAnchor(),
        scroll: { ...viewportScroll },
      }
    },
    setViewportPosition(position) {
      viewportRange = normalizeRange(position.range.start, position.range.end, rowModel.getRowCount())
      rowModel.setViewportRange(viewportRange)
      viewportScroll = {
        top: normalizeScrollOffset(position.scroll?.top),
        left: normalizeScrollOffset(position.scroll?.left),
      }
      const rowIndex = resolveRowIndex(position.anchor ?? {})
      if (rowIndex != null) {
        setViewportRowIndex(rowIndex)
      }
      const columnIndex = resolveColumnIndex(position.anchor ?? {})
      if (columnIndex != null) {
        setViewportColumnIndex(columnIndex)
      }
    },
    scrollToRow(target) {
      const rowIndex = resolveRowIndex(target)
      if (rowIndex != null) {
        setViewportRowIndex(rowIndex)
      }
    },
    scrollToColumn(target) {
      const columnIndex = resolveColumnIndex(target)
      if (columnIndex != null) {
        setViewportColumnIndex(columnIndex)
      }
    },
    scrollToCell(target: DataGridViewportCellTarget) {
      const rowIndex = resolveRowIndex(target)
      if (rowIndex != null) {
        setViewportRowIndex(rowIndex)
      }
      const columnIndex = resolveColumnIndex(target)
      if (columnIndex != null) {
        setViewportColumnIndex(columnIndex)
      }
    },
    getVirtualWindow() {
      const rowRange = normalizeRange(viewportRange.start, viewportRange.end, rowModel.getRowCount())
      const colTotal = columnModel.getSnapshot().visibleColumns.length
      const colRange = normalizeRange(viewportColumnIndex, viewportColumnIndex, colTotal)
      return {
        rowStart: rowRange.start,
        rowEnd: rowRange.end,
        rowTotal: rowModel.getRowCount(),
        colStart: colRange.start,
        colEnd: colRange.end,
        colTotal,
        overscan: { top: 0, bottom: 0, left: 0, right: 0 },
      }
    },
    setVirtualizationEnabled(enabled) {
      virtualizationEnabled = Boolean(enabled)
    },
    getVirtualizationEnabled() {
      return virtualizationEnabled
    },
    setRowHeightMode() {
      // No-op in headless default runtime.
    },
    getEffectiveRowHeight() {
      return baseRowHeight
    },
    setBaseRowHeight(height) {
      if (!Number.isFinite(height)) {
        return
      }
      baseRowHeight = Math.max(1, Math.trunc(height))
      rowHeightVersion += 1
    },
    measureRowHeight() {
      // No-op in headless default runtime.
    },
    setRowHeightOverride(rowIndex, height) {
      if (!Number.isInteger(rowIndex) || rowIndex < 0) {
        return
      }
      const previousHeight = rowHeightOverrides.get(rowIndex) ?? null
      if (height == null) {
        rowHeightOverrides.delete(rowIndex)
        rowHeightVersion += 1
        lastRowHeightMutation = {
          version: rowHeightVersion,
          kind: "clear",
          rowIndex,
          previousHeight,
          nextHeight: null,
        }
        return
      }
      if (!Number.isFinite(height)) {
        return
      }
      const normalizedHeight = Math.max(1, Math.trunc(height))
      rowHeightOverrides.set(rowIndex, normalizedHeight)
      rowHeightVersion += 1
      lastRowHeightMutation = {
        version: rowHeightVersion,
        kind: "set",
        rowIndex,
        previousHeight,
        nextHeight: normalizedHeight,
      }
    },
    getRowHeightOverride(rowIndex) {
      if (!Number.isInteger(rowIndex) || rowIndex < 0) {
        return null
      }
      return rowHeightOverrides.get(rowIndex) ?? null
    },
    getRowHeightVersion() {
      return rowHeightVersion
    },
    getRowHeightOverridesSnapshot() {
      return rowHeightOverrides
    },
    getLastRowHeightMutation() {
      return lastRowHeightMutation
    },
    clearRowHeightOverrides() {
      rowHeightOverrides.clear()
      rowHeightVersion += 1
      lastRowHeightMutation = {
        version: rowHeightVersion,
        kind: "clear-all",
        rowIndex: null,
        previousHeight: null,
        nextHeight: null,
      }
    },
  }

  const services: Partial<DataGridCoreServiceRegistry> = {
    rowModel: {
      name: "rowModel",
      model: rowModel as DataGridRowModel<unknown>,
    },
    columnModel: {
      name: "columnModel",
      model: columnModel,
    },
    viewport: options.services?.viewport ?? defaultViewportService,
    ...options.services,
  }

  const core = createDataGridCore({
    services,
    startupOrder: options.startupOrder,
  })
  const api = createDataGridApi<TRow>({
    core,
    plugins: options.plugins,
  })

  return {
    rowModel,
    columnModel,
    core,
    api,
  }
}
