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

  const componentProps = computed(() => ({
    rows: rows.value,
    columns: columns.value,
    services: options.services,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  }))

  return {
    ...runtime,
    rows,
    columns,
    componentProps,
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
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
  }
}
