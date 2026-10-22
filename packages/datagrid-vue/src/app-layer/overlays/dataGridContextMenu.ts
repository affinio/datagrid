export const DATAGRID_CELL_MENU_ITEM_KEYS = ["clipboard", "pasteSpecial", "edit"] as const

export type DataGridCellMenuItemKey = (typeof DATAGRID_CELL_MENU_ITEM_KEYS)[number]
export type DataGridCellMenuCustomItemPlacement =
  | "start"
  | "end"
  | `before:${DataGridCellMenuItemKey}`
  | `after:${DataGridCellMenuItemKey}`

export type DataGridCellMenuItemLabels = Readonly<Partial<Record<DataGridCellMenuItemKey, string>>>
export type DataGridCellMenuDisabledReasons = Readonly<Partial<Record<DataGridCellMenuItemKey, string>>>

export const DATAGRID_CELL_MENU_ACTION_KEYS = ["cut", "copy", "paste", "pasteValues", "clear"] as const

export type DataGridCellMenuActionKey = (typeof DATAGRID_CELL_MENU_ACTION_KEYS)[number]

export interface DataGridCellMenuActionOption {
  hidden?: boolean
  disabled?: boolean
  disabledReason?: string
  label?: string
}

export type DataGridCellMenuActionOptions = Readonly<
  Partial<Record<DataGridCellMenuActionKey, DataGridCellMenuActionOption>>
>

export interface DataGridCellMenuCustomItemContext {
  zone: "cell" | "range"
  columnKey: string
  rowId: string | null
  closeMenu: () => void
}

interface DataGridCellMenuCustomItemBase {
  key: string
  label: string
  placement?: DataGridCellMenuCustomItemPlacement
  hidden?: boolean
  disabled?: boolean
  disabledReason?: string
}

export interface DataGridCellMenuCustomLeafItem extends DataGridCellMenuCustomItemBase {
  kind?: "item"
  onSelect?: (context: DataGridCellMenuCustomItemContext) => void | Promise<void>
}

export interface DataGridCellMenuCustomSubmenuItem extends DataGridCellMenuCustomItemBase {
  kind: "submenu"
  items: readonly DataGridCellMenuCustomItem[]
}

export type DataGridCellMenuCustomItem =
  | DataGridCellMenuCustomLeafItem
  | DataGridCellMenuCustomSubmenuItem

export interface DataGridCellMenuColumnOptions {
  items?: readonly DataGridCellMenuItemKey[]
  hide?: readonly DataGridCellMenuItemKey[]
  disabled?: readonly DataGridCellMenuItemKey[]
  disabledReasons?: DataGridCellMenuDisabledReasons
  labels?: DataGridCellMenuItemLabels
  actions?: DataGridCellMenuActionOptions
  customItems?: readonly DataGridCellMenuCustomItem[]
}

export interface DataGridCellMenuOptions {
  enabled: boolean
  items: readonly DataGridCellMenuItemKey[]
  disabled: readonly DataGridCellMenuItemKey[]
  disabledReasons: DataGridCellMenuDisabledReasons
  labels: DataGridCellMenuItemLabels
  actions: DataGridCellMenuActionOptions
  customItems: readonly DataGridCellMenuCustomItem[]
  columns: Readonly<Record<string, DataGridCellMenuColumnOptions>>
}

export type DataGridCellMenuProp =
  | boolean
  | {
      enabled?: boolean
      items?: readonly DataGridCellMenuItemKey[]
      disabled?: readonly DataGridCellMenuItemKey[]
      disabledReasons?: DataGridCellMenuDisabledReasons
      labels?: DataGridCellMenuItemLabels
      actions?: DataGridCellMenuActionOptions
      customItems?: readonly DataGridCellMenuCustomItem[]
      columns?: Readonly<Record<string, DataGridCellMenuColumnOptions>>
    }
  | null

export const DATAGRID_ROW_INDEX_MENU_ITEM_KEYS = ["insert", "clipboard", "selection"] as const

export type DataGridRowIndexMenuItemKey = (typeof DATAGRID_ROW_INDEX_MENU_ITEM_KEYS)[number]

export type DataGridRowIndexMenuItemLabels = Readonly<Partial<Record<DataGridRowIndexMenuItemKey, string>>>
export type DataGridRowIndexMenuDisabledReasons = Readonly<Partial<Record<DataGridRowIndexMenuItemKey, string>>>

export const DATAGRID_ROW_INDEX_MENU_ACTION_KEYS = [
  "insertAbove",
  "insertBelow",
  "cut",
  "copy",
  "paste",
  "deleteSelected",
] as const

