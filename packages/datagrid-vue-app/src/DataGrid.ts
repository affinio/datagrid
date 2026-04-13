import {
  computed,
  defineComponent,
  type ExtractPublicPropTypes,
  h,
  onBeforeUnmount,
  ref,
  toRef,
  watch,
  type PropType,
  type VNode,
} from "vue"
import {
  type CreateDataGridCoreOptions,
  type DataGridApi,
  type DataGridApiRowSelectionChangedEvent,
  type DataGridApiSelectionChangedEvent,
  type DataGridApiPluginDefinition,
  type DataGridAggregationModel,
  type DataGridColumnModel,
  type DataGridColumnPin,
  type DataGridComputedFieldDefinition,
  type DataGridCoreServiceRegistry,
  type DataGridFilterSnapshot,
  type DataGridFormulaFieldDefinition,
  type DataGridFormulaFunctionRegistry,
  type DataGridGroupBySpec,
  type DataGridMigrateStateOptions,
  type DataGridRowNode,
  type DataGridRowSelectionSnapshot,
  type DataGridRowModel,
  type DataGridRowNodeInput,
  type DataGridSetStateOptions,
  type DataGridSortState,
  type DataGridUnifiedColumnState,
  type DataGridUnifiedState,
  type DataGridPivotSpec,
  type UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import {
  useDataGridAppRowSelection,
  useDataGridAppSelection,
} from "@affino/datagrid-vue/app"
import type { DataGridBivariantCallback } from "./types/bivariance"
import DataGridDefaultRenderer from "./host/DataGridDefaultRenderer"
import type { DataGridAppToolbarModule } from "./host/DataGridModuleHost"
import {
  resolveDataGridColumns,
  resolveDataGridFormulaRowModelOptions,
  type DataGridAppClientRowModelOptions,
  type DataGridAppColumnInput,
} from "./config/dataGridFormulaOptions"
import {
  resolveDataGridChrome,
  type DataGridChromeProp,
  type DataGridResolvedChromeOptions,
} from "./config/dataGridChrome"
import { type DataGridThemeProp } from "./theme/dataGridTheme"
import {
  resolveDataGridGroupBy,
  resolveDataGridPagination,
  resolveDataGridRenderMode,
  type DataGridGroupByProp,
  type DataGridPaginationProp,
} from "./config/dataGridPublicProps"
import {
  resolveDataGridAdvancedFilter,
  type DataGridAdvancedFilterOptions,
  type DataGridAdvancedFilterProp,
} from "./config/dataGridAdvancedFilter"
import {
  resolveDataGridFindReplace,
  type DataGridFindReplaceOptions,
  type DataGridFindReplaceProp,
} from "./config/dataGridFindReplace"
import {
  resolveDataGridGridLines,
  type DataGridGridLinesOptions,
  type DataGridGridLinesProp,
} from "./config/dataGridGridLines"
import {
  resolveDataGridLayoutOptions,
  type DataGridLayoutMode,
} from "./config/dataGridLayout"
import {
  resolveDataGridPlaceholderRows,
  type DataGridPlaceholderRowsOptions,
  type DataGridPlaceholderRowsProp,
} from "./config/dataGridPlaceholderRows"
import {
  migrateDataGridSavedView,
  sanitizeDataGridSavedView,
  type DataGridSavedViewSnapshot,
} from "./config/dataGridSavedView"
import {
  resolveDataGridColumnLayout,
  type DataGridColumnLayoutOptions,
  type DataGridColumnLayoutProp,
} from "./config/dataGridColumnLayout"
import {
  resolveDataGridColumnReorder,
  type DataGridColumnReorderOptions,
  type DataGridColumnReorderProp,
} from "./config/dataGridColumnReorder"
import {
  resolveDataGridRowReorder,
  type DataGridRowReorderOptions,
  type DataGridRowReorderProp,
} from "./config/dataGridRowReorder"
import {
  resolveDataGridAggregations,
  type DataGridAggregationsOptions,
  type DataGridAggregationsProp,
} from "./config/dataGridAggregations"
import {
  resolveDataGridColumnMenu,
  type DataGridColumnMenuOptions,
  type DataGridColumnMenuProp,
} from "./overlays/dataGridColumnMenu"
import {
  resolveDataGridCellMenu,
  resolveDataGridRowIndexMenu,
  type DataGridCellMenuOptions,
  type DataGridCellMenuProp,
  type DataGridRowIndexMenuOptions,
  type DataGridRowIndexMenuProp,
} from "./overlays/dataGridContextMenu"
import { type DataGridVirtualizationProp, resolveDataGridVirtualization } from "./config/dataGridVirtualization"
import DataGridRuntimeHost from "./host/DataGridRuntimeHost"
import {
  useDataGridAppControlledState,
  type UseDataGridAppControlledStateOptions,
} from "./useDataGridAppControlledState"
import { useDataGridAppRowModel } from "./useDataGridAppRowModel"
import type { DataGridCellEditablePredicate } from "./dataGridEditability"
import {
  createDisabledDataGridHistoryController,
  resolveDataGridHistory,
  type DataGridHistoryController,
  type DataGridHistoryProp,
} from "./dataGridHistory"
import type {
  DataGridAppViewMode,
  DataGridGanttProp,
} from "./gantt/dataGridGantt.types"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

type DataGridSelectionService = NonNullable<DataGridRuntimeOverrides["selection"]>

export type DataGridSelectionCellReader<TRow = unknown> = DataGridBivariantCallback<[
  row: DataGridRowNode<TRow>,
  columnKey: string,
], unknown>

export type DataGridFilterCellReader<TRow = unknown> = DataGridBivariantCallback<[
  row: DataGridRowNode<TRow>,
  columnKey: string,
], unknown>

export function defineDataGridSelectionCellReader<TRow = unknown>() {
  return <TReader extends DataGridSelectionCellReader<TRow>>(reader: TReader): TReader => reader
}

export function defineDataGridFilterCellReader<TRow = unknown>() {
  return <TReader extends DataGridFilterCellReader<TRow>>(reader: TReader): TReader => reader
}

type DataGridBodyAwareRuntime = {
  api: UseDataGridRuntimeResult<Record<string, unknown>>["api"]
  syncBodyRowsInRange: UseDataGridRuntimeResult<Record<string, unknown>>["syncBodyRowsInRange"]
  setViewportRange: UseDataGridRuntimeResult<Record<string, unknown>>["setViewportRange"]
  setRows: UseDataGridRuntimeResult<Record<string, unknown>>["setRows"]
  rowPartition: UseDataGridRuntimeResult<Record<string, unknown>>["rowPartition"]
  virtualWindow: UseDataGridRuntimeResult<Record<string, unknown>>["virtualWindow"]
  columnSnapshot: UseDataGridRuntimeResult<Record<string, unknown>>["columnSnapshot"]
  setVirtualWindowRange?: (range: { start: number; end: number }) => void
} & {
  getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<Record<string, unknown>> | null
  resolveBodyRowIndexById: (rowId: string | number) => number
}

function readDataGridRowValueByPath(source: unknown, path: string): unknown {
  if (!path || typeof source !== "object" || source === null) {
    return undefined
  }
  const segments = path.split(".").filter(Boolean)
  let current: unknown = source
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined
      }
      current = current[index]
      continue
    }
    if (typeof current !== "object" || current === null || !(segment in (current as Record<string, unknown>))) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function createDataGridReadFilterCell(
  columns: readonly DataGridAppColumnInput[] | undefined,
  explicitReadFilterCell?: DataGridFilterCellReader,
): DataGridFilterCellReader | undefined {
  const columnsByKey = new Map<string, DataGridAppColumnInput>()
  for (const column of columns ?? []) {
    const key = String(column.key ?? "").trim()
    if (!key) {
      continue
    }
    columnsByKey.set(key, column)
  }
  if (columnsByKey.size === 0 && typeof explicitReadFilterCell !== "function") {
    return undefined
  }
  return (rowNode: DataGridRowNode<unknown>, columnKey: string) => {
    if (typeof explicitReadFilterCell === "function") {
      const explicitValue = explicitReadFilterCell(rowNode, columnKey)
      if (typeof explicitValue !== "undefined") {
        return explicitValue
      }
    }
    const column = columnsByKey.get(String(columnKey ?? "").trim())
    if (!column) {
      return undefined
    }
    const rowData = rowNode.data as Record<string, unknown>
    if (typeof column.valueGetter === "function") {
      return column.valueGetter(rowData)
    }
    if (typeof column.accessor === "function") {
      return column.accessor(rowData)
    }
    const field = typeof column.field === "string" ? column.field.trim() : ""
    if (!field) {
      return undefined
    }
    const directValue = rowData[field]
    if (typeof directValue !== "undefined") {
      return directValue
    }
    return readDataGridRowValueByPath(rowData, field)
  }
}

