export const DATAGRID_COLUMN_MENU_ITEM_KEYS = ["sort", "group", "pin", "filter"] as const

export type DataGridColumnMenuItemKey = (typeof DATAGRID_COLUMN_MENU_ITEM_KEYS)[number]

export const DATAGRID_COLUMN_MENU_TRIGGER_MODES = ["button", "contextmenu", "button+contextmenu"] as const

export type DataGridColumnMenuTriggerMode = (typeof DATAGRID_COLUMN_MENU_TRIGGER_MODES)[number]
export type DataGridColumnMenuCustomItemPlacement =
  | "start"
  | "end"
  | `before:${DataGridColumnMenuItemKey}`
  | `after:${DataGridColumnMenuItemKey}`

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

export interface DataGridColumnMenuCustomItemContext {
  columnKey: string
  columnLabel: string
  closeMenu: () => void
}

interface DataGridColumnMenuCustomItemBase {
  key: string
  label: string
  placement?: DataGridColumnMenuCustomItemPlacement
  hidden?: boolean
  disabled?: boolean
  disabledReason?: string
}

export interface DataGridColumnMenuCustomLeafItem extends DataGridColumnMenuCustomItemBase {
  kind?: "item"
  onSelect?: (context: DataGridColumnMenuCustomItemContext) => void | Promise<void>
}

export interface DataGridColumnMenuCustomSubmenuItem extends DataGridColumnMenuCustomItemBase {
  kind: "submenu"
  items: readonly DataGridColumnMenuCustomItem[]
}

export type DataGridColumnMenuCustomItem =
  | DataGridColumnMenuCustomLeafItem
  | DataGridColumnMenuCustomSubmenuItem

export interface DataGridColumnMenuColumnOptions {
  items?: readonly DataGridColumnMenuItemKey[]
  hide?: readonly DataGridColumnMenuItemKey[]
  disabled?: readonly DataGridColumnMenuItemKey[]
  disabledReasons?: DataGridColumnMenuDisabledReasons
  labels?: DataGridColumnMenuItemLabels
  actions?: DataGridColumnMenuActionOptions
  customItems?: readonly DataGridColumnMenuCustomItem[]
}

export interface DataGridColumnMenuOptions {
  enabled: boolean
  trigger: DataGridColumnMenuTriggerMode
  maxFilterValues: number
  items: readonly DataGridColumnMenuItemKey[]
  disabled: readonly DataGridColumnMenuItemKey[]
  disabledReasons: DataGridColumnMenuDisabledReasons
  labels: DataGridColumnMenuItemLabels
  actions: DataGridColumnMenuActionOptions
  customItems: readonly DataGridColumnMenuCustomItem[]
  columns: Readonly<Record<string, DataGridColumnMenuColumnOptions>>
}

export type DataGridColumnMenuProp =
  | boolean
  | {
      enabled?: boolean
      trigger?: DataGridColumnMenuTriggerMode
      maxFilterValues?: number
      items?: readonly DataGridColumnMenuItemKey[]
      disabled?: readonly DataGridColumnMenuItemKey[]
      disabledReasons?: DataGridColumnMenuDisabledReasons
      labels?: DataGridColumnMenuItemLabels
      actions?: DataGridColumnMenuActionOptions
      customItems?: readonly DataGridColumnMenuCustomItem[]
      columns?: Readonly<Record<string, DataGridColumnMenuColumnOptions>>
    }
  | null

const DEFAULT_MAX_FILTER_VALUES = 120
const DEFAULT_TRIGGER_MODE: DataGridColumnMenuTriggerMode = "button+contextmenu"

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

function normalizeTriggerMode(
  input: DataGridColumnMenuTriggerMode | undefined,
): DataGridColumnMenuTriggerMode {
  return DATAGRID_COLUMN_MENU_TRIGGER_MODES.includes(input as DataGridColumnMenuTriggerMode)
    ? (input as DataGridColumnMenuTriggerMode)
    : DEFAULT_TRIGGER_MODE
}

function isCustomItemPlacement(
  value: string,
): value is DataGridColumnMenuCustomItemPlacement {
  if (value === "start" || value === "end") {
    return true
  }
  if (!value.includes(":")) {
    return false
  }
  const [position, itemKey] = value.split(":")
  return (position === "before" || position === "after")
    && DATAGRID_COLUMN_MENU_ITEM_KEYS.includes(itemKey as DataGridColumnMenuItemKey)
}

