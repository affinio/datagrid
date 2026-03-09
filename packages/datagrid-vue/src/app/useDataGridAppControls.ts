import { computed, nextTick, ref, watch, type Ref } from "vue"
import type {
  DataGridAdvancedFilterExpression,
  DataGridColumnSnapshot,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridSortState,
} from "@affino/datagrid-core"
import type { DataGridPivotInteropSnapshot, DataGridPivotLayoutSnapshot, DataGridPivotSpec } from "@affino/datagrid-pivot"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"

type MaybeRef<T> = T | Ref<T>

function resolveMaybeRef<T>(value: MaybeRef<T>): T {
  if (typeof value === "object" && value !== null && "value" in value) {
    return value.value as T
  }
  return value
}

export type DataGridAppMode = "base" | "tree" | "pivot" | "worker"
export type DataGridAppRowHeightMode = "fixed" | "auto"
export type DataGridAppRowRenderMode = "virtualization" | "pagination"
export type DataGridAppPivotViewMode = "pivot" | "table"

export interface DataGridAppSortModel {
  key: string
  direction: "asc" | "desc"
}

function normalizeInitialSortState(
  value: DataGridAppSortModel | readonly DataGridAppSortModel[] | null | undefined,
): DataGridAppSortModel[] {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value.map(entry => ({ key: entry.key, direction: entry.direction }))
  }
  return [{ key: (value as DataGridAppSortModel).key, direction: (value as DataGridAppSortModel).direction }]
}

export interface UseDataGridAppControlsOptions<TRow, TPivotLayoutId extends string = string> {
  mode: MaybeRef<DataGridAppMode>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "columnSnapshot">
  appliedAdvancedFilterExpression: Ref<DataGridAdvancedFilterExpression | null>
  syncViewport?: () => void
  initialColumnFilters?: Record<string, string>
  initialGroupByField?: string
  initialSortState?: DataGridAppSortModel | readonly DataGridAppSortModel[] | null
  initialRowHeightMode?: DataGridAppRowHeightMode
  initialRowRenderMode?: DataGridAppRowRenderMode
  initialPaginationPageSize?: number
  initialPaginationPage?: number
  initialBaseRowHeight?: number
  pivotLayouts?: Readonly<Record<TPivotLayoutId, DataGridPivotSpec>>
  initialPivotViewMode?: DataGridAppPivotViewMode
  initialPivotLayout?: TPivotLayoutId
}

export interface UseDataGridAppControlsResult<TPivotLayoutId extends string = string> {
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  columnFilterTextByKey: Ref<Record<string, string>>
  groupByField: Ref<string>
  sortState: Ref<DataGridAppSortModel[]>
  rowHeightMode: Ref<DataGridAppRowHeightMode>
  rowRenderMode: Ref<DataGridAppRowRenderMode>
  paginationPageSize: Ref<number>
  paginationPage: Ref<number>
  baseRowHeight: Ref<number>
  normalizedBaseRowHeight: Ref<number>
  pivotViewMode: Ref<DataGridAppPivotViewMode>
  pivotLayout: Ref<TPivotLayoutId | null>
  pivotColumnCount: Ref<number>
  isRefreshCellsPanelOpen: Ref<boolean>
  refreshRowKeysInput: Ref<string>
  refreshColumnKeysInput: Ref<string>
  isStatePanelOpen: Ref<boolean>
  stateImportText: Ref<string>
  stateOutputText: Ref<string>
  isComputePolicyPanelOpen: Ref<boolean>
  projectionMode: Ref<"mutable" | "immutable" | "excel-like">
  computeMode: Ref<"sync" | "worker">
  computeDiagnosticsOutput: Ref<string>
  computeSupported: Ref<boolean>
  isPivotAdvancedPanelOpen: Ref<boolean>
  pivotAdvancedImportText: Ref<string>
  pivotAdvancedOutputText: Ref<string>
  setColumnFilterText: (columnKey: string, value: string) => void
  toggleSortForColumn: (columnKey: string, additive?: boolean) => void
  sortIndicator: (columnKey: string) => string
  applySortAndFilter: () => void
  applyGroupBy: () => void
  applyPaginationSettings: () => void
  applyRowHeightSettings: () => void
  applyPivotConfiguration: () => void
  openRefreshCellsPanel: () => void
  closeRefreshCellsPanel: () => void
  refreshCellsByRowKeys: () => void
  openStatePanel: () => void
  closeStatePanel: () => void
  exportStatePayload: () => void
  migrateStatePayload: () => void
  applyStatePayload: () => void
  openComputePolicyPanel: () => void
  closeComputePolicyPanel: () => void
  refreshComputeDiagnostics: () => void
  applyProjectionMode: () => void
  applyComputeMode: () => void
  openPivotAdvancedPanel: () => void
  closePivotAdvancedPanel: () => void
  exportPivotLayout: () => void
  exportPivotInterop: () => void
  importPivotLayout: () => void
}

