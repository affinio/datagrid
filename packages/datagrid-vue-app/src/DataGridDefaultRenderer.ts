import {
  type Component,
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
  type Ref,
} from "vue"
import type {
  DataGridAggOp,
  DataGridAggregationModel,
  DataGridColumnPin,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPivotSpec,
  DataGridAppColumnLayoutDraftColumn,
  DataGridSortState,
  DataGridAppAdvancedFilterColumnOption,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import {
  cloneDataGridFilterSnapshot,
  type GridSelectionPointLike,
  type DataGridRowId,
  type DataGridApiDiagnosticsSnapshot,
  useDataGridAppAdvancedFilterBuilder,
  useDataGridAppColumnLayoutPanel,
  useDataGridAppDiagnosticsPanel,
} from "@affino/datagrid-vue"
import DataGridAdvancedFilterPopover from "./DataGridAdvancedFilterPopover.vue"
import DataGridAggregationsPopover from "./DataGridAggregationsPopover.vue"
import DataGridColumnLayoutPopover from "./DataGridColumnLayoutPopover.vue"
import DataGridDiagnosticsPopover from "./DataGridDiagnosticsPopover.vue"
import DataGridModuleHost, { type DataGridAppToolbarModule } from "./DataGridModuleHost"
import DataGridTableStage from "./DataGridTableStage.vue"
import type { DataGridAdvancedFilterOptions } from "./dataGridAdvancedFilter"
import type { DataGridAggregationsOptions, DataGridAggregationPanelItem } from "./dataGridAggregations"
import type { DataGridColumnLayoutOptions } from "./dataGridColumnLayout"
import type { DataGridDiagnosticsOptions } from "./dataGridDiagnostics"
import type { DataGridColumnMenuOptions } from "./dataGridColumnMenu"
import type { DataGridVirtualizationOptions } from "./dataGridVirtualization"
import { useDataGridTableStageRuntime } from "./useDataGridTableStageRuntime"

type DataGridMode = "base" | "tree" | "pivot" | "worker"

interface SortToggleState {
  key: string
  direction: "asc" | "desc"
}

function normalizeBaseRowHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 31
  }
  return Math.max(24, Math.trunc(value))
}

function resolveInitialSortState(sortModel: readonly DataGridSortState[] | undefined): SortToggleState[] {
  return (sortModel ?? []).map(entry => ({
    key: entry.key,
    direction: entry.direction,
  }))
}

function createEmptyFilterModel(): DataGridFilterSnapshot {
  return {
    columnFilters: {},
    advancedFilters: {},
    advancedExpression: null,
  }
}

function cloneFilterModelState(
  filterModel: DataGridFilterSnapshot | null | undefined,
): DataGridFilterSnapshot {
  return cloneDataGridFilterSnapshot(filterModel ?? createEmptyFilterModel()) ?? createEmptyFilterModel()
}

function normalizeColumnMenuToken(token: string): string {
  return token.startsWith("string:")
    ? `string:${token.slice("string:".length).toLowerCase()}`
    : token
}

function pruneFilterModel(filterModel: DataGridFilterSnapshot): DataGridFilterSnapshot | null {
  const columnFilters: DataGridFilterSnapshot["columnFilters"] = {}
  for (const [columnKey, entry] of Object.entries(filterModel.columnFilters ?? {})) {
    if (entry.kind === "valueSet") {
      const tokens = Array.from(new Set(
        (entry.tokens ?? [])
          .map(token => normalizeColumnMenuToken(String(token ?? "")))
          .filter(token => token.length > 0),
      ))
      if (tokens.length === 0) {
        continue
      }
      columnFilters[columnKey] = {
        kind: "valueSet",
        tokens,
      }
      continue
    }
    columnFilters[columnKey] = {
      kind: "predicate",
      operator: entry.operator,
      value: entry.value,
      value2: entry.value2,
      caseSensitive: entry.caseSensitive,
    }
  }
  const advancedFilters = { ...(filterModel.advancedFilters ?? {}) }
  const advancedExpression = filterModel.advancedExpression ?? null
  if (
    Object.keys(columnFilters).length === 0
    && Object.keys(advancedFilters).length === 0
    && !advancedExpression
  ) {
    return null
  }
  return {
    columnFilters,
    advancedFilters,
    advancedExpression,
  }
}