function createDisabledRowSelectionService(): DataGridSelectionService {
  return {
    name: "selection",
    getRowSelectionSnapshot: () => null,
    setRowSelectionSnapshot: () => undefined,
    clearRowSelection: () => undefined,
    getFocusedRow: () => null,
    setFocusedRow: () => undefined,
    getSelectedRows: () => [],
    isRowSelected: () => false,
    setRowSelected: () => undefined,
    selectRows: () => undefined,
    deselectRows: () => undefined,
    clearSelectedRows: () => undefined,
  }
}

function composeSelectionLifecycle(
  hook: "init" | "start" | "stop" | "dispose",
  services: readonly (DataGridSelectionService | undefined)[],
): DataGridSelectionService[typeof hook] {
  const handlers = services
    .map(service => service?.[hook])
    .filter((handler): handler is NonNullable<DataGridSelectionService[typeof hook]> => typeof handler === "function")
  if (handlers.length === 0) {
    return undefined
  }
  return async context => {
    for (const handler of handlers) {
      await handler(context)
    }
  }
}

function composeSelectionService(options: {
  userSelectionService?: DataGridSelectionService
  cellSelectionService: DataGridSelectionService
  rowSelectionService: DataGridSelectionService
}): DataGridSelectionService {
  const {
    userSelectionService,
    cellSelectionService,
    rowSelectionService,
  } = options
  return {
    name: "selection",
    init: composeSelectionLifecycle("init", [userSelectionService, cellSelectionService, rowSelectionService]),
    start: composeSelectionLifecycle("start", [userSelectionService, cellSelectionService, rowSelectionService]),
    stop: composeSelectionLifecycle("stop", [userSelectionService, cellSelectionService, rowSelectionService]),
    dispose: composeSelectionLifecycle("dispose", [userSelectionService, cellSelectionService, rowSelectionService]),
    getSelectionSnapshot: cellSelectionService.getSelectionSnapshot,
    setSelectionSnapshot: cellSelectionService.setSelectionSnapshot,
    clearSelection: cellSelectionService.clearSelection,
    getRowSelectionSnapshot: rowSelectionService.getRowSelectionSnapshot,
    setRowSelectionSnapshot: rowSelectionService.setRowSelectionSnapshot,
    clearRowSelection: rowSelectionService.clearRowSelection,
    getFocusedRow: rowSelectionService.getFocusedRow,
    setFocusedRow: rowSelectionService.setFocusedRow,
    getSelectedRows: rowSelectionService.getSelectedRows,
    isRowSelected: rowSelectionService.isRowSelected,
    setRowSelected: rowSelectionService.setRowSelected,
    selectRows: rowSelectionService.selectRows,
    deselectRows: rowSelectionService.deselectRows,
    clearSelectedRows: rowSelectionService.clearSelectedRows,
  }
}

