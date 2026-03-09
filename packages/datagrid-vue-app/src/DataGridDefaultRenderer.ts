import {
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
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPivotSpec,
  DataGridSelectionSnapshot,
  DataGridSortState,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import { useDataGridAppSelection } from "@affino/datagrid-vue"
import DataGridTableStage from "./DataGridTableStage.vue"
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
    rowHeightMode: {
      type: String as PropType<"fixed" | "auto">,
      default: "fixed",
    },
    baseRowHeight: {
      type: Number,
      default: 31,
    },
  },
  setup(props) {
    const rowVersion = ref(0)
    const sortState = ref<SortToggleState[]>(resolveInitialSortState(props.sortModel))
    const columnFilterTextByKey = ref<Record<string, string>>(resolveInitialFilterTexts(props.filterModel))

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
        columnFilterTextByKey.value = resolveInitialFilterTexts(nextFilterModel)
      },
      { deep: true },
    )

    const modeRef = computed(() => props.mode)
    const rowsRef = computed(() => props.rows)
    const totalRows = computed(() => props.runtime.api.rows.getCount())
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

    const {
      selectionSnapshot,
      selectionAnchor,
      syncSelectionSnapshotFromRuntime,
    } = useDataGridAppSelection<Record<string, unknown>>({
      mode: modeRef as Ref<DataGridMode>,
      resolveRuntime: () => props.runtime,
      visibleColumns,
      totalRows,
    })

    const applySortAndFilter = (): void => {
      const nextSortModel: readonly DataGridSortState[] = sortState.value.map(entry => ({
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

      props.runtime.api.rows.setSortAndFilterModel({
        sortModel: nextSortModel,
        filterModel: Object.keys(nextColumnFilters).length > 0
          ? {
              columnFilters: nextColumnFilters,
              advancedFilters: {},
              advancedExpression: null,
            }
          : null,
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
      const direction = current.direction === "asc" ? "↑" : "↓"
      return sortState.value.length > 1 ? `${direction}${currentIndex + 1}` : direction
    }

    const setColumnFilterText = (columnKey: string, value: string): void => {
      columnFilterTextByKey.value = {
        ...columnFilterTextByKey.value,
        [columnKey]: value,
      }
      applySortAndFilter()
    }

    const applyRowHeightSettings = (): void => {
      props.runtime.api.view.setRowHeightMode(rowHeightMode.value)
      props.runtime.api.view.setBaseRowHeight(normalizedBaseRowHeight.value)
    }

    const {
      tableStageProps,
    } = useDataGridTableStageRuntime<Record<string, unknown>>({
      mode: modeRef as Ref<DataGridMode>,
      rows: rowsRef,
      runtime: props.runtime,
      rowVersion,
      totalRows,
      visibleColumns,
      rowRenderMode: computed(() => props.renderMode),
      rowHeightMode,
      normalizedBaseRowHeight,
      selectionSnapshot,
      selectionAnchor,
      syncSelectionSnapshotFromRuntime,
      firstColumnKey,
      columnFilterTextByKey,
      virtualization: computed(() => props.virtualization),
      toggleSortForColumn,
      sortIndicator,
      setColumnFilterText,
      applyRowHeightSettings,
      cloneRowData,
    })

    return () => h(DataGridTableStage, tableStageProps.value)
  },
})
