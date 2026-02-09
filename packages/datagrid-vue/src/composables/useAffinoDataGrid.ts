import { computed, isRef, ref, watch, type Ref } from "vue"
import type {
  CreateDataGridCoreOptions,
  DataGridColumnDef,
  DataGridSortDirection,
  DataGridSortState,
} from "@affino/datagrid-core"
import {
  useDataGridRuntime,
  type UseDataGridRuntimeOptions,
  type UseDataGridRuntimeResult,
} from "./useDataGridRuntime"
import {
  useDataGridContextMenu,
  type DataGridContextMenuAction,
  type DataGridContextMenuActionId,
  type DataGridContextMenuState,
  type OpenDataGridContextMenuInput,
} from "./useDataGridContextMenu"

type MaybeRef<T> = T | Ref<T>

export type AffinoDataGridEditMode = "cell" | "row"

export interface AffinoDataGridSelectionFeature<TRow> {
  enabled?: boolean
  initialSelectedRowKeys?: readonly string[]
  resolveRowKey?: (row: TRow, index: number) => string
}

export interface AffinoDataGridClipboardFeature<TRow> {
  enabled?: boolean
  useSystemClipboard?: boolean
  serializeRows?: (rows: readonly TRow[]) => string
  parseRows?: (text: string) => readonly TRow[]
}

export interface AffinoDataGridEditSession {
  rowKey: string
  columnKey: string
  mode: AffinoDataGridEditMode
  draft: string
}

export interface AffinoDataGridEditingFeature<TRow> {
  enabled?: boolean
  mode?: AffinoDataGridEditMode
  enum?: boolean
  onCommit?: (session: AffinoDataGridEditSession, context: {
    rows: readonly TRow[]
    columns: readonly DataGridColumnDef[]
  }) => void | Promise<void>
}

export interface AffinoDataGridFeatures<TRow> {
  selection?: boolean | AffinoDataGridSelectionFeature<TRow>
  clipboard?: boolean | AffinoDataGridClipboardFeature<TRow>
  editing?: boolean | AffinoDataGridEditingFeature<TRow>
}

export interface UseAffinoDataGridOptions<TRow> {
  rows: MaybeRef<readonly TRow[]>
  columns: MaybeRef<readonly DataGridColumnDef[]>
  services?: UseDataGridRuntimeOptions<TRow>["services"]
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
  autoStart?: boolean
  initialSortState?: readonly DataGridSortState[]
  features?: AffinoDataGridFeatures<TRow>
}

export type AffinoDataGridActionId = DataGridContextMenuActionId | "select-all" | "clear-selection"

export interface AffinoDataGridRunActionOptions {
  columnKey?: string | null
}

export interface AffinoDataGridActionResult {
  ok: boolean
  affected: number
  message: string
}

export interface AffinoDataGridActionBindingOptions {
  onResult?: (result: AffinoDataGridActionResult) => void
}

