export const DATAGRID_COLUMN_MENU_ITEM_KEYS = ["sort", "group", "pin", "filter"] as const

export type DataGridColumnMenuItemKey = (typeof DATAGRID_COLUMN_MENU_ITEM_KEYS)[number]

export type DataGridColumnMenuItemLabels = Readonly<Partial<Record<DataGridColumnMenuItemKey, string>>>

export interface DataGridColumnMenuColumnOptions {
  items?: readonly DataGridColumnMenuItemKey[]
  hide?: readonly DataGridColumnMenuItemKey[]
  disabled?: readonly DataGridColumnMenuItemKey[]
  labels?: DataGridColumnMenuItemLabels
}

export interface DataGridColumnMenuOptions {
  enabled: boolean
  maxFilterValues: number
  items: readonly DataGridColumnMenuItemKey[]
  disabled: readonly DataGridColumnMenuItemKey[]
  labels: DataGridColumnMenuItemLabels
  columns: Readonly<Record<string, DataGridColumnMenuColumnOptions>>
}

export type DataGridColumnMenuProp =
  | boolean
  | {
      enabled?: boolean
      maxFilterValues?: number
      items?: readonly DataGridColumnMenuItemKey[]
      disabled?: readonly DataGridColumnMenuItemKey[]
      labels?: DataGridColumnMenuItemLabels
      columns?: Readonly<Record<string, DataGridColumnMenuColumnOptions>>
    }
  | null

const DEFAULT_MAX_FILTER_VALUES = 120

function normalizeItems(input: readonly DataGridColumnMenuItemKey[] | undefined): readonly DataGridColumnMenuItemKey[] {
  const allowed = new Set<string>(DATAGRID_COLUMN_MENU_ITEM_KEYS)
  const source = Array.isArray(input) ? input : DATAGRID_COLUMN_MENU_ITEM_KEYS
  const normalized: DataGridColumnMenuItemKey[] = []
  for (const item of source) {
    if (!allowed.has(item) || normalized.includes(item)) {
      continue
    }
    normalized.push(item)
  }
  return normalized.length > 0 ? normalized : [...DATAGRID_COLUMN_MENU_ITEM_KEYS]
}

function normalizeItemSubset(
  input: readonly DataGridColumnMenuItemKey[] | undefined,
): readonly DataGridColumnMenuItemKey[] {
  if (!Array.isArray(input)) {
    return []
  }
  const allowed = new Set<string>(DATAGRID_COLUMN_MENU_ITEM_KEYS)
  const normalized: DataGridColumnMenuItemKey[] = []
  for (const item of input) {
    if (!allowed.has(item) || normalized.includes(item)) {
      continue
    }
    normalized.push(item)
  }
  return normalized
}

function normalizeLabels(input: DataGridColumnMenuItemLabels | undefined): DataGridColumnMenuItemLabels {
  if (!input) {
    return Object.freeze({})
  }
  const entries = Object.entries(input)
    .filter(([key, value]) => DATAGRID_COLUMN_MENU_ITEM_KEYS.includes(key as DataGridColumnMenuItemKey) && typeof value === "string")
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
  return Object.freeze(Object.fromEntries(entries))
}

function normalizeColumns(
  input: Readonly<Record<string, DataGridColumnMenuColumnOptions>> | undefined,
): Readonly<Record<string, DataGridColumnMenuColumnOptions>> {
  if (!input) {
    return {}
  }
  const normalizedEntries = Object.entries(input)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, value]) => {
      const items = value?.items ? normalizeItems(value.items) : undefined
      const hide = normalizeItemSubset(value?.hide)
      const disabled = normalizeItemSubset(value?.disabled)
      const labels = normalizeLabels(value?.labels)
      return [
        key,
        {
          ...(items ? { items } : {}),
          ...(hide.length > 0 ? { hide } : {}),
          ...(disabled.length > 0 ? { disabled } : {}),
          ...(Object.keys(labels).length > 0 ? { labels } : {}),
        } satisfies DataGridColumnMenuColumnOptions,
      ] as const
    })
  return Object.fromEntries(normalizedEntries)
}

export function resolveDataGridColumnMenu(
  input: DataGridColumnMenuProp | undefined,
): DataGridColumnMenuOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      maxFilterValues: DEFAULT_MAX_FILTER_VALUES,
      items: [...DATAGRID_COLUMN_MENU_ITEM_KEYS],
      disabled: [],
      labels: Object.freeze({}),
      columns: {},
    }
  }
  if (!input) {
    return {
      enabled: false,
      maxFilterValues: DEFAULT_MAX_FILTER_VALUES,
      items: [...DATAGRID_COLUMN_MENU_ITEM_KEYS],
      disabled: [],
      labels: Object.freeze({}),
      columns: {},
    }
  }
  return {
    enabled: input.enabled ?? true,
    maxFilterValues: Number.isFinite(input.maxFilterValues)
      ? Math.max(20, Math.trunc(input.maxFilterValues as number))
      : DEFAULT_MAX_FILTER_VALUES,
    items: normalizeItems(input.items),
    disabled: normalizeItemSubset(input.disabled),
    labels: normalizeLabels(input.labels),
    columns: normalizeColumns(input.columns),
  }
}

export function resolveDataGridColumnMenuItems(
  options: DataGridColumnMenuOptions,
  columnKey: string,
): readonly DataGridColumnMenuItemKey[] {
  const columnOptions = options.columns[columnKey]
  const baseItems = columnOptions?.items ? normalizeItems(columnOptions.items) : options.items
  const hidden = new Set(columnOptions?.hide ?? [])
  const filtered = baseItems.filter(item => !hidden.has(item))
  return filtered.length > 0 ? filtered : []
}

export function resolveDataGridColumnMenuDisabledItems(
  options: DataGridColumnMenuOptions,
  columnKey: string,
): readonly DataGridColumnMenuItemKey[] {
  const visibleItems = resolveDataGridColumnMenuItems(options, columnKey)
  const columnDisabled = new Set(options.columns[columnKey]?.disabled ?? [])
  const globallyDisabled = new Set(options.disabled)
  return visibleItems.filter(item => globallyDisabled.has(item) || columnDisabled.has(item))
}

export function resolveDataGridColumnMenuLabels(
  options: DataGridColumnMenuOptions,
  columnKey: string,
): DataGridColumnMenuItemLabels {
  return Object.freeze({
    ...options.labels,
    ...(options.columns[columnKey]?.labels ?? {}),
  })
}
