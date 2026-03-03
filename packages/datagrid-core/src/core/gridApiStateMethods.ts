import type {
  DataGridAggregationModel,
  DataGridColumnModel,
  DataGridColumnPin,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPivotSpec,
  DataGridRowModel,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "../models"
import type {
  DataGridSelectionCapability,
  DataGridSortFilterBatchCapability,
  DataGridTransactionCapability,
} from "./gridApiCapabilities"
import type {
  DataGridMigrateStateOptions,
  DataGridSetStateOptions,
  DataGridUnifiedState,
} from "./gridApiContracts"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"

export interface DataGridApiStateMethods<TRow = unknown> {
  getUnifiedState: () => DataGridUnifiedState<TRow>
  migrateUnifiedState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<TRow> | null
  setUnifiedState: (state: DataGridUnifiedState<TRow>, options?: DataGridSetStateOptions) => void
}

export interface CreateDataGridApiStateMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  getSelectionCapability: () => DataGridSelectionCapability | null
  getTransactionCapability: () => DataGridTransactionCapability | null
  getSortFilterBatchCapability: () => DataGridSortFilterBatchCapability | null
  setViewportRange: (range: DataGridViewportRange) => void
  onSelectionChanged?: (snapshot: DataGridSelectionSnapshot | null) => void
  onStateImported?: (state: DataGridUnifiedState<TRow>) => void
}

function cloneSerializable<T>(value: T): T {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(input: U) => U
  }).structuredClone
  if (typeof structuredCloneRef === "function") {
    try {
      return structuredCloneRef(value)
    } catch {
      // Fall through to JSON clone.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function normalizePin(pin: unknown): DataGridColumnPin | null {
  return pin === "left" || pin === "right" || pin === "none" ? pin : null
}

function normalizeSortModel(value: unknown): readonly DataGridSortState[] {
  if (!Array.isArray(value)) {
    return []
  }
  return cloneSerializable(value as readonly DataGridSortState[])
}

function normalizeFilterModel(value: unknown): DataGridFilterSnapshot | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridFilterSnapshot)
}

function normalizeGroupBy(value: unknown): DataGridGroupBySpec | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridGroupBySpec)
}

function normalizePivotModel(value: unknown): DataGridPivotSpec | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridPivotSpec)
}

function normalizeAggregationModel<TRow>(value: unknown): DataGridAggregationModel<TRow> | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridAggregationModel<TRow>)
}

function normalizeGroupExpansion(value: unknown): DataGridGroupExpansionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridGroupExpansionSnapshot)
}

function normalizeViewportRange(value: unknown): DataGridViewportRange | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const range = value as Partial<DataGridViewportRange>
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return null
  }
  const start = Math.max(0, Math.trunc(range.start as number))
  const end = Math.max(start, Math.trunc(range.end as number))
  return { start, end }
}

function normalizePaginationInput(value: unknown): DataGridPaginationInput | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const pagination = value as { enabled?: unknown; pageSize?: unknown; currentPage?: unknown }
  if (pagination.enabled === false) {
    return null
  }
  if (!Number.isFinite(pagination.pageSize) || !Number.isFinite(pagination.currentPage)) {
    return null
  }
  const pageSize = Math.max(1, Math.trunc(pagination.pageSize as number))
  const currentPage = Math.max(0, Math.trunc(pagination.currentPage as number))
  return { pageSize, currentPage }
}