export type DataGridRowIndexMenuActionKey = (typeof DATAGRID_ROW_INDEX_MENU_ACTION_KEYS)[number]

export interface DataGridRowIndexMenuActionOption {
  hidden?: boolean
  disabled?: boolean
  disabledReason?: string
  label?: string
}

export type DataGridRowIndexMenuActionOptions = Readonly<
  Partial<Record<DataGridRowIndexMenuActionKey, DataGridRowIndexMenuActionOption>>
>

export interface DataGridRowIndexMenuOptions {
  enabled: boolean
  items: readonly DataGridRowIndexMenuItemKey[]
  disabled: readonly DataGridRowIndexMenuItemKey[]
  disabledReasons: DataGridRowIndexMenuDisabledReasons
  labels: DataGridRowIndexMenuItemLabels
  actions: DataGridRowIndexMenuActionOptions
}

export type DataGridRowIndexMenuProp =
  | boolean
  | {
      enabled?: boolean
      items?: readonly DataGridRowIndexMenuItemKey[]
      disabled?: readonly DataGridRowIndexMenuItemKey[]
      disabledReasons?: DataGridRowIndexMenuDisabledReasons
      labels?: DataGridRowIndexMenuItemLabels
      actions?: DataGridRowIndexMenuActionOptions
    }
  | null

function normalizeItems<TItem extends string>(
  input: readonly TItem[] | undefined,
  allowedKeys: readonly TItem[],
): readonly TItem[] {
  const allowed = new Set<string>(allowedKeys)
  const source = Array.isArray(input) ? input : allowedKeys
  const normalized: TItem[] = []
  for (const item of source) {
    if (!allowed.has(item) || normalized.includes(item)) {
      continue
    }
    normalized.push(item)
  }
  return normalized.length > 0 ? normalized : [...allowedKeys]
}

function normalizeItemSubset<TItem extends string>(
  input: readonly TItem[] | undefined,
  allowedKeys: readonly TItem[],
): readonly TItem[] {
  if (!Array.isArray(input)) {
    return []
  }
  const allowed = new Set<string>(allowedKeys)
  const normalized: TItem[] = []
  for (const item of input) {
    if (!allowed.has(item) || normalized.includes(item)) {
      continue
    }
    normalized.push(item)
  }
  return normalized
}

function normalizeLabels<TItem extends string>(
  input: Readonly<Partial<Record<TItem, string>>> | undefined,
  allowedKeys: readonly TItem[],
): Readonly<Partial<Record<TItem, string>>> {
  if (!input) {
    return Object.freeze({})
  }
  const entries = Object.entries(input)
    .filter((entry): entry is [string, string] => allowedKeys.includes(entry[0] as TItem) && typeof entry[1] === "string")
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
  return Object.freeze(Object.fromEntries(entries) as Partial<Record<TItem, string>>)
}

function normalizeActionOptions<TKey extends string, TOption extends {
  hidden?: boolean
  disabled?: boolean
  disabledReason?: string
  label?: string
}>(
  input: Readonly<Partial<Record<TKey, TOption>>> | undefined,
  allowedKeys: readonly TKey[],
): Readonly<Partial<Record<TKey, Readonly<TOption>>>> {
  if (!input) {
    return Object.freeze({})
  }
  const entries = Object.entries(input)
    .filter(([key, value]) => allowedKeys.includes(key as TKey) && Boolean(value))
    .map(([key, value]) => {
      const option = value as TOption
      const normalized = {
        ...(option.hidden === true ? { hidden: true } : {}),
        ...(option.disabled === true ? { disabled: true } : {}),
        ...(typeof option.disabledReason === "string" && option.disabledReason.trim().length > 0
          ? { disabledReason: option.disabledReason.trim() }
          : {}),
        ...(typeof option.label === "string" && option.label.trim().length > 0
          ? { label: option.label.trim() }
          : {}),
      } as TOption
      return [key, Object.freeze(normalized)] as const
    })
    .filter(([, value]) => Object.keys(value).length > 0)
  return Object.freeze(Object.fromEntries(entries) as Partial<Record<TKey, Readonly<TOption>>>)
}

function isCellCustomItemPlacement(
  value: string,
): value is DataGridCellMenuCustomItemPlacement {
  if (value === "start" || value === "end") {
    return true
  }
  if (!value.includes(":")) {
    return false
  }
  const [position, itemKey] = value.split(":")
  return (position === "before" || position === "after")
    && DATAGRID_CELL_MENU_ITEM_KEYS.includes(itemKey as DataGridCellMenuItemKey)
}