export interface UseAffinoDataGridResult<TRow> extends UseDataGridRuntimeResult<TRow> {
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnDef[]>
  componentProps: Ref<{
    rows: readonly TRow[]
    columns: readonly DataGridColumnDef[]
    services: UseAffinoDataGridOptions<TRow>["services"]
    startupOrder: UseAffinoDataGridOptions<TRow>["startupOrder"]
    autoStart: boolean
  }>
  sortState: Ref<readonly DataGridSortState[]>
  setSortState: (nextState: readonly DataGridSortState[]) => void
  toggleColumnSort: (columnKey: string, directionCycle?: readonly DataGridSortDirection[]) => void
  clearSort: () => void
  actions: {
    copySelectedRows: () => Promise<boolean>
    cutSelectedRows: () => Promise<number>
    pasteRowsAppend: () => Promise<number>
    clearSelectedRows: () => number
    selectAllRows: () => number
    runAction: (actionId: AffinoDataGridActionId, options?: AffinoDataGridRunActionOptions) => Promise<AffinoDataGridActionResult>
  }
  contextMenu: {
    state: Ref<DataGridContextMenuState>
    style: Ref<{ left: string; top: string }>
    actions: Ref<readonly DataGridContextMenuAction[]>
    contextMenuRef: Ref<HTMLElement | null>
    open: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void
    close: () => void
    onKeyDown: (event: KeyboardEvent, handlers?: { onEscape?: () => void }) => void
    runAction: (actionId: DataGridContextMenuActionId) => Promise<AffinoDataGridActionResult>
  }
  features: {
    selection: {
      enabled: Ref<boolean>
      selectedRowKeys: Ref<readonly string[]>
      selectedCount: Ref<number>
      isSelectedByKey: (rowKey: string) => boolean
      setSelectedByKey: (rowKey: string, selected: boolean) => void
      toggleSelectedByKey: (rowKey: string) => void
      clearSelection: () => void
      resolveRowKey: (row: TRow, index: number) => string
    }
    clipboard: {
      enabled: Ref<boolean>
      lastCopiedText: Ref<string>
      copyText: (text: string) => Promise<boolean>
      readText: () => Promise<string>
      copyRows: (rows?: readonly TRow[]) => Promise<boolean>
      parseRows: (text: string) => readonly TRow[]
    }
    editing: {
      enabled: Ref<boolean>
      mode: Ref<AffinoDataGridEditMode>
      enum: Ref<boolean>
      activeSession: Ref<AffinoDataGridEditSession | null>
      beginEdit: (session: Omit<AffinoDataGridEditSession, "mode"> & { mode?: AffinoDataGridEditMode }) => boolean
      updateDraft: (draft: string) => boolean
      cancelEdit: () => boolean
      commitEdit: () => Promise<boolean>
    }
  }
  bindings: {
    getRowKey: (row: TRow, index: number) => string
    headerSort: (columnKey: string) => {
      role: "columnheader"
      tabindex: number
      "aria-sort": "none" | "ascending" | "descending"
      onClick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    rowSelection: (row: TRow, index: number) => {
      role: "row"
      tabindex: number
      "data-row-key": string
      "aria-selected": "true" | "false"
      onClick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    editableCell: (params: {
      row: TRow
      rowIndex: number
      columnKey: string
      editable?: boolean
      value?: unknown
    }) => {
      "data-row-key": string
      "data-column-key": string
      "data-inline-editable": "true" | "false"
      onDblclick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    isCellEditing: (rowKey: string, columnKey: string) => boolean
    inlineEditor: (params: {
      rowKey: string
      columnKey: string
      commitOnBlur?: boolean
    }) => {
      value: string
      onInput: (event: Event) => void
      onBlur: () => void
      onKeydown: (event: KeyboardEvent) => void
    }
    headerCell: (columnKey: string) => {
      role: "columnheader"
      tabindex: number
      "aria-sort": "none" | "ascending" | "descending"
      onClick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
      onContextmenu: (event: MouseEvent) => void
    }
    dataCell: (params: {
      row: TRow
      rowIndex: number
      columnKey: string
      editable?: boolean
      value?: unknown
    }) => {
      "data-row-key": string
      "data-column-key": string
      "data-inline-editable": "true" | "false"
      onDblclick: (event?: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
      onContextmenu: (event: MouseEvent) => void
    }
    contextMenuRef: (element: Element | null) => void
    contextMenuRoot: (handlers?: { onEscape?: () => void }) => {
      role: "menu"
      tabindex: number
      onMousedown: (event: MouseEvent) => void
      onKeydown: (event: KeyboardEvent) => void
    }
    contextMenuAction: (
      actionId: DataGridContextMenuActionId,
      options?: AffinoDataGridActionBindingOptions,
    ) => {
      onClick: () => void
    }
    actionButton: (
      actionId: AffinoDataGridActionId,
      options?: AffinoDataGridActionBindingOptions & { actionOptions?: AffinoDataGridRunActionOptions },
    ) => {
      onClick: () => void
    }
  }
}

interface NormalizedSelectionFeature<TRow> {
  enabled: boolean
  initialSelectedRowKeys: readonly string[]
  resolveRowKey?: (row: TRow, index: number) => string
}

interface NormalizedClipboardFeature<TRow> {
  enabled: boolean
  useSystemClipboard: boolean
  serializeRows: (rows: readonly TRow[]) => string
  parseRows: (text: string) => readonly TRow[]
}

interface NormalizedEditingFeature<TRow> {
  enabled: boolean
  mode: AffinoDataGridEditMode
  enum: boolean
  onCommit?: AffinoDataGridEditingFeature<TRow>["onCommit"]
}

function toReadonlyRef<T>(source: MaybeRef<T>): Ref<T> {
  if (isRef(source)) {
    return source as Ref<T>
  }
  return ref(source) as Ref<T>
}

function normalizeSelectionFeature<TRow>(
  input: boolean | AffinoDataGridSelectionFeature<TRow> | undefined,
): NormalizedSelectionFeature<TRow> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      initialSelectedRowKeys: [],
    }
  }
  if (!input) {
    return {
      enabled: false,
      initialSelectedRowKeys: [],
    }
  }
  return {
    enabled: input.enabled ?? true,
    initialSelectedRowKeys: input.initialSelectedRowKeys ?? [],
    resolveRowKey: input.resolveRowKey,
  }
}

function normalizeClipboardFeature<TRow>(
  input: boolean | AffinoDataGridClipboardFeature<TRow> | undefined,
): NormalizedClipboardFeature<TRow> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      useSystemClipboard: true,
      serializeRows: rows => JSON.stringify(rows),
      parseRows: text => {
        try {
          const parsed = JSON.parse(text)
          return Array.isArray(parsed) ? (parsed as readonly TRow[]) : []
        } catch {
          return []
        }
      },
    }
  }
  if (!input) {
    return {
      enabled: false,
      useSystemClipboard: true,
      serializeRows: rows => JSON.stringify(rows),
      parseRows: () => [],
    }
  }
  return {
    enabled: input.enabled ?? true,
    useSystemClipboard: input.useSystemClipboard ?? true,
    serializeRows: input.serializeRows ?? (rows => JSON.stringify(rows)),
    parseRows: input.parseRows ?? (() => []),
  }
}

