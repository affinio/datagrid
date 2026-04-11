import {
  type Component,
  type CSSProperties,
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  markRaw,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  toRaw,
  watch,
  type PropType,
  type Ref,
} from "vue"
import type {
  DataGridAggOp,
  DataGridAggregationModel,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPivotSpec,
  DataGridRowModel,
  DataGridSortState,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import {
  cloneDataGridFilterSnapshot,
  useDataGridContextMenu,
  type GridSelectionPointLike,
  type DataGridRowId,
  type DataGridRowSelectionSnapshot,
} from "@affino/datagrid-vue"
import {
  useDataGridAppColumnLayoutPanel,
  type DataGridAppColumnLayoutDraftColumn,
  type DataGridAppAdvancedFilterColumnOption,
} from "@affino/datagrid-vue/app"
import type { UseDataGridAppAdvancedFilterBuilderResult } from "@affino/datagrid-vue/app"
import {
  useDataGridContextMenuActionRouter,
  useDataGridContextMenuAnchor,
  useDataGridViewportContextMenuRouter,
} from "@affino/datagrid-vue/advanced"
import type { DataGridContextMenuActionId } from "@affino/datagrid-vue"
import DataGridModuleHost, {
  type DataGridAppInspectorPanel,
  type DataGridAppToolbarModule,
} from "./DataGridModuleHost"
import DataGridHistoryToolbarButton from "./DataGridHistoryToolbarButton"
import DataGridTableStage from "../stage/DataGridTableStage.vue"
import DataGridColumnLayoutPopover from "../overlays/DataGridColumnLayoutPopover.vue"
import type { DataGridAdvancedFilterOptions } from "../config/dataGridAdvancedFilter"
import type { DataGridAggregationsOptions, DataGridAggregationPanelItem } from "../config/dataGridAggregations"
import type { DataGridFindReplaceOptions } from "../config/dataGridFindReplace"
import type { DataGridGridLinesOptions } from "../config/dataGridGridLines"
import type { DataGridCellEditablePredicate } from "../dataGridEditability"
import type { DataGridColumnLayoutOptions } from "../config/dataGridColumnLayout"
import type { DataGridColumnReorderOptions } from "../config/dataGridColumnReorder"
import {
  resolveDataGridColumnMenuActionOptions,
  resolveDataGridColumnMenuCustomItems,
  resolveDataGridColumnMenuDisabledItems,
  resolveDataGridColumnMenuDisabledReasons,
  resolveDataGridColumnMenuLabels,
  resolveDataGridColumnMenuItems,
  type DataGridColumnMenuOptions,
} from "../overlays/dataGridColumnMenu"
import {
  resolveDataGridCellMenuActionOptions,
  resolveDataGridCellMenuDisabledItems,
  resolveDataGridCellMenuDisabledReasons,
  resolveDataGridCellMenuItems,
  resolveDataGridRowIndexMenuActionOptions,
  resolveDataGridRowIndexMenuDisabledItems,
  resolveDataGridRowIndexMenuDisabledReasons,
  resolveDataGridRowIndexMenuItems,
  type DataGridCellMenuActionKey,
  type DataGridCellMenuOptions,
  type DataGridRowIndexMenuActionKey,
  type DataGridRowIndexMenuOptions,
} from "../overlays/dataGridContextMenu"
import {
  type DataGridAppViewMode,
  type DataGridGanttProp,
} from "../gantt/dataGridGantt.types"
import type { DataGridResolvedChromeOptions, DataGridToolbarPlacement } from "../config/dataGridChrome"
import type { DataGridRowReorderOptions } from "../config/dataGridRowReorder"
import type { DataGridLayoutMode } from "../config/dataGridLayout"
import type { DataGridPlaceholderRowsOptions } from "../config/dataGridPlaceholderRows"
import type { DataGridVirtualizationOptions } from "../config/dataGridVirtualization"
import { useDataGridTableStageRuntime } from "../stage/useDataGridTableStageRuntime"
import { isDataGridPlaceholderSurfaceRow } from "../stage/useDataGridTableStagePlaceholderRows"
import { resolveAdvancedFilterDraftClausesFromFilterModel } from "../advancedFilterDraftClauses"
import {
  type UseDataGridAppFindReplaceResult,
  type DataGridFindReplaceVisualTarget,
} from "../useDataGridAppFindReplace"
import type { DataGridHistoryController, DataGridResolvedHistoryOptions } from "../dataGridHistory"

type DataGridMode = "base" | "tree" | "pivot" | "worker"

const DataGridAdvancedFilterPopover = defineAsyncComponent(() => import("../overlays/DataGridAdvancedFilterPopover.vue"))
const DataGridAggregationsPopover = defineAsyncComponent(() => import("../overlays/DataGridAggregationsPopover.vue"))
const DataGridFindReplacePopover = defineAsyncComponent(() => import("../overlays/DataGridFindReplacePopover.vue"))
const DataGridGanttStage = defineAsyncComponent(() => import("../gantt/DataGridGanttStageEntry"))

interface SortToggleState {
  key: string
  direction: "asc" | "desc"
}

type DataGridColumnFilterEntry = DataGridFilterSnapshot["columnFilters"][string]
type DataGridLegacyAdvancedFilterEntry = DataGridFilterSnapshot["advancedFilters"][string]
type DataGridAdvancedExpressionEntry = NonNullable<DataGridFilterSnapshot["advancedExpression"]>
type DataGridDefaultRendererRuntime = {
  api: UseDataGridRuntimeResult<Record<string, unknown>>["api"]
  syncBodyRowsInRange: UseDataGridRuntimeResult<Record<string, unknown>>["syncBodyRowsInRange"]
  setViewportRange: UseDataGridRuntimeResult<Record<string, unknown>>["setViewportRange"]
  setRows?: UseDataGridRuntimeResult<Record<string, unknown>>["setRows"]
  rowPartition: UseDataGridRuntimeResult<Record<string, unknown>>["rowPartition"]
  virtualWindow: UseDataGridRuntimeResult<Record<string, unknown>>["virtualWindow"]
  columnSnapshot: UseDataGridRuntimeResult<Record<string, unknown>>["columnSnapshot"]
  setVirtualWindowRange?: (range: { start: number; end: number }) => void
  getBodyRowAtIndex: (rowIndex: number) => import("@affino/datagrid-vue").DataGridRowNode<Record<string, unknown>> | null
  resolveBodyRowIndexById: (rowId: string | number) => number
}

function normalizeToolbarModule(module: DataGridAppToolbarModule): DataGridAppToolbarModule {
  return {
    ...module,
    component: markRaw(toRaw(module.component)),
  }
}

function normalizeBaseRowHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 31
  }
  return Math.max(24, Math.trunc(value))
}

function escapeCssAttributeValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value)
  }
  return value.replace(/\\/g, "\\\\").replace(/\"/g, '\\"')
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
    try {
      return globalThis.structuredClone(row)
    }
    catch {
      // Fall back to a plain-data clone when rows carry live references such as Window.
    }
  }
  return cloneRowDataFallback(row, new WeakMap<object, unknown>())
}

function cloneRowDataFallback<TRow>(row: TRow, seen: WeakMap<object, unknown>): TRow {
  if (row == null || typeof row !== "object") {
    return row
  }
  if (row instanceof Date) {
    return new Date(row.getTime()) as TRow
  }
  if (Array.isArray(row)) {
    if (seen.has(row)) {
      return seen.get(row) as TRow
    }
    const cloned: unknown[] = []
    seen.set(row, cloned)
    for (const value of row) {
      cloned.push(cloneRowDataFallback(value, seen))
    }
    return cloned as TRow
  }
  if (isPlainRowObject(row)) {
    if (seen.has(row)) {
      return seen.get(row) as TRow
    }
    const cloned: Record<string, unknown> = {}
    seen.set(row, cloned)
    for (const [key, value] of Object.entries(row)) {
      cloned[key] = cloneRowDataFallback(value, seen)
    }
    return cloned as TRow
  }
  if (row && typeof row === "object") {
    return { ...(row as Record<string, unknown>) } as TRow
  }
  return row
}

function isPlainRowObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function serializeRowClipboardRows(rows: readonly Record<string, unknown>[]): string | null {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(rows, (_key, value: unknown) => {
      if (value == null || typeof value !== "object") {
        return value
      }
      if (value instanceof Date) {
        return value.toISOString()
      }
      if (Array.isArray(value) || isPlainRowObject(value)) {
        if (seen.has(value)) {
          return undefined
        }
        seen.add(value)
        return value
      }
      return undefined
    })
  }
  catch {
    return null
  }
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

function cloneGroupBySpec(groupBy: DataGridGroupBySpec | null | undefined): DataGridGroupBySpec | null {
  if (!groupBy) {
    return null
  }
  return {
    fields: [...groupBy.fields],
    expandedByDefault: groupBy.expandedByDefault,
  }
}

function formatFilterDisplayValue(value: unknown): string {
  if (value == null) {
    return "blank"
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "string") {
    return `"${value}"`
  }
  return String(value)
}

function formatColumnFilterOperator(operator: string): string {
  switch (operator) {
    case "contains":
      return "contains"
    case "startsWith":
    case "starts-with":
      return "starts with"
    case "endsWith":
    case "ends-with":
      return "ends with"
    case "equals":
      return "="
    case "notEquals":
    case "not-equals":
      return "!="
    case "gt":
      return ">"
    case "gte":
      return ">="
    case "lt":
      return "<"
    case "lte":
      return "<="
    case "between":
      return "between"
    case "isEmpty":
    case "is-empty":
      return "is empty"
    case "notEmpty":
    case "not-empty":
      return "is not empty"
    case "isNull":
    case "is-null":
      return "is null"
    case "notNull":
    case "not-null":
      return "is not null"
    default:
      return operator
  }
}

function decodeColumnFilterToken(token: string): string {
  const normalized = String(token ?? "")
  if (normalized === "null") {
    return "(Blanks)"
  }
  const separatorIndex = normalized.indexOf(":")
  if (separatorIndex < 0) {
    return normalized
  }
  const kind = normalized.slice(0, separatorIndex)
  const payload = normalized.slice(separatorIndex + 1)
  if (
    kind === "string"
    || kind === "number"
    || kind === "boolean"
    || kind === "bigint"
    || kind === "date"
    || kind === "repr"
    || kind === "json"
  ) {
    return payload
  }
  return normalized
}

function formatColumnFilterSummary(label: string, filter: DataGridColumnFilterEntry): string {
  if (filter.kind === "valueSet") {
    if (filter.tokens.length === 1) {
      return `${label}: ${decodeColumnFilterToken(filter.tokens[0] ?? "")}`
    }
    return `${label}: ${filter.tokens.length} values`
  }
  if (filter.operator === "between") {
    return `${label} between ${formatFilterDisplayValue(filter.value)} and ${formatFilterDisplayValue(filter.value2)}`
  }
  if (
    filter.operator === "isEmpty"
    || filter.operator === "notEmpty"
    || filter.operator === "isNull"
    || filter.operator === "notNull"
  ) {
    return `${label} ${formatColumnFilterOperator(filter.operator)}`
  }
  return `${label} ${formatColumnFilterOperator(filter.operator)} ${formatFilterDisplayValue(filter.value)}`
}

function formatLegacyAdvancedFilterSummary(label: string, filter: DataGridLegacyAdvancedFilterEntry): string {
  const parts = filter.clauses
    .map((clause, clauseIndex) => {
      const prefix = clauseIndex === 0 ? "" : `${String(clause.join ?? "and").toUpperCase()} `
      if (clause.operator === "between") {
        return `${prefix}${formatColumnFilterOperator(clause.operator)} ${formatFilterDisplayValue(clause.value)} and ${formatFilterDisplayValue(clause.value2)}`
      }
      if (
        clause.operator === "isEmpty"
        || clause.operator === "notEmpty"
        || clause.operator === "isNull"
        || clause.operator === "notNull"
      ) {
        return `${prefix}${formatColumnFilterOperator(clause.operator)}`
      }
      return `${prefix}${formatColumnFilterOperator(clause.operator)} ${formatFilterDisplayValue(clause.value)}`
    })
    .filter(part => part.length > 0)

  if (parts.length === 0) {
    return `${label}: active`
  }
  return `${label} ${parts.join(" ")}`
}