function normalizeCellCustomItems(
  input: readonly DataGridCellMenuCustomItem[] | undefined,
): readonly DataGridCellMenuCustomItem[] {
  if (!Array.isArray(input)) {
    return Object.freeze([])
  }
  const normalized: DataGridCellMenuCustomItem[] = []
  const seenKeys = new Set<string>()
  for (const item of input) {
    const key = typeof item?.key === "string" ? item.key.trim() : ""
    const label = typeof item?.label === "string" ? item.label.trim() : ""
    if (key.length === 0 || label.length === 0 || seenKeys.has(key)) {
      continue
    }
    seenKeys.add(key)
    const placement = typeof item.placement === "string" && isCellCustomItemPlacement(item.placement)
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
    } satisfies DataGridCellMenuCustomItemBase
    if (item.kind === "submenu") {
      const items = normalizeCellCustomItems(item.items)
      if (items.length === 0) {
        continue
      }
      normalized.push(Object.freeze({
        ...baseItem,
        kind: "submenu",
        items,
      } satisfies DataGridCellMenuCustomSubmenuItem))
      continue
    }
    normalized.push(Object.freeze({
      ...baseItem,
      ...(typeof item.onSelect === "function" ? { onSelect: item.onSelect } : {}),
    } satisfies DataGridCellMenuCustomLeafItem))
  }
  return Object.freeze(normalized)
}

function normalizeCellColumns(
  input: Readonly<Record<string, DataGridCellMenuColumnOptions>> | undefined,
): Readonly<Record<string, DataGridCellMenuColumnOptions>> {
  if (!input) {
    return {}
  }
  const normalizedEntries = Object.entries(input)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, value]) => {
      const items = value?.items ? normalizeItems(value.items, DATAGRID_CELL_MENU_ITEM_KEYS) : undefined
      const hide = normalizeItemSubset(value?.hide, DATAGRID_CELL_MENU_ITEM_KEYS)
      const disabled = normalizeItemSubset(value?.disabled, DATAGRID_CELL_MENU_ITEM_KEYS)
      const disabledReasons = normalizeLabels(value?.disabledReasons, DATAGRID_CELL_MENU_ITEM_KEYS)
      const labels = normalizeLabels(value?.labels, DATAGRID_CELL_MENU_ITEM_KEYS)
      const actions = normalizeActionOptions(value?.actions, DATAGRID_CELL_MENU_ACTION_KEYS)
      const customItems = normalizeCellCustomItems(value?.customItems)
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
        } satisfies DataGridCellMenuColumnOptions,
      ] as const
    })
  return Object.freeze(Object.fromEntries(normalizedEntries))
}

export function resolveDataGridCellMenu(
  input: DataGridCellMenuProp | undefined,
): DataGridCellMenuOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      items: [...DATAGRID_CELL_MENU_ITEM_KEYS],
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
      items: [...DATAGRID_CELL_MENU_ITEM_KEYS],
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
    items: normalizeItems(input.items, DATAGRID_CELL_MENU_ITEM_KEYS),
    disabled: normalizeItemSubset(input.disabled, DATAGRID_CELL_MENU_ITEM_KEYS),
    disabledReasons: normalizeLabels(input.disabledReasons, DATAGRID_CELL_MENU_ITEM_KEYS),
    labels: normalizeLabels(input.labels, DATAGRID_CELL_MENU_ITEM_KEYS),
    actions: normalizeActionOptions(input.actions, DATAGRID_CELL_MENU_ACTION_KEYS),
    customItems: normalizeCellCustomItems(input.customItems),
    columns: normalizeCellColumns(input.columns),
  }
}

export function resolveDataGridCellMenuItems(
  options: DataGridCellMenuOptions,
  columnKey: string,
): readonly DataGridCellMenuItemKey[] {
  const columnOptions = options.columns[columnKey]
  const baseItems = columnOptions?.items
    ? normalizeItems(columnOptions.items, DATAGRID_CELL_MENU_ITEM_KEYS)
    : options.items
  const hidden = new Set(columnOptions?.hide ?? [])
  const filtered = baseItems.filter(item => !hidden.has(item))
  return filtered.length > 0 ? filtered : []
}

export function resolveDataGridCellMenuDisabledItems(
  options: DataGridCellMenuOptions,
  columnKey: string,
): readonly DataGridCellMenuItemKey[] {
  const visibleItems = resolveDataGridCellMenuItems(options, columnKey)
  const columnDisabled = new Set(options.columns[columnKey]?.disabled ?? [])
  const globallyDisabled = new Set(options.disabled)
  return visibleItems.filter(item => globallyDisabled.has(item) || columnDisabled.has(item))
}