function normalizeCustomItems(
  input: readonly DataGridColumnMenuCustomItem[] | undefined,
): readonly DataGridColumnMenuCustomItem[] {
  if (!Array.isArray(input)) {
    return Object.freeze([])
  }
  const normalized: DataGridColumnMenuCustomItem[] = []
  const seenKeys = new Set<string>()
  for (const item of input) {
    const key = typeof item?.key === "string" ? item.key.trim() : ""
    const label = typeof item?.label === "string" ? item.label.trim() : ""
    if (key.length === 0 || label.length === 0 || seenKeys.has(key)) {
      continue
    }
    seenKeys.add(key)
    const placement = typeof item.placement === "string" && isCustomItemPlacement(item.placement)
      ? item.placement
      : undefined
    const baseItem = {
      key,
      label,
      ...(placement ? { placement } : {}),
      ...(item.hidden === true ? { hidden: true } : {}),
      ...(item.disabled === true ? { disabled: true } : {}),
      ...(typeof item.disabledReason === "string" && item.disabledReason.trim().length > 0
        ? { disabledReason: item.disabledReason.trim() }
        : {}),
    } satisfies DataGridColumnMenuCustomItemBase
    if (item.kind === "submenu") {
      const items = normalizeCustomItems(item.items)
      if (items.length === 0) {
        continue
      }
      normalized.push(Object.freeze({
        ...baseItem,
        kind: "submenu",
        items,
      } satisfies DataGridColumnMenuCustomSubmenuItem))
      continue
    }
    normalized.push(Object.freeze({
      ...baseItem,
      ...(typeof item.onSelect === "function" ? { onSelect: item.onSelect } : {}),
    } satisfies DataGridColumnMenuCustomLeafItem))
  }
  return Object.freeze(normalized)
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
      const customItems = normalizeCustomItems(value?.customItems)
      return [
        key,
        {
          ...(items ? { items } : {}),
          ...(hide.length > 0 ? { hide } : {}),
          ...(disabled.length > 0 ? { disabled } : {}),
          ...(Object.keys(disabledReasons).length > 0 ? { disabledReasons } : {}),
          ...(Object.keys(labels).length > 0 ? { labels } : {}),
          ...(Object.keys(actions).length > 0 ? { actions } : {}),
          ...(customItems.length > 0 ? { customItems } : {}),
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
      trigger: DEFAULT_TRIGGER_MODE,
      maxFilterValues: DEFAULT_MAX_FILTER_VALUES,
      items: [...DATAGRID_COLUMN_MENU_ITEM_KEYS],
      disabled: [],
      disabledReasons: Object.freeze({}),
      labels: Object.freeze({}),
      actions: Object.freeze({}),
      customItems: Object.freeze([]),
      columns: {},
    }
  }
  if (!input) {
    return {
      enabled: false,
      trigger: DEFAULT_TRIGGER_MODE,
      maxFilterValues: DEFAULT_MAX_FILTER_VALUES,
      items: [...DATAGRID_COLUMN_MENU_ITEM_KEYS],
      disabled: [],
      disabledReasons: Object.freeze({}),
      labels: Object.freeze({}),
      actions: Object.freeze({}),
      customItems: Object.freeze([]),
      columns: {},
    }
  }
  return {
    enabled: input.enabled ?? true,
    trigger: normalizeTriggerMode(input.trigger),
    maxFilterValues: Number.isFinite(input.maxFilterValues)
      ? Math.max(20, Math.trunc(input.maxFilterValues as number))
      : DEFAULT_MAX_FILTER_VALUES,
    items: normalizeItems(input.items),
    disabled: normalizeItemSubset(input.disabled),
    disabledReasons: normalizeDisabledReasons(input.disabledReasons),
    labels: normalizeLabels(input.labels),
    actions: normalizeActionOptions(input.actions),
    customItems: normalizeCustomItems(input.customItems),
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

export function resolveDataGridColumnMenuCustomItems(
  options: DataGridColumnMenuOptions,
  columnKey: string,
): readonly DataGridColumnMenuCustomItem[] {
  const merged = new Map<string, DataGridColumnMenuCustomItem>()
  for (const item of options.customItems) {
    merged.set(item.key, item)
  }
  for (const item of options.columns[columnKey]?.customItems ?? []) {
    merged.set(item.key, item)
  }
  return Object.freeze(Array.from(merged.values()))
}