const MIN_ROW_HEIGHT = 24

function splitCsvTokens(value: string): string[] {
  return value
    .split(",")
    .map(token => token.trim())
    .filter(token => token.length > 0)
}

export function useDataGridAppControls<TRow, TPivotLayoutId extends string = string>(
  options: UseDataGridAppControlsOptions<TRow, TPivotLayoutId>,
): UseDataGridAppControlsResult<TPivotLayoutId> {
  const runtime = options.runtime
  const visibleColumns = computed<readonly DataGridColumnSnapshot[]>(() => runtime.columnSnapshot.value.visibleColumns)
  const columnFilterTextByKey = ref<Record<string, string>>({ ...(options.initialColumnFilters ?? {}) })
  const groupByField = ref(options.initialGroupByField ?? "")
  const sortState = ref<DataGridAppSortModel[]>(normalizeInitialSortState(options.initialSortState))
  const rowHeightMode = ref<DataGridAppRowHeightMode>(options.initialRowHeightMode ?? "fixed")
  const rowRenderMode = ref<DataGridAppRowRenderMode>(options.initialRowRenderMode ?? "virtualization")
  const paginationPageSize = ref<number>(options.initialPaginationPageSize ?? 200)
  const paginationPage = ref<number>(options.initialPaginationPage ?? 1)
  const baseRowHeight = ref<number>(options.initialBaseRowHeight ?? 31)
  const pivotViewMode = ref<DataGridAppPivotViewMode>(options.initialPivotViewMode ?? "pivot")
  const pivotLayout = ref(options.initialPivotLayout as TPivotLayoutId | null) as Ref<TPivotLayoutId | null>
  const isRefreshCellsPanelOpen = ref(false)
  const refreshRowKeysInput = ref("")
  const refreshColumnKeysInput = ref("")
  const isStatePanelOpen = ref(false)
  const stateImportText = ref("")
  const stateOutputText = ref("")
  const isComputePolicyPanelOpen = ref(false)
  const projectionMode = ref<"mutable" | "immutable" | "excel-like">("immutable")
  const computeMode = ref<"sync" | "worker">("sync")
  const computeDiagnosticsOutput = ref("")
  const isPivotAdvancedPanelOpen = ref(false)
  const pivotAdvancedImportText = ref("")
  const pivotAdvancedOutputText = ref("")

  const scheduleViewportSync = (): void => {
    if (!options.syncViewport) {
      return
    }
    void nextTick(() => {
      options.syncViewport?.()
    })
  }

  const normalizedBaseRowHeight = computed<number>(() => {
    const candidate = Number.isFinite(baseRowHeight.value) ? Math.trunc(baseRowHeight.value) : 31
    return Math.max(MIN_ROW_HEIGHT, candidate)
  })

  const buildGroupBySpec = (field: string): DataGridGroupBySpec | null => {
    const trimmed = field.trim()
    if (!trimmed) {
      return null
    }
    return {
      fields: [trimmed],
      expandedByDefault: true,
    }
  }

  const applySortAndFilter = (): void => {
    const sortModel: readonly DataGridSortState[] = sortState.value.map(entry => ({
      key: entry.key,
      direction: entry.direction,
    }))

    const nextColumnFilters: DataGridFilterSnapshot["columnFilters"] = {}
    for (const [columnKey, rawValue] of Object.entries(columnFilterTextByKey.value)) {
      const value = rawValue.trim()
      if (!value) {
        continue
      }
      nextColumnFilters[columnKey] = {
        kind: "predicate",
        operator: "contains",
        value,
        caseSensitive: false,
      }
    }

    const advancedExpression = options.appliedAdvancedFilterExpression.value
    const hasColumnFilters = Object.keys(nextColumnFilters).length > 0
    const nextFilter: DataGridFilterSnapshot | null = hasColumnFilters || advancedExpression
      ? {
          columnFilters: nextColumnFilters,
          advancedFilters: {},
          advancedExpression,
        }
      : null

    runtime.api.rows.setSortAndFilterModel({
      sortModel,
      filterModel: nextFilter,
    })
  }

  const applyGroupBy = (): void => {
    if (resolveMaybeRef(options.mode) === "pivot") {
      return
    }
    runtime.api.rows.setGroupBy(buildGroupBySpec(groupByField.value))
    scheduleViewportSync()
  }

  const applyPaginationSettings = (): void => {
    if (resolveMaybeRef(options.mode) !== "base") {
      runtime.api.rows.setPagination(null)
      return
    }
    if (rowRenderMode.value === "pagination") {
      const nextPageSize = Math.max(1, Math.trunc(paginationPageSize.value || 1))
      const nextPage = Math.max(1, Math.trunc(paginationPage.value || 1))
      paginationPageSize.value = nextPageSize
      paginationPage.value = nextPage
      runtime.api.rows.setPagination({
        pageSize: nextPageSize,
        currentPage: nextPage - 1,
      })
    } else {
      runtime.api.rows.setPagination(null)
    }
    scheduleViewportSync()
  }

  const applyRowHeightSettings = (): void => {
    if (resolveMaybeRef(options.mode) !== "base") {
      return
    }
    runtime.api.view.setRowHeightMode(rowHeightMode.value)
    runtime.api.view.setBaseRowHeight(normalizedBaseRowHeight.value)
  }

  const applyPivotConfiguration = (): void => {
    if (resolveMaybeRef(options.mode) !== "pivot") {
      return
    }
    const activePivotLayoutId = pivotLayout.value as TPivotLayoutId | null
    const nextPivotLayout = activePivotLayoutId == null
      ? null
      : (options.pivotLayouts?.[activePivotLayoutId] ?? null)
    runtime.api.pivot.setModel(pivotViewMode.value === "pivot" ? nextPivotLayout : null)
    runtime.api.rows.expandAllGroups()
    scheduleViewportSync()
  }

  const setColumnFilterText = (columnKey: string, value: string): void => {
    columnFilterTextByKey.value = {
      ...columnFilterTextByKey.value,
      [columnKey]: value,
    }
  }

  const toggleSortForColumn = (columnKey: string, additive = false): void => {
    const currentIndex = sortState.value.findIndex(entry => entry.key === columnKey)
    const current = currentIndex >= 0 ? sortState.value[currentIndex] : null

    if (!current) {
      const nextEntry: DataGridAppSortModel = { key: columnKey, direction: "asc" }
      sortState.value = additive ? [...sortState.value, nextEntry] : [nextEntry]
      return
    }

    if (current.direction === "asc") {
      const nextEntry: DataGridAppSortModel = { key: columnKey, direction: "desc" }
      if (additive) {
        sortState.value = sortState.value.map(entry => (
          entry.key === columnKey ? nextEntry : entry
        ))
        return
      }
      sortState.value = [nextEntry]
      return
    }

    if (additive) {
      sortState.value = sortState.value.filter(entry => entry.key !== columnKey)
      return
    }
    sortState.value = []
  }

  const sortIndicator = (columnKey: string): string => {
    const currentIndex = sortState.value.findIndex(entry => entry.key === columnKey)
    if (currentIndex < 0) {
      return ""
    }
    const current = sortState.value[currentIndex]
    if (!current) {
      return ""
    }
    const direction = current.direction === "asc" ? "↑" : "↓"
    return sortState.value.length > 1 ? `${direction}${currentIndex + 1}` : direction
  }

  const openRefreshCellsPanel = (): void => {
    isRefreshCellsPanelOpen.value = true
  }

  const closeRefreshCellsPanel = (): void => {
    isRefreshCellsPanelOpen.value = false
  }

  const refreshCellsByRowKeys = (): void => {
    const rowKeys = splitCsvTokens(refreshRowKeysInput.value)
    if (!rowKeys.length) {
      return
    }
    const defaultColumnKeys = visibleColumns.value.slice(0, 1).map(column => column.key)
    const columnKeys = splitCsvTokens(refreshColumnKeysInput.value)
    const keysToRefresh = columnKeys.length ? columnKeys : defaultColumnKeys
    if (!keysToRefresh.length) {
      return
    }
    runtime.api.view.refreshCellsByRowKeys(rowKeys, keysToRefresh)
  }

  const exportStatePayload = (): void => {
    stateOutputText.value = JSON.stringify(runtime.api.state.get(), null, 2)
  }

  const migrateStatePayload = (): void => {
    const raw = stateImportText.value.trim()
    if (!raw) {
      return
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      const migrated = runtime.api.state.migrate(parsed, { strict: false })
      stateOutputText.value = migrated
        ? JSON.stringify(migrated, null, 2)
        : "State migration failed"
    } catch {
      stateOutputText.value = "Invalid state JSON"
    }
  }

  const applyStatePayload = (): void => {
    const raw = stateImportText.value.trim()
    if (!raw) {
      return
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      const migrated = runtime.api.state.migrate(parsed, { strict: false })
      if (!migrated) {
        stateOutputText.value = "State migration failed"
        return
      }
      runtime.api.state.set(migrated, {
        applyColumns: true,
        applySelection: true,
        applyViewport: true,
        strict: false,
      })
      stateOutputText.value = "State applied"
      scheduleViewportSync()
    } catch {
      stateOutputText.value = "Invalid state JSON"
    }
  }

  const openStatePanel = (): void => {
    isStatePanelOpen.value = true
    exportStatePayload()
  }

  const closeStatePanel = (): void => {
    isStatePanelOpen.value = false
  }

  const computeSupported = computed<boolean>(() => runtime.api.compute.hasSupport())

  const refreshComputeDiagnostics = (): void => {
    computeDiagnosticsOutput.value = JSON.stringify({
      mode: runtime.api.compute.getMode(),
      projectionMode: runtime.api.policy.getProjectionMode(),
      diagnostics: runtime.api.compute.getDiagnostics(),
    }, null, 2)
  }

  const openComputePolicyPanel = (): void => {
    isComputePolicyPanelOpen.value = true
    projectionMode.value = runtime.api.policy.getProjectionMode()
    computeMode.value = (runtime.api.compute.getMode() ?? "sync") as "sync" | "worker"
    refreshComputeDiagnostics()
  }

  const closeComputePolicyPanel = (): void => {
    isComputePolicyPanelOpen.value = false
  }

  const applyProjectionMode = (): void => {
    projectionMode.value = runtime.api.policy.setProjectionMode(projectionMode.value)
    refreshComputeDiagnostics()
  }

  const applyComputeMode = (): void => {
    if (!runtime.api.compute.hasSupport()) {
      return
    }
    runtime.api.compute.switchMode(computeMode.value)
    computeMode.value = (runtime.api.compute.getMode() ?? computeMode.value) as "sync" | "worker"
    refreshComputeDiagnostics()
  }

  const openPivotAdvancedPanel = (): void => {
    isPivotAdvancedPanelOpen.value = true
  }

  const closePivotAdvancedPanel = (): void => {
    isPivotAdvancedPanelOpen.value = false
  }

  const exportPivotLayout = (): void => {
    if (resolveMaybeRef(options.mode) !== "pivot") {
      return
    }
    pivotAdvancedOutputText.value = JSON.stringify(runtime.api.pivot.exportLayout() as DataGridPivotLayoutSnapshot<TRow>, null, 2)
  }

  const exportPivotInterop = (): void => {
    if (resolveMaybeRef(options.mode) !== "pivot") {
      return
    }
    pivotAdvancedOutputText.value = JSON.stringify(runtime.api.pivot.exportInterop() as DataGridPivotInteropSnapshot<TRow> | null, null, 2)
  }

  const importPivotLayout = (): void => {
    if (resolveMaybeRef(options.mode) !== "pivot") {
      return
    }
    const raw = pivotAdvancedImportText.value.trim()
    if (!raw) {
      return
    }
    try {
      runtime.api.pivot.importLayout(JSON.parse(raw) as DataGridPivotLayoutSnapshot<TRow>)
      runtime.api.rows.expandAllGroups()
      scheduleViewportSync()
    } catch {
      pivotAdvancedOutputText.value = "Invalid layout JSON"
    }
  }

  const pivotColumnCount = computed<number>(() => {
    return visibleColumns.value.filter(column => column.key.startsWith("pivot|")).length
  })

  watch(
    [sortState, columnFilterTextByKey, options.appliedAdvancedFilterExpression],
    applySortAndFilter,
    { immediate: true, deep: true },
  )

  watch(groupByField, () => {
    applyGroupBy()
  }, { immediate: true })

  watch([rowRenderMode, paginationPageSize, paginationPage], () => {
    applyPaginationSettings()
  }, { immediate: true })

  watch([rowHeightMode, normalizedBaseRowHeight], () => {
    applyRowHeightSettings()
  }, { immediate: true })

  watch([pivotLayout, pivotViewMode], () => {
    applyPivotConfiguration()
  }, { immediate: true })

  return {
    visibleColumns,
    columnFilterTextByKey,
    groupByField,
    sortState,
    rowHeightMode,
    rowRenderMode,
    paginationPageSize,
    paginationPage,
    baseRowHeight,
    normalizedBaseRowHeight,
    pivotViewMode,
    pivotLayout,
    pivotColumnCount,
    isRefreshCellsPanelOpen,
    refreshRowKeysInput,
    refreshColumnKeysInput,
    isStatePanelOpen,
    stateImportText,
    stateOutputText,
    isComputePolicyPanelOpen,
    projectionMode,
    computeMode,
    computeDiagnosticsOutput,
    computeSupported,
    isPivotAdvancedPanelOpen,
    pivotAdvancedImportText,
    pivotAdvancedOutputText,
    setColumnFilterText,
    toggleSortForColumn,
    sortIndicator,
    applySortAndFilter,
    applyGroupBy,
    applyPaginationSettings,
    applyRowHeightSettings,
    applyPivotConfiguration,
    openRefreshCellsPanel,
    closeRefreshCellsPanel,
    refreshCellsByRowKeys,
    openStatePanel,
    closeStatePanel,
    exportStatePayload,
    migrateStatePayload,
    applyStatePayload,
    openComputePolicyPanel,
    closeComputePolicyPanel,
    refreshComputeDiagnostics,
    applyProjectionMode,
    applyComputeMode,
    openPivotAdvancedPanel,
    closePivotAdvancedPanel,
    exportPivotLayout,
    exportPivotInterop,
    importPivotLayout,
  }
}
