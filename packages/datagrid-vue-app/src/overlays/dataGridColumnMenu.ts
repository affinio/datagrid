export const DATAGRID_COLUMN_MENU_ITEM_KEYS = ["sort", "group", "pin", "filter"] as const

export type DataGridColumnMenuItemKey = (typeof DATAGRID_COLUMN_MENU_ITEM_KEYS)[number]

export type DataGridColumnMenuItemLabels = Readonly<Partial<Record<DataGridColumnMenuItemKey, string>>>
export type DataGridColumnMenuDisabledReasons = Readonly<Partial<Record<DataGridColumnMenuItemKey, string>>>

export const DATAGRID_COLUMN_MENU_ACTION_KEYS = [
  "sortAsc",
  "sortDesc",
  "clearSort",
  "toggleGroup",
  "pinMenu",
  "pinLeft",
  "pinRight",
  "unpin",
  "clearFilter",
  "addCurrentSelectionToFilter",
  "selectAllValues",
  "clearAllValues",
  "applyFilter",
  "cancelFilter",
] as const

export type DataGridColumnMenuActionKey = (typeof DATAGRID_COLUMN_MENU_ACTION_KEYS)[number]

export interface DataGridColumnMenuActionOption {
  hidden?: boolean
  disabled?: boolean
  disabledReason?: string
  label?: string
}

export type DataGridColumnMenuActionOptions = Readonly<
  Partial<Record<DataGridColumnMenuActionKey, DataGridColumnMenuActionOption>>
>

export interface DataGridColumnMenuColumnOptions {
  items?: readonly DataGridColumnMenuItemKey[]
  hide?: readonly DataGridColumnMenuItemKey[]
  disabled?: readonly DataGridColumnMenuItemKey[]
  disabledReasons?: DataGridColumnMenuDisabledReasons
  labels?: DataGridColumnMenuItemLabels
  actions?: DataGridColumnMenuActionOptions
}

export interface DataGridColumnMenuOptions {
  enabled: boolean
  maxFilterValues: number
  items: readonly DataGridColumnMenuItemKey[]
  disabled: readonly DataGridColumnMenuItemKey[]
  disabledReasons: DataGridColumnMenuDisabledReasons
  labels: DataGridColumnMenuItemLabels
  actions: DataGridColumnMenuActionOptions
  columns: Readonly<Record<string, DataGridColumnMenuColumnOptions>>
}

export type DataGridColumnMenuProp =
  | boolean
  | {
      enabled?: boolean
      maxFilterValues?: number
      items?: readonly DataGridColumnMenuItemKey[]
      disabled?: readonly DataGridColumnMenuItemKey[]
      disabledReasons?: DataGridColumnMenuDisabledReasons
      labels?: DataGridColumnMenuItemLabels
      actions?: DataGridColumnMenuActionOptions
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

function normalizeDisabledReasons(input: DataGridColumnMenuDisabledReasons | undefined): DataGridColumnMenuDisabledReasons {
  if (!input) {
    return Object.freeze({})
  }
  const entries = Object.entries(input)
    .filter(([key, value]) => DATAGRID_COLUMN_MENU_ITEM_KEYS.includes(key as DataGridColumnMenuItemKey) && typeof value === "string")
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
  return Object.freeze(Object.fromEntries(entries))
}

function normalizeActionOptions(input: DataGridColumnMenuActionOptions | undefined): DataGridColumnMenuActionOptions {
  if (!input) {
    return Object.freeze({})
  }
  const entries = Object.entries(input)
    .filter(([key, value]) => DATAGRID_COLUMN_MENU_ACTION_KEYS.includes(key as DataGridColumnMenuActionKey) && Boolean(value))
    .map(([key, value]) => {
      const option = value as DataGridColumnMenuActionOption
      const normalized = {
        ...(option.hidden === true ? { hidden: true } : {}),
        ...(option.disabled === true ? { disabled: true } : {}),
        ...(typeof option.disabledReason === "string" && option.disabledReason.trim().length > 0
          ? { disabledReason: option.disabledReason.trim() }
          : {}),
        ...(typeof option.label === "string" && option.label.trim().length > 0
          ? { label: option.label.trim() }
          : {}),
      } satisfies DataGridColumnMenuActionOption
      return [key, Object.freeze(normalized)] as const
    })
    .filter(([, value]) => Object.keys(value).length > 0)
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
      const disabledReasons = normalizeDisabledReasons(value?.disabledReasons)
      const labels = normalizeLabels(value?.labels)
      const actions = normalizeActionOptions(value?.actions)
      return [
        key,
        {
          ...(items ? { items } : {}),
          ...(hide.length > 0 ? { hide } : {}),
          ...(disabled.length > 0 ? { disabled } : {}),
          ...(Object.keys(disabledReasons).length > 0 ? { disabledReasons } : {}),
          ...(Object.keys(labels).length > 0 ? { labels } : {}),
          ...(Object.keys(actions).length > 0 ? { actions } : {}),
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
      disabledReasons: Object.freeze({}),
      labels: Object.freeze({}),
      actions: Object.freeze({}),
      columns: {},
    }
  }
  if (!input) {
    return {
      enabled: false,
      maxFilterValues: DEFAULT_MAX_FILTER_VALUES,
      items: [...DATAGRID_COLUMN_MENU_ITEM_KEYS],
      disabled: [],
      disabledReasons: Object.freeze({}),
      labels: Object.freeze({}),
      actions: Object.freeze({}),
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
    disabledReasons: normalizeDisabledReasons(input.disabledReasons),
    labels: normalizeLabels(input.labels),
    actions: normalizeActionOptions(input.actions),
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

export function resolveDataGridColumnMenuDisabledReasons(
  options: DataGridColumnMenuOptions,
  columnKey: string,
): DataGridColumnMenuDisabledReasons {
  return Object.freeze({
    ...options.disabledReasons,
    ...(options.columns[columnKey]?.disabledReasons ?? {}),
  })
}

export function resolveDataGridColumnMenuActionOptions(
  options: DataGridColumnMenuOptions,
  columnKey: string,
): DataGridColumnMenuActionOptions {
  const columnActions = options.columns[columnKey]?.actions ?? {}
  const entries = DATAGRID_COLUMN_MENU_ACTION_KEYS
    .map(actionKey => {
      const merged = {
        ...(options.actions[actionKey] ?? {}),
        ...(columnActions[actionKey] ?? {}),
      } satisfies DataGridColumnMenuActionOption
      return [actionKey, Object.freeze(merged)] as const
    })
    .filter(([, value]) => Object.keys(value).length > 0)
  return Object.freeze(Object.fromEntries(entries))
}