function normalizeEditingFeature<TRow>(
  input: boolean | AffinoDataGridEditingFeature<TRow> | undefined,
): NormalizedEditingFeature<TRow> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      mode: "cell",
      enum: false,
    }
  }
  if (!input) {
    return {
      enabled: false,
      mode: "cell",
      enum: false,
    }
  }
  return {
    enabled: input.enabled ?? true,
    mode: input.mode ?? "cell",
    enum: input.enum ?? false,
    onCommit: input.onCommit,
  }
}

function fallbackResolveRowKey<TRow>(row: TRow, index: number): string {
  const candidate = row as { rowId?: unknown; id?: unknown; key?: unknown }
  if (typeof candidate.rowId === "string" || typeof candidate.rowId === "number") {
    return String(candidate.rowId)
  }
  if (typeof candidate.id === "string" || typeof candidate.id === "number") {
    return String(candidate.id)
  }
  if (typeof candidate.key === "string" || typeof candidate.key === "number") {
    return String(candidate.key)
  }
  return `row-${index}`
}

function toAriaSortDirection(
  direction: DataGridSortDirection | null,
): "none" | "ascending" | "descending" {
  if (direction === "asc") {
    return "ascending"
  }
  if (direction === "desc") {
    return "descending"
  }
  return "none"
}