function formatAdvancedExpressionSummary(
  expression: DataGridAdvancedExpressionEntry,
  resolveColumnLabel: (columnKey: string) => string,
): string {
  if (expression.kind === "condition") {
    const label = resolveColumnLabel(expression.key)
    if (expression.operator === "between") {
      return `${label} between ${formatFilterDisplayValue(expression.value)} and ${formatFilterDisplayValue(expression.value2)}`
    }
    if (
      expression.operator === "isEmpty"
      || expression.operator === "notEmpty"
      || expression.operator === "isNull"
      || expression.operator === "notNull"
    ) {
      return `${label} ${formatColumnFilterOperator(expression.operator)}`
    }
    return `${label} ${formatColumnFilterOperator(expression.operator)} ${formatFilterDisplayValue(expression.value)}`
  }
  if (expression.kind === "not") {
    return `NOT (${formatAdvancedExpressionSummary(expression.child, resolveColumnLabel)})`
  }
  return expression.children
    .map(child => formatAdvancedExpressionSummary(child, resolveColumnLabel))
    .filter(part => part.length > 0)
    .join(` ${expression.operator.toUpperCase()} `)
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

const CELL_MENU_ACTION_IDS_BY_ITEM = {
  clipboard: ["cut", "copy", "paste"],
  edit: ["clear"],
} satisfies Readonly<Record<string, readonly RendererContextMenuActionId[]>>

const ROW_INDEX_MENU_ACTION_IDS_BY_ITEM = {
  insert: ["insert-row-above", "insert-row-below"],
  clipboard: ["cut-row", "copy-row", "paste-row"],
  selection: ["delete-selected-rows"],
} satisfies Readonly<Record<string, readonly RendererContextMenuActionId[]>>

const DEFAULT_CONTEXT_MENU_ACTION_LABELS: Readonly<Record<RendererContextMenuActionId, string>> = {
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  clear: "Clear values",
  "insert-row-above": "Insert above",
  "insert-row-below": "Insert below",
  "copy-row": "Copy row",
  "paste-row": "Paste row",
  "cut-row": "Cut row",
  "delete-selected-rows": "Delete selected rows",
  "sort-asc": "Sort ascending",
  "sort-desc": "Sort descending",
  "sort-clear": "Clear sort",
  filter: "Filter column",
  "auto-size": "Auto size column",
}

const ROW_INDEX_MENU_SHORTCUT_HINTS: Readonly<Partial<Record<RendererContextMenuActionId, string>>> = {
  "insert-row-above": "Insert / Ctrl/Cmd+I",
  "copy-row": "Ctrl/Cmd+C",
  "paste-row": "Ctrl/Cmd+V",
  "cut-row": "Ctrl/Cmd+X",
}

type RendererContextMenuActionId =
  | DataGridContextMenuActionId
  | "insert-row-above"
  | "insert-row-below"
  | "copy-row"
  | "paste-row"
  | "cut-row"
  | "delete-selected-rows"

type RendererRowIndexKeyboardAction = RendererContextMenuActionId | "open-row-menu"

type RendererContextMenuZone = "cell" | "range" | "header" | "row-index"

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
      type: Object as PropType<DataGridDefaultRendererRuntime>,
      required: true,
    },
    runtimeRowModel: {
      type: Object as PropType<Pick<DataGridRowModel<Record<string, unknown>>, "subscribe" | "getSnapshot">>,
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
    rowSelectionSnapshot: {
      type: Object as PropType<Ref<DataGridRowSelectionSnapshot | null>>,
      required: true,
    },
    syncSelectionSnapshotFromRuntime: {
      type: Function as PropType<() => void>,
      required: true,
    },
    syncRowSelectionSnapshotFromRuntime: {
      type: Function as PropType<() => void>,
      default: () => undefined,
    },
    flushRowSelectionSnapshotUpdates: {
      type: Function as PropType<() => void>,
      default: () => undefined,
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
    cellMenu: {
      type: Object as PropType<DataGridCellMenuOptions>,
      required: true,
    },
    rowIndexMenu: {
      type: Object as PropType<DataGridRowIndexMenuOptions>,
      required: true,
    },
    columnLayout: {
      type: Object as PropType<DataGridColumnLayoutOptions>,
      required: true,
    },
    columnReorder: {
      type: Object as PropType<DataGridColumnReorderOptions>,
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
    findReplace: {
      type: Object as PropType<DataGridFindReplaceOptions>,
      required: true,
    },
    gridLines: {
      type: Object as PropType<DataGridGridLinesOptions>,
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
    layoutMode: {
      type: String as PropType<DataGridLayoutMode>,
      default: "fill",
    },
    minRows: {
      type: Number as PropType<number | null>,
      default: null,
    },
    maxRows: {
      type: Number as PropType<number | null>,
      default: null,
    },
    placeholderRows: {
      type: Object as PropType<DataGridPlaceholderRowsOptions<Record<string, unknown>>>,
      required: true,
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
    showRowIndex: {
      type: Boolean,
      default: true,
    },
    rowSelection: {
      type: Boolean,
      default: true,
    },
    rowReorder: {
      type: Object as PropType<DataGridRowReorderOptions>,
      required: true,
    },
    isCellEditable: {
      type: Function as PropType<DataGridCellEditablePredicate<Record<string, unknown>> | undefined>,
      default: undefined,
    },
    viewMode: {
      type: String as PropType<DataGridAppViewMode>,
      default: "table",
    },
    gantt: {
      type: [Boolean, Object] as PropType<DataGridGanttProp | undefined>,
      default: undefined,
    },
    toolbarModules: {
      type: Array as PropType<readonly DataGridAppToolbarModule[]>,
      default: () => [],
    },
    history: {
      type: Object as PropType<DataGridResolvedHistoryOptions>,
      required: true,
    },
    chrome: {
      type: Object as PropType<DataGridResolvedChromeOptions>,
      required: true,
    },
    registerHistoryController: {
      type: Function as PropType<(controller: DataGridHistoryController | null) => void>,
      default: () => undefined,
    },
    reportToolbarModules: {
      type: Function as PropType<(modules: readonly DataGridAppToolbarModule[]) => void>,
      default: () => undefined,
    },
    inspectorPanel: {
      type: Object as PropType<DataGridAppInspectorPanel | null>,
      default: null,
    },
  },
  setup(props) {
    const gridChromeStyle = computed<CSSProperties>(() => ({
      "--datagrid-row-divider-size": props.gridLines.bodyRows ? "1px" : "0px",
      "--datagrid-column-divider-size": props.gridLines.bodyColumns ? "1px" : "0px",
      "--datagrid-header-column-divider-size": props.gridLines.headerColumns ? "1px" : "0px",
      "--datagrid-pinned-pane-separator-size": props.gridLines.pinnedSeparators ? "2px" : "0px",
      "--datagrid-app-layout-gap": `${props.chrome.toolbarGap}px`,
      "--datagrid-app-workspace-gap": `${props.chrome.workspaceGap}px`,
      "--datagrid-app-toolbar-gap": props.chrome.density === "compact" ? "10px" : "12px",
      "--datagrid-app-toolbar-group-gap": props.chrome.density === "compact" ? "6px" : "8px",
      "--datagrid-app-toolbar-button-gap": props.chrome.density === "compact" ? "6px" : "8px",
      "--datagrid-app-toolbar-button-height": props.chrome.density === "compact" ? "28px" : "32px",
      "--datagrid-app-toolbar-button-padding-inline": props.chrome.density === "compact" ? "10px" : "12px",
      "--datagrid-app-toolbar-button-font-size": props.chrome.density === "compact" ? "11px" : "12px",
      "--datagrid-app-toolbar-surface-padding-block": props.chrome.density === "compact" ? "8px" : "10px",
      "--datagrid-app-toolbar-surface-padding-inline": props.chrome.density === "compact" ? "10px" : "12px",
    }))
    const gridLinesChromeSignature = computed(() => {
      return [
        props.gridLines.body,
        props.gridLines.header,
        props.gridLines.pinnedSeparators ? "sep:1" : "sep:0",
      ].join("|")
    })

    const rowVersion = ref(0)
    const sortState = ref<SortToggleState[]>(resolveInitialSortState(props.sortModel))
    const filterModelState = ref<DataGridFilterSnapshot>(cloneFilterModelState(props.filterModel))
    const columnFilterTextByKey = computed<Record<string, string>>(() => (
      resolveInitialFilterTexts(filterModelState.value)
    ))

    let lastRowModelVersionKey = ""
    const resolveRowModelVersionKey = () => {
      const snapshot = props.runtimeRowModel.getSnapshot()
      return [
        snapshot.kind,
        snapshot.revision ?? "",
        snapshot.rowCount,
        snapshot.loading ? 1 : 0,
        snapshot.projection?.recomputeVersion ?? snapshot.projection?.version ?? "",
      ].join("|")
    }

    lastRowModelVersionKey = resolveRowModelVersionKey()

    const unsubscribeRowModel = props.runtimeRowModel.subscribe(() => {
      const nextVersionKey = resolveRowModelVersionKey()
      if (nextVersionKey === lastRowModelVersionKey) {
        return
      }
      lastRowModelVersionKey = nextVersionKey
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
    const totalRuntimeRows = computed(() => {
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
    const columnLabelByKey = computed(() => {
      const map = new Map<string, string>()
      for (const column of allColumns.value) {
        map.set(column.key, column.column.label ?? column.key)
      }
      return map
    })
    const {
      isColumnLayoutPanelOpen,
      columnLayoutPanelItems,
      openColumnLayoutPanel,
      cancelColumnLayoutPanel,
      applyColumnLayoutPanel,
      moveColumnUp,
      moveColumnDown,
      moveColumnToPosition,
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
    const advancedFilterBuilderRef = shallowRef<UseDataGridAppAdvancedFilterBuilderResult | null>(null)
    const isAdvancedFilterPanelOpen = computed(() => (
      advancedFilterBuilderRef.value?.isAdvancedFilterPanelOpen.value ?? false
    ))
    const advancedFilterDraftClauses = computed(() => (
      advancedFilterBuilderRef.value?.advancedFilterDraftClauses.value ?? []
    ))
    const appliedAdvancedFilterExpression = computed<DataGridAdvancedExpressionEntry | null>(() => (
      advancedFilterBuilderRef.value?.appliedAdvancedFilterExpression.value ?? null
    ))
    const ensureAdvancedFilterBuilder = async (): Promise<UseDataGridAppAdvancedFilterBuilderResult> => {
      if (advancedFilterBuilderRef.value) {
        return advancedFilterBuilderRef.value
      }
      const { useDataGridAppAdvancedFilterBuilder } = await import("@affino/datagrid-vue/app")
      const builder = useDataGridAppAdvancedFilterBuilder({
        resolveColumns: () => advancedFilterColumns.value,
      })
      builder.hydrateAdvancedFilterClauses(resolveAdvancedFilterDraftClausesFromFilterModel(filterModelState.value))
      advancedFilterBuilderRef.value = builder
      return builder
    }
    const hydrateAdvancedFilterClauses = (clauses: Parameters<UseDataGridAppAdvancedFilterBuilderResult["hydrateAdvancedFilterClauses"]>[0]): void => {
      advancedFilterBuilderRef.value?.hydrateAdvancedFilterClauses(clauses)
    }
    const openAdvancedFilterPanel = async (): Promise<void> => {
      const builder = await ensureAdvancedFilterBuilder()
      builder.openAdvancedFilterPanel()
    }
    const addAdvancedFilterClause = async (): Promise<void> => {
      const builder = await ensureAdvancedFilterBuilder()
      builder.addAdvancedFilterClause()
    }
    const removeAdvancedFilterClause = async (clauseId: number): Promise<void> => {
      const builder = await ensureAdvancedFilterBuilder()
      builder.removeAdvancedFilterClause(clauseId)
    }
    const updateAdvancedFilterClause = async (patch: Parameters<UseDataGridAppAdvancedFilterBuilderResult["updateAdvancedFilterClause"]>[0]): Promise<void> => {
      const builder = await ensureAdvancedFilterBuilder()
      builder.updateAdvancedFilterClause(patch)
    }
    const cancelAdvancedFilterPanel = (): void => {
      advancedFilterBuilderRef.value?.cancelAdvancedFilterPanel()
    }
    const commitAdvancedFilterPanelDraft = (): void => {
      advancedFilterBuilderRef.value?.applyAdvancedFilterPanel()
    }
    const clearAdvancedFilterPanel = (): void => {
      advancedFilterBuilderRef.value?.clearAdvancedFilterPanel()
    }
    const isAggregationsPanelOpen = ref(false)
    const aggregationDraftModel = ref<DataGridAggregationModel<Record<string, unknown>> | null>(null)
    const aggregationGroupingEnabled = computed(() => Boolean(props.groupBy?.fields?.length))
    const currentAggregationModel = computed<DataGridAggregationModel<Record<string, unknown>> | null>(() => {
      void rowVersion.value
      return cloneAggregationModelState(props.runtime.api.rows.getAggregationModel())
    })
    const currentGroupBy = computed<DataGridGroupBySpec | null>(() => {
      void rowVersion.value
      return cloneGroupBySpec(props.runtime.api.rows.getSnapshot().groupBy)
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

    const resolveColumnMenuItems = (columnKey: string) => {
      return resolveDataGridColumnMenuItems(props.columnMenu, columnKey)
    }

    const resolveColumnMenuDisabledItems = (columnKey: string) => {
      return resolveDataGridColumnMenuDisabledItems(props.columnMenu, columnKey)
    }

    const resolveColumnMenuDisabledReasons = (columnKey: string) => {
      return resolveDataGridColumnMenuDisabledReasons(props.columnMenu, columnKey)
    }

    const resolveColumnMenuLabels = (columnKey: string) => {
      return resolveDataGridColumnMenuLabels(props.columnMenu, columnKey)
    }

    const resolveColumnMenuActionOptions = (columnKey: string) => {
      return resolveDataGridColumnMenuActionOptions(props.columnMenu, columnKey)
    }

    const resolveColumnMenuCustomItems = (columnKey: string) => {
      return resolveDataGridColumnMenuCustomItems(props.columnMenu, columnKey)
    }

    const resolveColumnGroupOrder = (columnKey: string): number | null => {
      const index = currentGroupBy.value?.fields.findIndex(field => field === columnKey) ?? -1
      return index >= 0 ? index : null
    }

    const isColumnGrouped = (columnKey: string): boolean => {
      return resolveColumnGroupOrder(columnKey) !== null
    }

    const applySortAndFilter = (): void => {
      const nextSortModel: readonly DataGridSortState[] = sortState.value.map(entry => ({
        key: entry.key,
        direction: entry.direction,
      }))
      const advancedExpression = filterModelState.value.advancedExpression ?? null
      const nextFilterModel = props.advancedFilter.enabled
        ? {
            ...filterModelState.value,
            advancedFilters: {},
            advancedExpression,
          }
        : {
            ...filterModelState.value,
            advancedExpression,
          }

      props.runtime.api.rows.setSortAndFilterModel({
        sortModel: nextSortModel,
        filterModel: pruneFilterModel(nextFilterModel),
      })
    }

    const syncAdvancedFilterBuilderFromRuntime = (): void => {
      hydrateAdvancedFilterClauses(resolveAdvancedFilterDraftClausesFromFilterModel(filterModelState.value))
    }

    const effectiveAdvancedExpression = computed<DataGridAdvancedExpressionEntry | null>(() => {
      return filterModelState.value.advancedExpression ?? null
    })

    const activeFilterSummaryItems = computed<readonly string[]>(() => {
      const resolveColumnLabel = (columnKey: string): string => columnLabelByKey.value.get(columnKey) ?? columnKey
      const items: string[] = []

      for (const [columnKey, entry] of Object.entries(filterModelState.value.columnFilters ?? {})) {
        if (!entry) {
          continue
        }
        items.push(formatColumnFilterSummary(resolveColumnLabel(columnKey), entry))
      }

      for (const [columnKey, entry] of Object.entries(filterModelState.value.advancedFilters ?? {})) {
        if (!entry) {
          continue
        }
        items.push(`Advanced: ${formatLegacyAdvancedFilterSummary(resolveColumnLabel(columnKey), entry)}`)
      }

      if (effectiveAdvancedExpression.value) {
        items.push(`Advanced: ${formatAdvancedExpressionSummary(effectiveAdvancedExpression.value, resolveColumnLabel)}`)
      }

      return Object.freeze(items)
    })

    const hasActiveFilters = computed(() => activeFilterSummaryItems.value.length > 0)

    const resetAllFilters = (): void => {
      filterModelState.value = createEmptyFilterModel()
      clearAdvancedFilterPanel()
      applySortAndFilter()
    }

    watch(
      filterModelState,
      () => {
        if (!props.advancedFilter.enabled || isAdvancedFilterPanelOpen.value) {
          return
        }
        syncAdvancedFilterBuilderFromRuntime()
      },
      { immediate: true, deep: true },
    )

    const handleOpenAdvancedFilterPanel = (): void => {
      syncAdvancedFilterBuilderFromRuntime()
      void openAdvancedFilterPanel()
    }

    const applyAdvancedFilterPanel = (): void => {
      commitAdvancedFilterPanelDraft()
      filterModelState.value = {
        ...cloneFilterModelState(filterModelState.value),
        columnFilters: {},
        advancedFilters: {},
        advancedExpression: appliedAdvancedFilterExpression.value,
      }
      applySortAndFilter()
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

    const openAggregationsPanel = (): void => {
      aggregationDraftModel.value = cloneAggregationModelState(currentAggregationModel.value)
      isAggregationsPanelOpen.value = true
    }

    const cancelAggregationsPanel = (): void => {
      aggregationDraftModel.value = cloneAggregationModelState(currentAggregationModel.value)
      isAggregationsPanelOpen.value = false
    }

    watch(
      aggregationGroupingEnabled,
      enabled => {
        if (enabled) {
          return
        }
        cancelAggregationsPanel()
      },
      { immediate: true },
    )

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

    const applyColumnMenuGroupBy = (columnKey: string, grouped: boolean): void => {
      const current = currentGroupBy.value
      const nextFields = grouped
        ? Array.from(new Set([...(current?.fields ?? []), columnKey]))
        : (current?.fields ?? []).filter(field => field !== columnKey)
      props.runtime.api.rows.setGroupBy(nextFields.length > 0
        ? {
            fields: nextFields,
            expandedByDefault: current?.expandedByDefault ?? true,
          }
        : null)
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

    const stageHostRef = ref<HTMLElement | null>(null)
    const rowClipboardBuffer = ref<{
      rows: readonly Record<string, unknown>[]
      operation: "copy" | "cut"
      sourceRowIds: readonly string[]
    } | null>(null)
    let generatedRowIdentitySequence = 0
    type MenuCoord = { rowIndex: number; columnIndex: number }
    type MenuRange = { startRow: number; endRow: number; startColumn: number; endColumn: number }

    const resolveCurrentSelectionRange = (): MenuRange | null => {
      const snapshot = props.selectionSnapshot.value
      const range = snapshot?.ranges[snapshot.activeRangeIndex] ?? null
      if (!range) {
        return null
      }
      return {
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startCol,
        endColumn: range.endCol,
      }
    }

    const resolveCurrentCellCoord = (): MenuCoord | null => {
      const activeCell = props.selectionSnapshot.value?.activeCell
      if (!activeCell) {
        return null
      }
      return {
        rowIndex: activeCell.rowIndex,
        columnIndex: activeCell.colIndex,
      }
    }

    const isMultiCellSelection = (
      range: MenuRange | null,
    ): boolean => {
      if (!range) {
        return false
      }
      return range.startRow !== range.endRow || range.startColumn !== range.endColumn
    }

    const isCoordInsideRange = (
      coord: MenuCoord,
      range: MenuRange,
    ): boolean => {
      return coord.rowIndex >= Math.min(range.startRow, range.endRow)
        && coord.rowIndex <= Math.max(range.startRow, range.endRow)
        && coord.columnIndex >= Math.min(range.startColumn, range.endColumn)
        && coord.columnIndex <= Math.max(range.startColumn, range.endColumn)
    }

    const resolveCellCoordFromDataset = (rowId: string, columnKey: string): MenuCoord | null => {
      const rowIndex = props.runtime.resolveBodyRowIndexById(rowId)
      const columnIndex = visibleColumns.value.findIndex(column => column.key === columnKey)
      if (rowIndex < 0 || columnIndex < 0) {
        return null
      }
      return { rowIndex, columnIndex }
    }

    const buildSingleCellSelectionSnapshot = (coord: MenuCoord): import("@affino/datagrid-vue").DataGridSelectionSnapshot => ({
      ranges: [{
        startRow: coord.rowIndex,
        endRow: coord.rowIndex,
        startCol: coord.columnIndex,
        endCol: coord.columnIndex,
        anchor: {
          rowIndex: coord.rowIndex,
          colIndex: coord.columnIndex,
          rowId: props.runtime.getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
        },
        focus: {
          rowIndex: coord.rowIndex,
          colIndex: coord.columnIndex,
          rowId: props.runtime.getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
        },
        startRowId: props.runtime.getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
        endRowId: props.runtime.getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
      }],
      activeRangeIndex: 0,
      activeCell: {
        rowIndex: coord.rowIndex,
        colIndex: coord.columnIndex,
        rowId: props.runtime.getBodyRowAtIndex(coord.rowIndex)?.rowId ?? null,
      },
    })

    type CapturedColumnSelectionCoord = {
      rowIndex: number
      rowId: string | number | null
      columnKey: string
    }

    type CapturedColumnSelectionRange = {
      startRow: number
      endRow: number
      startColumnKey: string
      endColumnKey: string
      startRowId: string | number | null
      endRowId: string | number | null
      anchor: CapturedColumnSelectionCoord
      focus: CapturedColumnSelectionCoord
    }

    type CapturedColumnSelectionState = {
      ranges: readonly CapturedColumnSelectionRange[]
      activeRangeIndex: number
      activeCell: CapturedColumnSelectionCoord | null
    }

    const resolveVisibleColumnKeyAtIndex = (
      columnKeys: readonly string[],
      columnIndex: number,
    ): string | null => {
      if (!Number.isFinite(columnIndex)) {
        return null
      }
      const normalizedColumnIndex = Math.trunc(columnIndex)
      return columnKeys[normalizedColumnIndex] ?? null
    }

    const normalizeSelectionRowId = (value: unknown): string | number | null => {
      return typeof value === "string" || typeof value === "number"
        ? value
        : null
    }

    const captureColumnSelectionState = (): CapturedColumnSelectionState | null => {
      const snapshot = props.selectionSnapshot.value
      const columnKeys = visibleColumns.value.map(column => column.key)
      if (!snapshot || columnKeys.length === 0) {
        return null
      }

      const ranges = snapshot.ranges
        .map(range => {
          const startColumnKey = resolveVisibleColumnKeyAtIndex(columnKeys, range.startCol)
          const endColumnKey = resolveVisibleColumnKeyAtIndex(columnKeys, range.endCol)
          if (!startColumnKey || !endColumnKey) {
            return null
          }

          const anchorColumnKey = resolveVisibleColumnKeyAtIndex(columnKeys, range.anchor?.colIndex ?? range.startCol)
            ?? startColumnKey
          const focusColumnKey = resolveVisibleColumnKeyAtIndex(columnKeys, range.focus?.colIndex ?? range.endCol)
            ?? endColumnKey

          return {
            startRow: range.startRow,
            endRow: range.endRow,
            startColumnKey,
            endColumnKey,
            startRowId: normalizeSelectionRowId(range.startRowId),
            endRowId: normalizeSelectionRowId(range.endRowId),
            anchor: {
              rowIndex: range.anchor?.rowIndex ?? range.startRow,
              rowId: normalizeSelectionRowId(range.anchor?.rowId),
              columnKey: anchorColumnKey,
            },
            focus: {
              rowIndex: range.focus?.rowIndex ?? range.endRow,
              rowId: normalizeSelectionRowId(range.focus?.rowId),
              columnKey: focusColumnKey,
            },
          } satisfies CapturedColumnSelectionRange
        })
        .filter((range): range is CapturedColumnSelectionRange => range != null)

      if (ranges.length === 0) {
        return null
      }

      const activeCellColumnKey = snapshot.activeCell
        ? resolveVisibleColumnKeyAtIndex(columnKeys, snapshot.activeCell.colIndex)
        : null

      return {
        ranges,
        activeRangeIndex: Math.max(0, Math.trunc(snapshot.activeRangeIndex ?? 0)),
        activeCell: snapshot.activeCell && activeCellColumnKey
          ? {
              rowIndex: snapshot.activeCell.rowIndex,
              rowId: normalizeSelectionRowId(snapshot.activeCell.rowId),
              columnKey: activeCellColumnKey,
            }
          : null,
      }
    }

    const buildColumnSelectionSnapshotFromCapturedState = (
      captured: CapturedColumnSelectionState,
    ): import("@affino/datagrid-vue").DataGridSelectionSnapshot | null => {
      const currentColumnKeys = visibleColumns.value.map(column => column.key)
      if (currentColumnKeys.length === 0) {
        return null
      }

      const ranges: import("@affino/datagrid-vue").DataGridSelectionSnapshot["ranges"] = []
      for (const range of captured.ranges) {
        const startColumnIndex = currentColumnKeys.indexOf(range.startColumnKey)
        const endColumnIndex = currentColumnKeys.indexOf(range.endColumnKey)
        const anchorColumnIndex = currentColumnKeys.indexOf(range.anchor.columnKey)
        const focusColumnIndex = currentColumnKeys.indexOf(range.focus.columnKey)
        if (startColumnIndex < 0 || endColumnIndex < 0 || anchorColumnIndex < 0 || focusColumnIndex < 0) {
          continue
        }
        ranges.push({
          startRow: range.startRow,
          endRow: range.endRow,
          startCol: startColumnIndex,
          endCol: endColumnIndex,
          startRowId: range.startRowId,
          endRowId: range.endRowId,
          anchor: {
            rowIndex: range.anchor.rowIndex,
            colIndex: anchorColumnIndex,
            rowId: range.anchor.rowId,
          },
          focus: {
            rowIndex: range.focus.rowIndex,
            colIndex: focusColumnIndex,
            rowId: range.focus.rowId,
          },
        })
      }

      if (ranges.length === 0) {
        return null
      }

      const activeRangeIndex = Math.min(ranges.length - 1, Math.max(0, captured.activeRangeIndex))
      const fallbackRange = ranges[activeRangeIndex] ?? ranges[0] ?? null
      if (!fallbackRange) {
        return null
      }

      const activeCellColumnIndex = captured.activeCell
        ? currentColumnKeys.indexOf(captured.activeCell.columnKey)
        : -1

      return {
        ranges,
        activeRangeIndex,
        activeCell: activeCellColumnIndex >= 0 && captured.activeCell
          ? {
              rowIndex: captured.activeCell.rowIndex,
              colIndex: activeCellColumnIndex,
              rowId: captured.activeCell.rowId,
            }
          : {
              rowIndex: fallbackRange.focus.rowIndex,
              colIndex: fallbackRange.focus.colIndex,
              rowId: fallbackRange.focus.rowId,
            },
      }
    }

    const restoreColumnInteractionAfterReorder = (captured: CapturedColumnSelectionState | null): void => {
      const nextSelectionSnapshot = captured
        ? buildColumnSelectionSnapshotFromCapturedState(captured)
        : null
      if (nextSelectionSnapshot) {
        props.runtime.api.selection.setSnapshot(nextSelectionSnapshot)
        props.syncSelectionSnapshotFromRuntime()
      }
      scheduleViewportAnchorFocus()
    }

    const resolveFocusedReorderedRowId = (sourceRowIds: readonly string[]): string | null => {
      if (sourceRowIds.length === 0) {
        return null
      }
      const sourceRowIdSet = new Set(sourceRowIds)
      const activeRowId = props.selectionSnapshot.value?.activeCell?.rowId
      if (activeRowId != null) {
        const normalizedActiveRowId = String(activeRowId)
        if (sourceRowIdSet.has(normalizedActiveRowId)) {
          return normalizedActiveRowId
        }
      }
      const activeRange = props.selectionSnapshot.value?.ranges[props.selectionSnapshot.value?.activeRangeIndex ?? 0] ?? null
      const anchorRowId = activeRange?.anchor?.rowId
      if (anchorRowId != null) {
        const normalizedAnchorRowId = String(anchorRowId)
        if (sourceRowIdSet.has(normalizedAnchorRowId)) {
          return normalizedAnchorRowId
        }
      }
      const focusedRowId = props.rowSelectionSnapshot.value?.focusedRow
      if (focusedRowId != null) {
        const normalizedFocusedRowId = String(focusedRowId)
        if (sourceRowIdSet.has(normalizedFocusedRowId)) {
          return normalizedFocusedRowId
        }
      }
      return sourceRowIds[0] ?? null
    }

    const buildRowIndexSelectionSnapshot = (
      rowIds: readonly string[],
      focusRowId: string,
    ): import("@affino/datagrid-vue").DataGridSelectionSnapshot | null => {
      const lastColumnIndex = visibleColumns.value.length - 1
      if (rowIds.length === 0 || lastColumnIndex < 0) {
        return null
      }
      const resolvedRows = rowIds
        .map(rowId => ({ rowId, rowIndex: props.runtime.resolveBodyRowIndexById(rowId) }))
        .filter((entry): entry is { rowId: string; rowIndex: number } => entry.rowIndex >= 0)
        .sort((left, right) => left.rowIndex - right.rowIndex)
      if (resolvedRows.length === 0) {
        return null
      }
      const fallbackRow = resolvedRows[0] ?? null
      const focusedRowIndex = props.runtime.resolveBodyRowIndexById(focusRowId)
      const resolvedFocusRow = focusedRowIndex >= 0
        ? { rowId: focusRowId, rowIndex: focusedRowIndex }
        : fallbackRow
      if (!resolvedFocusRow || resolvedFocusRow.rowIndex < 0) {
        return null
      }
      return {
        ranges: [{
          startRow: resolvedRows[0]?.rowIndex ?? resolvedFocusRow.rowIndex,
          endRow: resolvedRows[resolvedRows.length - 1]?.rowIndex ?? resolvedFocusRow.rowIndex,
          startCol: 0,
          endCol: lastColumnIndex,
          anchor: {
            rowIndex: resolvedFocusRow.rowIndex,
            colIndex: 0,
            rowId: resolvedFocusRow.rowId,
          },
          focus: {
            rowIndex: resolvedFocusRow.rowIndex,
            colIndex: 0,
            rowId: resolvedFocusRow.rowId,
          },
          startRowId: resolvedRows[0]?.rowId ?? resolvedFocusRow.rowId,
          endRowId: resolvedRows[resolvedRows.length - 1]?.rowId ?? resolvedFocusRow.rowId,
        }],
        activeRangeIndex: 0,
        activeCell: {
          rowIndex: resolvedFocusRow.rowIndex,
          colIndex: 0,
          rowId: resolvedFocusRow.rowId,
        },
      }
    }

    const scheduleViewportAnchorFocus = (): void => {
      const focusViewport = (): boolean => {
        const viewport = stageHostRef.value?.querySelector<HTMLElement>(".grid-body-viewport")
        if (!viewport) {
          return false
        }
        try {
          viewport.focus({ preventScroll: true })
        }
        catch {
          viewport.focus()
        }
        return document.activeElement === viewport
      }

      const runAttempt = (attempt: number): void => {
        void nextTick(() => {
          if (focusViewport() || attempt >= 3) {
            return
          }
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              runAttempt(attempt + 1)
            })
            return
          }
          runAttempt(attempt + 1)
        })
      }

      runAttempt(0)
    }

    const restoreRowInteractionAfterReorder = (sourceRowIds: readonly string[]): void => {
      const focusRowId = resolveFocusedReorderedRowId(sourceRowIds)
      if (!focusRowId) {
        return
      }
      if (props.runtime.api.rowSelection.hasSupport()) {
        props.runtime.api.rowSelection.setFocusedRow(focusRowId)
        props.syncRowSelectionSnapshotFromRuntime?.()
        props.flushRowSelectionSnapshotUpdates?.()
      }
      const nextSelectionSnapshot = buildRowIndexSelectionSnapshot(sourceRowIds, focusRowId)
      if (nextSelectionSnapshot) {
        props.runtime.api.selection.setSnapshot(nextSelectionSnapshot)
        props.syncSelectionSnapshotFromRuntime()
      }
      scheduleViewportAnchorFocus()
    }

    const resolveRuntimeRowById = (rowId: string): import("@affino/datagrid-vue").DataGridRowNode<Record<string, unknown>> | null => {
      const rowCount = props.runtime.api.rows.getCount()
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = props.runtime.api.rows.get(rowIndex)
        if (row && String(row.rowId) === rowId) {
          return row
        }
      }
      return null
    }

    const resolvePlaceholderVisualRowIndex = (rowId: string): number | null => {
      if (!props.placeholderRows.enabled || !props.placeholderRows.createRowAt) {
        return null
      }
      if (resolveRuntimeRowById(rowId)) {
        return null
      }
      const selector = `.datagrid-stage__row-index-cell[data-row-id="${escapeCssAttributeValue(rowId)}"]`
      const rowIndexCell = stageHostRef.value?.querySelector<HTMLElement>(selector)
      const visualRowIndex = Number.parseInt(rowIndexCell?.dataset.rowIndex ?? "", 10)
      if (!Number.isFinite(visualRowIndex)) {
        return null
      }
      const normalizedVisualRowIndex = Math.max(0, Math.trunc(visualRowIndex))
      if (normalizedVisualRowIndex < props.runtime.api.rows.getCount()) {
        return null
      }
      return normalizedVisualRowIndex
    }

    const writeClipboardText = async (payload: string): Promise<boolean> => {
      try {
        if (!globalThis.navigator?.clipboard?.writeText) {
          return false
        }
        await globalThis.navigator.clipboard.writeText(payload)
        return true
      }
      catch {
        return false
      }
    }

    const readClipboardText = async (): Promise<string> => {
      try {
        if (!globalThis.navigator?.clipboard?.readText) {
          return ""
        }
        return await globalThis.navigator.clipboard.readText()
      }
      catch {
        return ""
      }
    }

    const readRowClipboardRows = async (): Promise<readonly Record<string, unknown>[] | null> => {
      if (rowClipboardBuffer.value?.rows.length) {
        return rowClipboardBuffer.value.rows.map(row => cloneRowData(row))
      }
      const payload = (await readClipboardText()).trim()
      if (!payload) {
        return null
      }
      try {
        const parsed = JSON.parse(payload)
        if (Array.isArray(parsed)) {
          return parsed
            .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
            .map(row => cloneRowData(row))
        }
        if (parsed && typeof parsed === "object") {
          return [cloneRowData(parsed as Record<string, unknown>)]
        }
      }
      catch {
        return null
      }
      return null
    }

    const setRowClipboardRows = async (
      rows: readonly Record<string, unknown>[],
      operation: "copy" | "cut",
      sourceRowIds: readonly string[] = [],
    ): Promise<boolean> => {
      const clonedRows = rows.map(row => cloneRowData(row))
      rowClipboardBuffer.value = {
        rows: clonedRows,
        operation,
        sourceRowIds: sourceRowIds.map(rowId => String(rowId)),
      }
      const clipboardPayload = serializeRowClipboardRows(clonedRows)
      if (clipboardPayload) {
        await writeClipboardText(clipboardPayload)
      }
      return true
    }

    const canInsertRows = (): boolean => props.runtime.api.rows.hasInsertSupport()
    const canMutateRows = (): boolean => props.runtime.api.rows.hasDataMutationSupport()

    const isStructuredSourceRowInput = (candidate: unknown): candidate is Record<string, unknown> => {
      if (!candidate || typeof candidate !== "object") {
        return false
      }
      return (
        "data" in candidate
        || "row" in candidate
        || "kind" in candidate
        || "state" in candidate
        || "sourceIndex" in candidate
        || "originalIndex" in candidate
        || "displayIndex" in candidate
      )
    }

    const resolveDataRowId = (candidate: Record<string, unknown>): string | null => {
      const candidateRecord = candidate as { rowId?: unknown; id?: unknown }
      if (candidateRecord.rowId != null) {
        return String(candidateRecord.rowId)
      }
      if (candidateRecord.id != null) {
        return String(candidateRecord.id)
      }
      return null
    }

    const resolveSourceRowTemplateByRowId = (rowId: string): Record<string, unknown> | null => {
      for (const candidate of props.rows) {
        if (!candidate || typeof candidate !== "object") {
          continue
        }
        const record = candidate as Record<string, unknown>
        const candidateRowId = record.rowId != null
          ? String(record.rowId)
          : record.rowKey != null
            ? String(record.rowKey)
            : null
        if (candidateRowId === rowId && isStructuredSourceRowInput(record)) {
          return record
        }
      }
      for (const candidate of props.rows) {
        if (!candidate || typeof candidate !== "object") {
          continue
        }
        const record = candidate as Record<string, unknown>
        if (isStructuredSourceRowInput(record)) {
          return record
        }
      }
      return null
    }

    const createGeneratedRowIdentity = (): string => {
      generatedRowIdentitySequence += 1
      return `datagrid-row-${Date.now()}-${generatedRowIdentitySequence}`
    }

    const cloneRawRowWithFreshIdentity = (row: Record<string, unknown>): Record<string, unknown> => {
      const cloned = cloneRowData(row)
      const nextIdentity = createGeneratedRowIdentity()
      let assignedIdentity = false
      if ("id" in cloned) {
        cloned.id = nextIdentity
        assignedIdentity = true
      }
      if ("rowId" in cloned) {
        cloned.rowId = nextIdentity
        assignedIdentity = true
      }
      if (!assignedIdentity) {
        cloned.id = nextIdentity
      }
      return cloned
    }

    const buildBlankRawRowInput = (row: Record<string, unknown>): Record<string, unknown> => {
      const nextIdentity = createGeneratedRowIdentity()
      const nextRow: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        if (key === "id" || key === "rowId") {
          nextRow[key] = nextIdentity
          continue
        }
        nextRow[key] = typeof value === "number" ? null : ""
      }
      if (!("id" in nextRow) && !("rowId" in nextRow)) {
        nextRow.id = nextIdentity
      }
      return nextRow
    }

    const buildStructuredRowInput = (
      row: Record<string, unknown>,
      template: Record<string, unknown>,
      mode: "clone" | "blank",
    ): Record<string, unknown> => {
      const nextIdentity = createGeneratedRowIdentity()
      const nextData = mode === "clone"
        ? cloneRowData(row)
        : Object.entries(row).reduce<Record<string, unknown>>((result, [key, value]) => {
            result[key] = typeof value === "number" ? null : ""
            return result
          }, {})
      if ("id" in nextData || !("rowId" in nextData) && !("id" in nextData)) {
        nextData.id = nextIdentity
      }
      if ("rowId" in nextData) {
        nextData.rowId = nextIdentity
      }
      if ("rowKey" in nextData) {
        nextData.rowKey = nextIdentity
      }
      const templateState = typeof template.state === "object" && template.state != null
        ? template.state as Record<string, unknown>
        : null
      return {
        kind: template.kind === "group" ? "leaf" : (template.kind ?? "leaf"),
        rowId: nextIdentity,
        rowKey: nextIdentity,
        state: {
          ...(templateState ?? {}),
          selected: false,
          group: false,
          pinned: "none",
          expanded: false,
        },
        data: nextData,
        row: cloneRowData(nextData),
      }
    }

    const cloneRowWithFreshIdentity = (
      row: Record<string, unknown>,
      template: Record<string, unknown> | null = null,
    ): Record<string, unknown> => {
      if (template && isStructuredSourceRowInput(template)) {
        return buildStructuredRowInput(row, template, "clone")
      }
      return cloneRawRowWithFreshIdentity(row)
    }

    const buildInsertedRowInput = (
      row: Record<string, unknown>,
      template: Record<string, unknown> | null = null,
    ): Record<string, unknown> => {
      if (template && isStructuredSourceRowInput(template)) {
        return buildStructuredRowInput(row, template, "blank")
      }
      return buildBlankRawRowInput(row)
    }

    const buildPlaceholderInsertedRowInput = (
      visualRowIndex: number,
      materializedRowCount: number,
      sourceRows: readonly Record<string, unknown>[],
    ): Record<string, unknown> | null => {
      if (!props.placeholderRows.enabled || !props.placeholderRows.createRowAt) {
        return null
      }
      const createdRow = props.placeholderRows.createRowAt({
        visualRowIndex,
        materializedRowCount,
        sourceRows,
        reason: "edit",
      })
      return createdRow ? cloneRowData(createdRow) : null
    }

    const insertPlaceholderRowAtVisualIndex = (
      insertIndex: number,
      ensureMaterializedCount: number,
    ): boolean => {
      if (!canInsertRows()) {
        return false
      }

      const nextSourceRows = readCurrentRuntimeDataRows().map(row => cloneRowData(row))
      let materializedCount = props.runtime.api.rows.getCount()

      while (materializedCount < ensureMaterializedCount) {
        const fillerRow = buildPlaceholderInsertedRowInput(
          materializedCount,
          materializedCount,
          nextSourceRows,
        )
        if (!fillerRow) {
          return false
        }
        const inserted = props.runtime.api.rows.insertDataAt(materializedCount, [fillerRow])
        if (!inserted) {
          return false
        }
        nextSourceRows.push(fillerRow)
        materializedCount += 1
      }

      const safeInsertIndex = Math.max(0, Math.min(materializedCount, Math.trunc(insertIndex)))
      const insertedRow = buildPlaceholderInsertedRowInput(
        safeInsertIndex,
        materializedCount,
        nextSourceRows,
      )
      if (!insertedRow) {
        return false
      }

      return props.runtime.api.rows.insertDataAt(safeInsertIndex, [insertedRow])
    }

    const materializePlaceholderRowsUpTo = (
      ensureMaterializedCount: number,
    ): readonly Record<string, unknown>[] | null => {
      if (!canInsertRows()) {
        return null
      }

      const nextSourceRows = readCurrentRuntimeDataRows().map(row => cloneRowData(row))
      let materializedCount = props.runtime.api.rows.getCount()
      const normalizedCount = Math.max(0, Math.trunc(ensureMaterializedCount))

      while (materializedCount < normalizedCount) {
        const fillerRow = buildPlaceholderInsertedRowInput(
          materializedCount,
          materializedCount,
          nextSourceRows,
        )
        if (!fillerRow) {
          return null
        }
        const inserted = props.runtime.api.rows.insertDataAt(materializedCount, [fillerRow])
        if (!inserted) {
          return null
        }
        nextSourceRows.push(fillerRow)
        materializedCount += 1
      }

      return nextSourceRows
    }

    const resolveSelectedRuntimeRowIds = (targetRowId: string): readonly string[] => {
      const isDeletableRuntimeRowId = (rowId: string): boolean => {
        const rowIndex = props.runtime.resolveBodyRowIndexById(rowId)
        if (rowIndex < 0 || rowIndex >= props.runtime.api.rows.getCount()) {
          return false
        }
        const row = props.runtime.getBodyRowAtIndex(rowIndex)
        return row != null && row.kind !== "group" && !isDataGridPlaceholderSurfaceRow(row)
      }

      const selectedRowIds = props.rowSelectionSnapshot.value?.selectedRows ?? []
      const normalizedSelected = selectedRowIds
        .map(rowId => String(rowId))
        .filter(rowId => rowId.length > 0 && isDeletableRuntimeRowId(rowId))
      if (normalizedSelected.length > 0) {
        return normalizedSelected
      }

      const selectionRange = resolveCurrentSelectionRange()
      const lastVisibleColumnIndex = visibleColumns.value.length - 1
      if (selectionRange && lastVisibleColumnIndex >= 0) {
        const startColumn = Math.min(selectionRange.startColumn, selectionRange.endColumn)
        const endColumn = Math.max(selectionRange.startColumn, selectionRange.endColumn)
        const startRow = Math.min(selectionRange.startRow, selectionRange.endRow)
        const endRow = Math.max(selectionRange.startRow, selectionRange.endRow)
        const targetRowIndex = targetRowId.length > 0 ? props.runtime.resolveBodyRowIndexById(targetRowId) : -1
        if (
          startColumn === 0
          && endColumn === lastVisibleColumnIndex
          && (targetRowIndex < 0 || (targetRowIndex >= startRow && targetRowIndex <= endRow))
        ) {
          const rangedRowIds: string[] = []
          for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
            const row = props.runtime.getBodyRowAtIndex(rowIndex)
            if (!row || row.kind === "group" || row.rowId == null) {
              continue
            }
            const rowId = String(row.rowId)
            if (!isDeletableRuntimeRowId(rowId)) {
              continue
            }
            rangedRowIds.push(rowId)
          }
          if (rangedRowIds.length > 0) {
            return rangedRowIds
          }
        }
      }

      return targetRowId.length > 0 && isDeletableRuntimeRowId(targetRowId) ? [targetRowId] : []
    }

    const readCurrentRuntimeDataRows = (): Record<string, unknown>[] => {
      const rows: Record<string, unknown>[] = []
      const rowCount = props.runtime.api.rows.getCount()
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = props.runtime.api.rows.get(rowIndex)
        if (!row || row.kind === "group") {
          continue
        }
        rows.push(row.data)
      }
      return rows
    }

    const resolveExistingRuntimeDataRowIds = (rowIds: readonly string[]): readonly string[] => {
      const existingRowIds = new Set(
        readCurrentRuntimeDataRows()
          .map(row => resolveDataRowId(row))
          .filter((rowId): rowId is string => rowId != null),
      )
      return Array.from(new Set(rowIds.map(rowId => String(rowId)).filter(rowId => existingRowIds.has(rowId))))
    }

    const resolveExistingRuntimeDataRowsByIds = (
      rowIds: readonly string[],
    ): readonly Record<string, unknown>[] => {
      if (rowIds.length === 0) {
        return []
      }
      const rowIdSet = new Set(rowIds.map(rowId => String(rowId)))
      return readCurrentRuntimeDataRows().filter(candidate => {
        const normalized = resolveDataRowId(candidate)
        return normalized != null && rowIdSet.has(normalized)
      })
    }

    const removeRuntimeRows = (rowIds: readonly string[]): boolean => {
      if (!canMutateRows() || rowIds.length === 0) {
        return false
      }
      const rowIdSet = new Set(rowIds)
      const nextRows = readCurrentRuntimeDataRows().filter(candidate => {
        const normalized = resolveDataRowId(candidate)
        return normalized == null || !rowIdSet.has(normalized)
      })
      if (nextRows.length === props.runtime.api.rows.getCount()) {
        return false
      }
      props.runtime.api.rows.replaceData(nextRows)
      if (props.runtime.api.rowSelection.hasSupport()) {
        props.runtime.api.rowSelection.clearSelectedRows()
        props.syncRowSelectionSnapshotFromRuntime?.()
      }
      return true
    }

    const moveRuntimeRowsToIndex = (sourceRowIds: readonly string[], targetIndex: number): boolean => {
      if (!canMutateRows() || sourceRowIds.length === 0) {
        return false
      }
      const currentRows = readCurrentRuntimeDataRows()
      const sourceRowIdSet = new Set(sourceRowIds.map(rowId => String(rowId)))
      const movedRows = currentRows.filter(candidate => {
        const normalized = resolveDataRowId(candidate)
        return normalized != null && sourceRowIdSet.has(normalized)
      })
      if (movedRows.length === 0) {
        return false
      }
      const remainingRows = currentRows.filter(candidate => {
        const normalized = resolveDataRowId(candidate)
        return normalized == null || !sourceRowIdSet.has(normalized)
      })
      const safeTargetIndex = Number.isFinite(targetIndex)
        ? Math.max(0, Math.min(remainingRows.length, Math.trunc(targetIndex)))
        : remainingRows.length
      props.runtime.api.rows.replaceData([
        ...remainingRows.slice(0, safeTargetIndex),
        ...movedRows,
        ...remainingRows.slice(safeTargetIndex),
      ])
      if (props.runtime.api.rowSelection.hasSupport()) {
        props.runtime.api.rowSelection.selectRows(sourceRowIds)
        props.syncRowSelectionSnapshotFromRuntime?.()
      }
      return true
    }

    const moveRuntimeRowsAfter = (sourceRowIds: readonly string[], targetRowId: string): boolean => {
      if (!canMutateRows() || sourceRowIds.length === 0 || !targetRowId) {
        return false
      }
      const sourceRowIdSet = new Set(sourceRowIds.map(rowId => String(rowId)))
      if (sourceRowIdSet.has(String(targetRowId))) {
        return false
      }
      const currentRows = readCurrentRuntimeDataRows()
      const remainingRows = currentRows.filter(candidate => {
        const normalized = resolveDataRowId(candidate)
        return normalized == null || !sourceRowIdSet.has(normalized)
      })
      const targetIndex = remainingRows.findIndex(candidate => resolveDataRowId(candidate) === targetRowId)
      if (targetIndex < 0) {
        return false
      }
      return moveRuntimeRowsToIndex(sourceRowIds, targetIndex + 1)
    }

    const reorderRowsByIndex = (payload: {
      sourceRowId: string | number
      targetRowId: string | number
      placement: "before" | "after"
    }): boolean => {
      if (!canMutateRows()) {
        return false
      }
      const normalizedSourceRowId = String(payload.sourceRowId)
      const normalizedTargetRowId = String(payload.targetRowId)
      if (!normalizedSourceRowId || !normalizedTargetRowId || normalizedSourceRowId === normalizedTargetRowId) {
        return false
      }
      const resolvedSelection = resolveExistingRuntimeDataRowIds(resolveSelectedRuntimeRowIds(normalizedSourceRowId))
      const sourceRowIds = resolvedSelection.includes(normalizedSourceRowId)
        ? resolvedSelection
        : resolveExistingRuntimeDataRowIds([normalizedSourceRowId])
      if (sourceRowIds.length === 0 || sourceRowIds.includes(normalizedTargetRowId)) {
        return false
      }

      const currentRows = readCurrentRuntimeDataRows()
      const sourceRowIdSet = new Set(sourceRowIds)
      const remainingRows = currentRows.filter(candidate => {
        const normalized = resolveDataRowId(candidate)
        return normalized == null || !sourceRowIdSet.has(normalized)
      })
      const targetIndex = remainingRows.findIndex(candidate => resolveDataRowId(candidate) === normalizedTargetRowId)
      if (targetIndex < 0) {
        return false
      }

      const beforeSnapshot = captureHistorySnapshot()
      const moved = moveRuntimeRowsToIndex(
        sourceRowIds,
        payload.placement === "after" ? targetIndex + 1 : targetIndex,
      )
      if (moved) {
        restoreRowInteractionAfterReorder(sourceRowIds)
        recordRowMutation(beforeSnapshot, sourceRowIds.length > 1 ? `Move ${sourceRowIds.length} rows` : "Move row")
      }
      return moved
    }

    const reorderColumnsByHeader = (payload: {
      sourceColumnKey: string
      targetColumnKey: string
      placement: "before" | "after"
    }): boolean => {
      const normalizedSourceColumnKey = String(payload.sourceColumnKey)
      const normalizedTargetColumnKey = String(payload.targetColumnKey)
      if (!normalizedSourceColumnKey || !normalizedTargetColumnKey || normalizedSourceColumnKey === normalizedTargetColumnKey) {
        return false
      }

      const currentColumns = allColumns.value
      const sourceColumn = currentColumns.find(column => column.key === normalizedSourceColumnKey)
      const targetColumn = currentColumns.find(column => column.key === normalizedTargetColumnKey)
      if (!sourceColumn || !targetColumn) {
        return false
      }

      const nextOrder = currentColumns.map(column => column.key)
      const sourceIndex = nextOrder.indexOf(normalizedSourceColumnKey)
      const targetIndex = nextOrder.indexOf(normalizedTargetColumnKey)
      if (sourceIndex < 0 || targetIndex < 0) {
        return false
      }

      const movedColumnKey = nextOrder[sourceIndex]
      if (!movedColumnKey) {
        return false
      }
      nextOrder.splice(sourceIndex, 1)
      const normalizedTargetIndex = nextOrder.indexOf(normalizedTargetColumnKey)
      if (normalizedTargetIndex < 0) {
        return false
      }
      const insertIndex = payload.placement === "after" ? normalizedTargetIndex + 1 : normalizedTargetIndex
      nextOrder.splice(insertIndex, 0, movedColumnKey)

      const previousSelection = captureColumnSelectionState()
      const targetPin = (targetColumn.pin ?? "none") as DataGridColumnPin
      const sourcePin = (sourceColumn.pin ?? "none") as DataGridColumnPin
      if (sourcePin !== targetPin) {
        props.runtime.api.columns.setPin(normalizedSourceColumnKey, targetPin)
      }
      props.runtime.api.columns.setOrder(nextOrder)
      restoreColumnInteractionAfterReorder(previousSelection)
      return true
    }

    const clearPendingRowClipboardOperation = (): boolean => {
      if (!rowClipboardBuffer.value) {
        return false
      }
      rowClipboardBuffer.value = null
      return true
    }

    const isRowInPendingClipboardCut = (
      row: import("@affino/datagrid-vue").DataGridRowNode<Record<string, unknown>>,
    ): boolean => {
      if (row.kind === "group") {
        return false
      }
      const pending = rowClipboardBuffer.value
      if (!pending) {
        return false
      }
      return pending.sourceRowIds.includes(String(row.rowId))
    }

    let contextMenuVisible = () => false
    let closeRuntimeContextMenu = (): void => undefined
    let openRuntimeContextMenuFromCurrentCell = (): void => undefined
    const highlightedFindReplaceCell = ref<DataGridFindReplaceVisualTarget | null>(null)
    let runRowIndexContextAction = async (
      _action: RendererRowIndexKeyboardAction,
      _rowId: string | number,
    ): Promise<boolean> => false

    const resolveRowIndexMenuLabel = (
      actionId: RendererContextMenuActionId,
      customLabel?: string,
    ): string => {
      if (customLabel) {
        return customLabel
      }
      const label = DEFAULT_CONTEXT_MENU_ACTION_LABELS[actionId]
      const shortcutHint = ROW_INDEX_MENU_SHORTCUT_HINTS[actionId]
      return shortcutHint ? `${label} (${shortcutHint})` : label
    }

    const {
      tableStageProps,
      tableStageContext,
      historyController,
      copySelectedCells,
      pasteSelectedCells,
      cutSelectedCells,
      clearSelectedCells,
      captureHistorySnapshot,
      captureHistorySnapshotForRowIds,
      recordHistoryIntentTransaction,
      revealCellInComfortZone,
    } = useDataGridTableStageRuntime<Record<string, unknown>>({
      mode: modeRef as Ref<DataGridMode>,
      layoutMode: computed(() => props.layoutMode),
      minRows: computed(() => props.minRows),
      maxRows: computed(() => props.maxRows),
      placeholderRows: computed(() => props.placeholderRows),
      enableFillHandle: computed(() => props.fillHandle),
      enableRangeMove: computed(() => props.rangeMove),
      rows: rowsRef,
      sourceRows: rowsRef,
      runtime: props.runtime,
      rowVersion,
      totalRuntimeRows,
      visibleColumns,
      rowRenderMode: computed(() => props.renderMode),
      rowHeightMode,
      normalizedBaseRowHeight,
      selectionSnapshot: props.selectionSnapshot,
      selectionAnchor: props.selectionAnchor,
      rowSelectionSnapshot: props.rowSelectionSnapshot,
      rowHover: computed(() => props.rowHover),
      stripedRows: computed(() => props.stripedRows),
      chromeSignature: gridLinesChromeSignature,
      showRowIndex: computed(() => props.showRowIndex),
      showRowSelection: computed(() => props.rowSelection),
      isRowInPendingClipboardCut,
      syncSelectionSnapshotFromRuntime: props.syncSelectionSnapshotFromRuntime,
      syncRowSelectionSnapshotFromRuntime: props.syncRowSelectionSnapshotFromRuntime,
      flushRowSelectionSnapshotUpdates: props.flushRowSelectionSnapshotUpdates,
      clearExternalPendingClipboardOperation: clearPendingRowClipboardOperation,
      firstColumnKey,
      columnFilterTextByKey,
      virtualization: computed(() => props.virtualization),
      toggleSortForColumn,
      sortIndicator,
      setColumnFilterText,
      columnMenuEnabled: computed(() => props.columnMenu.enabled),
      columnMenuTrigger: computed(() => props.columnMenu.trigger),
      columnMenuMaxFilterValues: computed(() => props.columnMenu.maxFilterValues),
      resolveColumnMenuItems,
      resolveColumnMenuDisabledItems,
      resolveColumnMenuDisabledReasons,
      resolveColumnMenuLabels,
      resolveColumnMenuActionOptions,
      resolveColumnMenuCustomItems,
      isColumnFilterActive,
      isColumnGrouped,
      resolveColumnGroupOrder,
      resolveColumnMenuSortDirection,
      resolveColumnMenuSelectedTokens: resolveCurrentValueFilterTokens,
      applyColumnMenuSort,
      applyColumnMenuPin,
      applyColumnMenuGroupBy,
      applyColumnMenuFilter,
      clearColumnMenuFilter,
      applyRowHeightSettings,
      cloneRowData,
      historyEnabled: computed(() => props.history.enabled),
      historyMaxDepth: computed(() => props.history.depth),
      historyShortcuts: computed(() => props.history.shortcuts),
      history: props.history.adapter,
      isCellEditable: props.isCellEditable,
      isContextMenuVisible: () => contextMenuVisible(),
      closeContextMenu: () => closeRuntimeContextMenu(),
      openContextMenuFromCurrentCell: () => {
        openRuntimeContextMenuFromCurrentCell()
      },
      runRowIndexKeyboardAction: (action, rowId) => runRowIndexContextAction(action, rowId),
      reorderColumnsByHeader: props.columnReorder.enabled ? reorderColumnsByHeader : undefined,
      reorderRowsByIndex: props.rowReorder.enabled ? reorderRowsByIndex : undefined,
      cellClass: (row, _rowIndex, column) => {
        const target = highlightedFindReplaceCell.value
        if (!target || row.kind === "group" || row.rowId == null) {
          return null
        }
        if (row.rowId !== target.rowId || column.key !== target.columnKey) {
          return null
        }
        return {
          "grid-cell--find-match-active": true,
          "grid-cell--find-match-flash-a": target.flashPhase === 0,
          "grid-cell--find-match-flash-b": target.flashPhase === 1,
        }
      },
    })

    watch(
      () => props.registerHistoryController,
      registerHistoryController => {
        registerHistoryController?.(historyController)
      },
      { immediate: true },
    )

    watch(
      () => props.history.shortcuts,
      (shortcutMode, _previous, onCleanup) => {
        if (shortcutMode !== "window" || typeof window === "undefined") {
          return
        }
        const handleWindowKeydown = (event: KeyboardEvent) => {
          if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) {
            return
          }
          const key = event.key.toLowerCase()
          const direction = key === "z"
            ? (event.shiftKey ? "redo" : "undo")
            : (key === "y" && !event.shiftKey ? "redo" : null)
          if (!direction) {
            return
          }
          event.preventDefault()
          void historyController.runHistoryAction(direction)
        }
        window.addEventListener("keydown", handleWindowKeydown)
        onCleanup(() => {
          window.removeEventListener("keydown", handleWindowKeydown)
        })
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      props.registerHistoryController?.(null)
    })

    const stageVisibleColumns = computed(() => tableStageProps.value.columns.visibleColumns)
    const applyActiveCell = (coord: MenuCoord): void => {
      props.runtime.api.selection.setSnapshot(buildSingleCellSelectionSnapshot(coord))
      props.syncSelectionSnapshotFromRuntime()
    }
    const isFindReplaceCellEditable = (
      row: import("@affino/datagrid-vue").DataGridRowNode<Record<string, unknown>>,
      rowIndex: number,
      column: DataGridColumnSnapshot,
      _columnIndex: number,
    ): boolean => {
      if (row.kind === "group" || row.rowId == null || column.column.capabilities?.editable === false) {
        return false
      }
      if (!props.isCellEditable) {
        return true
      }
      return props.isCellEditable({
        row: row.data,
        rowId: row.rowId,
        rowIndex,
        column: column.column,
        columnKey: column.key,
      })
    }
    const findReplaceRef = shallowRef<UseDataGridAppFindReplaceResult | null>(null)
    const ensureFindReplace = async (): Promise<UseDataGridAppFindReplaceResult> => {
      if (findReplaceRef.value) {
        return findReplaceRef.value
      }
      const { useDataGridAppFindReplace } = await import("../useDataGridAppFindReplace")
      const feature = useDataGridAppFindReplace<Record<string, unknown>, unknown>({
        runtime: props.runtime,
        visibleColumns,
        stageVisibleColumns,
        resolveCurrentCellCoord,
        applyActiveCell,
        revealCellInComfortZone,
        captureRowsSnapshot: captureHistorySnapshot,
        captureRowsSnapshotForRowIds: captureHistorySnapshotForRowIds,
        recordHistoryIntentTransaction,
        isCellEditable: isFindReplaceCellEditable,
      })
      findReplaceRef.value = feature
      return feature
    }
    const findReplace = {
      isPanelOpen: computed(() => findReplaceRef.value?.isPanelOpen.value ?? false),
      findText: computed(() => findReplaceRef.value?.findText.value ?? ""),
      replaceText: computed(() => findReplaceRef.value?.replaceText.value ?? ""),
      matchCase: computed(() => findReplaceRef.value?.matchCase.value ?? false),
      statusText: computed(() => findReplaceRef.value?.statusText.value ?? ""),
      active: computed(() => findReplaceRef.value?.active.value ?? false),
      canFind: computed(() => findReplaceRef.value?.canFind.value ?? false),
      canReplaceCurrent: computed(() => findReplaceRef.value?.canReplaceCurrent.value ?? false),
      canReplaceAll: computed(() => findReplaceRef.value?.canReplaceAll.value ?? false),
      highlightedCell: computed(() => findReplaceRef.value?.highlightedCell.value ?? null),
      openPanel: async (): Promise<void> => {
        const feature = await ensureFindReplace()
        feature.openPanel()
      },
      closePanel: (): void => {
        findReplaceRef.value?.closePanel()
      },
      updateFindText: async (value: string): Promise<void> => {
        const feature = await ensureFindReplace()
        feature.updateFindText(value)
      },
      updateReplaceText: async (value: string): Promise<void> => {
        const feature = await ensureFindReplace()
        feature.updateReplaceText(value)
      },
      updateMatchCase: async (value: boolean): Promise<void> => {
        const feature = await ensureFindReplace()
        feature.updateMatchCase(value)
      },
      findNext: async (): Promise<boolean> => {
        const feature = await ensureFindReplace()
        return feature.findNext()
      },
      findPrevious: async (): Promise<boolean> => {
        const feature = await ensureFindReplace()
        return feature.findPrevious()
      },
      replaceCurrent: async (): Promise<boolean> => {
        const feature = await ensureFindReplace()
        return feature.replaceCurrent()
      },
      replaceAll: async (): Promise<number> => {
        const feature = await ensureFindReplace()
        return feature.replaceAll()
      },
    }

    watch(
      () => findReplace.highlightedCell.value,
      nextHighlightedCell => {
        highlightedFindReplaceCell.value = nextHighlightedCell
      },
      { immediate: true },
    )

    const {
      contextMenu,
      contextMenuRef,
      contextMenuStyle,
      closeContextMenu,
      openContextMenu,
      onContextMenuKeyDown,
    } = useDataGridContextMenu()

    contextMenuVisible = () => contextMenu.value.visible
    closeRuntimeContextMenu = closeContextMenu

    const viewportContextRouter = useDataGridViewportContextMenuRouter<MenuCoord, MenuRange>({
      isInteractionBlocked: () => false,
      isRangeMoveModifierActive: () => false,
      resolveSelectionRange: resolveCurrentSelectionRange,
      resolveCellCoordFromDataset,
      applyCellSelection: (coord: MenuCoord) => {
        applyActiveCell(coord)
      },
      resolveActiveCellCoord: resolveCurrentCellCoord,
      setActiveCellCoord: (coord: MenuCoord) => {
        applyActiveCell(coord)
      },
      cellCoordsEqual: (left: MenuCoord | null, right: MenuCoord | null) => left?.rowIndex === right?.rowIndex && left?.columnIndex === right?.columnIndex,
      isMultiCellSelection,
      isCoordInsideRange,
      openContextMenu,
      closeContextMenu,
      isColumnContextEnabled: (columnKey: string) => {
        if (!props.cellMenu.enabled) {
          return false
        }
        return resolveDataGridCellMenuItems(props.cellMenu, columnKey).length > 0
      },
      isRowIndexContextEnabled: () => props.rowIndexMenu.enabled && props.showRowIndex,
    } as unknown as Parameters<typeof useDataGridViewportContextMenuRouter<MenuCoord, MenuRange>>[0])

    const contextMenuAnchor = useDataGridContextMenuAnchor({
      resolveCurrentCellCoord,
      resolveViewportElement: () => stageHostRef.value,
      resolveRowAtIndex: (rowIndex: number) => props.runtime.getBodyRowAtIndex(rowIndex) ?? undefined,
      resolveColumnAtIndex: (columnIndex: number) => visibleColumns.value[columnIndex] ?? undefined,
      resolveSelectionRange: resolveCurrentSelectionRange,
      isMultiCellSelection: (range: MenuRange) => isMultiCellSelection(range),
      isCoordInsideRange,
      openContextMenu,
      isColumnContextEnabled: column => props.cellMenu.enabled && resolveDataGridCellMenuItems(props.cellMenu, column.key).length > 0,
    })

    openRuntimeContextMenuFromCurrentCell = () => {
      contextMenuAnchor.openContextMenuFromCurrentCell()
    }

    const openRuntimeRowIndexContextMenu = (rowId: string | number): boolean => {
      if (!props.rowIndexMenu.enabled || !props.showRowIndex || !stageHostRef.value) {
        return false
      }
      const normalizedRowId = String(rowId)
      const selector = `.datagrid-stage__row-index-cell[data-row-id="${escapeCssAttributeValue(normalizedRowId)}"]`
      const rowIndexCell = stageHostRef.value.querySelector<HTMLElement>(selector)
      if (!rowIndexCell) {
        return false
      }
      const rect = rowIndexCell.getBoundingClientRect()
      openContextMenu(
        rect.left + Math.max(10, Math.min(rect.width / 2, Math.max(10, rect.width - 10))),
        rect.bottom - 4,
        {
          zone: "row-index",
          rowId: normalizedRowId,
        } as unknown as Parameters<typeof openContextMenu>[2],
      )
      return true
    }

    const recordRowMutation = (
      beforeSnapshot: unknown,
      label: string,
    ): void => {
      recordHistoryIntentTransaction({
        intent: "edit",
        label,
      }, beforeSnapshot)
    }

    runRowIndexContextAction = async (
      action: RendererRowIndexKeyboardAction,
      rowId: string | number,
    ): Promise<boolean> => {
      const normalizedRowId = String(rowId)
      if (action === "open-row-menu") {
        return openRuntimeRowIndexContextMenu(normalizedRowId)
      }
      const placeholderVisualRowIndex = resolvePlaceholderVisualRowIndex(normalizedRowId)
      if (placeholderVisualRowIndex != null) {
        if (action === "delete-selected-rows") {
          const rowIds = resolveExistingRuntimeDataRowIds(resolveSelectedRuntimeRowIds(normalizedRowId))
          if (rowIds.length === 0) {
            return false
          }
          const beforeSnapshot = captureHistorySnapshot()
          const removed = removeRuntimeRows(rowIds)
          if (removed) {
            recordRowMutation(beforeSnapshot, rowIds.length > 1 ? `Delete ${rowIds.length} rows` : "Delete row")
          }
          return removed
        }
        if (action === "insert-row-above") {
          const beforeSnapshot = captureHistorySnapshot()
          const inserted = insertPlaceholderRowAtVisualIndex(
            placeholderVisualRowIndex,
            placeholderVisualRowIndex,
          )
          if (inserted) {
            recordRowMutation(beforeSnapshot, "Insert row above")
          }
          return inserted
        }
        if (action === "insert-row-below") {
          const beforeSnapshot = captureHistorySnapshot()
          const inserted = insertPlaceholderRowAtVisualIndex(
            placeholderVisualRowIndex + 1,
            placeholderVisualRowIndex + 1,
          )
          if (inserted) {
            recordRowMutation(beforeSnapshot, "Insert row below")
          }
          return inserted
        }
        if (action === "paste-row") {
          if (!canInsertRows()) {
            return false
          }
          const rows = await readRowClipboardRows()
          if (!rows || rows.length === 0) {
            return false
          }
          const beforeSnapshot = captureHistorySnapshot()
          const pendingCutSourceRowIds = rowClipboardBuffer.value?.operation === "cut"
            ? rowClipboardBuffer.value.sourceRowIds
            : []
          const sourceRows = materializePlaceholderRowsUpTo(placeholderVisualRowIndex + 1)
          if (!sourceRows) {
            return false
          }
          const insertIndex = Math.max(0, placeholderVisualRowIndex + 1)
          const sourceRowTemplate = resolveSourceRowTemplateByRowId(
            pendingCutSourceRowIds[0] ?? normalizedRowId,
          ) ?? resolveSourceRowTemplateByRowId(normalizedRowId)
          const inserted = pendingCutSourceRowIds.length > 0
            ? moveRuntimeRowsToIndex(pendingCutSourceRowIds, insertIndex)
            : props.runtime.api.rows.insertDataAt(
                insertIndex,
                rows.map(row => cloneRowWithFreshIdentity(row, sourceRowTemplate)),
              )
          if (inserted && rowClipboardBuffer.value?.operation === "cut") {
            rowClipboardBuffer.value = null
          }
          if (inserted) {
            recordRowMutation(
              beforeSnapshot,
              pendingCutSourceRowIds.length > 0
                ? (pendingCutSourceRowIds.length > 1 ? `Move ${pendingCutSourceRowIds.length} rows` : "Move row")
                : (rows.length > 1 ? `Paste ${rows.length} rows` : "Paste row"),
            )
          }
          return inserted
        }
        return false
      }
      const targetRow = resolveRuntimeRowById(normalizedRowId)
      if (!targetRow || targetRow.kind === "group") {
        return false
      }

      if (action === "insert-row-above") {
        if (!canInsertRows()) {
          return false
        }
        const beforeSnapshot = captureHistorySnapshot()
        const inserted = props.runtime.api.rows.insertDataBefore(
          rowId,
          [buildInsertedRowInput(targetRow.data, resolveSourceRowTemplateByRowId(normalizedRowId))],
        )
        if (inserted) {
          recordRowMutation(beforeSnapshot, "Insert row above")
        }
        return inserted
      }
      if (action === "insert-row-below") {
        if (!canInsertRows()) {
          return false
        }
        const beforeSnapshot = captureHistorySnapshot()
        const inserted = props.runtime.api.rows.insertDataAfter(
          rowId,
          [buildInsertedRowInput(targetRow.data, resolveSourceRowTemplateByRowId(normalizedRowId))],
        )
        if (inserted) {
          recordRowMutation(beforeSnapshot, "Insert row below")
        }
        return inserted
      }
      if (action === "copy-row") {
        const rowIds = resolveExistingRuntimeDataRowIds(resolveSelectedRuntimeRowIds(normalizedRowId))
        const rows = resolveExistingRuntimeDataRowsByIds(rowIds)
        return setRowClipboardRows(
          rows.length > 0 ? rows : [targetRow.data],
          "copy",
          rowIds.length > 0 ? rowIds : [normalizedRowId],
        )
      }
      if (action === "cut-row") {
        const rowIds = resolveExistingRuntimeDataRowIds(resolveSelectedRuntimeRowIds(normalizedRowId))
        const rows = resolveExistingRuntimeDataRowsByIds(rowIds)
        return setRowClipboardRows(
          rows.length > 0 ? rows : [targetRow.data],
          "cut",
          rowIds.length > 0 ? rowIds : [normalizedRowId],
        )
      }
      if (action === "paste-row") {
        if (!canInsertRows()) {
          return false
        }
        const rows = await readRowClipboardRows()
        if (!rows || rows.length === 0) {
          return false
        }
        const beforeSnapshot = captureHistorySnapshot()
        const pendingCutSourceRowIds = rowClipboardBuffer.value?.operation === "cut"
          ? rowClipboardBuffer.value.sourceRowIds
          : []
        const sourceRowTemplate = resolveSourceRowTemplateByRowId(
          pendingCutSourceRowIds[0] ?? normalizedRowId,
        ) ?? resolveSourceRowTemplateByRowId(normalizedRowId)
        const inserted = pendingCutSourceRowIds.length > 0
          ? moveRuntimeRowsAfter(pendingCutSourceRowIds, normalizedRowId)
          : props.runtime.api.rows.insertDataAfter(
              rowId,
              rows.map(row => cloneRowWithFreshIdentity(row, sourceRowTemplate)),
            )
        if (inserted && rowClipboardBuffer.value?.operation === "cut") {
          rowClipboardBuffer.value = null
        }
        if (inserted) {
          recordRowMutation(
            beforeSnapshot,
            pendingCutSourceRowIds.length > 0
              ? (pendingCutSourceRowIds.length > 1 ? `Move ${pendingCutSourceRowIds.length} rows` : "Move row")
              : (rows.length > 1 ? `Paste ${rows.length} rows` : "Paste row"),
          )
        }
        return inserted
      }
      if (action === "delete-selected-rows") {
        const rowIds = resolveExistingRuntimeDataRowIds(resolveSelectedRuntimeRowIds(normalizedRowId))
        if (rowIds.length === 0) {
          return false
        }
        const beforeSnapshot = captureHistorySnapshot()
        const removed = removeRuntimeRows(rowIds)
        if (removed) {
          recordRowMutation(beforeSnapshot, rowIds.length > 1 ? `Delete ${rowIds.length} rows` : "Delete row")
        }
        return removed
      }

      return false
    }

    const contextMenuActionRouter = useDataGridContextMenuActionRouter({
      resolveContextMenuState: () => ({
        zone: contextMenu.value.zone as RendererContextMenuZone,
        columnKey: contextMenu.value.columnKey,
        rowId: contextMenu.value.rowId,
      }),
      runHeaderContextAction: () => false,
      runRowIndexContextAction,
      copySelection: copySelectedCells,
      pasteSelection: pasteSelectedCells,
      cutSelection: cutSelectedCells,
      clearCurrentSelection: clearSelectedCells,
      closeContextMenu,
    } as unknown as Parameters<typeof useDataGridContextMenuActionRouter>[0])

    const menuActionEntries = computed(() => {
      if (!contextMenu.value.visible) {
        return [] as Array<{
          id: RendererContextMenuActionId
          label: string
          disabled: boolean
          title: string | undefined
          separatorBefore: boolean
        }>
      }

      const zone = contextMenu.value.zone as RendererContextMenuZone

      if (zone === "cell" || zone === "range") {
        const columnKey = contextMenu.value.columnKey ?? ""
        if (!props.cellMenu.enabled || !columnKey) {
          return []
        }
        const items = resolveDataGridCellMenuItems(props.cellMenu, columnKey)
        const disabledItems = new Set(resolveDataGridCellMenuDisabledItems(props.cellMenu, columnKey))
        const disabledReasons = resolveDataGridCellMenuDisabledReasons(props.cellMenu, columnKey)
        const actionOptions = resolveDataGridCellMenuActionOptions(props.cellMenu, columnKey)
        return items.flatMap((item, itemIndex) => {
          const itemActions = CELL_MENU_ACTION_IDS_BY_ITEM[item] ?? []
          return itemActions.flatMap(actionId => {
            const actionKey = actionId as DataGridCellMenuActionKey
            const option = actionOptions[actionKey]
            if (option?.hidden) {
              return []
            }
            const disabled = disabledItems.has(item) || option?.disabled === true
            return [{
              id: actionId,
              label: option?.label ?? DEFAULT_CONTEXT_MENU_ACTION_LABELS[actionId],
              disabled,
              title: option?.disabledReason ?? disabledReasons[item],
              separatorBefore: itemIndex > 0 && actionId === itemActions[0],
            }]
          })
        })
      }

      if (zone === "row-index") {
        if (!props.rowIndexMenu.enabled) {
          return []
        }
        const placeholderVisualRowIndex = resolvePlaceholderVisualRowIndex(contextMenu.value.rowId ?? "")
        const items = resolveDataGridRowIndexMenuItems(props.rowIndexMenu)
        const disabledItems = new Set(resolveDataGridRowIndexMenuDisabledItems(props.rowIndexMenu))
        const disabledReasons = resolveDataGridRowIndexMenuDisabledReasons(props.rowIndexMenu)
        const actionOptions = resolveDataGridRowIndexMenuActionOptions(props.rowIndexMenu)
        return items.flatMap((item, itemIndex) => {
          const itemActions = ROW_INDEX_MENU_ACTION_IDS_BY_ITEM[item] ?? []
          return itemActions.flatMap(actionId => {
            const actionKey = actionId === "insert-row-above"
              ? "insertAbove"
              : actionId === "insert-row-below"
                ? "insertBelow"
                : actionId === "copy-row"
                  ? "copy"
                  : actionId === "paste-row"
                    ? "paste"
                    : actionId === "delete-selected-rows"
                      ? "deleteSelected"
                      : "cut"
            const option = actionOptions[actionKey as DataGridRowIndexMenuActionKey]
            if (option?.hidden) {
              return []
            }
            let disabled = disabledItems.has(item) || option?.disabled === true
            let title = option?.disabledReason ?? disabledReasons[item]
            if (
              placeholderVisualRowIndex != null
              && actionId !== "delete-selected-rows"
              && actionId !== "insert-row-above"
              && actionId !== "insert-row-below"
              && actionId !== "paste-row"
            ) {
              disabled = true
              title = title ?? "Placeholder rows must be materialized before this action is available"
            }
            if ((actionId === "insert-row-above" || actionId === "insert-row-below" || actionId === "paste-row") && !canInsertRows()) {
              disabled = true
              title = title ?? "Row insertion is not supported by the current row model"
            }
            if ((actionId === "cut-row" || actionId === "delete-selected-rows") && !canMutateRows()) {
              disabled = true
              title = title ?? "Row deletion is not supported by the current row model"
            }
            if (actionId === "delete-selected-rows") {
              const effectiveRowIds = resolveExistingRuntimeDataRowIds(
                resolveSelectedRuntimeRowIds(contextMenu.value.rowId ?? ""),
              )
              if (effectiveRowIds.length === 0) {
                disabled = true
                title = title ?? "No deletable rows are selected"
              }
            }
            return [{
              id: actionId,
              label: resolveRowIndexMenuLabel(actionId, option?.label),
              disabled,
              title,
              separatorBefore: itemIndex > 0 && actionId === itemActions[0],
            }]
          })
        })
      }

      return []
    })

    const handleViewportContextMenu = (event: MouseEvent): void => {
      viewportContextRouter.dispatchViewportContextMenu(event)
    }

    const focusGridViewport = (): void => {
      const viewport = stageHostRef.value?.querySelector<HTMLElement>(".grid-body-viewport")
      viewport?.focus({ preventScroll: true })
    }

    const scheduleGridViewportFocus = (): void => {
      void nextTick(() => {
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            focusGridViewport()
          })
          return
        }
        focusGridViewport()
      })
    }

    const handleContextMenuAction = async (action: RendererContextMenuActionId): Promise<void> => {
      const handled = await contextMenuActionRouter.runContextMenuAction(action as DataGridContextMenuActionId)
      if (handled) {
        focusGridViewport()
        closeContextMenu()
        scheduleGridViewportFocus()
      }
    }

    watch(
      () => contextMenu.value.visible,
      (visible, _previous, onCleanup) => {
        if (!visible || typeof window === "undefined") {
          return
        }
        const handleWindowPointerDown = (event: MouseEvent) => {
          const target = event.target as Node | null
          if (target && contextMenuRef.value?.contains(target)) {
            return
          }
          closeContextMenu()
        }
        const handleWindowBlur = () => {
          closeContextMenu()
        }
        window.addEventListener("mousedown", handleWindowPointerDown, true)
        window.addEventListener("blur", handleWindowBlur)
        onCleanup(() => {
          window.removeEventListener("mousedown", handleWindowPointerDown, true)
          window.removeEventListener("blur", handleWindowBlur)
        })
      },
    )
    const stageProps = computed(() => ({
      ...tableStageProps.value,
      columns: {
        ...tableStageProps.value.columns,
        columnMenuEnabled: props.columnMenu.enabled,
        columnMenuTrigger: props.columnMenu.trigger,
        columnMenuMaxFilterValues: props.columnMenu.maxFilterValues,
        resolveColumnMenuItems,
        resolveColumnMenuDisabledItems,
        resolveColumnMenuDisabledReasons,
        resolveColumnMenuLabels,
        resolveColumnMenuActionOptions,
        resolveColumnMenuCustomItems,
        isColumnFilterActive,
        isColumnGrouped,
        resolveColumnGroupOrder,
        resolveColumnMenuSortDirection,
        resolveColumnMenuSelectedTokens: resolveCurrentValueFilterTokens,
        applyColumnMenuSort,
        applyColumnMenuPin,
        applyColumnMenuGroupBy,
        applyColumnMenuFilter,
        clearColumnMenuFilter,
      },
      rows: {
        ...tableStageProps.value.rows,
        sourceRows: props.rows,
        rowHover: props.rowHover,
        stripedRows: props.stripedRows,
      },
    }))
    const toolbarModules = computed<readonly DataGridAppToolbarModule[]>(() => {
      const modules: DataGridAppToolbarModule[] = []
      if (props.history.enabled && props.history.controls === "toolbar") {
        modules.push({
          key: "history-undo",
          component: DataGridHistoryToolbarButton as Component,
          props: {
            action: "undo",
            label: "Undo",
            disabled: !historyController.canUndo(),
            onTrigger: () => historyController.runHistoryAction("undo"),
          },
        })
        modules.push({
          key: "history-redo",
          component: DataGridHistoryToolbarButton as Component,
          props: {
            action: "redo",
            label: "Redo",
            disabled: !historyController.canRedo(),
            onTrigger: () => historyController.runHistoryAction("redo"),
          },
        })
      }
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
            onMoveToPosition: (payload: { key: string; targetKey: string; placement: "before" | "after" }) => {
              moveColumnToPosition(payload.key, payload.targetKey, payload.placement)
            },
            onApply: applyColumnLayoutPanel,
            onCancel: cancelColumnLayoutPanel,
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
            appliedFilterSummaryItems: activeFilterSummaryItems.value,
            hasAnyFilters: hasActiveFilters.value,
            buttonLabel: props.advancedFilter.buttonLabel,
            active: hasActiveFilters.value,
            showActiveIcon: hasActiveFilters.value,
            onOpen: handleOpenAdvancedFilterPanel,
            onAdd: addAdvancedFilterClause,
            onRemove: removeAdvancedFilterClause,
            onUpdateClause: updateAdvancedFilterClause,
            onApply: applyAdvancedFilterPanel,
            onCancel: cancelAdvancedFilterPanel,
            onResetAll: resetAllFilters,
          },
        })
      }
      if (props.findReplace.enabled) {
        modules.push({
          key: "find-replace",
          component: DataGridFindReplacePopover as Component,
          props: {
            isOpen: findReplace.isPanelOpen.value,
            findText: findReplace.findText.value,
            replaceText: findReplace.replaceText.value,
            matchCase: findReplace.matchCase.value,
            statusText: findReplace.statusText.value,
            buttonLabel: props.findReplace.buttonLabel,
            active: findReplace.active.value,
            canFind: findReplace.canFind.value,
            canReplaceCurrent: findReplace.canReplaceCurrent.value,
            canReplaceAll: findReplace.canReplaceAll.value,
            onOpen: findReplace.openPanel,
            onCancel: findReplace.closePanel,
            onUpdateFindText: findReplace.updateFindText,
            onUpdateReplaceText: findReplace.updateReplaceText,
            onUpdateMatchCase: findReplace.updateMatchCase,
            onFindNext: findReplace.findNext,
            onFindPrevious: findReplace.findPrevious,
            onReplaceCurrent: findReplace.replaceCurrent,
            onReplaceAll: findReplace.replaceAll,
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
            active: aggregationGroupingEnabled.value && (
              isAggregationsPanelOpen.value || Boolean(currentAggregationModel.value?.columns.length)
            ),
            disabled: !aggregationGroupingEnabled.value,
            disabledReason: aggregationGroupingEnabled.value
              ? ""
              : "Aggregations require an active group-by model.",
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
      return [...modules, ...props.toolbarModules].map(normalizeToolbarModule)
    })

    watch(
      toolbarModules,
      nextModules => {
        props.reportToolbarModules?.(nextModules)
      },
      { immediate: true, flush: "post" },
    )

    const effectiveToolbarPlacement = computed<DataGridToolbarPlacement>(() => {
      if (props.viewMode === "gantt" && props.chrome.toolbarPlacement === "integrated") {
        return "stacked"
      }
      return props.chrome.toolbarPlacement
    })

    const renderToolbarInternally = computed(() => {
      return toolbarModules.value.length > 0 && effectiveToolbarPlacement.value !== "hidden"
    })

    const renderToolbarStacked = computed(() => {
      return renderToolbarInternally.value && effectiveToolbarPlacement.value === "stacked"
    })

    const renderToolbarIntegrated = computed(() => {
      return renderToolbarInternally.value && effectiveToolbarPlacement.value === "integrated"
    })

    return () => h("div", {
      class: [
        "datagrid-app-layout",
        `datagrid-app-layout--toolbar-${effectiveToolbarPlacement.value}`,
        `datagrid-app-layout--density-${props.chrome.density}`,
        props.layoutMode === "auto-height"
          ? "datagrid-app-layout--auto-height"
          : "datagrid-app-layout--fill",
      ],
      style: gridChromeStyle.value,
    }, [
      renderToolbarStacked.value
        ? h(DataGridModuleHost as Component, {
          modules: toolbarModules.value,
          variant: "standalone",
        })
        : null,
      h("div", {
        class: [
          "datagrid-app-workspace",
          props.layoutMode === "auto-height"
            ? "datagrid-app-workspace--auto-height"
            : "datagrid-app-workspace--fill",
        ],
      }, [
        renderToolbarIntegrated.value
          ? h("div", {
            class: [
              "datagrid-app-stage-surface",
              props.layoutMode === "auto-height"
                ? "datagrid-app-stage-surface--auto-height"
                : "datagrid-app-stage-surface--fill",
              "datagrid-app-stage-surface--integrated",
            ],
          }, [
            h(DataGridModuleHost as Component, {
              modules: toolbarModules.value,
              variant: "integrated",
            }),
            h("div", {
              class: [
                "datagrid-app-stage",
                "datagrid-app-stage--integrated",
                props.layoutMode === "auto-height"
                  ? "datagrid-app-stage--auto-height"
                  : "datagrid-app-stage--fill",
              ],
              ref: stageHostRef,
            }, [
              props.viewMode === "gantt"
                ? h(DataGridGanttStage as Component, {
                  stageContext: tableStageContext,
                  runtime: props.runtime,
                  gantt: props.gantt,
                  baseRowHeight: normalizedBaseRowHeight.value,
                  rowVersion: rowVersion.value,
                })
                : h(DataGridTableStage as Component, {
                  ...stageProps.value,
                  stageContext: tableStageContext,
                  onViewportContextMenu: handleViewportContextMenu,
                }),
              contextMenu.value.visible && menuActionEntries.value.length > 0
                ? h("div", {
                  ref: contextMenuRef,
                  class: "datagrid-context-menu",
                  style: contextMenuStyle.value,
                  role: "menu",
                  tabindex: -1,
                  onKeydown: (event: KeyboardEvent) => {
                    onContextMenuKeyDown(event, {
                      onEscape: () => {
                        focusGridViewport()
                      },
                    })
                  },
                }, menuActionEntries.value.flatMap(entry => {
                  const nodes: Array<ReturnType<typeof h>> = []
                  if (entry.separatorBefore) {
                    nodes.push(h("div", {
                      class: "datagrid-context-menu__separator",
                      "aria-hidden": "true",
                    }))
                  }
                  nodes.push(h("button", {
                    type: "button",
                    class: "datagrid-context-menu__item",
                    "data-datagrid-menu-action": entry.id,
                    disabled: entry.disabled,
                    title: entry.title,
                    onClick: () => {
                      void handleContextMenuAction(entry.id)
                    },
                  }, entry.label))
                  return nodes
                }))
                : null,
            ]),
          ])
          : h("div", {
            class: [
              "datagrid-app-stage",
              props.layoutMode === "auto-height"
                ? "datagrid-app-stage--auto-height"
                : "datagrid-app-stage--fill",
            ],
            ref: stageHostRef,
          }, [
            props.viewMode === "gantt"
              ? h(DataGridGanttStage as Component, {
                stageContext: tableStageContext,
                runtime: props.runtime,
                gantt: props.gantt,
                baseRowHeight: normalizedBaseRowHeight.value,
                rowVersion: rowVersion.value,
              })
              : h(DataGridTableStage as Component, {
                ...stageProps.value,
                stageContext: tableStageContext,
                onViewportContextMenu: handleViewportContextMenu,
              }),
            contextMenu.value.visible && menuActionEntries.value.length > 0
              ? h("div", {
                ref: contextMenuRef,
                class: "datagrid-context-menu",
                style: contextMenuStyle.value,
                role: "menu",
                tabindex: -1,
                onKeydown: (event: KeyboardEvent) => {
                  onContextMenuKeyDown(event, {
                    onEscape: () => {
                      focusGridViewport()
                    },
                  })
                },
              }, menuActionEntries.value.flatMap(entry => {
                const nodes: Array<ReturnType<typeof h>> = []
                if (entry.separatorBefore) {
                  nodes.push(h("div", {
                    class: "datagrid-context-menu__separator",
                    "aria-hidden": "true",
                  }))
                }
                nodes.push(h("button", {
                  type: "button",
                  class: "datagrid-context-menu__item",
                  "data-datagrid-menu-action": entry.id,
                  disabled: entry.disabled,
                  title: entry.title,
                  onClick: () => {
                    void handleContextMenuAction(entry.id)
                  },
                }, entry.label))
                return nodes
              }))
              : null,
          ]),
        props.inspectorPanel
          ? h("aside", {
            class: "datagrid-app-inspector-shell",
          }, [
            h(props.inspectorPanel.component, {
              ...(props.inspectorPanel.props ?? {}),
            }),
          ])
          : null,
      ]),
    ])
  },
})
