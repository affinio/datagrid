import type {
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
} from "./layoutContracts.js"
import type {
  DataGridColumnPin,
  DataGridPivotLayoutColumnModel,
  DataGridPivotLayoutRowModel,
  DataGridSortAndFilterModelInput,
} from "./coreTypes.js"

export interface DataGridPivotLayoutSortFilterBatchCapability {
  setSortAndFilterModel: (input: DataGridSortAndFilterModelInput) => void
}

function cloneSerializable<T>(value: T): T {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(input: U) => U
  }).structuredClone
  if (typeof structuredCloneRef === "function") {
    try {
      return structuredCloneRef(value)
    } catch {
      // Fall through to JSON fallback.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function areSerializableValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

function normalizePivotLayoutOrder(input: readonly string[] | undefined): string[] {
  if (!Array.isArray(input)) {
    return []
  }
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const rawKey of input) {
    if (typeof rawKey !== "string") {
      continue
    }
    const key = rawKey.trim()
    if (key.length === 0 || seen.has(key)) {
      continue
    }
    seen.add(key)
    normalized.push(key)
  }
  return normalized
}

function normalizePivotLayoutPin(pin: unknown): DataGridColumnPin | null {
  if (pin === "left" || pin === "right" || pin === "none") {
    return pin
  }
  return null
}

export function exportPivotLayoutSnapshot<TRow = unknown>(
  rowModel: DataGridPivotLayoutRowModel<TRow>,
  columnModel: DataGridPivotLayoutColumnModel,
): DataGridPivotLayoutSnapshot<TRow> {
  const rowSnapshot = rowModel.getSnapshot()
  const columnSnapshot = columnModel.getSnapshot()
  const visibility: Record<string, boolean> = {}
  const widths: Record<string, number | null> = {}
  const pins: Record<string, DataGridColumnPin> = {}
  for (const column of columnSnapshot.columns) {
    visibility[column.key] = column.visible
    widths[column.key] = column.width
    pins[column.key] = column.pin
  }
  return {
    version: 1,
    sortModel: cloneSerializable(rowSnapshot.sortModel),
    filterModel: cloneSerializable(rowSnapshot.filterModel),
    groupBy: cloneSerializable(rowSnapshot.groupBy),
    pivotModel: cloneSerializable(rowModel.getPivotModel()),
    aggregationModel: cloneSerializable(rowModel.getAggregationModel()),
    groupExpansion: cloneSerializable(rowSnapshot.groupExpansion),
    columnState: {
      order: cloneSerializable(columnSnapshot.order),
      visibility,
      widths,
      pins,
    },
  }
}

export function exportPivotInteropSnapshot<TRow = unknown>(
  rowModel: DataGridPivotLayoutRowModel<TRow>,
  columnModel: DataGridPivotLayoutColumnModel,
): DataGridPivotInteropSnapshot<TRow> | null {
  const pivotModel = rowModel.getPivotModel()
  if (!pivotModel) {
    return null
  }
  const rowSnapshot = rowModel.getSnapshot()
  const rowCount = Math.max(0, Math.trunc(rowSnapshot.rowCount))
  const rows = rowCount > 0
    ? rowModel.getRowsInRange({ start: 0, end: rowCount - 1 })
    : []
  const layout = exportPivotLayoutSnapshot(rowModel, columnModel)
  return {
    version: 1,
    layout,
    pivotColumns: cloneSerializable(rowSnapshot.pivotColumns ?? []),
    rows: cloneSerializable(rows),
  }
}

export function importPivotLayoutSnapshot<TRow = unknown>(
  rowModel: DataGridPivotLayoutRowModel<TRow>,
  columnModel: DataGridPivotLayoutColumnModel,
  batchSortFilterCapability: DataGridPivotLayoutSortFilterBatchCapability | null,
  layout: DataGridPivotLayoutSnapshot<TRow>,
  options: DataGridPivotLayoutImportOptions = {},
): void {
  if (!layout || typeof layout !== "object") {
    return
  }

  const currentLayout = exportPivotLayoutSnapshot(rowModel, columnModel)
  if (areSerializableValuesEqual(currentLayout, layout)) {
    return
  }

  if (options.applyColumnState !== false) {
    const applyColumnState = () => {
      const order = normalizePivotLayoutOrder(layout.columnState?.order)
      if (order.length > 0) {
        columnModel.setColumnOrder(order)
      }
      const visibility = layout.columnState?.visibility ?? {}
      for (const [key, value] of Object.entries(visibility)) {
        columnModel.setColumnVisibility(key, Boolean(value))
      }
      const widths = layout.columnState?.widths ?? {}
      for (const [key, value] of Object.entries(widths)) {
        const normalizedWidth = Number.isFinite(value)
          ? Math.max(0, Math.trunc(value as number))
          : null
        columnModel.setColumnWidth(key, normalizedWidth)
      }
      const pins = layout.columnState?.pins ?? {}
      for (const [key, value] of Object.entries(pins)) {
        const normalizedPin = normalizePivotLayoutPin(value)
        if (!normalizedPin) {
          continue
        }
        columnModel.setColumnPin(key, normalizedPin)
      }
    }

    if (typeof columnModel.batch === "function") {
      columnModel.batch(applyColumnState)
    } else {
      applyColumnState()
    }
  }

  const sortModel = Array.isArray(layout.sortModel)
    ? layout.sortModel
    : []
  const filterModel = layout.filterModel == null
    ? null
    : layout.filterModel
  if (batchSortFilterCapability) {
    batchSortFilterCapability.setSortAndFilterModel({ sortModel, filterModel })
  } else {
    rowModel.setFilterModel(filterModel)
    rowModel.setSortModel(sortModel)
  }
  rowModel.setGroupBy(layout.groupBy ?? null)
  rowModel.setPivotModel(layout.pivotModel ?? null)
  rowModel.setAggregationModel(layout.aggregationModel ?? null)
  rowModel.setGroupExpansion(layout.groupExpansion ?? null)
}
