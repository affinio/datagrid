import type { DataGridMigrateStateOptions, DataGridUnifiedState } from "@affino/datagrid-vue"
import type { DataGridAppViewMode } from "../gantt/dataGridGantt.types"

export interface DataGridSavedViewSnapshot<TRow extends Record<string, unknown> = Record<string, unknown>> {
  state: DataGridUnifiedState<TRow>
  viewMode?: DataGridAppViewMode
}

export interface DataGridSavedViewStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

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
  return {
    ...savedView,
    state: sanitizeDataGridSavedViewState(savedView.state),
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

  return sanitizeDataGridSavedView({
    state: migratedState,
    ...(viewMode ? { viewMode } : {}),
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