interface LowLevelGridExpose {
  api: DataGridApi<Record<string, unknown>>
  core: unknown
  runtime: DataGridBodyAwareRuntime
  rowModel: DataGridRowModel<Record<string, unknown>>
  columnModel: DataGridColumnModel
  columnSnapshot: unknown
  rowPartition: DataGridBodyAwareRuntime["rowPartition"]
  setRows: (rows: readonly Record<string, unknown>[]) => void
  syncBodyRowsInRange: (range: { start: number; end: number }) => readonly unknown[]
  getBodyRowAtIndex: DataGridBodyAwareRuntime["getBodyRowAtIndex"]
  resolveBodyRowIndexById: DataGridBodyAwareRuntime["resolveBodyRowIndexById"]
  virtualWindow: unknown
  start: () => Promise<void>
  stop: () => void
}

interface DataGridRuntimeHostSlotProps {
  runtime: LowLevelGridExpose["runtime"]
  rowModel: LowLevelGridExpose["rowModel"]
  defaultRendererProps?: Record<string, unknown>
  [key: string]: unknown
}

type DataGridDefaultRendererRuntime = Pick<
  DataGridBodyAwareRuntime,
  "api" | "syncBodyRowsInRange" | "setViewportRange" | "setVirtualWindowRange" | "setRows" | "getBodyRowAtIndex" | "resolveBodyRowIndexById" | "rowPartition" | "virtualWindow" | "columnSnapshot"
>

function rowSelectionSnapshotsEqual(
  left: DataGridRowSelectionSnapshot | null | undefined,
  right: DataGridRowSelectionSnapshot | null | undefined,
): boolean {
  if (left?.focusedRow !== right?.focusedRow) {
    return false
  }
  const leftRows = left?.selectedRows ?? []
  const rightRows = right?.selectedRows ?? []
  if (leftRows.length !== rightRows.length) {
    return false
  }
  for (let index = 0; index < leftRows.length; index += 1) {
    if (leftRows[index] !== rightRows[index]) {
      return false
    }
  }
  return true
}

function toolbarModulePropsEqual(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) {
    return true
  }
  const leftEntries = Object.entries(left ?? {})
  const rightEntries = Object.entries(right ?? {})
  if (leftEntries.length !== rightEntries.length) {
    return false
  }
  for (const [key, value] of leftEntries) {
    if (!Object.is(value, right?.[key])) {
      return false
    }
  }
  return true
}

function toolbarModulesEqual(
  left: readonly DataGridAppToolbarModule[],
  right: readonly DataGridAppToolbarModule[],
): boolean {
  if (left === right) {
    return true
  }
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftModule = left[index]
    const rightModule = right[index]
    if (!leftModule || !rightModule) {
      return false
    }
    if (
      leftModule.key !== rightModule.key
      || leftModule.component !== rightModule.component
      || !toolbarModulePropsEqual(leftModule.props, rightModule.props)
    ) {
      return false
    }
  }
  return true
}