export function createDataGridApiStateMethods<TRow = unknown>(
  input: CreateDataGridApiStateMethodsInput<TRow>,
): DataGridApiStateMethods<TRow> {
  const {
    rowModel,
    columnModel,
    getSelectionCapability,
    getTransactionCapability,
    getSortFilterBatchCapability,
    setViewportRange,
    onSelectionChanged,
    onStateImported,
  } = input

  const migrateUnifiedState = (
    state: unknown,
    options: DataGridMigrateStateOptions = {},
  ): DataGridUnifiedState<TRow> | null => {
    if (!state || typeof state !== "object") {
      if (options.strict) {
        throw new Error("[DataGridApi] State migration failed: input must be an object.")
      }
      return null
    }

    const candidate = state as { version?: unknown }
    if (candidate.version !== 1) {
      if (options.strict) {
        throw new Error(`[DataGridApi] Unsupported state version: ${String(candidate.version)}`)
      }
      return null
    }

    return cloneSerializable(state as DataGridUnifiedState<TRow>)
  }

  return {
    getUnifiedState() {
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
        rows: {
          snapshot: cloneSerializable(rowSnapshot),
          aggregationModel: cloneSerializable(rowModel.getAggregationModel()),
        },
        columns: {
          order: cloneSerializable(columnSnapshot.order),
          visibility,
          widths,
          pins,
        },
        selection: cloneSerializable(getSelectionCapability()?.getSelectionSnapshot() ?? null),
        transaction: cloneSerializable(getTransactionCapability()?.getTransactionSnapshot() ?? null),
      }
    },
    migrateUnifiedState(state: unknown, options?: DataGridMigrateStateOptions) {
      return migrateUnifiedState(state, options)
    },
    setUnifiedState(state: DataGridUnifiedState<TRow>, options: DataGridSetStateOptions = {}) {
      const migratedState = migrateUnifiedState(state, { strict: options.strict })
      if (!migratedState) {
        return
      }

      const rowSnapshot = migratedState.rows?.snapshot
      if (rowSnapshot) {
        const sortModel = normalizeSortModel(rowSnapshot.sortModel)
        const filterModel = normalizeFilterModel(rowSnapshot.filterModel)
        const batchedInput: DataGridSortAndFilterModelInput = {
          sortModel,
          filterModel,
        }
        const sortFilterBatchCapability = getSortFilterBatchCapability()
        if (sortFilterBatchCapability) {
          sortFilterBatchCapability.setSortAndFilterModel(batchedInput)
        } else {
          rowModel.setFilterModel(batchedInput.filterModel)
          rowModel.setSortModel(batchedInput.sortModel)
        }

        rowModel.setGroupBy(normalizeGroupBy(rowSnapshot.groupBy))
        rowModel.setPivotModel(normalizePivotModel(rowSnapshot.pivotModel))
        rowModel.setAggregationModel(normalizeAggregationModel(migratedState.rows?.aggregationModel))
        rowModel.setGroupExpansion(normalizeGroupExpansion(rowSnapshot.groupExpansion))
        rowModel.setPagination(normalizePaginationInput(rowSnapshot.pagination))
        if (options.applyViewport !== false) {
          const viewportRange = normalizeViewportRange(rowSnapshot.viewportRange)
          if (viewportRange) {
            setViewportRange(viewportRange)
          }
        }
      }

      if (options.applyColumns !== false && migratedState.columns) {
        const order = Array.isArray(migratedState.columns.order) ? migratedState.columns.order : []
        if (order.length > 0) {
          columnModel.setColumnOrder(order)
        }
        for (const [key, value] of Object.entries(migratedState.columns.visibility ?? {})) {
          columnModel.setColumnVisibility(key, Boolean(value))
        }
        for (const [key, value] of Object.entries(migratedState.columns.widths ?? {})) {
          const width = Number.isFinite(value) ? Math.max(0, Math.trunc(value as number)) : null
          columnModel.setColumnWidth(key, width)
        }
        for (const [key, value] of Object.entries(migratedState.columns.pins ?? {})) {
          const pin = normalizePin(value)
          if (!pin) {
            continue
          }
          columnModel.setColumnPin(key, pin)
        }
      }

      if (options.applySelection !== false) {
        const selectionCapability = getSelectionCapability()
        if (selectionCapability) {
          if (migratedState.selection) {
            selectionCapability.setSelectionSnapshot(cloneSerializable(migratedState.selection))
            onSelectionChanged?.(selectionCapability.getSelectionSnapshot())
          } else {
            selectionCapability.clearSelection()
            onSelectionChanged?.(selectionCapability.getSelectionSnapshot())
          }
        } else if (options.strict && migratedState.selection) {
          throw new Error("[DataGridApi] Cannot restore selection state without selection capability.")
        }
      }

      if (options.strict && migratedState.transaction) {
        throw new Error("[DataGridApi] Transaction state restore is not supported by current facade.")
      }

      onStateImported?.(cloneSerializable(migratedState))
    },
  }
}
