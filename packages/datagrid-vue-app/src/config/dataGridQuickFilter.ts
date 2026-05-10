import type { DataGridQuickFilterMode } from "@affino/datagrid-vue"

export interface DataGridQuickFilterOptions {
  placeholder?: string
  columns?: readonly string[]
  mode?: DataGridQuickFilterMode
  applyMode?: DataGridQuickFilterApplyMode
  debounceMs?: number
}

export type DataGridQuickFilterProp =
  | boolean
  | DataGridQuickFilterOptions
  | null

export type DataGridQuickFilterApplyMode = "input" | "debounce" | "manual"

export interface DataGridResolvedQuickFilterOptions {
  enabled: boolean
  placeholder: string
  columns: readonly string[] | null
  mode: DataGridQuickFilterMode
  applyMode: DataGridQuickFilterApplyMode
  debounceMs: number
}

const DEFAULT_PLACEHOLDER = "Search rows"
const DEFAULT_MODE: DataGridQuickFilterMode = "contains"
const DEFAULT_APPLY_MODE: DataGridQuickFilterApplyMode = "input"
const DEFAULT_DEBOUNCE_MS = 300

function resolvePlaceholder(value: string | undefined): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_PLACEHOLDER
}

function resolveMode(value: DataGridQuickFilterMode | undefined): DataGridQuickFilterMode {
  return value === "tokens" ? "tokens" : DEFAULT_MODE
}

function resolveApplyMode(value: DataGridQuickFilterApplyMode | undefined): DataGridQuickFilterApplyMode {
  return value === "debounce" || value === "manual" ? value : DEFAULT_APPLY_MODE
}

function resolveDebounceMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DEBOUNCE_MS
  }
  return Math.max(0, Math.trunc(value))
}

function resolveColumns(value: readonly string[] | undefined): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const columns = value
    .map(column => column.trim())
    .filter((column, index, allColumns) => column.length > 0 && allColumns.indexOf(column) === index)
  return columns.length > 0 ? Object.freeze(columns) : null
}

export function resolveDataGridQuickFilter(
  input: DataGridQuickFilterProp | undefined,
): DataGridResolvedQuickFilterOptions {
  if (typeof input === "boolean") {
    return Object.freeze({
      enabled: input,
      placeholder: DEFAULT_PLACEHOLDER,
      columns: null,
      mode: DEFAULT_MODE,
      applyMode: DEFAULT_APPLY_MODE,
      debounceMs: DEFAULT_DEBOUNCE_MS,
    })
  }
  if (!input) {
    return Object.freeze({
      enabled: false,
      placeholder: DEFAULT_PLACEHOLDER,
      columns: null,
      mode: DEFAULT_MODE,
      applyMode: DEFAULT_APPLY_MODE,
      debounceMs: DEFAULT_DEBOUNCE_MS,
    })
  }
  return Object.freeze({
    enabled: true,
    placeholder: resolvePlaceholder(input.placeholder),
    columns: resolveColumns(input.columns),
    mode: resolveMode(input.mode),
    applyMode: resolveApplyMode(input.applyMode),
    debounceMs: resolveDebounceMs(input.debounceMs),
  })
}