const dataGridProps = {
  rows: {
    type: Array as PropType<readonly unknown[]>,
    default: () => [],
  },
  rowModel: {
    type: Object as PropType<DataGridRowModel<unknown> | undefined>,
    default: undefined,
  },
  clientRowModelOptions: {
    type: Object as PropType<DataGridAppClientRowModelOptions<unknown> | undefined>,
    default: undefined,
  },
  computedFields: {
    type: Array as PropType<readonly DataGridComputedFieldDefinition<unknown>[] | null | undefined>,
    default: undefined,
  },
  formulas: {
    type: Array as PropType<readonly DataGridFormulaFieldDefinition[] | null | undefined>,
    default: undefined,
  },
  formulaFunctions: {
    type: Object as PropType<DataGridFormulaFunctionRegistry | null | undefined>,
    default: undefined,
  },
  columns: {
    type: Array as PropType<readonly DataGridAppColumnInput[]>,
    default: () => [],
  },
  theme: {
    type: [String, Object] as PropType<DataGridThemeProp>,
    default: undefined,
  },
  aggregationModel: {
    type: Object as PropType<DataGridAggregationModel<Record<string, unknown>> | null | undefined>,
    default: undefined,
  },
  renderMode: {
    type: String as PropType<"virtualization" | "pagination" | undefined>,
    default: undefined,
  },
  virtualization: {
    type: [Boolean, Object] as PropType<DataGridVirtualizationProp | undefined>,
    default: undefined,
  },
  pagination: {
    type: [Boolean, Object] as PropType<DataGridPaginationProp | undefined>,
    default: undefined,
  },
  columnMenu: {
    type: [Boolean, Object] as PropType<DataGridColumnMenuProp | undefined>,
    default: undefined,
  },
  cellMenu: {
    type: [Boolean, Object] as PropType<DataGridCellMenuProp | undefined>,
    default: undefined,
  },
  rowIndexMenu: {
    type: [Boolean, Object] as PropType<DataGridRowIndexMenuProp | undefined>,
    default: undefined,
  },
  columnLayout: {
    type: [Boolean, Object] as PropType<DataGridColumnLayoutProp | undefined>,
    default: undefined,
  },
  columnReorder: {
    type: [Boolean, Object] as PropType<DataGridColumnReorderProp | undefined>,
    default: undefined,
  },
  aggregations: {
    type: [Boolean, Object] as PropType<DataGridAggregationsProp | undefined>,
    default: undefined,
  },
  advancedFilter: {
    type: [Boolean, Object] as PropType<DataGridAdvancedFilterProp | undefined>,
    default: undefined,
  },
  findReplace: {
    type: [Boolean, Object] as PropType<DataGridFindReplaceProp | undefined>,
    default: undefined,
  },
  gridLines: {
    type: [String, Object] as PropType<DataGridGridLinesProp | undefined>,
    default: undefined,
  },
  showRowIndex: {
    type: Boolean,
    default: true,
  },
  rowSelection: {
    type: Boolean,
    default: true,
  },
  rowReorder: {
    type: [Boolean, Object] as PropType<DataGridRowReorderProp | undefined>,
    default: undefined,
  },
  rowSelectionState: {
    type: Object as PropType<DataGridRowSelectionSnapshot | null | undefined>,
    default: undefined,
  },
  pageSize: {
    type: Number as PropType<number | undefined>,
    default: undefined,
  },
  currentPage: {
    type: Number as PropType<number | undefined>,
    default: undefined,
  },
  plugins: {
    type: Array as PropType<readonly DataGridApiPluginDefinition<unknown>[]>,
    default: () => [],
  },
  services: {
    type: Object as PropType<DataGridRuntimeOverrides | undefined>,
    default: undefined,
  },
  startupOrder: {
    type: Array as PropType<CreateDataGridCoreOptions["startupOrder"] | undefined>,
    default: undefined,
  },
  autoStart: {
    type: Boolean,
    default: true,
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
    type: [String, Array, Object] as PropType<DataGridGroupByProp | undefined>,
    default: undefined,
  },
  pivotModel: {
    type: Object as PropType<DataGridPivotSpec | null | undefined>,
    default: undefined,
  },
  columnState: {
    type: Object as PropType<DataGridUnifiedColumnState | null | undefined>,
    default: undefined,
  },
  columnOrder: {
    type: Array as PropType<readonly string[] | null | undefined>,
    default: undefined,
  },
  hiddenColumnKeys: {
    type: Array as PropType<readonly string[] | null | undefined>,
    default: undefined,
  },
  columnWidths: {
    type: Object as PropType<Readonly<Record<string, number | null>> | null | undefined>,
    default: undefined,
  },
  columnPins: {
    type: Object as PropType<Readonly<Record<string, DataGridColumnPin>> | null | undefined>,
    default: undefined,
  },
  state: {
    type: Object as PropType<DataGridUnifiedState<Record<string, unknown>> | null | undefined>,
    default: undefined,
  },
  stateOptions: {
    type: Object as PropType<DataGridSetStateOptions | null | undefined>,
    default: undefined,
  },
  rowHeightMode: {
    type: String as PropType<"fixed" | "auto">,
    default: "fixed",
  },
  baseRowHeight: {
    type: Number,
    default: 31,
  },
  layoutMode: {
    type: String as PropType<DataGridLayoutMode>,
    default: "fill",
  },
  minRows: {
    type: Number as PropType<number | undefined>,
    default: undefined,
  },
  maxRows: {
    type: Number as PropType<number | undefined>,
    default: undefined,
  },
  placeholderRows: {
    type: [Number, Object] as PropType<DataGridPlaceholderRowsProp<Record<string, unknown>> | undefined>,
    default: undefined,
  },
  fillHandle: {
    type: Boolean,
    default: false,
  },
  rangeMove: {
    type: Boolean,
    default: false,
  },
  rowHover: {
    type: Boolean,
    default: false,
  },
  stripedRows: {
    type: Boolean,
    default: false,
  },
  readSelectionCell: {
    type: Function as PropType<DataGridSelectionCellReader | undefined>,
    default: undefined,
  },
  readFilterCell: {
    type: Function as PropType<DataGridFilterCellReader | undefined>,
    default: undefined,
  },
  isCellEditable: {
    type: Function as PropType<DataGridCellEditablePredicate<Record<string, unknown>> | undefined>,
    default: undefined,
  },
  viewMode: {
    type: String as PropType<DataGridAppViewMode | undefined>,
    default: undefined,
  },
  gantt: {
    type: [Boolean, Object] as PropType<DataGridGanttProp | undefined>,
    default: undefined,
  },
  history: {
    type: [Boolean, Object] as PropType<DataGridHistoryProp | undefined>,
    default: undefined,
  },
  chrome: {
    type: [String, Object] as PropType<DataGridChromeProp | undefined>,
    default: undefined,
  },
  toolbarModules: {
    type: Array as PropType<readonly DataGridAppToolbarModule[]>,
    default: () => [],
  },
} as const

type DataGridPublicPropsBase = ExtractPublicPropTypes<typeof dataGridProps>

export type DataGridProps<TRow = unknown> = Omit<
  DataGridPublicPropsBase,
  | "rows"
  | "rowModel"
  | "clientRowModelOptions"
  | "computedFields"
  | "columns"
  | "plugins"
  | "state"
  | "placeholderRows"
  | "readSelectionCell"
  | "readFilterCell"
  | "isCellEditable"
> & {
  rows?: readonly (TRow | DataGridRowNodeInput<TRow>)[]
  rowModel?: DataGridRowModel<TRow> | undefined
  clientRowModelOptions?: DataGridAppClientRowModelOptions<TRow> | undefined
  computedFields?: readonly DataGridComputedFieldDefinition<TRow>[] | null | undefined
  columns?: readonly DataGridAppColumnInput<TRow>[]
  plugins?: readonly DataGridApiPluginDefinition<TRow>[]
  state?: DataGridUnifiedState<TRow> | null | undefined
  placeholderRows?: DataGridPlaceholderRowsProp<TRow> | undefined
  readSelectionCell?: DataGridSelectionCellReader<TRow> | undefined
  readFilterCell?: DataGridFilterCellReader<TRow> | undefined
  isCellEditable?: DataGridCellEditablePredicate<TRow> | undefined
}

export interface DataGridExposed<TRow = unknown> {
  history: DataGridHistoryController
  getHistory: () => DataGridHistoryController
  getApi: () => DataGridApi<TRow> | null
  getSelectionAggregatesLabel: () => string
  getState: () => DataGridUnifiedState<TRow> | null
  getSavedView: () => DataGridSavedViewSnapshot<TRow & Record<string, unknown>> | null
  migrateSavedView: (
    savedView: unknown,
    options?: DataGridMigrateStateOptions,
  ) => DataGridSavedViewSnapshot<TRow & Record<string, unknown>> | null
  applySavedView: (
    savedView: DataGridSavedViewSnapshot<TRow & Record<string, unknown>>,
    options?: DataGridSetStateOptions,
  ) => boolean
  migrateState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<TRow> | null
  applyState: (state: DataGridUnifiedState<TRow> | null, options?: DataGridSetStateOptions) => boolean
}