export function useAffinoDataGrid<TRow>(
  options: UseAffinoDataGridOptions<TRow>,
): UseAffinoDataGridResult<TRow> {
  const rows = toReadonlyRef(options.rows)
  const columns = toReadonlyRef(options.columns)

  const runtime = useDataGridRuntime<TRow>({
    rows,
    columns,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  })

  const normalizedSelectionFeature = normalizeSelectionFeature(options.features?.selection)
  const normalizedClipboardFeature = normalizeClipboardFeature(options.features?.clipboard)
  const normalizedEditingFeature = normalizeEditingFeature(options.features?.editing)

  const selectionEnabled = ref(normalizedSelectionFeature.enabled)
  const selectedRowKeySet = ref<Set<string>>(new Set(normalizedSelectionFeature.initialSelectedRowKeys))
  const resolveRowKey = (row: TRow, index: number): string => (
    normalizedSelectionFeature.resolveRowKey
      ? normalizedSelectionFeature.resolveRowKey(row, index)
      : fallbackResolveRowKey(row, index)
  )

  watch(rows, nextRows => {
    if (!selectionEnabled.value) {
      return
    }
    const allowed = new Set<string>()
    nextRows.forEach((row, index) => {
      allowed.add(resolveRowKey(row, index))
    })
    const nextSelected = new Set<string>()
    selectedRowKeySet.value.forEach(rowKey => {
      if (allowed.has(rowKey)) {
        nextSelected.add(rowKey)
      }
    })
    selectedRowKeySet.value = nextSelected
  })

  const selectedRowKeys = computed<readonly string[]>(() => Array.from(selectedRowKeySet.value))
  const selectedCount = computed(() => selectedRowKeySet.value.size)

  const isSelectedByKey = (rowKey: string): boolean => (
    selectionEnabled.value && selectedRowKeySet.value.has(rowKey)
  )

  const setSelectedByKey = (rowKey: string, selected: boolean): void => {
    if (!selectionEnabled.value) {
      return
    }
    const next = new Set(selectedRowKeySet.value)
    if (selected) {
      next.add(rowKey)
    } else {
      next.delete(rowKey)
    }
    selectedRowKeySet.value = next
  }

  const toggleSelectedByKey = (rowKey: string): void => {
    setSelectedByKey(rowKey, !isSelectedByKey(rowKey))
  }

  const clearSelection = (): void => {
    if (selectedRowKeySet.value.size === 0) {
      return
    }
    selectedRowKeySet.value = new Set()
  }

  const sortState = ref<readonly DataGridSortState[]>(options.initialSortState ?? [])
  const setSortState = (nextState: readonly DataGridSortState[]) => {
    sortState.value = nextState.map(entry => ({ ...entry }))
  }

  const toggleColumnSort = (
    columnKey: string,
    directionCycle: readonly DataGridSortDirection[] = ["asc", "desc"],
  ) => {
    const current = sortState.value.find(entry => entry.key === columnKey)
    if (!current) {
      setSortState([{ key: columnKey, direction: directionCycle[0] ?? "asc" }])
      return
    }

    const currentIndex = directionCycle.indexOf(current.direction)
    if (currentIndex < 0 || currentIndex === directionCycle.length - 1) {
      setSortState(sortState.value.filter(entry => entry.key !== columnKey))
      return
    }

    setSortState(
      sortState.value.map(entry => (
        entry.key === columnKey
          ? { key: columnKey, direction: directionCycle[currentIndex + 1] ?? "asc" }
          : { ...entry }
      )),
    )
  }

  const clearSort = () => {
    if (sortState.value.length === 0) {
      return
    }
    sortState.value = []
  }

  const replaceRows = (nextRows: readonly TRow[]): boolean => {
    try {
      rows.value = nextRows
      return true
    } catch {
      return false
    }
  }

  const resolveColumnSortDirection = (columnKey: string): DataGridSortDirection | null => {
    const entry = sortState.value.find(item => item.key === columnKey)
    return entry?.direction ?? null
  }

  const resolveSelectedRows = (): readonly TRow[] => rows.value.filter((row, index) => (
    selectedRowKeySet.value.has(resolveRowKey(row, index))
  ))

  const selectAllRows = (): number => {
    if (!selectionEnabled.value) {
      return 0
    }
    const nextSelected = new Set<string>()
    rows.value.forEach((row, index) => {
      nextSelected.add(resolveRowKey(row, index))
    })
    selectedRowKeySet.value = nextSelected
    return nextSelected.size
  }

  watch(sortState, nextSortState => {
    runtime.api.setSortModel(nextSortState)
  }, { immediate: true })

  const clipboardEnabled = ref(normalizedClipboardFeature.enabled)
  const clipboardBuffer = ref("")
  const lastCopiedText = computed(() => clipboardBuffer.value)

  const copyText = async (text: string): Promise<boolean> => {
    if (!clipboardEnabled.value) {
      return false
    }
    clipboardBuffer.value = text
    if (!normalizedClipboardFeature.useSystemClipboard) {
      return true
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      return true
    } catch {
      return false
    }
  }

  const readText = async (): Promise<string> => {
    if (!clipboardEnabled.value) {
      return ""
    }
    if (!normalizedClipboardFeature.useSystemClipboard) {
      return clipboardBuffer.value
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        clipboardBuffer.value = text
        return text
      }
    } catch {
      // Ignore clipboard read failures and fall back to in-memory value.
    }

    return clipboardBuffer.value
  }

  const copyRows = async (rowsOverride?: readonly TRow[]): Promise<boolean> => {
    const payload = normalizedClipboardFeature.serializeRows(rowsOverride ?? rows.value)
    return copyText(payload)
  }

  const parseRows = (text: string): readonly TRow[] => normalizedClipboardFeature.parseRows(text)

  const copySelectedRows = async (): Promise<boolean> => copyRows(resolveSelectedRows())

  const clearSelectedRows = (): number => {
    const selectedKeys = selectedRowKeySet.value
    if (!selectedKeys.size) {
      return 0
    }
    const nextRows = rows.value.filter((row, index) => !selectedKeys.has(resolveRowKey(row, index)))
    const affected = rows.value.length - nextRows.length
    if (affected <= 0) {
      return 0
    }
    const didReplace = replaceRows(nextRows)
    if (!didReplace) {
      return 0
    }
    selectedRowKeySet.value = new Set()
    return affected
  }

  const cutSelectedRows = async (): Promise<number> => {
    const copied = await copySelectedRows()
    if (!copied) {
      return 0
    }
    return clearSelectedRows()
  }

  const pasteRowsAppend = async (): Promise<number> => {
    const text = await readText()
    if (!text) {
      return 0
    }
    const parsedRows = parseRows(text)
    if (parsedRows.length === 0) {
      return 0
    }
    const nextRows = [...rows.value, ...parsedRows]
    const didReplace = replaceRows(nextRows)
    if (!didReplace) {
      return 0
    }
    return parsedRows.length
  }

  const editingEnabled = ref(normalizedEditingFeature.enabled)
  const editingMode = ref<AffinoDataGridEditMode>(normalizedEditingFeature.mode)
  const editingEnum = ref(normalizedEditingFeature.enum)
  const activeSession = ref<AffinoDataGridEditSession | null>(null)

  const beginEdit = (session: Omit<AffinoDataGridEditSession, "mode"> & { mode?: AffinoDataGridEditMode }): boolean => {
    if (!editingEnabled.value) {
      return false
    }
    activeSession.value = {
      rowKey: session.rowKey,
      columnKey: session.columnKey,
      mode: session.mode ?? editingMode.value,
      draft: session.draft,
    }
    return true
  }

  const updateDraft = (draft: string): boolean => {
    if (!activeSession.value) {
      return false
    }
    activeSession.value = {
      ...activeSession.value,
      draft,
    }
    return true
  }

  const cancelEdit = (): boolean => {
    if (!activeSession.value) {
      return false
    }
    activeSession.value = null
    return true
  }

  const commitEdit = async (): Promise<boolean> => {
    if (!activeSession.value) {
      return false
    }
    const session = activeSession.value
    activeSession.value = null

    if (!normalizedEditingFeature.onCommit) {
      return true
    }

    await normalizedEditingFeature.onCommit(session, {
      rows: rows.value,
      columns: columns.value,
    })
    return true
  }

  const isCellEditing = (rowKey: string, columnKey: string): boolean => (
    activeSession.value?.rowKey === rowKey && activeSession.value?.columnKey === columnKey
  )

  const resolveCellDraft = (params: {
    row: TRow
    columnKey: string
    value?: unknown
  }): string => {
    if (params.value !== undefined && params.value !== null) {
      return String(params.value)
    }
    const candidate = params.row as Record<string, unknown>
    const fromRow = candidate[params.columnKey]
    return fromRow === undefined || fromRow === null ? "" : String(fromRow)
  }

  const selectOnlyRow = (rowKey: string): void => {
    if (!selectionEnabled.value) {
      return
    }
    selectedRowKeySet.value = new Set([rowKey])
  }

  const createHeaderSortBindings = (columnKey: string) => ({
    role: "columnheader" as const,
    tabindex: 0,
    "aria-sort": toAriaSortDirection(resolveColumnSortDirection(columnKey)),
    onClick: (_event?: MouseEvent) => {
      toggleColumnSort(columnKey)
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      event.preventDefault()
      toggleColumnSort(columnKey)
    },
  })

  const createRowSelectionBindings = (row: TRow, index: number) => {
    const rowKey = resolveRowKey(row, index)
    return {
      role: "row" as const,
      tabindex: 0,
      "data-row-key": rowKey,
      "aria-selected": (isSelectedByKey(rowKey) ? "true" : "false") as "true" | "false",
      onClick: (event?: MouseEvent) => {
        const shouldToggle = Boolean(event?.metaKey || event?.ctrlKey)
        if (shouldToggle) {
          toggleSelectedByKey(rowKey)
          return
        }
        selectOnlyRow(rowKey)
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key !== " " && event.key !== "Enter") {
          return
        }
        event.preventDefault()
        const shouldToggle = event.metaKey || event.ctrlKey
        if (shouldToggle) {
          toggleSelectedByKey(rowKey)
          return
        }
        selectOnlyRow(rowKey)
      },
    }
  }

  const createEditableCellBindings = (params: {
    row: TRow
    rowIndex: number
    columnKey: string
    editable?: boolean
    value?: unknown
  }) => {
    const rowKey = resolveRowKey(params.row, params.rowIndex)
    const editable = params.editable ?? true
    const startEdit = (): void => {
      if (!editable || !editingEnabled.value) {
        return
      }
      beginEdit({
        rowKey,
        columnKey: params.columnKey,
        draft: resolveCellDraft({
          row: params.row,
          columnKey: params.columnKey,
          value: params.value,
        }),
      })
    }

    return {
      "data-row-key": rowKey,
      "data-column-key": params.columnKey,
      "data-inline-editable": editable ? ("true" as const) : ("false" as const),
      onDblclick: (_event?: MouseEvent) => {
        startEdit()
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== "F2") {
          return
        }
        event.preventDefault()
        startEdit()
      },
    }
  }

  const createInlineEditorBindings = (params: {
    rowKey: string
    columnKey: string
    commitOnBlur?: boolean
  }) => ({
    value: isCellEditing(params.rowKey, params.columnKey)
      ? (activeSession.value?.draft ?? "")
      : "",
    onInput: (event: Event) => {
      const target = event.target as HTMLInputElement | null
      updateDraft(target?.value ?? "")
    },
    onBlur: () => {
      if (params.commitOnBlur === false) {
        return
      }
      void commitEdit()
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        cancelEdit()
        return
      }
      if (event.key !== "Enter") {
        return
      }
      event.preventDefault()
      void commitEdit()
    },
  })

  const componentProps = computed(() => ({
    rows: rows.value,
    columns: columns.value,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  }))

  const runAction = async (
    actionId: AffinoDataGridActionId,
    actionOptions: AffinoDataGridRunActionOptions = {},
  ): Promise<AffinoDataGridActionResult> => {
    switch (actionId) {
      case "copy": {
        const ok = await copySelectedRows()
        const affected = resolveSelectedRows().length
        return {
          ok,
          affected: ok ? affected : 0,
          message: ok ? `Copied ${affected} selected row(s)` : "Copy failed",
        }
      }
      case "cut": {
        const affected = await cutSelectedRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Cut ${affected} row(s)` : "Nothing was cut",
        }
      }
      case "paste": {
        const affected = await pasteRowsAppend()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Pasted ${affected} row(s)` : "Nothing to paste",
        }
      }
      case "clear": {
        const affected = clearSelectedRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Cleared ${affected} row(s)` : "Nothing to clear",
        }
      }
      case "sort-asc":
      case "sort-desc": {
        const columnKey = actionOptions.columnKey ?? null
        if (!columnKey) {
          return {
            ok: false,
            affected: 0,
            message: "Missing column key for sort action",
          }
        }
        setSortState([{ key: columnKey, direction: actionId === "sort-asc" ? "asc" : "desc" }])
        return {
          ok: true,
          affected: 1,
          message: `Sorted ${columnKey} ${actionId === "sort-asc" ? "ascending" : "descending"}`,
        }
      }
      case "sort-clear": {
        clearSort()
        return {
          ok: true,
          affected: 1,
          message: "Sort cleared",
        }
      }
      case "select-all": {
        const affected = selectAllRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Selected ${affected} row(s)` : "Nothing to select",
        }
      }
      case "clear-selection": {
        const affected = selectedRowKeySet.value.size
        clearSelection()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? "Selection cleared" : "Selection already empty",
        }
      }
      case "filter":
      case "auto-size":
      default:
        return {
          ok: false,
          affected: 0,
          message: `Action "${actionId}" is not mapped in useAffinoDataGrid`,
        }
    }
  }

  const contextMenuBridge = useDataGridContextMenu({
    isColumnResizable(columnKey) {
      return columns.value.some(column => column.key === columnKey)
    },
  })

  const runContextMenuAction = async (
    actionId: DataGridContextMenuActionId,
  ): Promise<AffinoDataGridActionResult> => {
    const result = await runAction(actionId, {
      columnKey: contextMenuBridge.contextMenu.value.columnKey,
    })
    contextMenuBridge.closeContextMenu()
    return result
  }

  const createHeaderCellBindings = (columnKey: string) => ({
    ...createHeaderSortBindings(columnKey),
    onContextmenu: (event: MouseEvent) => {
      event.preventDefault()
      contextMenuBridge.openContextMenu(event.clientX, event.clientY, {
        zone: "header",
        columnKey,
      })
    },
  })

  const createDataCellBindings = (params: {
    row: TRow
    rowIndex: number
    columnKey: string
    editable?: boolean
    value?: unknown
  }) => {
    const base = createEditableCellBindings(params)
    return {
      ...base,
      onContextmenu: (event: MouseEvent) => {
        event.preventDefault()
        contextMenuBridge.openContextMenu(event.clientX, event.clientY, {
          zone: "cell",
          rowId: String(resolveRowKey(params.row, params.rowIndex)),
          columnKey: params.columnKey,
        })
      },
    }
  }

  const setContextMenuRef = (element: Element | null) => {
    contextMenuBridge.contextMenuRef.value = element as HTMLElement | null
  }

  const createContextMenuRootBindings = (handlers?: { onEscape?: () => void }) => ({
    role: "menu" as const,
    tabindex: -1,
    onMousedown: (event: MouseEvent) => {
      event.stopPropagation()
    },
    onKeydown: (event: KeyboardEvent) => {
      contextMenuBridge.onContextMenuKeyDown(event, handlers)
    },
  })

  const createContextMenuActionBinding = (
    actionId: DataGridContextMenuActionId,
    options: AffinoDataGridActionBindingOptions = {},
  ) => ({
    onClick: () => {
      void runContextMenuAction(actionId).then(result => {
        options.onResult?.(result)
      })
    },
  })

  const createActionButtonBinding = (
    actionId: AffinoDataGridActionId,
    options: AffinoDataGridActionBindingOptions & { actionOptions?: AffinoDataGridRunActionOptions } = {},
  ) => ({
    onClick: () => {
      void runAction(actionId, options.actionOptions).then(result => {
        options.onResult?.(result)
      })
    },
  })

  return {
    ...runtime,
    rows,
    columns,
    componentProps,
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    actions: {
      copySelectedRows,
      cutSelectedRows,
      pasteRowsAppend,
      clearSelectedRows,
      selectAllRows,
      runAction,
    },
    contextMenu: {
      state: contextMenuBridge.contextMenu,
      style: contextMenuBridge.contextMenuStyle,
      actions: contextMenuBridge.contextMenuActions,
      contextMenuRef: contextMenuBridge.contextMenuRef,
      open: contextMenuBridge.openContextMenu,
      close: contextMenuBridge.closeContextMenu,
      onKeyDown: contextMenuBridge.onContextMenuKeyDown,
      runAction: runContextMenuAction,
    },
    features: {
      selection: {
        enabled: selectionEnabled,
        selectedRowKeys,
        selectedCount,
        isSelectedByKey,
        setSelectedByKey,
        toggleSelectedByKey,
        clearSelection,
        resolveRowKey,
      },
      clipboard: {
        enabled: clipboardEnabled,
        lastCopiedText,
        copyText,
        readText,
        copyRows,
        parseRows,
      },
      editing: {
        enabled: editingEnabled,
        mode: editingMode,
        enum: editingEnum,
        activeSession,
        beginEdit,
        updateDraft,
        cancelEdit,
        commitEdit,
      },
    },
    bindings: {
      getRowKey: resolveRowKey,
      headerSort: createHeaderSortBindings,
      rowSelection: createRowSelectionBindings,
      editableCell: createEditableCellBindings,
      isCellEditing,
      inlineEditor: createInlineEditorBindings,
      headerCell: createHeaderCellBindings,
      dataCell: createDataCellBindings,
      contextMenuRef: setContextMenuRef,
      contextMenuRoot: createContextMenuRootBindings,
      contextMenuAction: createContextMenuActionBinding,
      actionButton: createActionButtonBinding,
    },
  }
}