export function resolveDataGridCellMenuLabels(
  options: DataGridCellMenuOptions,
  columnKey: string,
): DataGridCellMenuItemLabels {
  return Object.freeze({
    ...options.labels,
    ...(options.columns[columnKey]?.labels ?? {}),
  })
}

export function resolveDataGridCellMenuDisabledReasons(
  options: DataGridCellMenuOptions,
  columnKey: string,
): DataGridCellMenuDisabledReasons {
  return Object.freeze({
    ...options.disabledReasons,
    ...(options.columns[columnKey]?.disabledReasons ?? {}),
  })
}

export function resolveDataGridCellMenuActionOptions(
  options: DataGridCellMenuOptions,
  columnKey: string,
): DataGridCellMenuActionOptions {
  const columnActions = options.columns[columnKey]?.actions ?? {}
  const entries = DATAGRID_CELL_MENU_ACTION_KEYS
    .map(actionKey => {
      const merged = {
        ...(options.actions[actionKey] ?? {}),
        ...(columnActions[actionKey] ?? {}),
      } satisfies DataGridCellMenuActionOption
      return [actionKey, Object.freeze(merged)] as const
    })
    .filter(([, value]) => Object.keys(value).length > 0)
  return Object.freeze(Object.fromEntries(entries))
}

export function resolveDataGridCellMenuCustomItems(
  options: DataGridCellMenuOptions,
  columnKey: string,
): readonly DataGridCellMenuCustomItem[] {
  const merged = new Map<string, DataGridCellMenuCustomItem>()
  for (const item of options.customItems) {
    merged.set(item.key, item)
  }
  for (const item of options.columns[columnKey]?.customItems ?? []) {
    merged.set(item.key, item)
  }
  return Object.freeze(Array.from(merged.values()))
}

export function resolveDataGridRowIndexMenu(
  input: DataGridRowIndexMenuProp | undefined,
): DataGridRowIndexMenuOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      items: [...DATAGRID_ROW_INDEX_MENU_ITEM_KEYS],
      disabled: [],
      disabledReasons: Object.freeze({}),
      labels: Object.freeze({}),
      actions: Object.freeze({}),
    }
  }
  if (!input) {
    return {
      enabled: false,
      items: [...DATAGRID_ROW_INDEX_MENU_ITEM_KEYS],
      disabled: [],
      disabledReasons: Object.freeze({}),
      labels: Object.freeze({}),
      actions: Object.freeze({}),
    }
  }
  return {
    enabled: input.enabled ?? true,
    items: normalizeItems(input.items, DATAGRID_ROW_INDEX_MENU_ITEM_KEYS),
    disabled: normalizeItemSubset(input.disabled, DATAGRID_ROW_INDEX_MENU_ITEM_KEYS),
    disabledReasons: normalizeLabels(input.disabledReasons, DATAGRID_ROW_INDEX_MENU_ITEM_KEYS),
    labels: normalizeLabels(input.labels, DATAGRID_ROW_INDEX_MENU_ITEM_KEYS),
    actions: normalizeActionOptions(input.actions, DATAGRID_ROW_INDEX_MENU_ACTION_KEYS),
  }
}

export function resolveDataGridRowIndexMenuItems(
  options: DataGridRowIndexMenuOptions,
): readonly DataGridRowIndexMenuItemKey[] {
  return options.items
}

export function resolveDataGridRowIndexMenuDisabledItems(
  options: DataGridRowIndexMenuOptions,
): readonly DataGridRowIndexMenuItemKey[] {
  return options.disabled
}

export function resolveDataGridRowIndexMenuLabels(
  options: DataGridRowIndexMenuOptions,
): DataGridRowIndexMenuItemLabels {
  return options.labels
}

export function resolveDataGridRowIndexMenuDisabledReasons(
  options: DataGridRowIndexMenuOptions,
): DataGridRowIndexMenuDisabledReasons {
  return options.disabledReasons
}

export function resolveDataGridRowIndexMenuActionOptions(
  options: DataGridRowIndexMenuOptions,
): DataGridRowIndexMenuActionOptions {
  const entries = DATAGRID_ROW_INDEX_MENU_ACTION_KEYS
    .map(actionKey => [actionKey, Object.freeze({ ...(options.actions[actionKey] ?? {}) })] as const)
    .filter(([, value]) => Object.keys(value).length > 0)
  return Object.freeze(Object.fromEntries(entries))
}