function resolveInitialFilterTexts(filterModel: DataGridFilterSnapshot | null | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  const columnFilters = filterModel?.columnFilters ?? {}
  for (const [columnKey, filter] of Object.entries(columnFilters)) {
    if (filter?.kind === "predicate" && typeof filter.value === "string") {
      result[columnKey] = filter.value
    }
  }
  return result
}

function cloneRowData<TRow>(row: TRow): TRow {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(row)
  }
  if (row && typeof row === "object") {
    return { ...(row as Record<string, unknown>) } as TRow
  }
  return row
}

function cloneAggregationModelState<TRow>(
  model: DataGridAggregationModel<TRow> | null | undefined,
): DataGridAggregationModel<TRow> | null {
  if (!model) {
    return null
  }
  return {
    columns: model.columns.map(column => ({ ...column })),
    basis: model.basis === "source" ? "source" : "filtered",
  }
}

const NUMERIC_AGG_OPS: readonly DataGridAggOp[] = [
  "sum",
  "avg",
  "min",
  "max",
  "count",
  "countNonNull",
  "first",
  "last",
]
const ORDERED_AGG_OPS: readonly DataGridAggOp[] = [
  "min",
  "max",
  "count",
  "countNonNull",
  "first",
  "last",
]
const BASIC_AGG_OPS: readonly DataGridAggOp[] = [
  "count",
  "countNonNull",
  "first",
  "last",
]

function resolveAllowedAggregationOps(dataType: string | undefined): readonly DataGridAggOp[] {
  if (dataType === "number" || dataType === "currency" || dataType === "percent") {
    return NUMERIC_AGG_OPS
  }
  if (dataType === "date" || dataType === "datetime") {
    return ORDERED_AGG_OPS
  }
  return BASIC_AGG_OPS
}

