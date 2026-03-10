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
  DataGridColumnPin,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPivotSpec,
  DataGridSortState,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import {
  cloneDataGridFilterSnapshot,
  type GridSelectionPointLike,
  type DataGridRowId,
} from "@affino/datagrid-vue"
import DataGridTableStage from "./DataGridTableStage.vue"
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
    const rowHeightMode = ref(props.rowHeightMode)
    const normalizedBaseRowHeight = computed(() => normalizeBaseRowHeight(props.baseRowHeight))
    const firstColumnKey = computed<string>(() => visibleColumns.value[0]?.key ?? "name")

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

      props.runtime.api.rows.setSortAndFilterModel({
        sortModel: nextSortModel,
        filterModel: pruneFilterModel(filterModelState.value),
      })
    }

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

    return () => h(DataGridTableStage as Component, {
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
    })
  },
})