const DataGridRuntimeComponent = defineComponent({
  name: "DataGrid",
  inheritAttrs: false,
  props: dataGridProps,
  emits: {
    "cell-change": (_payload: unknown) => true,
    "selection-change": (_payload: DataGridApiSelectionChangedEvent) => true,
    "row-selection-change": (_payload: DataGridApiRowSelectionChangedEvent) => true,
    "row-select": (_payload: DataGridRowSelectionSnapshot | null) => true,
    "update:rowSelectionState": (_payload: DataGridRowSelectionSnapshot | null) => true,
    "update:columnState": (_payload: DataGridUnifiedColumnState | null) => true,
    "update:columnOrder": (_payload: readonly string[] | null) => true,
    "update:hiddenColumnKeys": (_payload: readonly string[] | null) => true,
    "update:columnWidths": (_payload: Readonly<Record<string, number | null>> | null) => true,
    "update:columnPins": (_payload: Readonly<Record<string, DataGridColumnPin>> | null) => true,
    "update:groupBy": (_payload: DataGridGroupBySpec | null) => true,
    "update:viewMode": (_payload: DataGridAppViewMode) => true,
    "update:state": (_payload: DataGridUnifiedState<Record<string, unknown>> | null) => true,
    "toolbar-modules-change": (_payload: readonly DataGridAppToolbarModule[]) => true,
    "ready": (_payload: { api: DataGridApi<Record<string, unknown>>; rowModel: DataGridRowModel<Record<string, unknown>> | null }) => true,
  },
  setup(props, { attrs, slots, emit, expose }) {
    const dataGridRef = ref<LowLevelGridExpose | null>(null)
    const disabledHistoryController = createDisabledDataGridHistoryController()
    const registeredHistoryController = ref<DataGridHistoryController | null>(null)
    const resolvedToolbarModules = ref<readonly DataGridAppToolbarModule[]>([])
    let queuedToolbarModules: readonly DataGridAppToolbarModule[] | null = null
    let toolbarModulesEmitScheduled = false
    const currentViewMode = ref<DataGridAppViewMode>(props.viewMode === "gantt" ? "gantt" : "table")
    const runtimeUnifiedState = ref<DataGridUnifiedState<Record<string, unknown>> | null>(props.state ?? null)
    const resolvedHistory = computed(() => resolveDataGridHistory(props.history))
    const resolvedChrome = computed<DataGridResolvedChromeOptions>(() => resolveDataGridChrome(props.chrome))
    const resolvedRenderMode = computed(() => {
      return resolveDataGridRenderMode(props.renderMode, props.pagination)
    })
    const resolvedPagination = computed(() => {
      return resolveDataGridPagination(
        props.pagination,
        resolvedRenderMode.value,
        props.pageSize,
        props.currentPage,
      )
    })
    const resolvedColumnMenu = computed<DataGridColumnMenuOptions>(() => {
      return resolveDataGridColumnMenu(props.columnMenu)
    })
    const resolvedCellMenu = computed<DataGridCellMenuOptions>(() => {
      return resolveDataGridCellMenu(props.cellMenu)
    })
    const resolvedRowIndexMenu = computed<DataGridRowIndexMenuOptions>(() => {
      return resolveDataGridRowIndexMenu(props.rowIndexMenu)
    })
    const resolvedColumnLayout = computed<DataGridColumnLayoutOptions>(() => {
      return resolveDataGridColumnLayout(props.columnLayout)
    })
    const resolvedColumnReorder = computed<DataGridColumnReorderOptions>(() => {
      return resolveDataGridColumnReorder(props.columnReorder)
    })
    const resolvedAggregations = computed<DataGridAggregationsOptions>(() => {
      return resolveDataGridAggregations(props.aggregations)
    })
    const resolvedAdvancedFilter = computed<DataGridAdvancedFilterOptions>(() => {
      return resolveDataGridAdvancedFilter(props.advancedFilter)
    })
    const resolvedFindReplace = computed<DataGridFindReplaceOptions>(() => {
      return resolveDataGridFindReplace(props.findReplace)
    })
    const resolvedGridLines = computed<DataGridGridLinesOptions>(() => {
      return resolveDataGridGridLines(props.gridLines)
    })
    const resolvedGroupBy = computed(() => {
      return resolveDataGridGroupBy(props.groupBy)
    })
    const effectiveUnifiedState = computed(() => props.state ?? runtimeUnifiedState.value)
    const effectiveSortModel = computed<readonly DataGridSortState[] | undefined>(() => {
      if (props.sortModel !== undefined) {
        return props.sortModel
      }
      return effectiveUnifiedState.value?.rows?.snapshot?.sortModel
    })
    const effectiveFilterModel = computed<DataGridFilterSnapshot | null | undefined>(() => {
      if (props.filterModel !== undefined) {
        return props.filterModel
      }
      return effectiveUnifiedState.value?.rows?.snapshot?.filterModel ?? null
    })
    const effectiveGroupBy = computed<DataGridGroupBySpec | null>(() => {
      if (props.groupBy !== undefined) {
        return resolvedGroupBy.value ?? null
      }
      return effectiveUnifiedState.value?.rows?.snapshot?.groupBy ?? null
    })
    const effectivePivotModel = computed<DataGridPivotSpec | null | undefined>(() => {
      if (props.pivotModel !== undefined) {
        return props.pivotModel
      }
      return effectiveUnifiedState.value?.rows?.snapshot?.pivotModel ?? null
    })
    const resolvedVirtualization = computed(() => {
      return resolveDataGridVirtualization(props.virtualization, resolvedRenderMode.value)
    })
    const resolvedLayout = computed(() => (
      resolveDataGridLayoutOptions(props.layoutMode, props.minRows, props.maxRows)
    ))
    const resolvedPlaceholderRows = computed<DataGridPlaceholderRowsOptions<Record<string, unknown>>>(() => {
      return resolveDataGridPlaceholderRows(props.placeholderRows)
    })
    const resolvedRowReorder = computed<DataGridRowReorderOptions>(() => {
      return resolveDataGridRowReorder(props.rowReorder)
    })
    const resolvedReadFilterCell = computed<DataGridFilterCellReader | undefined>(() => {
      const clientRowModelReadFilterCell = props.clientRowModelOptions?.readFilterCell as DataGridFilterCellReader | undefined
      return createDataGridReadFilterCell(
        props.columns,
        props.readFilterCell ?? clientRowModelReadFilterCell,
      )
    })
    const resolvedAppClientRowModelOptions = computed<DataGridAppClientRowModelOptions<unknown> | undefined>(() => {
      if (!resolvedReadFilterCell.value) {
        return props.clientRowModelOptions
      }
      return {
        ...(props.clientRowModelOptions ?? {}),
        readFilterCell: resolvedReadFilterCell.value as DataGridAppClientRowModelOptions<unknown>["readFilterCell"],
      }
    })
    const resolvedClientRowModelOptions = computed(() => {
      return resolveDataGridFormulaRowModelOptions({
        columns: props.columns,
        clientRowModelOptions: resolvedAppClientRowModelOptions.value,
        computedFields: props.computedFields,
        formulas: props.formulas,
        formulaFunctions: props.formulaFunctions,
      })
    })
    const resolvedColumns = computed(() => resolveDataGridColumns(props.columns))
    const controlledProps: UseDataGridAppControlledStateOptions["props"] = {
      get state() {
        return props.state
      },
      get stateOptions() {
        return props.stateOptions
      },
      get columnState() {
        return props.columnState
      },
      get columnOrder() {
        return props.columnOrder
      },
      get hiddenColumnKeys() {
        return props.hiddenColumnKeys
      },
      get columnWidths() {
        return props.columnWidths
      },
      get columnPins() {
        return props.columnPins
      },
      get sortModel() {
        return props.sortModel
      },
      get filterModel() {
        return props.filterModel
      },
      get groupBy() {
        return resolvedGroupBy.value
      },
      get aggregationModel() {
        return props.aggregationModel
      },
      get pivotModel() {
        return props.pivotModel
      },
      get rowHeightMode() {
        return props.rowHeightMode
      },
      get baseRowHeight() {
        return props.baseRowHeight
      },
      get columns() {
        return props.columns
      },
    }
    const inferredMode = computed<"base" | "tree" | "pivot">(() => {
      if (effectivePivotModel.value) {
        return "pivot"
      }
      if (resolvedClientRowModelOptions.value && "initialTreeData" in resolvedClientRowModelOptions.value) {
        return "tree"
      }
      return "base"
    })
    const visibleColumns = computed(() => dataGridRef.value?.api.columns.getSnapshot().visibleColumns ?? [])
    const totalRows = computed(() => dataGridRef.value?.api.rows.getCount() ?? 0)
    const selectionOptions = {
      mode: computed(() => inferredMode.value),
      resolveRuntime: () => dataGridRef.value,
      visibleColumns,
      totalRows,
      showRowSelection: computed(() => props.rowSelection),
      readSelectionCell: props.readSelectionCell,
    } as Parameters<typeof useDataGridAppSelection<unknown>>[0]

    const {
      selectionSnapshot,
      selectionAnchor,
      syncSelectionSnapshotFromRuntime,
      selectionService,
      selectionAggregatesLabel,
    } = useDataGridAppSelection<unknown>(selectionOptions)
    const {
      rowSelectionSnapshot,
      syncRowSelectionSnapshotFromRuntime,
      reconcileRowSelectionFromRuntime,
      selectionService: rowSelectionService,
    } = useDataGridAppRowSelection<unknown>({
      resolveRuntime: () => dataGridRef.value,
    })
    const resolvedRowSelectionService = computed<DataGridSelectionService>(() => {
      return props.rowSelection ? rowSelectionService : createDisabledRowSelectionService()
    })
    const resolvedServices = computed<DataGridRuntimeOverrides>(() => ({
      ...(props.services ?? {}),
      selection: composeSelectionService({
        userSelectionService: props.services?.selection,
        cellSelectionService: selectionService,
        rowSelectionService: resolvedRowSelectionService.value,
      }),
    }))
    const {
      dataGridInstanceKey,
      resolvedRowModel,
    } = useDataGridAppRowModel({
      rows: toRef(props, "rows"),
      rowModel: toRef(props, "rowModel"),
      clientRowModelOptions: resolvedClientRowModelOptions,
      onOwnedRowModelRecreated: () => {
        controlledState.dispose()
      },
    })

    const controlledState = useDataGridAppControlledState({
      gridRef: dataGridRef,
      props: controlledProps,
      emit: {
        columnState: payload => emit("update:columnState", payload),
        columnOrder: payload => emit("update:columnOrder", payload),
        hiddenColumnKeys: payload => emit("update:hiddenColumnKeys", payload),
        columnWidths: payload => emit("update:columnWidths", payload),
        columnPins: payload => emit("update:columnPins", payload),
        groupBy: payload => emit("update:groupBy", payload as DataGridGroupBySpec | null),
        state: payload => {
          runtimeUnifiedState.value = payload
          emit("update:state", payload)
        },
        ready: payload => emit("ready", {
          api: payload.api,
          rowModel: (resolvedRowModel.value as DataGridRowModel<Record<string, unknown>> | null),
        }),
      },
    })

    const handleCellChange = (payload: unknown): void => {
      reconcileRowSelectionFromRuntime()
      emit("cell-change", payload)
      controlledState.emitSnapshotUpdates()
    }

    const handleSelectionChange = (payload: DataGridApiSelectionChangedEvent): void => {
      emit("selection-change", payload)
    }

    const handleRowSelectionChange = (payload: DataGridApiRowSelectionChangedEvent): void => {
      emit("row-selection-change", payload)
    }

    const flushRowSelectionSnapshotUpdates = (): void => {
      controlledState.emitSnapshotUpdates()
    }

    watch(
      rowSelectionSnapshot,
      (snapshot: DataGridRowSelectionSnapshot | null) => {
        emit("row-select", snapshot)
        emit("update:rowSelectionState", snapshot)
        flushRowSelectionSnapshotUpdates()
      },
      { deep: true },
    )

    watch(
      () => [props.rowSelection, props.rowSelectionState, dataGridRef.value] as const,
      ([enabled, controlledRowSelection]) => {
        if (enabled) {
          if (controlledRowSelection !== undefined) {
            const runtimeRowSelection = dataGridRef.value?.api.rowSelection
            if (!rowSelectionSnapshotsEqual(rowSelectionSnapshot.value, controlledRowSelection)) {
              if (controlledRowSelection) {
                runtimeRowSelection?.setSnapshot(controlledRowSelection)
              } else {
                runtimeRowSelection?.clear()
              }
              syncRowSelectionSnapshotFromRuntime()
            }
            return
          }
          syncRowSelectionSnapshotFromRuntime()
          return
        }
        rowSelectionService.clearRowSelection?.()
      },
      { immediate: true },
    )

    watch(
      () => props.viewMode,
      nextViewMode => {
        currentViewMode.value = nextViewMode === "gantt" ? "gantt" : "table"
      },
      { immediate: true },
    )

    const setView = (nextViewMode: DataGridAppViewMode): void => {
      const normalized = nextViewMode === "gantt" ? "gantt" : "table"
      currentViewMode.value = normalized
      emit("update:viewMode", normalized)
    }

    const registerHistoryController = (controller: DataGridHistoryController | null): void => {
      registeredHistoryController.value = controller
    }

    const reportToolbarModules = (modules: readonly DataGridAppToolbarModule[]): void => {
      if (toolbarModulesEqual(resolvedToolbarModules.value, modules)) {
        return
      }
      resolvedToolbarModules.value = modules
      queuedToolbarModules = modules
      if (toolbarModulesEmitScheduled) {
        return
      }
      toolbarModulesEmitScheduled = true
      Promise.resolve().then(() => {
        toolbarModulesEmitScheduled = false
        const nextModules = queuedToolbarModules
        queuedToolbarModules = null
        if (!nextModules) {
          return
        }
        emit("toolbar-modules-change", nextModules)
      })
    }

    const adapterHistoryController = computed<DataGridHistoryController>(() => {
      const adapter = resolvedHistory.value.adapter
      if (!resolvedHistory.value.enabled || !adapter) {
        return disabledHistoryController
      }
      return {
        canUndo: () => adapter.canUndo(),
        canRedo: () => adapter.canRedo(),
        runHistoryAction: direction => adapter.runHistoryAction(direction),
      }
    })

    const historyController: DataGridHistoryController = {
      canUndo: () => (registeredHistoryController.value ?? adapterHistoryController.value).canUndo(),
      canRedo: () => (registeredHistoryController.value ?? adapterHistoryController.value).canRedo(),
      runHistoryAction: direction => (
        (registeredHistoryController.value ?? adapterHistoryController.value).runHistoryAction(direction)
      ),
    }

    const getSavedView = (): DataGridSavedViewSnapshot<Record<string, unknown>> | null => {
      const state = controlledState.getState()
      if (!state) {
        return null
      }
      return sanitizeDataGridSavedView({
        state,
        viewMode: currentViewMode.value,
      })
    }

    const migrateSavedView = (
      savedView: unknown,
      options?: DataGridMigrateStateOptions,
    ): DataGridSavedViewSnapshot<Record<string, unknown>> | null => {
      return migrateDataGridSavedView(savedView, controlledState.migrateState, options)
    }

    const applySavedView = (
      savedView: DataGridSavedViewSnapshot<Record<string, unknown>>,
      options?: DataGridSetStateOptions,
    ): boolean => {
      const sanitized = sanitizeDataGridSavedView(savedView)
      const applied = controlledState.applyState(sanitized.state, options)
      if (!applied) {
        return false
      }
      if (sanitized.viewMode) {
        setView(sanitized.viewMode)
      }
      return true
    }

    onBeforeUnmount(() => {
      controlledState.dispose()
    })

    expose({
      grid: dataGridRef,
      rowModel: resolvedRowModel,
      history: historyController,
      getHistory: () => historyController,
      toolbarModules: resolvedToolbarModules,
      getToolbarModules: () => resolvedToolbarModules.value,
      getApi: () => dataGridRef.value?.api ?? null,
      getRuntime: () => dataGridRef.value?.runtime ?? null,
      getCore: () => dataGridRef.value?.core ?? null,
      getColumnState: () => controlledState.getColumnState(),
      getColumnSnapshot: () => dataGridRef.value?.api.columns.getSnapshot() ?? null,
      getSelectionAggregatesLabel: () => selectionAggregatesLabel.value,
      getSelectionSummary: () => {
        const summarize = dataGridRef.value?.api.selection.summarize
        if (!summarize) {
          return null
        }
        const summaryOptions: Parameters<typeof summarize>[0] & {
          readSelectionCell?: typeof props.readSelectionCell
        } = {
          readSelectionCell: props.readSelectionCell,
        }
        return summarize(summaryOptions)
      },
      getView: () => currentViewMode.value,
      setView,
      getSavedView,
      migrateSavedView,
      applySavedView,
      applyColumnState: controlledState.applyColumnState,
      getState: controlledState.getState,
      migrateState: controlledState.migrateState,
      applyState: controlledState.applyState,
      exportPivotLayout: controlledState.exportPivotLayout,
      exportPivotInterop: controlledState.exportPivotInterop,
      importPivotLayout: controlledState.importPivotLayout,
      expandAllGroups: controlledState.expandAllGroups,
      collapseAllGroups: controlledState.collapseAllGroups,
      insertRowsAt: (index: number, rows: readonly DataGridRowNodeInput<Record<string, unknown>>[]) =>
        dataGridRef.value?.api.rows.insertDataAt(index, rows) ?? false,
      insertRowBefore: (rowId: string | number, rows: readonly DataGridRowNodeInput<Record<string, unknown>>[]) =>
        dataGridRef.value?.api.rows.insertDataBefore(rowId, rows) ?? false,
      insertRowAfter: (rowId: string | number, rows: readonly DataGridRowNodeInput<Record<string, unknown>>[]) =>
        dataGridRef.value?.api.rows.insertDataAfter(rowId, rows) ?? false,
      insertColumnsAt: (index: number, columns: readonly DataGridAppColumnInput[]) =>
        dataGridRef.value?.api.columns.insertAt(index, columns) ?? false,
      insertColumnBefore: (columnKey: string, columns: readonly DataGridAppColumnInput[]) =>
        dataGridRef.value?.api.columns.insertBefore(columnKey, columns) ?? false,
      insertColumnAfter: (columnKey: string, columns: readonly DataGridAppColumnInput[]) =>
        dataGridRef.value?.api.columns.insertAfter(columnKey, columns) ?? false,
    })

    return (): VNode => {
      const defaultRendererProps = {
        mode: inferredMode.value,
        rows: props.rows as readonly Record<string, unknown>[],
        runtime: dataGridRef.value?.runtime ?? null,
        runtimeRowModel: dataGridRef.value?.rowModel ?? null,
        selectionSnapshot,
        selectionAnchor,
        rowSelectionSnapshot,
        syncSelectionSnapshotFromRuntime,
        syncRowSelectionSnapshotFromRuntime,
        flushRowSelectionSnapshotUpdates,
        sortModel: effectiveSortModel.value,
        filterModel: effectiveFilterModel.value,
        groupBy: effectiveGroupBy.value,
        pivotModel: effectivePivotModel.value,
        renderMode: resolvedRenderMode.value,
        virtualization: resolvedVirtualization.value,
        columnMenu: resolvedColumnMenu.value,
        cellMenu: resolvedCellMenu.value,
        rowIndexMenu: resolvedRowIndexMenu.value,
        columnLayout: resolvedColumnLayout.value,
        columnReorder: resolvedColumnReorder.value,
        aggregations: resolvedAggregations.value,
        advancedFilter: resolvedAdvancedFilter.value,
        findReplace: resolvedFindReplace.value,
        gridLines: resolvedGridLines.value,
        rowHeightMode: props.rowHeightMode,
        baseRowHeight: props.baseRowHeight,
        layoutMode: resolvedLayout.value.layoutMode,
        minRows: resolvedLayout.value.minRows,
        maxRows: resolvedLayout.value.maxRows,
        placeholderRows: resolvedPlaceholderRows.value,
        fillHandle: props.fillHandle,
        rangeMove: props.rangeMove,
        rowHover: props.rowHover,
        stripedRows: props.stripedRows,
        readSelectionCell: props.readSelectionCell,
        isCellEditable: props.isCellEditable,
        showRowIndex: props.showRowIndex,
        rowSelection: props.rowSelection,
        rowReorder: resolvedRowReorder.value,
        viewMode: currentViewMode.value,
        gantt: props.gantt,
        history: resolvedHistory.value,
        chrome: resolvedChrome.value,
        registerHistoryController,
        reportToolbarModules,
        toolbarModules: props.toolbarModules,
      }
      return h(
        DataGridRuntimeHost,
        {
          ...attrs,
          ref: dataGridRef,
          key: dataGridInstanceKey.value,
          rows: props.rows,
          rowModel: resolvedRowModel.value,
          columns: resolvedColumns.value,
          theme: props.theme,
          layoutMode: resolvedLayout.value.layoutMode,
          renderMode: resolvedRenderMode.value,
          pagination: resolvedPagination.value,
          plugins: props.plugins,
          services: resolvedServices.value,
          startupOrder: props.startupOrder,
          autoStart: props.autoStart,
          onCellChange: handleCellChange,
          onSelectionChange: handleSelectionChange,
          onRowSelectionChange: handleRowSelectionChange,
        },
        slots.default
          ? {
              default: (slotProps: DataGridRuntimeHostSlotProps) => slots.default?.({
                ...slotProps,
                defaultRendererProps: {
                  ...defaultRendererProps,
                  runtime: slotProps.runtime as DataGridDefaultRendererRuntime,
                  runtimeRowModel: slotProps.rowModel as Pick<DataGridRowModel<Record<string, unknown>>, "subscribe" | "getSnapshot">,
                },
              }),
            }
          : {
              default: (slotProps: DataGridRuntimeHostSlotProps) => h(DataGridDefaultRenderer, {
                ...defaultRendererProps,
                runtime: slotProps.runtime as DataGridDefaultRendererRuntime,
                runtimeRowModel: slotProps.rowModel as Pick<DataGridRowModel<Record<string, unknown>>, "subscribe" | "getSnapshot">,
              }),
            },
      )
    }
  },
})

type DataGridRuntimeStatics = {
  [K in keyof typeof DataGridRuntimeComponent]: (typeof DataGridRuntimeComponent)[K]
}

type DataGridComponentInstance<TRow = unknown> = Omit<
  InstanceType<typeof DataGridRuntimeComponent>,
  "$props" | keyof DataGridExposed<any>
> & {
  $props: DataGridProps<TRow>
} & DataGridExposed<TRow>

export type DataGridInstance<TRow = unknown> = DataGridComponentInstance<TRow>

export type DataGridComponentFor<TRow = unknown> = DataGridRuntimeStatics & {
  new (): DataGridComponentInstance<TRow>
}

export function useDataGridRef<TRow = unknown>() {
  return ref<DataGridInstance<TRow> | null>(null)
}

export function defineDataGridComponent<TRow = unknown>() {
  return DataGridRuntimeComponent as DataGridComponentFor<TRow>
}

export type DataGridComponent = DataGridRuntimeStatics & {
  new <TRow = unknown>(): DataGridComponentInstance<TRow>
}

export default DataGridRuntimeComponent as DataGridComponent