export default defineComponent({
  name: "DataGridDefaultRenderer",
  props: {
    mode: {
      type: String as PropType<DataGridMode>,
      required: true,
    },
    rows: {
      type: Array as PropType<readonly Record<string, unknown>[]>,
      default: () => [],
    },
    runtime: {
      type: Object as PropType<Pick<UseDataGridRuntimeResult<Record<string, unknown>>, "api" | "syncRowsInRange" | "virtualWindow" | "columnSnapshot">>,
      required: true,
    },
    runtimeRowModel: {
      type: Object as PropType<{ subscribe: (listener: () => void) => () => void }>,
      required: true,
    },
    selectionSnapshot: {
      type: Object as PropType<Ref<import("@affino/datagrid-vue").DataGridSelectionSnapshot | null>>,
      required: true,
    },
    selectionAnchor: {
      type: Object as PropType<Ref<GridSelectionPointLike<DataGridRowId> | null>>,
      required: true,
    },
    syncSelectionSnapshotFromRuntime: {
      type: Function as PropType<() => void>,
      required: true,
    },
    sortModel: {
      type: Array as PropType<readonly DataGridSortState[] | undefined>,
      default: undefined,
    },
    filterModel: {
      type: Object as PropType<DataGridFilterSnapshot | null | undefined>,
      default: undefined,
    },
    groupBy: {
      type: Object as PropType<DataGridGroupBySpec | null | undefined>,
      default: undefined,
    },
    pivotModel: {
      type: Object as PropType<DataGridPivotSpec | null | undefined>,
      default: undefined,
    },
    renderMode: {
      type: String as PropType<"virtualization" | "pagination">,
      default: "virtualization",
    },
    virtualization: {
      type: Object as PropType<DataGridVirtualizationOptions>,
      required: true,
    },
    columnMenu: {
      type: Object as PropType<DataGridColumnMenuOptions>,
      required: true,
    },
    columnLayout: {
      type: Object as PropType<DataGridColumnLayoutOptions>,
      required: true,
    },
    diagnostics: {
      type: Object as PropType<DataGridDiagnosticsOptions>,
      required: true,
    },
    aggregations: {
      type: Object as PropType<DataGridAggregationsOptions>,
      required: true,
    },
    advancedFilter: {
      type: Object as PropType<DataGridAdvancedFilterOptions>,
      required: true,
    },
    rowHeightMode: {
      type: String as PropType<"fixed" | "auto">,
      default: "fixed",
    },
    baseRowHeight: {
      type: Number,
      default: 31,
    },
    rowHover: {
      type: Boolean,
      default: false,
    },
    stripedRows: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const rowVersion = ref(0)
    const sortState = ref<SortToggleState[]>(resolveInitialSortState(props.sortModel))
    const filterModelState = ref<DataGridFilterSnapshot>(cloneFilterModelState(props.filterModel))
    const columnFilterTextByKey = computed<Record<string, string>>(() => (
      resolveInitialFilterTexts(filterModelState.value)
    ))

    const unsubscribeRowModel = props.runtimeRowModel.subscribe(() => {
      rowVersion.value += 1
    })

    onBeforeUnmount(() => {
      unsubscribeRowModel()
    })

    watch(
      () => props.sortModel,
      nextSortModel => {
        sortState.value = resolveInitialSortState(nextSortModel)
      },
      { deep: true },
    )

    watch(
      () => props.filterModel,
      nextFilterModel => {
        filterModelState.value = cloneFilterModelState(nextFilterModel)
      },
      { deep: true },
    )

    const modeRef = computed(() => props.mode)
    const rowsRef = computed(() => props.rows)
    const totalRows = computed(() => {
      void rowVersion.value
      return props.runtime.api.rows.getSnapshot().rowCount
    })
    const visibleColumns = computed(() => props.runtime.columnSnapshot.value.visibleColumns)
    const allColumns = computed(() => props.runtime.columnSnapshot.value.columns ?? [])
    const advancedFilterColumns = computed<readonly DataGridAppAdvancedFilterColumnOption[]>(() => {
      return visibleColumns.value
        .filter(column => column.visible !== false)
        .map(column => ({
          key: column.key,
          label: column.column.label ?? column.key,
        }))
    })
    const columnLayoutDraftColumns = computed<readonly DataGridAppColumnLayoutDraftColumn[]>(() => {
      return allColumns.value.map(column => ({
        key: column.key,
        label: column.column.label ?? column.key,
        visible: column.visible !== false,
      }))
    })
    const aggregatableColumns = computed(() => {
      return allColumns.value
        .filter(column => column.column.capabilities?.aggregatable === true)
        .map(column => ({
          key: column.key,
          label: column.column.label ?? column.key,
          allowedOps: resolveAllowedAggregationOps(column.column.dataType),
        }))
    })
    const rowHeightMode = ref(props.rowHeightMode)
    const normalizedBaseRowHeight = computed(() => normalizeBaseRowHeight(props.baseRowHeight))
    const firstColumnKey = computed<string>(() => visibleColumns.value[0]?.key ?? "name")
    const {
      isColumnLayoutPanelOpen,
      columnLayoutPanelItems,
      openColumnLayoutPanel,
      cancelColumnLayoutPanel,
      applyColumnLayoutPanel,
      moveColumnUp,
      moveColumnDown,
      updateColumnVisibility,
    } = useDataGridAppColumnLayoutPanel({
      resolveColumns: () => columnLayoutDraftColumns.value,
      applyColumnLayout: payload => {
        props.runtime.api.columns.setOrder(payload.order)
        for (const [columnKey, visible] of Object.entries(payload.visibilityByKey)) {
          props.runtime.api.columns.setVisibility(columnKey, visible)
        }
      },
    })
    const {
      isDiagnosticsPanelOpen,
      diagnosticsSnapshot,
      openDiagnosticsPanel,
      closeDiagnosticsPanel,
      refreshDiagnosticsPanel,
    } = useDataGridAppDiagnosticsPanel<DataGridApiDiagnosticsSnapshot>({
      readDiagnostics: () => props.runtime.api.diagnostics.getAll(),
    })
    const {
      isAdvancedFilterPanelOpen,
      advancedFilterDraftClauses,
      appliedAdvancedFilterExpression,
      openAdvancedFilterPanel,
      addAdvancedFilterClause,
      removeAdvancedFilterClause,
      updateAdvancedFilterClause,
      cancelAdvancedFilterPanel,
      applyAdvancedFilterPanel,
    } = useDataGridAppAdvancedFilterBuilder({
      resolveColumns: () => advancedFilterColumns.value,
    })
    const isAggregationsPanelOpen = ref(false)
    const aggregationDraftModel = ref<DataGridAggregationModel<Record<string, unknown>> | null>(null)
    const currentAggregationModel = computed<DataGridAggregationModel<Record<string, unknown>> | null>(() => {
      void rowVersion.value
      return cloneAggregationModelState(props.runtime.api.rows.getAggregationModel())
    })
    const aggregationPanelItems = computed<readonly DataGridAggregationPanelItem[]>(() => {
      const enabledByKey = new Map<string, DataGridAggOp>(
        (aggregationDraftModel.value?.columns ?? []).map(column => [column.key, column.op]),
      )
      return aggregatableColumns.value.map(column => {
        const firstAllowedOp = column.allowedOps[0] ?? "count"
        const currentOp = enabledByKey.get(column.key)
        const normalizedOp = currentOp && column.allowedOps.includes(currentOp) ? currentOp : firstAllowedOp
        return {
          key: column.key,
          label: column.label,
          enabled: enabledByKey.has(column.key),
          op: normalizedOp,
          allowedOps: column.allowedOps,
        }
      })
    })
    const aggregationBasis = computed<"filtered" | "source">(() => {
      return aggregationDraftModel.value?.basis === "source" ? "source" : "filtered"
    })

    watch(
      currentAggregationModel,
      nextModel => {
        if (isAggregationsPanelOpen.value) {
          return
        }
        aggregationDraftModel.value = cloneAggregationModelState(nextModel)
      },
      { immediate: true, deep: true },
    )

    watch(
      () => props.rowHeightMode,
      nextMode => {
        rowHeightMode.value = nextMode
      },
    )

    const isColumnFilterActive = (columnKey: string): boolean => {
      const entry = filterModelState.value.columnFilters?.[columnKey]
      if (!entry) {
        return false
      }
      return entry.kind === "valueSet"
        ? entry.tokens.length > 0
        : true
    }

    const resolveCurrentValueFilterTokens = (columnKey: string): readonly string[] => {
      const entry = filterModelState.value.columnFilters?.[columnKey]
      if (!entry || entry.kind !== "valueSet") {
        return []
      }
      return entry.tokens.map(token => normalizeColumnMenuToken(String(token ?? "")))
    }

    const applySortAndFilter = (): void => {
      const nextSortModel: readonly DataGridSortState[] = sortState.value.map(entry => ({
        key: entry.key,
        direction: entry.direction,
      }))
      const advancedExpression = props.advancedFilter.enabled
        ? appliedAdvancedFilterExpression.value
        : (filterModelState.value.advancedExpression ?? null)

      props.runtime.api.rows.setSortAndFilterModel({
        sortModel: nextSortModel,
        filterModel: pruneFilterModel({
          ...filterModelState.value,
          advancedExpression,
        }),
      })
    }

    watch(
      appliedAdvancedFilterExpression,
      () => {
        if (!props.advancedFilter.enabled) {
          return
        }
        applySortAndFilter()
      },
      { deep: true },
    )

    const toggleSortForColumn = (columnKey: string, additive = false): void => {
      const currentIndex = sortState.value.findIndex(entry => entry.key === columnKey)
      const current = currentIndex >= 0 ? sortState.value[currentIndex] : null

      if (!current) {
        const nextEntry: SortToggleState = { key: columnKey, direction: "asc" }
        sortState.value = additive ? [...sortState.value, nextEntry] : [nextEntry]
        applySortAndFilter()
        return
      }

      if (current.direction === "asc") {
        const nextEntry: SortToggleState = { key: columnKey, direction: "desc" }
        if (additive) {
          sortState.value = sortState.value.map(entry => (
            entry.key === columnKey ? nextEntry : entry
          ))
        } else {
          sortState.value = [nextEntry]
        }
        applySortAndFilter()
        return
      }

      sortState.value = additive
        ? sortState.value.filter(entry => entry.key !== columnKey)
        : []
      applySortAndFilter()
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

    const setColumnFilterText = (columnKey: string, value: string): void => {
      const nextFilterModel = cloneFilterModelState(filterModelState.value)
      const normalizedValue = value.trim()
      if (!normalizedValue) {
        delete nextFilterModel.columnFilters[columnKey]
      } else {
        nextFilterModel.columnFilters[columnKey] = {
          kind: "predicate",
          operator: "contains",
          value: normalizedValue,
          caseSensitive: false,
        }
      }
      filterModelState.value = nextFilterModel
      applySortAndFilter()
    }

    const applyRowHeightSettings = (): void => {
      props.runtime.api.view.setRowHeightMode(rowHeightMode.value)
      props.runtime.api.view.setBaseRowHeight(normalizedBaseRowHeight.value)
    }

    const openAggregationsPanel = (): void => {
      aggregationDraftModel.value = cloneAggregationModelState(currentAggregationModel.value)
      isAggregationsPanelOpen.value = true
    }

    const cancelAggregationsPanel = (): void => {
      aggregationDraftModel.value = cloneAggregationModelState(currentAggregationModel.value)
      isAggregationsPanelOpen.value = false
    }

    const clearAggregationsPanel = (): void => {
      aggregationDraftModel.value = null
    }

    const updateAggregationBasis = (basis: "filtered" | "source"): void => {
      aggregationDraftModel.value = {
        basis,
        columns: aggregationDraftModel.value?.columns ?? [],
      }
    }

    const toggleAggregationColumn = (key: string, enabled: boolean): void => {
      const column = aggregatableColumns.value.find(candidate => candidate.key === key)
      if (!column) {
        return
      }
      const existingColumns = aggregationDraftModel.value?.columns ?? []
      if (!enabled) {
        const nextColumns = existingColumns.filter(candidate => candidate.key !== key)
        aggregationDraftModel.value = nextColumns.length > 0
          ? { basis: aggregationBasis.value, columns: nextColumns }
          : null
        return
      }
      const existing = existingColumns.find(candidate => candidate.key === key)
      const nextColumn = existing ?? {
        key,
        op: column.allowedOps[0] ?? "count",
      }
      aggregationDraftModel.value = {
        basis: aggregationBasis.value,
        columns: [
          ...existingColumns.filter(candidate => candidate.key !== key),
          nextColumn,
        ],
      }
    }

    const updateAggregationOp = (key: string, op: string): void => {
      const column = aggregatableColumns.value.find(candidate => candidate.key === key)
      if (!column || !column.allowedOps.includes(op as DataGridAggOp)) {
        return
      }
      const nextColumns = (aggregationDraftModel.value?.columns ?? []).map(candidate => {
        if (candidate.key !== key) {
          return candidate
        }
        return {
          ...candidate,
          op: op as DataGridAggOp,
        }
      })
      aggregationDraftModel.value = {
        basis: aggregationBasis.value,
        columns: nextColumns,
      }
    }

    const applyAggregationsPanel = (): void => {
      const nextModel = aggregationDraftModel.value && aggregationDraftModel.value.columns.length > 0
        ? aggregationDraftModel.value
        : null
      props.runtime.api.rows.setAggregationModel(nextModel)
      aggregationDraftModel.value = cloneAggregationModelState(nextModel)
      isAggregationsPanelOpen.value = false
    }

    const resolveColumnMenuSortDirection = (columnKey: string): "asc" | "desc" | null => {
      return sortState.value.find(entry => entry.key === columnKey)?.direction ?? null
    }

    const applyColumnMenuSort = (columnKey: string, direction: "asc" | "desc" | null): void => {
      const targetColumn = visibleColumns.value.find(column => column.key === columnKey)
      if (!targetColumn || targetColumn.column.capabilities?.sortable === false) {
        return
      }
      sortState.value = direction === null
        ? sortState.value.filter(entry => entry.key !== columnKey)
        : [{ key: columnKey, direction }]
      applySortAndFilter()
    }

    const applyColumnMenuPin = (columnKey: string, pin: DataGridColumnPin): void => {
      props.runtime.api.columns.setPin(columnKey, pin)
    }

    const applyColumnMenuFilter = (columnKey: string, tokens: readonly string[]): void => {
      const normalizedTokens = Array.from(new Set(
        tokens
          .map(token => normalizeColumnMenuToken(String(token ?? "")))
          .filter(token => token.length > 0),
      ))
      if (normalizedTokens.length === 0) {
        clearColumnMenuFilter(columnKey)
        return
      }
      const nextFilterModel = cloneFilterModelState(filterModelState.value)
      nextFilterModel.columnFilters[columnKey] = {
        kind: "valueSet",
        tokens: normalizedTokens,
      }
      filterModelState.value = nextFilterModel
      applySortAndFilter()
    }

    const clearColumnMenuFilter = (columnKey: string): void => {
      const nextFilterModel = cloneFilterModelState(filterModelState.value)
      delete nextFilterModel.columnFilters[columnKey]
      filterModelState.value = nextFilterModel
      applySortAndFilter()
    }

    const {
      tableStageProps,
    } = useDataGridTableStageRuntime<Record<string, unknown>>({
      mode: modeRef as Ref<DataGridMode>,
      rows: rowsRef,
      sourceRows: rowsRef,
      runtime: props.runtime,
      rowVersion,
      totalRows,
      visibleColumns,
      rowRenderMode: computed(() => props.renderMode),
      rowHeightMode,
      normalizedBaseRowHeight,
      selectionSnapshot: props.selectionSnapshot,
      selectionAnchor: props.selectionAnchor,
      syncSelectionSnapshotFromRuntime: props.syncSelectionSnapshotFromRuntime,
      firstColumnKey,
      columnFilterTextByKey,
      virtualization: computed(() => props.virtualization),
      toggleSortForColumn,
      sortIndicator,
      setColumnFilterText,
      columnMenuEnabled: computed(() => props.columnMenu.enabled),
      columnMenuMaxFilterValues: computed(() => props.columnMenu.maxFilterValues),
      isColumnFilterActive,
      resolveColumnMenuSortDirection,
      resolveColumnMenuSelectedTokens: resolveCurrentValueFilterTokens,
      applyColumnMenuSort,
      applyColumnMenuPin,
      applyColumnMenuFilter,
      clearColumnMenuFilter,
      applyRowHeightSettings,
      cloneRowData,
    })
    const toolbarModules = computed<readonly DataGridAppToolbarModule[]>(() => {
      const modules: DataGridAppToolbarModule[] = []
      if (props.columnLayout.enabled) {
        modules.push({
          key: "column-layout",
          component: DataGridColumnLayoutPopover as Component,
          props: {
            isOpen: isColumnLayoutPanelOpen.value,
            items: columnLayoutPanelItems.value,
            buttonLabel: props.columnLayout.buttonLabel,
            active: false,
            onOpen: openColumnLayoutPanel,
            onToggleVisibility: updateColumnVisibility,
            onMoveUp: moveColumnUp,
            onMoveDown: moveColumnDown,
            onApply: applyColumnLayoutPanel,
            onCancel: cancelColumnLayoutPanel,
          },
        })
      }
      if (props.diagnostics.enabled) {
        modules.push({
          key: "diagnostics",
          component: DataGridDiagnosticsPopover as Component,
          props: {
            isOpen: isDiagnosticsPanelOpen.value,
            snapshot: diagnosticsSnapshot.value,
            buttonLabel: props.diagnostics.buttonLabel,
            active: isDiagnosticsPanelOpen.value,
            onOpen: openDiagnosticsPanel,
            onClose: closeDiagnosticsPanel,
            onRefresh: refreshDiagnosticsPanel,
          },
        })
      }
      if (props.advancedFilter.enabled) {
        modules.push({
          key: "advanced-filter",
          component: DataGridAdvancedFilterPopover as Component,
          props: {
            isOpen: isAdvancedFilterPanelOpen.value,
            clauses: advancedFilterDraftClauses.value,
            columns: advancedFilterColumns.value,
            buttonLabel: props.advancedFilter.buttonLabel,
            active: appliedAdvancedFilterExpression.value != null,
            onOpen: openAdvancedFilterPanel,
            onAdd: addAdvancedFilterClause,
            onRemove: removeAdvancedFilterClause,
            onUpdateClause: updateAdvancedFilterClause,
            onApply: applyAdvancedFilterPanel,
            onCancel: cancelAdvancedFilterPanel,
          },
        })
      }
      if (props.aggregations.enabled && props.mode !== "pivot") {
        modules.push({
          key: "aggregations",
          component: DataGridAggregationsPopover as Component,
          props: {
            isOpen: isAggregationsPanelOpen.value,
            basis: aggregationBasis.value,
            items: aggregationPanelItems.value,
            buttonLabel: props.aggregations.buttonLabel,
            active: isAggregationsPanelOpen.value || Boolean(currentAggregationModel.value?.columns.length),
            onOpen: openAggregationsPanel,
            onUpdateBasis: updateAggregationBasis,
            onToggleColumn: toggleAggregationColumn,
            onUpdateOp: updateAggregationOp,
            onClear: clearAggregationsPanel,
            onApply: applyAggregationsPanel,
            onCancel: cancelAggregationsPanel,
          },
        })
      }
      return modules
    })

    return () => h("div", {
      class: "datagrid-app-layout",
    }, [
      h(DataGridModuleHost as Component, {
        modules: toolbarModules.value,
      }),
      h(DataGridTableStage as Component, {
        ...tableStageProps.value,
        sourceRows: props.rows,
        columnMenuEnabled: props.columnMenu.enabled,
        columnMenuMaxFilterValues: props.columnMenu.maxFilterValues,
        rowHover: props.rowHover,
        stripedRows: props.stripedRows,
        isColumnFilterActive,
        resolveColumnMenuSortDirection,
        resolveColumnMenuSelectedTokens: resolveCurrentValueFilterTokens,
        applyColumnMenuSort,
        applyColumnMenuPin,
        applyColumnMenuFilter,
        clearColumnMenuFilter,
      }),
    ])
  },
})
