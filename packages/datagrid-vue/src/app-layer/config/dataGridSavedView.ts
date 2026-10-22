import type { DataGridMigrateStateOptions, DataGridSetStateOptions, DataGridUnifiedState } from "@affino/datagrid-vue/headless"
import type { DataGridAppViewMode } from "./dataGridAppView"

export interface DataGridSavedViewSnapshot<TRow extends Record<string, unknown> = Record<string, unknown>> {
  state: DataGridUnifiedState<TRow>
  viewMode?: DataGridAppViewMode
  /** Present on newly captured views. Missing means a legacy view that restores all state. */
  included?: readonly DataGridSavedViewPart[]
}

export type DataGridSavedViewPart =
  | "columns"
  | "sorting"
  | "filters"
  | "grouping"
  | "pagination"
  | "pivot"
  | "aggregation"
  | "selection"
  | "viewportPosition"
  | "viewMode"

export interface DataGridCaptureSavedViewOptions {
  /** Defaults to the standard presentation parts; selection and viewport are opt-in. */
  include?: readonly DataGridSavedViewPart[]
}

export interface DataGridApplySavedViewOptions extends DataGridSetStateOptions {
  /** Active editor or pointer interaction blocks restore by default. */
  interaction?: "reject" | "cancel"
}

export interface DataGridSavedViewInteractionController {
  isActive: () => boolean
  cancel: () => boolean
}

export interface DataGridSavedViewStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const SAVED_VIEW_PARTS = new Set<DataGridSavedViewPart>([
  "columns",
  "sorting",
  "filters",
  "grouping",
  "pagination",
  "pivot",
  "aggregation",
  "selection",
  "viewportPosition",
  "viewMode",
])

export function sanitizeDataGridSavedViewState<TRow extends Record<string, unknown> = Record<string, unknown>>(
  state: DataGridUnifiedState<TRow>,
): DataGridUnifiedState<TRow> {
  return {
    ...state,
    transaction: null,
  }
}

export function sanitizeDataGridSavedView<TRow extends Record<string, unknown> = Record<string, unknown>>(
  savedView: DataGridSavedViewSnapshot<TRow>,
): DataGridSavedViewSnapshot<TRow> {
  const included = savedView.included ? new Set(savedView.included) : null
  const state = sanitizeDataGridSavedViewState(savedView.state)
  const sanitizedState = included
    ? {
        ...state,
        rows: {
          ...state.rows,
          snapshot: {
            ...state.rows.snapshot,
            revision: undefined,
            datasetVersion: null,
            rowCount: 0,
            loading: false,
            initialLoading: false,
            refreshing: false,
            warming: false,
            error: null,
            treeDataDiagnostics: null,
            projection: null,
            viewportRange: { start: 0, end: 0 },
            sortModel: included.has("sorting") ? state.rows.snapshot.sortModel : [],
            filterModel: included.has("filters") ? state.rows.snapshot.filterModel : null,
            groupBy: included.has("grouping") ? state.rows.snapshot.groupBy : null,
            groupExpansion: included.has("grouping")
              ? state.rows.snapshot.groupExpansion
              : { expandedByDefault: true, toggledGroupKeys: [] },
            pagination: included.has("pagination")
              ? state.rows.snapshot.pagination
              : {
                  enabled: false,
                  pageSize: 25,
                  currentPage: 0,
                  pageCount: 0,
                  totalRowCount: 0,
                  startIndex: 0,
                  endIndex: 0,
                },
            pivotModel: included.has("pivot") ? state.rows.snapshot.pivotModel : null,
            pivotColumns: included.has("pivot") ? state.rows.snapshot.pivotColumns : [],
          },
          aggregationModel: included.has("aggregation") ? state.rows.aggregationModel : null,
        },
        columns: included.has("columns")
          ? state.columns
          : { order: [], zoneOrder: {}, visibility: {}, widths: {}, pins: {} },
        selection: included.has("selection") ? state.selection : null,
        rowSelection: included.has("selection") ? state.rowSelection : null,
        view: included.has("viewportPosition") ? state.view : { viewportPosition: null },
      }
    : state
  return {
    ...savedView,
    state: sanitizedState,
    ...(savedView.included ? { included: [...new Set(savedView.included)] } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function migrateDataGridSavedView<TRow extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
  migrateState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<TRow> | null,
  options?: DataGridMigrateStateOptions,
): DataGridSavedViewSnapshot<TRow> | null {
  const record = isRecord(value) ? value : null
  const migratedState = migrateState(record && "state" in record ? record.state : value, options)
  if (!migratedState) {
    return null
  }

  const rawViewMode = record?.viewMode
  const viewMode = rawViewMode === "gantt"
    ? "gantt"
    : rawViewMode === "table"
      ? "table"
      : undefined

  let included: readonly DataGridSavedViewPart[] | undefined
  if (record && "included" in record) {
    if (!Array.isArray(record.included)
      || record.included.some((part): boolean => typeof part !== "string" || !SAVED_VIEW_PARTS.has(part as DataGridSavedViewPart))) {
      return null
    }
    included = [...new Set(record.included as DataGridSavedViewPart[])]
  }

  return sanitizeDataGridSavedView({
    state: migratedState,
    ...(viewMode ? { viewMode } : {}),
    ...(included ? { included } : {}),
  })
}

export function serializeDataGridSavedView<TRow extends Record<string, unknown> = Record<string, unknown>>(
  savedView: DataGridSavedViewSnapshot<TRow>,
): string {
  return JSON.stringify(sanitizeDataGridSavedView(savedView))
}

export function parseDataGridSavedView<TRow extends Record<string, unknown> = Record<string, unknown>>(
  value: string,
  migrateState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<TRow> | null,
  options?: DataGridMigrateStateOptions,
): DataGridSavedViewSnapshot<TRow> | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null
  }

  try {
    return migrateDataGridSavedView(JSON.parse(value), migrateState, options)
  } catch {
    return null
  }
}

export function writeDataGridSavedViewToStorage<TRow extends Record<string, unknown> = Record<string, unknown>>(
  storage: DataGridSavedViewStorageLike | null | undefined,
  key: string,
  savedView: DataGridSavedViewSnapshot<TRow>,
): boolean {
  if (!storage || typeof key !== "string" || key.trim().length === 0) {
    return false
  }

  try {
    storage.setItem(key, serializeDataGridSavedView(savedView))
    return true
  } catch {
    return false
  }
}

export function readDataGridSavedViewFromStorage<TRow extends Record<string, unknown> = Record<string, unknown>>(
  storage: DataGridSavedViewStorageLike | null | undefined,
  key: string,
  migrateState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<TRow> | null,
  options?: DataGridMigrateStateOptions,
): DataGridSavedViewSnapshot<TRow> | null {
  if (!storage || typeof key !== "string" || key.trim().length === 0) {
    return null
  }

  try {
    const rawValue = storage.getItem(key)
    if (!rawValue) {
      return null
    }
    return parseDataGridSavedView(rawValue, migrateState, options)
  } catch {
    return null
  }
}

export function clearDataGridSavedViewInStorage(
  storage: DataGridSavedViewStorageLike | null | undefined,
  key: string,
): boolean {
  if (!storage || typeof key !== "string" || key.trim().length === 0) {
    return false
  }

  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}
