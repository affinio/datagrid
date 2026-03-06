import { aggregationFeature } from "../features/aggregationFeature"
import { aggregationFunctionsRegistryFeature } from "../features/aggregationFunctionsRegistryFeature"
import { advancedClipboardFeature } from "../features/advancedClipboardFeature"
import { advancedPivotEngineFeature } from "../features/advancedPivotEngineFeature"
import { autoScrollFeature } from "../features/autoScrollFeature"
import { clipboardFeature } from "../features/clipboardFeature"
import { columnAutosizeFeature } from "../features/columnAutosizeFeature"
import { columnMenuFeature } from "../features/columnMenuFeature"
import { columnPinningFeature } from "../features/columnPinningFeature"
import { columnReorderFeature } from "../features/columnReorderFeature"
import { columnResizeFeature } from "../features/columnResizeFeature"
import { columnVirtualizationFeature } from "../features/columnVirtualizationFeature"
import { columnVisibilityFeature } from "../features/columnVisibilityFeature"
import { cellEditorsFeature } from "../features/cellEditorsFeature"
import { dataExportFeature } from "../features/dataExportFeature"
import { excelCompatibleClipboardFeature } from "../features/excelCompatibleClipboardFeature"
import { exportExcelFeature } from "../features/exportExcelFeature"
import { filterDslFeature } from "../features/filterDslFeature"
import { filterBuilderUiFeature } from "../features/filterBuilderUiFeature"
import { fillHandleFeature } from "../features/fillHandleFeature"
import { groupPanelFeature } from "../features/groupPanelFeature"
import { groupingFeature } from "../features/groupingFeature"
import { historyFeature } from "../features/historyFeature"
import { keyboardFeature } from "../features/keyboardFeature"
import { navigationFeature } from "../features/navigationFeature"
import { pointerPreviewFeature } from "../features/pointerPreviewFeature"
import { pivotFeature } from "../features/pivotFeature"
import { pivotPanelFeature } from "../features/pivotPanelFeature"
import { rangeMoveFeature } from "../features/rangeMoveFeature"
import { resizeFeature } from "../features/resizeFeature"
import { rowHeightFeature } from "../features/rowHeightFeature"
import { rowSelectionModesFeature } from "../features/rowSelectionModesFeature"
import { selectionFeature } from "../features/selectionFeature"
import { selectionOverlayFeature } from "../features/selectionOverlayFeature"
import { serverSideRowModelFeature } from "../features/serverSideRowModelFeature"
import { sortingFeature } from "../features/sortingFeature"
import type { DataGridFeature, GridContext } from "../grid/types"
import type {
  DataGridAggregationModel,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
  DataGridPivotValueSpec,
  DataGridRowModelKind,
  DataGridSelectionSnapshot,
  DataGridSortAndFilterModelInput,
  DataGridSortDirection,
  DataGridSortState,
} from "@affino/datagrid-core"
import { computed, ref, type ComputedRef, type Ref } from "vue"

export type DataGridFeatureName =
  | "selection"
  | "clipboard"
  | "advancedClipboard"
  | "excelCompatibleClipboard"
  | "fill"
  | "fillHandle"
  | "navigation"
  | "keyboard"
  | "history"
  | "sorting"
  | "pivot"
  | "advancedPivotEngine"
  | "pivotPanel"
  | "grouping"
  | "groupPanel"
  | "aggregation"
  | "aggregationFunctionsRegistry"
  | "filterDsl"
  | "filterBuilderUI"
  | "columnPinning"
  | "columnVisibility"
  | "columnAutosize"
  | "columnMenu"
  | "columnResize"
  | "columnReorder"
  | "columnVirtualization"
  | "cellEditors"
  | "serverSideRowModel"
  | "rowHeight"
  | "rowSelectionModes"
  | "selectionOverlay"
  | "export"
  | "exportExcel"
  | "rangeMove"
  | "pointerPreview"
  | "autoScroll"
  | "resize"

const KEYBOARD_TRIGGER_FEATURES: readonly DataGridFeatureName[] = [
  "selection",
  "clipboard",
  "advancedClipboard",
  "excelCompatibleClipboard",
  "fill",
  "fillHandle",
  "navigation",
  "history",
]

export type DataGridFeatureRegistry<TRow = unknown> = Record<
  DataGridFeatureName,
  () => DataGridFeature<TRow, string, unknown>
>

export interface DataGridExportContext<TRow = unknown> {
  rows: readonly TRow[]
  columns: readonly {
    key: string
    label: string
  }[]
  delimiter: string
  includeHeaders: boolean
}

export interface DataGridExportPayload {
  text: string
  mimeType?: string
  fileName?: string
}

export interface CreateDataGridFeatureRegistryOptions<TRow = unknown> {
  isColumnReadOnly?: (columnKey: string) => boolean
  resolveExportCsv?: (context: DataGridExportContext<TRow>) => Promise<string | DataGridExportPayload> | string | DataGridExportPayload
  resolveExportExcel?: (context: DataGridExportContext<TRow>) => Promise<string | DataGridExportPayload> | string | DataGridExportPayload
  resolveCellTextValue?: (value: unknown, columnKey: string) => string
  columnAutosize?: {
    minWidth?: number
    maxWidth?: number
    maxRows?: number
    charWidth?: number
    padding?: number
  }
}

export interface DataGridSelectedCell {
  rowIndex: number
  columnIndex: number
}

export interface DataGridSelectionFeatureApi {
  getSnapshot: () => DataGridSelectionSnapshot | null
  getActiveCell: () => DataGridSelectedCell | null
  selectCell: (rowIndex: number, columnIndex: number) => DataGridSelectionSnapshot | null
  selectRow: (rowIndex: number) => DataGridSelectionSnapshot | null
  clear: () => void
}

export interface DataGridNavigationFeatureApi {
  moveBy: (deltaRow: number, deltaColumn: number) => DataGridSelectionSnapshot | null
  handleKeydown: (event: KeyboardEvent) => boolean
}

export interface DataGridClipboardFeatureApi {
  copy: () => Promise<string>
  cut: () => Promise<string>
  paste: (text?: string) => Promise<boolean>
  clear: () => void
  applyMatrix: (matrix: readonly (readonly string[])[], startRow: number, startColumn: number) => boolean
}

export interface DataGridAdvancedClipboardOptions {
  delimiter?: string
  includeHeaders?: boolean
}

export interface DataGridAdvancedClipboardFeatureApi {
  copy: (options?: DataGridAdvancedClipboardOptions) => Promise<string>
  cut: (options?: DataGridAdvancedClipboardOptions) => Promise<string>
  paste: (text?: string, options?: DataGridAdvancedClipboardOptions) => Promise<boolean>
  serializeSelection: (options?: DataGridAdvancedClipboardOptions) => string
  parseText: (text: string, delimiter?: string) => readonly (readonly string[])[]
}

export interface DataGridFillHandleFeatureApi {
  fillSelection: () => boolean
}

export interface DataGridHistoryFeatureApi {
  supported: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => Promise<string | null>
  redo: () => Promise<string | null>
}

export interface DataGridKeyboardFeatureApi {
  handleKeydown: (event: KeyboardEvent) => Promise<boolean>
}

export interface DataGridSortingFeatureApi {
  setSortModel: (sortModel: readonly DataGridSortState[]) => void
  getSortModel: () => readonly DataGridSortState[]
  clearSortModel: () => void
  toggleColumnSort: (columnKey: string, directionCycle?: readonly DataGridSortDirection[]) => readonly DataGridSortState[]
}

export interface DataGridPivotFeatureApi<TRow = unknown> {
  setModel: (pivotModel: DataGridPivotSpec | null) => void
  getModel: () => DataGridPivotSpec | null
  getCellDrilldown: (input: DataGridPivotCellDrilldownInput) => DataGridPivotCellDrilldown<TRow> | null
  exportLayout: () => DataGridPivotLayoutSnapshot<TRow>
  exportInterop: () => DataGridPivotInteropSnapshot<TRow> | null
  importLayout: (
    layout: DataGridPivotLayoutSnapshot<TRow>,
    options?: DataGridPivotLayoutImportOptions,
  ) => void
}

export interface DataGridAdvancedPivotEngineFeatureApi<TRow = unknown> extends DataGridPivotFeatureApi<TRow> {
  refresh: () => void
}

export interface DataGridPivotPanelState {
  open: boolean
  rows: readonly string[]
  columns: readonly string[]
  values: readonly DataGridPivotValueSpec[]
}

export interface DataGridPivotPanelFeatureApi {
  state: Ref<DataGridPivotPanelState>
  open: () => void
  close: () => void
  toggle: () => void
  setRows: (rows: readonly string[]) => void
  setColumns: (columns: readonly string[]) => void
  setValues: (values: readonly DataGridPivotValueSpec[]) => void
}

export interface DataGridGroupingFeatureApi {
  setGroupBy: (groupBy: DataGridGroupBySpec | null) => void
  getGroupBy: () => DataGridGroupBySpec | null
  clearGroupBy: () => void
  setGroupExpansion: (expansion: DataGridGroupExpansionSnapshot | null) => void
  toggleGroup: (groupKey: string) => void
  expandGroup: (groupKey: string) => void
  collapseGroup: (groupKey: string) => void
  expandAllGroups: () => void
  collapseAllGroups: () => void
}

export interface DataGridGroupPanelFeatureApi {
  state: Ref<{
    open: boolean
    columns: readonly string[]
  }>
  open: () => void
  close: () => void
  toggle: () => void
  setColumns: (columns: readonly string[]) => void
}

export interface DataGridAggregationFeatureApi<TRow = unknown> {
  setModel: (aggregationModel: DataGridAggregationModel<TRow> | null) => void
  getModel: () => DataGridAggregationModel<TRow> | null
  clearModel: () => void
}

export type DataGridAggregationFunction = (values: readonly unknown[]) => unknown

export interface DataGridAggregationFunctionsRegistryFeatureApi {
  register: (name: string, fn: DataGridAggregationFunction) => void
  unregister: (name: string) => boolean
  resolve: (name: string) => DataGridAggregationFunction | null
  list: () => readonly string[]
}

export interface DataGridFilterDslFeatureApi {
  setFilterModel: (filterModel: DataGridFilterSnapshot | null) => void
  getFilterModel: () => DataGridFilterSnapshot | null
  clearFilterModel: () => void
  setSortModel: (sortModel: readonly DataGridSortState[]) => void
  setSortAndFilterModel: (input: DataGridSortAndFilterModelInput) => void
}

export interface DataGridFilterBuilderUiFeatureApi {
  state: Ref<{
    open: boolean
    draft: DataGridFilterSnapshot | null
  }>
  open: () => void
  close: () => void
  toggle: () => void
  setDraft: (filterModel: DataGridFilterSnapshot | null) => void
  apply: () => void
  clear: () => void
}

export interface DataGridColumnPinningFeatureApi {
  setPin: (columnKey: string, pin: DataGridColumnPin) => void
  getPin: (columnKey: string) => DataGridColumnPin
  clearPin: (columnKey: string) => void
}

export interface DataGridColumnVisibilityFeatureApi {
  setVisible: (columnKey: string, visible: boolean) => void
  isVisible: (columnKey: string) => boolean
  toggleVisible: (columnKey: string) => boolean
  getHiddenColumns: () => readonly string[]
  showAll: () => void
}

export interface DataGridColumnAutosizeFeatureApi {
  estimateWidth: (columnKey: string) => number | null
  autosizeColumn: (columnKey: string) => number | null
  autosizeColumns: (columnKeys?: readonly string[]) => readonly string[]
}

export interface DataGridColumnMenuFeatureApi {
  state: Ref<{
    open: boolean
    columnKey: string | null
    anchor: { x: number; y: number } | null
  }>
  open: (columnKey: string, anchor?: { x: number; y: number } | null) => void
  close: () => void
  toggle: (columnKey: string, anchor?: { x: number; y: number } | null) => void
}

export interface DataGridColumnResizeFeatureApi {
  setWidth: (columnKey: string, width: number | null) => void
  getWidth: (columnKey: string) => number | null
  resetWidth: (columnKey: string) => void
}

export interface DataGridColumnReorderFeatureApi {
  getOrder: () => readonly string[]
  setOrder: (order: readonly string[]) => void
  moveColumn: (columnKey: string, toIndex: number) => boolean
}

export interface DataGridCellEditorsActiveCell {
  rowIndex: number
  columnKey: string
}

export interface DataGridCellEditorsFeatureApi<TRow = unknown> {
  isEditing: () => boolean
  getActiveCell: () => DataGridCellEditorsActiveCell | null
  startEdit: (rowIndex: number, columnKey: string) => boolean
  commitEdit: (value: unknown, options?: { emit?: boolean; reapply?: boolean }) => boolean
  cancelEdit: () => void
}

export interface DataGridColumnVirtualizationFeatureApi {
  enabled: Ref<boolean>
  setEnabled: (enabled: boolean) => void
  getEnabled: () => boolean
}

export interface DataGridRowHeightFeatureApi {
  mode: Ref<"fixed" | "auto">
  base: Ref<number>
  setMode: (mode: "fixed" | "auto") => void
  setBase: (height: number) => void
  measure: () => void
  setOverride: (rowIndex: number, height: number | null) => void
  getOverride: (rowIndex: number) => number | null
  clearOverrides: () => void
}

export interface DataGridServerSideRowModelFeatureApi {
  kind: ComputedRef<DataGridRowModelKind>
  isServerModel: () => boolean
  refresh: () => void
  pause: () => boolean
  resume: () => boolean
  flush: () => Promise<void>
}

export type DataGridRowSelectionMode = "single" | "multiple"

export interface DataGridRowSelectionModesFeatureApi {
  mode: Ref<DataGridRowSelectionMode>
  setMode: (mode: DataGridRowSelectionMode) => void
  getMode: () => DataGridRowSelectionMode
}

export interface DataGridSelectionOverlayRect {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridSelectionOverlayFeatureApi {
  overlays: Ref<readonly DataGridSelectionOverlayRect[]>
  refresh: () => readonly DataGridSelectionOverlayRect[]
}

export interface DataGridExportFeatureApi {
  exportCsv: (options?: { delimiter?: string; includeHeaders?: boolean }) => Promise<DataGridExportPayload>
  downloadCsv: (fileName?: string) => Promise<DataGridExportPayload>
}

export interface DataGridExportExcelFeatureApi {
  exportExcel: (options?: { delimiter?: string; includeHeaders?: boolean }) => Promise<DataGridExportPayload>
  downloadExcel: (fileName?: string) => Promise<DataGridExportPayload>
}

interface SelectionSnapshotInput {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
  anchorRow: number
  anchorColumn: number
  focusRow: number
  focusColumn: number
  resolveRowId: (rowIndex: number) => string | number | null
}

function createSelectionSnapshot(input: SelectionSnapshotInput): DataGridSelectionSnapshot {
  const startRowId = input.resolveRowId(input.startRow)
  const endRowId = input.resolveRowId(input.endRow)
  const activeRowId = input.resolveRowId(input.focusRow)

  return {
    ranges: [
      {
        startRow: input.startRow,
        endRow: input.endRow,
        startCol: input.startColumn,
        endCol: input.endColumn,
        startRowId,
        endRowId,
        anchor: {
          rowIndex: input.anchorRow,
          colIndex: input.anchorColumn,
          rowId: input.resolveRowId(input.anchorRow),
        },
        focus: {
          rowIndex: input.focusRow,
          colIndex: input.focusColumn,
          rowId: activeRowId,
        },
      },
    ],
    activeRangeIndex: 0,
    activeCell: {
      rowIndex: input.focusRow,
      colIndex: input.focusColumn,
      rowId: activeRowId,
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseClipboardText(text: string): readonly (readonly string[])[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(line => line.length > 0)
    .map(line => line.split("\t"))
}

function canUseClipboardApi(): boolean {
  return typeof navigator !== "undefined"
    && typeof navigator.clipboard !== "undefined"
}

function resolveTextValue(value: unknown): string {
  if (value == null) {
    return ""
  }
  return String(value)
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value
  }
  return `"${value.replace(/"/g, "\"\"")}"`
}

function serializeDelimitedRow(values: readonly string[], delimiter: string): string {
  if (delimiter === ",") {
    return values.map(escapeCsvCell).join(delimiter)
  }
  return values.join(delimiter)
}

function serializeDelimitedTable(
  rows: readonly (readonly string[])[],
  delimiter: string,
): string {
  return rows.map(row => serializeDelimitedRow(row, delimiter)).join("\n")
}

function normalizeExportPayload(
  payload: string | DataGridExportPayload,
  fallbackFileName: string,
  fallbackMimeType: string,
): DataGridExportPayload {
  if (typeof payload === "string") {
    return {
      text: payload,
      fileName: fallbackFileName,
      mimeType: fallbackMimeType,
    }
  }
  return {
    text: payload.text ?? "",
    fileName: payload.fileName ?? fallbackFileName,
    mimeType: payload.mimeType ?? fallbackMimeType,
  }
}

function downloadTextFile(payload: DataGridExportPayload): void {
  if (typeof document === "undefined") {
    return
  }
  const blob = new Blob([payload.text], {
    type: payload.mimeType ?? "text/plain;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = payload.fileName ?? "datagrid-export.txt"
  anchor.click()
  URL.revokeObjectURL(url)
}

function resolveColumnFromRuntimeSnapshot<TRow>(
  ctx: GridContext<TRow>,
  columnKey: string,
): DataGridColumnSnapshot | null {
  return ctx.runtime.columnSnapshot.value.columns.find(column => column.key === columnKey) ?? null
}

function resolveVisibleColumnsWithLabels<TRow>(
  ctx: GridContext<TRow>,
): readonly {
  key: string
  label: string
  snapshot: DataGridColumnSnapshot | null
}[] {
  return ctx.runtime.columnSnapshot.value.visibleColumns.map((entry) => {
    const columnRecord = entry as unknown as {
      key: string
      label?: string
      column?: { label?: string }
    }
    const key = columnRecord.key
    const snapshot = resolveColumnFromRuntimeSnapshot(ctx, key)
    return {
      key,
      label: columnRecord.label ?? columnRecord.column?.label ?? key,
      snapshot,
    }
  })
}

function resolveExportRows<TRow>(
  ctx: GridContext<TRow>,
): readonly TRow[] {
  const rowCount = Math.max(0, ctx.api.rows.getCount())
  const rows: TRow[] = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = ctx.api.rows.get(rowIndex)?.row
    if (row != null) {
      rows.push(row)
    }
  }
  return rows
}

function resolveColumnWidthBounds(
  column: DataGridColumnSnapshot | null,
  defaults: { minWidth: number; maxWidth: number },
): { minWidth: number; maxWidth: number } {
  const minWidth = Number.isFinite(column?.column.minWidth)
    ? Math.max(0, Math.trunc(column?.column.minWidth ?? defaults.minWidth))
    : defaults.minWidth
  const maxWidth = Number.isFinite(column?.column.maxWidth)
    ? Math.max(minWidth, Math.trunc(column?.column.maxWidth ?? defaults.maxWidth))
    : defaults.maxWidth
  return {
    minWidth,
    maxWidth,
  }
}

function resolveColumnKeyPayload(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload
  }
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { columnKey?: unknown }
  return typeof candidate.columnKey === "string" ? candidate.columnKey : null
}

function resolveColumnPinPayload(payload: unknown): { columnKey: string; pin: DataGridColumnPin } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { columnKey?: unknown; pin?: unknown }
  if (typeof candidate.columnKey !== "string") {
    return null
  }
  if (candidate.pin !== "left" && candidate.pin !== "right" && candidate.pin !== "none") {
    return null
  }
  return {
    columnKey: candidate.columnKey,
    pin: candidate.pin,
  }
}

function resolveColumnVisibilityPayload(payload: unknown): { columnKey: string; visible: boolean } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { columnKey?: unknown; visible?: unknown }
  if (typeof candidate.columnKey !== "string" || typeof candidate.visible !== "boolean") {
    return null
  }
  return {
    columnKey: candidate.columnKey,
    visible: candidate.visible,
  }
}

function resolveColumnMenuPayload(
  payload: unknown,
): { columnKey: string; anchor?: { x: number; y: number } | null } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { columnKey?: unknown; anchor?: unknown }
  if (typeof candidate.columnKey !== "string") {
    return null
  }
  if (!candidate.anchor || typeof candidate.anchor !== "object") {
    return { columnKey: candidate.columnKey, anchor: null }
  }
  const anchorCandidate = candidate.anchor as { x?: unknown; y?: unknown }
  if (typeof anchorCandidate.x !== "number" || typeof anchorCandidate.y !== "number") {
    return { columnKey: candidate.columnKey, anchor: null }
  }
  return {
    columnKey: candidate.columnKey,
    anchor: {
      x: anchorCandidate.x,
      y: anchorCandidate.y,
    },
  }
}

function resolveSortTogglePayload(payload: unknown): { columnKey: string; cycle?: readonly DataGridSortDirection[] } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { columnKey?: unknown; cycle?: unknown }
  if (typeof candidate.columnKey !== "string") {
    return null
  }
  const cycle = Array.isArray(candidate.cycle)
    ? candidate.cycle.filter((entry): entry is DataGridSortDirection => entry === "asc" || entry === "desc")
    : undefined
  return {
    columnKey: candidate.columnKey,
    cycle,
  }
}

function resolveSortModelPayload(payload: unknown): readonly DataGridSortState[] | null {
  if (!Array.isArray(payload)) {
    return null
  }
  const entries: DataGridSortState[] = []
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") {
      continue
    }
    const candidate = entry as { key?: unknown; direction?: unknown }
    if (typeof candidate.key !== "string") {
      continue
    }
    if (candidate.direction !== "asc" && candidate.direction !== "desc") {
      continue
    }
    entries.push({
      key: candidate.key,
      direction: candidate.direction,
    })
  }
  return entries
}

function resolveBooleanPayload(payload: unknown): boolean | null {
  return typeof payload === "boolean" ? payload : null
}

function resolveRowIndexFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { rowIndex?: unknown }
  return typeof candidate.rowIndex === "number" ? candidate.rowIndex : null
}

function resolveCellCoordFromPayload(payload: unknown): { rowIndex: number; columnIndex: number } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { rowIndex?: unknown; columnIndex?: unknown }
  if (typeof candidate.rowIndex !== "number" || typeof candidate.columnIndex !== "number") {
    return null
  }
  return {
    rowIndex: candidate.rowIndex,
    columnIndex: candidate.columnIndex,
  }
}

function resolveKeyboardEventPayload(payload: unknown): KeyboardEvent | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as Partial<KeyboardEvent>
  if (typeof candidate.key !== "string") {
    return null
  }
  return payload as KeyboardEvent
}

function resolveColumnResizePayload(payload: unknown): { columnKey: string; width: number | null } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { columnKey?: unknown; width?: unknown }
  if (typeof candidate.columnKey !== "string") {
    return null
  }
  const width = candidate.width
  if (width == null) {
    return { columnKey: candidate.columnKey, width: null }
  }
  if (typeof width !== "number" || !Number.isFinite(width)) {
    return null
  }
  return {
    columnKey: candidate.columnKey,
    width: Math.max(0, Math.trunc(width)),
  }
}

function resolveColumnReorderPayload(payload: unknown): { order: readonly string[] } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { order?: unknown }
  if (!Array.isArray(candidate.order)) {
    return null
  }
  return {
    order: candidate.order.filter((value): value is string => typeof value === "string"),
  }
}

function resolveColumnMovePayload(payload: unknown): { columnKey: string; toIndex: number } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { columnKey?: unknown; toIndex?: unknown }
  if (typeof candidate.columnKey !== "string" || typeof candidate.toIndex !== "number") {
    return null
  }
  return {
    columnKey: candidate.columnKey,
    toIndex: Math.trunc(candidate.toIndex),
  }
}

function resolveCellEditStartPayload(payload: unknown): DataGridCellEditorsActiveCell | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { rowIndex?: unknown; columnKey?: unknown }
  if (typeof candidate.rowIndex !== "number" || typeof candidate.columnKey !== "string") {
    return null
  }
  return {
    rowIndex: candidate.rowIndex,
    columnKey: candidate.columnKey,
  }
}

function resolveCellEditCommitPayload(payload: unknown): { value: unknown; emit?: boolean; reapply?: boolean } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const candidate = payload as { value?: unknown; emit?: unknown; reapply?: unknown }
  return {
    value: candidate.value,
    emit: typeof candidate.emit === "boolean" ? candidate.emit : undefined,
    reapply: typeof candidate.reapply === "boolean" ? candidate.reapply : undefined,
  }
}

export function resolveDataGridFeatureDependencies(
  features: readonly DataGridFeatureName[],
): readonly DataGridFeatureName[] {
  const nextFeatures = [...features]
  const requiresKeyboard = nextFeatures.some(feature => KEYBOARD_TRIGGER_FEATURES.includes(feature))
  if (requiresKeyboard && !nextFeatures.includes("keyboard")) {
    nextFeatures.push("keyboard")
  }
  if (
    (nextFeatures.includes("advancedClipboard") || nextFeatures.includes("excelCompatibleClipboard"))
    && !nextFeatures.includes("clipboard")
  ) {
    nextFeatures.push("clipboard")
  }
  if (
    (nextFeatures.includes("advancedClipboard") || nextFeatures.includes("excelCompatibleClipboard"))
    && !nextFeatures.includes("selection")
  ) {
    nextFeatures.push("selection")
  }
  if (nextFeatures.includes("pivotPanel") && !nextFeatures.includes("pivot")) {
    nextFeatures.push("pivot")
  }
  if (nextFeatures.includes("advancedPivotEngine") && !nextFeatures.includes("pivot")) {
    nextFeatures.push("pivot")
  }
  if (nextFeatures.includes("groupPanel") && !nextFeatures.includes("grouping")) {
    nextFeatures.push("grouping")
  }
  return nextFeatures
}

export function createDataGridFeatureRegistry<TRow = unknown>(
  options: CreateDataGridFeatureRegistryOptions<TRow> = {},
): DataGridFeatureRegistry<TRow> {
  const createSelection = (): DataGridFeature<TRow, "selection", DataGridSelectionFeatureApi> => selectionFeature({
    install(ctx) {
      const localSnapshot = ref<DataGridSelectionSnapshot | null>(
        ctx.api.selection.hasSupport() ? ctx.api.selection.getSnapshot() : null,
      )

      const resolveRowCount = (): number => Math.max(0, ctx.api.rows.getCount())
      const resolveColumnCount = (): number => Math.max(0, ctx.runtime.columnSnapshot.value.visibleColumns.length)
      const resolveRowIdByIndex = (rowIndex: number): string | number | null => {
        const row = ctx.api.rows.get(rowIndex)
        return row ? row.rowId : null
      }

      const setSnapshot = (snapshot: DataGridSelectionSnapshot | null): void => {
        localSnapshot.value = snapshot
        if (ctx.api.selection.hasSupport()) {
          if (snapshot) {
            ctx.api.selection.setSnapshot(snapshot)
          } else {
            ctx.api.selection.clear()
          }
          return
        }
        ctx.emit("selection:changed", { snapshot })
      }

      const getSnapshot = (): DataGridSelectionSnapshot | null => {
        if (!ctx.api.selection.hasSupport()) {
          return localSnapshot.value
        }
        return ctx.api.selection.getSnapshot() ?? localSnapshot.value
      }

      const selectCell = (rowIndex: number, columnIndex: number): DataGridSelectionSnapshot | null => {
        const rowCount = resolveRowCount()
        const colCount = resolveColumnCount()
        if (rowCount <= 0 || colCount <= 0) {
          setSnapshot(null)
          return null
        }

        const safeRowIndex = clamp(rowIndex, 0, rowCount - 1)
        const safeColumnIndex = clamp(columnIndex, 0, colCount - 1)
        const snapshot = createSelectionSnapshot({
          startRow: safeRowIndex,
          endRow: safeRowIndex,
          startColumn: safeColumnIndex,
          endColumn: safeColumnIndex,
          anchorRow: safeRowIndex,
          anchorColumn: safeColumnIndex,
          focusRow: safeRowIndex,
          focusColumn: safeColumnIndex,
          resolveRowId: resolveRowIdByIndex,
        })
        setSnapshot(snapshot)
        return snapshot
      }

      const selectRow = (rowIndex: number): DataGridSelectionSnapshot | null => {
        const rowCount = resolveRowCount()
        const colCount = resolveColumnCount()
        if (rowCount <= 0 || colCount <= 0) {
          setSnapshot(null)
          return null
        }

        const safeRowIndex = clamp(rowIndex, 0, rowCount - 1)
        const snapshot = createSelectionSnapshot({
          startRow: safeRowIndex,
          endRow: safeRowIndex,
          startColumn: 0,
          endColumn: colCount - 1,
          anchorRow: safeRowIndex,
          anchorColumn: 0,
          focusRow: safeRowIndex,
          focusColumn: 0,
          resolveRowId: resolveRowIdByIndex,
        })
        setSnapshot(snapshot)
        return snapshot
      }

      return {
        getSnapshot,
        getActiveCell: () => {
          const activeCell = getSnapshot()?.activeCell
          if (!activeCell) {
            return null
          }
          return {
            rowIndex: activeCell.rowIndex,
            columnIndex: activeCell.colIndex,
          }
        },
        selectCell,
        selectRow,
        clear: () => {
          setSnapshot(null)
        },
      }
    },
    on: {
      "cell-click"(payload) {
        const coord = resolveCellCoordFromPayload(payload)
        if (!coord) {
          return
        }
        this.selectCell(coord.rowIndex, coord.columnIndex)
      },
      "row-select"(payload) {
        const rowIndex = resolveRowIndexFromPayload(payload)
        if (rowIndex == null) {
          return
        }
        this.selectRow(rowIndex)
      },
    },
  })

  const createNavigation = (): DataGridFeature<TRow, "navigation", DataGridNavigationFeatureApi> => navigationFeature({
    install(ctx) {
      const resolveSelection = (): DataGridSelectionFeatureApi | null => {
        const feature = ctx.features.get("selection")
        return feature && typeof feature === "object" ? feature as DataGridSelectionFeatureApi : null
      }

      const moveBy = (deltaRow: number, deltaColumn: number): DataGridSelectionSnapshot | null => {
        const selection = resolveSelection()
        if (!selection) {
          return null
        }
        const rowCount = Math.max(0, ctx.api.rows.getCount())
        const colCount = Math.max(0, ctx.runtime.columnSnapshot.value.visibleColumns.length)
        if (rowCount <= 0 || colCount <= 0) {
          return null
        }

        const activeCell = selection.getActiveCell() ?? { rowIndex: 0, columnIndex: 0 }
        return selection.selectCell(
          clamp(activeCell.rowIndex + deltaRow, 0, rowCount - 1),
          clamp(activeCell.columnIndex + deltaColumn, 0, colCount - 1),
        )
      }

      const handleKeydown = (event: KeyboardEvent): boolean => {
        switch (event.key) {
          case "ArrowUp":
            moveBy(-1, 0)
            return true
          case "ArrowDown":
            moveBy(1, 0)
            return true
          case "ArrowLeft":
            moveBy(0, -1)
            return true
          case "ArrowRight":
            moveBy(0, 1)
            return true
          default:
            return false
        }
      }

      return {
        moveBy,
        handleKeydown,
      }
    },
  })

  const createClipboard = (): DataGridFeature<TRow, "clipboard", DataGridClipboardFeatureApi> => clipboardFeature({
    install(ctx) {
      const lastClipboardText = ref("")
      const resolveSelection = (): DataGridSelectionFeatureApi | null => {
        const feature = ctx.features.get("selection")
        return feature && typeof feature === "object" ? feature as DataGridSelectionFeatureApi : null
      }

      const resolveColumns = (): readonly string[] => {
        return ctx.runtime.columnSnapshot.value.visibleColumns.map(column => column.key)
      }

      const resolveRange = () => {
        const selection = resolveSelection()
        const snapshot = selection?.getSnapshot()
        if (!snapshot || snapshot.ranges.length === 0) {
          return null
        }
        return snapshot.ranges[snapshot.activeRangeIndex] ?? snapshot.ranges[0] ?? null
      }

      const applyMatrix = (matrix: readonly (readonly string[])[], startRow: number, startColumn: number): boolean => {
        if (!ctx.api.rows.hasPatchSupport() || matrix.length === 0) {
          return false
        }
        const columns = resolveColumns()
        if (columns.length === 0) {
          return false
        }

        const updatesByRow = new Map<string | number, Partial<TRow>>()
        for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
          const values = matrix[rowOffset]
          if (!values) {
            continue
          }
          const rowIndex = startRow + rowOffset
          const rowNode = ctx.api.rows.get(rowIndex)
          if (!rowNode) {
            continue
          }

          const nextPatch = updatesByRow.get(rowNode.rowId) ?? ({} as Partial<TRow>)
          const nextPatchRecord = nextPatch as Record<string, unknown>
          for (let colOffset = 0; colOffset < values.length; colOffset += 1) {
            const columnKey = columns[startColumn + colOffset]
            if (!columnKey) {
              continue
            }
            if (options.isColumnReadOnly?.(columnKey)) {
              continue
            }
            nextPatchRecord[columnKey] = values[colOffset] ?? ""
          }
          updatesByRow.set(rowNode.rowId, nextPatch)
        }

        if (updatesByRow.size === 0) {
          return false
        }

        try {
          ctx.api.rows.applyEdits(
            Array.from(updatesByRow.entries()).map(([rowId, data]) => ({ rowId, data })),
            { reapply: true, emit: true },
          )
        } catch {
          return false
        }
        return true
      }

      const copy = async (): Promise<string> => {
        const range = resolveRange()
        if (!range) {
          return ""
        }

        const columns = resolveColumns()
        const lines: string[] = []
        for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
          const row = ctx.api.rows.get(rowIndex)
          if (!row) {
            continue
          }
          const rowRecord = row.row as Record<string, unknown>
          const values: string[] = []
          for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
            const key = columns[colIndex]
            values.push(resolveTextValue(key ? rowRecord[key] : ""))
          }
          lines.push(values.join("\t"))
        }

        const text = lines.join("\n")
        lastClipboardText.value = text
        if (text && canUseClipboardApi()) {
          try {
            await navigator.clipboard.writeText(text)
          } catch {
            // Ignore clipboard permission failures and keep in-memory fallback.
          }
        }
        return text
      }

      const clear = (): void => {
        const range = resolveRange()
        if (!range) {
          return
        }
        const width = Math.max(1, range.endCol - range.startCol + 1)
        const height = Math.max(1, range.endRow - range.startRow + 1)
        const emptyMatrix = Array.from({ length: height }, () => Array.from({ length: width }, () => ""))
        applyMatrix(emptyMatrix, range.startRow, range.startCol)
      }

      const paste = async (text?: string): Promise<boolean> => {
        const resolvedText = text ?? (() => {
          if (canUseClipboardApi()) {
            return null
          }
          return lastClipboardText.value
        })()

        let nextText = resolvedText
        if (nextText == null && canUseClipboardApi()) {
          try {
            nextText = await navigator.clipboard.readText()
          } catch {
            nextText = lastClipboardText.value
          }
        }

        if (!nextText) {
          return false
        }

        const matrix = parseClipboardText(nextText)
        if (matrix.length === 0) {
          return false
        }

        const selection = resolveSelection()
        const active = selection?.getActiveCell()
        const startRow = active?.rowIndex ?? 0
        const startColumn = active?.columnIndex ?? 0
        return applyMatrix(matrix, startRow, startColumn)
      }

      const cut = async (): Promise<string> => {
        const text = await copy()
        clear()
        return text
      }

      return {
        copy,
        cut,
        paste,
        clear,
        applyMatrix,
      }
    },
  })

  const createFillHandle = (): DataGridFeature<TRow, "fillHandle", DataGridFillHandleFeatureApi> => fillHandleFeature({
    install(ctx) {
      const resolveSelection = (): DataGridSelectionFeatureApi | null => {
        const feature = ctx.features.get("selection")
        return feature && typeof feature === "object" ? feature as DataGridSelectionFeatureApi : null
      }

      const resolveClipboard = (): DataGridClipboardFeatureApi | null => {
        const feature = ctx.features.get("clipboard")
        return feature && typeof feature === "object" ? feature as DataGridClipboardFeatureApi : null
      }

      const fillSelection = (): boolean => {
        const selection = resolveSelection()
        const clipboard = resolveClipboard()
        const snapshot = selection?.getSnapshot()
        if (!selection || !clipboard || !snapshot || snapshot.ranges.length === 0) {
          return false
        }

        const activeCell = snapshot.activeCell
        if (!activeCell) {
          return false
        }

        const activeRow = ctx.api.rows.get(activeCell.rowIndex)
        const columnKey = ctx.runtime.columnSnapshot.value.visibleColumns[activeCell.colIndex]?.key
        if (!activeRow || !columnKey) {
          return false
        }
        const activeValue = resolveTextValue((activeRow.row as Record<string, unknown>)[columnKey])
        const range = snapshot.ranges[snapshot.activeRangeIndex] ?? snapshot.ranges[0]
        if (!range) {
          return false
        }

        const width = Math.max(1, range.endCol - range.startCol + 1)
        const height = Math.max(1, range.endRow - range.startRow + 1)
        const matrix = Array.from({ length: height }, () => Array.from({ length: width }, () => activeValue))
        return clipboard.applyMatrix(matrix, range.startRow, range.startCol)
      }

      return {
        fillSelection,
      }
    },
  })

  const createHistory = (): DataGridFeature<TRow, "history", DataGridHistoryFeatureApi> => historyFeature({
    install(ctx) {
      return {
        supported: () => ctx.api.transaction.hasSupport(),
        canUndo: () => ctx.api.transaction.canUndo(),
        canRedo: () => ctx.api.transaction.canRedo(),
        undo: () => ctx.api.transaction.undo(),
        redo: () => ctx.api.transaction.redo(),
      }
    },
  })

  const createSorting = (): DataGridFeature<TRow, "sorting", DataGridSortingFeatureApi> => sortingFeature({
    install(ctx) {
      const setSortModel = (sortModel: readonly DataGridSortState[]): void => {
        ctx.api.rows.setSortModel(sortModel)
      }
      const getSortModel = (): readonly DataGridSortState[] => {
        return ctx.api.rows.getSnapshot().sortModel
      }
      const clearSortModel = (): void => {
        setSortModel([])
      }
      const toggleColumnSort = (
        columnKey: string,
        directionCycle: readonly DataGridSortDirection[] = ["asc", "desc"],
      ): readonly DataGridSortState[] => {
        const current = getSortModel()
        const existing = current.find(entry => entry.key === columnKey)
        if (!existing) {
          const next = directionCycle[0]
          if (!next) {
            clearSortModel()
            return getSortModel()
          }
          setSortModel([{ key: columnKey, direction: next }])
          return getSortModel()
        }
        const cycleIndex = directionCycle.findIndex(direction => direction === existing.direction)
        const nextDirection = cycleIndex < 0 ? null : directionCycle[cycleIndex + 1] ?? null
        if (!nextDirection) {
          const next = current.filter(entry => entry.key !== columnKey)
          setSortModel(next)
          return getSortModel()
        }
        const next = current.map(entry => (
          entry.key === columnKey
            ? { ...entry, direction: nextDirection }
            : entry
        ))
        setSortModel(next)
        return getSortModel()
      }
      return {
        setSortModel,
        getSortModel,
        clearSortModel,
        toggleColumnSort,
      }
    },
    on: {
      "sort:set"(payload) {
        const model = resolveSortModelPayload(payload)
        if (!model) {
          return
        }
        this.setSortModel(model)
      },
      "sort:clear"() {
        this.clearSortModel()
      },
      "sort:toggle"(payload) {
        const togglePayload = resolveSortTogglePayload(payload)
        if (!togglePayload) {
          return
        }
        this.toggleColumnSort(togglePayload.columnKey, togglePayload.cycle)
      },
    },
  })

  const createAdvancedClipboard = (): DataGridFeature<TRow, "advancedClipboard", DataGridAdvancedClipboardFeatureApi> => advancedClipboardFeature({
    install(ctx) {
      const parseText = (text: string, delimiter = "\t"): readonly (readonly string[])[] => {
        return text
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .split("\n")
          .filter(line => line.length > 0)
          .map(line => line.split(delimiter))
      }
      const resolveSelection = (): DataGridSelectionFeatureApi | null => {
        const feature = ctx.features.get("selection")
        return feature && typeof feature === "object" ? feature as DataGridSelectionFeatureApi : null
      }
      const resolveClipboard = (): DataGridClipboardFeatureApi | null => {
        const feature = ctx.features.get("clipboard")
        return feature && typeof feature === "object" ? feature as DataGridClipboardFeatureApi : null
      }
      const serializeSelection = (selectionOptions: DataGridAdvancedClipboardOptions = {}): string => {
        const selection = resolveSelection()
        const snapshot = selection?.getSnapshot()
        if (!snapshot || snapshot.ranges.length === 0) {
          return ""
        }
        const delimiter = selectionOptions.delimiter ?? "\t"
        const visibleColumns = resolveVisibleColumnsWithLabels(ctx)
        const range = snapshot.ranges[snapshot.activeRangeIndex] ?? snapshot.ranges[0]
        if (!range) {
          return ""
        }
        const lines: string[][] = []
        if (selectionOptions.includeHeaders) {
          lines.push(visibleColumns
            .slice(range.startCol, range.endCol + 1)
            .map(column => column.label))
        }
        for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
          const rowNode = ctx.api.rows.get(rowIndex)
          if (!rowNode) {
            continue
          }
          const rowRecord = rowNode.row as Record<string, unknown>
          const nextLine: string[] = []
          for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
            const column = visibleColumns[colIndex]
            if (!column) {
              continue
            }
            nextLine.push(options.resolveCellTextValue?.(rowRecord[column.key], column.key) ?? resolveTextValue(rowRecord[column.key]))
          }
          lines.push(nextLine)
        }
        return serializeDelimitedTable(lines, delimiter)
      }
      const copy = async (copyOptions: DataGridAdvancedClipboardOptions = {}): Promise<string> => {
        const text = serializeSelection(copyOptions)
        if (!text) {
          return ""
        }
        if (canUseClipboardApi()) {
          try {
            await navigator.clipboard.writeText(text)
          } catch {
            // Ignore permission errors.
          }
        }
        return text
      }
      const paste = async (
        text?: string,
        pasteOptions: DataGridAdvancedClipboardOptions = {},
      ): Promise<boolean> => {
        let resolvedText = text
        if (!resolvedText && canUseClipboardApi()) {
          try {
            resolvedText = await navigator.clipboard.readText()
          } catch {
            resolvedText = ""
          }
        }
        if (!resolvedText) {
          return false
        }
        const delimiter = pasteOptions.delimiter ?? "\t"
        const matrix = parseText(resolvedText, delimiter)
        if (matrix.length === 0) {
          return false
        }
        const clipboard = resolveClipboard()
        const selection = resolveSelection()
        if (!clipboard || !selection) {
          return false
        }
        const active = selection.getActiveCell()
        return clipboard.applyMatrix(matrix, active?.rowIndex ?? 0, active?.columnIndex ?? 0)
      }
      const cut = async (cutOptions: DataGridAdvancedClipboardOptions = {}): Promise<string> => {
        const text = await copy(cutOptions)
        const clipboard = resolveClipboard()
        clipboard?.clear()
        return text
      }
      return {
        copy,
        cut,
        paste,
        serializeSelection,
        parseText,
      }
    },
    on: {
      "advanced-clipboard:copy"(payload) {
        void this.copy((payload ?? undefined) as DataGridAdvancedClipboardOptions | undefined)
      },
      "advanced-clipboard:paste"(payload) {
        if (typeof payload === "string") {
          void this.paste(payload)
          return
        }
        void this.paste(undefined, (payload ?? undefined) as DataGridAdvancedClipboardOptions | undefined)
      },
      "advanced-clipboard:cut"(payload) {
        void this.cut((payload ?? undefined) as DataGridAdvancedClipboardOptions | undefined)
      },
    },
  })

  const createExcelCompatibleClipboard = (): DataGridFeature<TRow, "excelCompatibleClipboard", DataGridAdvancedClipboardFeatureApi> => excelCompatibleClipboardFeature({
    install(ctx) {
      const resolveAdvancedClipboard = (): DataGridAdvancedClipboardFeatureApi | null => {
        const feature = ctx.features.get("advancedClipboard")
        return feature && typeof feature === "object" ? feature as DataGridAdvancedClipboardFeatureApi : null
      }
      const resolveClipboard = (): DataGridClipboardFeatureApi | null => {
        const feature = ctx.features.get("clipboard")
        return feature && typeof feature === "object" ? feature as DataGridClipboardFeatureApi : null
      }
      const parseText = (text: string, delimiter = "\t"): readonly (readonly string[])[] => {
        return text
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .split("\n")
          .filter(line => line.length > 0)
          .map(line => line.split(delimiter))
      }
      const serializeSelection = (selectionOptions: DataGridAdvancedClipboardOptions = {}): string => {
        const advanced = resolveAdvancedClipboard()
        if (advanced) {
          return advanced.serializeSelection({ ...selectionOptions, delimiter: "\t" })
        }
        const selectionFeature = ctx.features.get("selection")
        const selection = selectionFeature && typeof selectionFeature === "object"
          ? selectionFeature as DataGridSelectionFeatureApi
          : null
        const snapshot = selection?.getSnapshot()
        if (!snapshot || snapshot.ranges.length === 0) {
          return ""
        }
        const range = snapshot.ranges[snapshot.activeRangeIndex] ?? snapshot.ranges[0]
        if (!range) {
          return ""
        }
        const columns = resolveVisibleColumnsWithLabels(ctx)
        const lines: string[][] = []
        if (selectionOptions.includeHeaders) {
          lines.push(columns.slice(range.startCol, range.endCol + 1).map(column => column.label))
        }
        for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
          const rowNode = ctx.api.rows.get(rowIndex)
          if (!rowNode) {
            continue
          }
          const rowRecord = rowNode.row as Record<string, unknown>
          const line: string[] = []
          for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
            const column = columns[colIndex]
            if (!column) {
              continue
            }
            line.push(options.resolveCellTextValue?.(rowRecord[column.key], column.key) ?? resolveTextValue(rowRecord[column.key]))
          }
          lines.push(line)
        }
        return serializeDelimitedTable(lines, "\t")
      }
      return {
        copy: async (copyOptions = {}) => {
          const advanced = resolveAdvancedClipboard()
          if (advanced) {
            return advanced.copy({ ...copyOptions, delimiter: "\t" })
          }
          const text = serializeSelection(copyOptions)
          if (text && canUseClipboardApi()) {
            try {
              await navigator.clipboard.writeText(text)
            } catch {
              // Ignore permission errors.
            }
          }
          return text
        },
        cut: async (cutOptions = {}) => {
          const advanced = resolveAdvancedClipboard()
          if (advanced) {
            return advanced.cut({ ...cutOptions, delimiter: "\t" })
          }
          const text = serializeSelection(cutOptions)
          resolveClipboard()?.clear()
          return text
        },
        paste: async (text?: string, pasteOptions = {}) => {
          const advanced = resolveAdvancedClipboard()
          if (advanced) {
            return advanced.paste(text, { ...pasteOptions, delimiter: "\t" })
          }
          let nextText = text
          if (!nextText && canUseClipboardApi()) {
            try {
              nextText = await navigator.clipboard.readText()
            } catch {
              nextText = ""
            }
          }
          if (!nextText) {
            return false
          }
          const clipboard = resolveClipboard()
          const selectionFeature = ctx.features.get("selection")
          const selection = selectionFeature && typeof selectionFeature === "object"
            ? selectionFeature as DataGridSelectionFeatureApi
            : null
          if (!clipboard || !selection) {
            return false
          }
          const matrix = parseText(nextText, "\t")
          const activeCell = selection.getActiveCell()
          return clipboard.applyMatrix(matrix, activeCell?.rowIndex ?? 0, activeCell?.columnIndex ?? 0)
        },
        serializeSelection,
        parseText,
      }
    },
  })

  const createPivot = (): DataGridFeature<TRow, "pivot", DataGridPivotFeatureApi<TRow>> => pivotFeature({
    install(ctx) {
      return {
        setModel: ctx.api.pivot.setModel,
        getModel: ctx.api.pivot.getModel,
        getCellDrilldown: ctx.api.pivot.getCellDrilldown,
        exportLayout: ctx.api.pivot.exportLayout,
        exportInterop: ctx.api.pivot.exportInterop,
        importLayout: ctx.api.pivot.importLayout,
      }
    },
  })

  const createAdvancedPivotEngine = (): DataGridFeature<TRow, "advancedPivotEngine", DataGridAdvancedPivotEngineFeatureApi<TRow>> => advancedPivotEngineFeature({
    install(ctx) {
      return {
        setModel: ctx.api.pivot.setModel,
        getModel: ctx.api.pivot.getModel,
        getCellDrilldown: ctx.api.pivot.getCellDrilldown,
        exportLayout: ctx.api.pivot.exportLayout,
        exportInterop: ctx.api.pivot.exportInterop,
        importLayout: ctx.api.pivot.importLayout,
        refresh: () => {
          void ctx.api.view.reapply()
        },
      }
    },
  })

  const createPivotPanel = (): DataGridFeature<TRow, "pivotPanel", DataGridPivotPanelFeatureApi> => pivotPanelFeature({
    install(ctx) {
      const state = ref<DataGridPivotPanelState>({
        open: false,
        rows: [],
        columns: [],
        values: [],
      })

      const syncFromModel = (): void => {
        const model = ctx.api.pivot.getModel()
        state.value = {
          ...state.value,
          rows: model?.rows ?? [],
          columns: model?.columns ?? [],
          values: model?.values ?? [],
        }
      }

      syncFromModel()

      const updateModel = (patch: Partial<DataGridPivotSpec>): void => {
        const current = ctx.api.pivot.getModel() ?? { rows: [], columns: [], values: [] }
        ctx.api.pivot.setModel({
          rows: patch.rows ?? current.rows,
          columns: patch.columns ?? current.columns,
          values: patch.values ?? current.values,
        })
        syncFromModel()
      }

      return {
        state,
        open: () => {
          state.value = { ...state.value, open: true }
        },
        close: () => {
          state.value = { ...state.value, open: false }
        },
        toggle: () => {
          state.value = { ...state.value, open: !state.value.open }
        },
        setRows: (rows) => {
          updateModel({ rows: [...rows] })
        },
        setColumns: (columns) => {
          updateModel({ columns: [...columns] })
        },
        setValues: (values) => {
          updateModel({ values: [...values] })
        },
      }
    },
  })

  const createGrouping = (): DataGridFeature<TRow, "grouping", DataGridGroupingFeatureApi> => groupingFeature({
    install(ctx) {
      return {
        setGroupBy: ctx.api.rows.setGroupBy,
        getGroupBy: () => ctx.api.rows.getSnapshot().groupBy ?? null,
        clearGroupBy: () => ctx.api.rows.setGroupBy(null),
        setGroupExpansion: ctx.api.rows.setGroupExpansion,
        toggleGroup: ctx.api.rows.toggleGroup,
        expandGroup: ctx.api.rows.expandGroup,
        collapseGroup: ctx.api.rows.collapseGroup,
        expandAllGroups: ctx.api.rows.expandAllGroups,
        collapseAllGroups: ctx.api.rows.collapseAllGroups,
      }
    },
  })

  const createGroupPanel = (): DataGridFeature<TRow, "groupPanel", DataGridGroupPanelFeatureApi> => groupPanelFeature({
    install(ctx) {
      const state = ref({
        open: false,
        columns: [] as readonly string[],
      })
      const syncFromSnapshot = (): void => {
        state.value = {
          ...state.value,
          columns: ctx.api.rows.getSnapshot().groupBy?.fields ?? [],
        }
      }
      syncFromSnapshot()
      return {
        state,
        open: () => {
          state.value = { ...state.value, open: true }
        },
        close: () => {
          state.value = { ...state.value, open: false }
        },
        toggle: () => {
          state.value = { ...state.value, open: !state.value.open }
        },
        setColumns: (columns) => {
          ctx.api.rows.setGroupBy(columns.length > 0 ? { fields: [...columns] } : null)
          syncFromSnapshot()
        },
      }
    },
  })

  const createAggregation = (): DataGridFeature<TRow, "aggregation", DataGridAggregationFeatureApi<TRow>> => aggregationFeature({
    install(ctx) {
      return {
        setModel: ctx.api.rows.setAggregationModel,
        getModel: ctx.api.rows.getAggregationModel,
        clearModel: () => ctx.api.rows.setAggregationModel(null),
      }
    },
  })

  const createAggregationFunctionsRegistry = (): DataGridFeature<TRow, "aggregationFunctionsRegistry", DataGridAggregationFunctionsRegistryFeatureApi> => aggregationFunctionsRegistryFeature({
    install(ctx) {
      const registry = new Map<string, DataGridAggregationFunction>()
      return {
        register: (name, fn) => {
          registry.set(name, fn)
          ctx.emit("aggregation:functions:changed", { name, action: "register" })
        },
        unregister: (name) => {
          const deleted = registry.delete(name)
          if (deleted) {
            ctx.emit("aggregation:functions:changed", { name, action: "unregister" })
          }
          return deleted
        },
        resolve: (name) => registry.get(name) ?? null,
        list: () => Array.from(registry.keys()).sort((left, right) => left.localeCompare(right)),
      }
    },
  })

  const createFilterDsl = (): DataGridFeature<TRow, "filterDsl", DataGridFilterDslFeatureApi> => filterDslFeature({
    install(ctx) {
      return {
        setFilterModel: ctx.api.rows.setFilterModel,
        getFilterModel: () => ctx.api.rows.getSnapshot().filterModel ?? null,
        clearFilterModel: () => ctx.api.rows.setFilterModel(null),
        setSortModel: ctx.api.rows.setSortModel,
        setSortAndFilterModel: ctx.api.rows.setSortAndFilterModel,
      }
    },
  })

  const createFilterBuilderUi = (): DataGridFeature<TRow, "filterBuilderUI", DataGridFilterBuilderUiFeatureApi> => filterBuilderUiFeature({
    install(ctx) {
      const state = ref({
        open: false,
        draft: ctx.api.rows.getSnapshot().filterModel ?? null,
      })
      return {
        state,
        open: () => {
          state.value = { ...state.value, open: true }
        },
        close: () => {
          state.value = { ...state.value, open: false }
        },
        toggle: () => {
          state.value = { ...state.value, open: !state.value.open }
        },
        setDraft: (filterModel) => {
          state.value = { ...state.value, draft: filterModel }
        },
        apply: () => {
          ctx.api.rows.setFilterModel(state.value.draft)
        },
        clear: () => {
          state.value = { ...state.value, draft: null }
          ctx.api.rows.setFilterModel(null)
        },
      }
    },
  })

  const createColumnPinning = (): DataGridFeature<TRow, "columnPinning", DataGridColumnPinningFeatureApi> => columnPinningFeature({
    install(ctx) {
      return {
        setPin: (columnKey, pin) => {
          ctx.api.columns.setPin(columnKey, pin)
        },
        getPin: (columnKey) => {
          return ctx.api.columns.get(columnKey)?.pin ?? "none"
        },
        clearPin: (columnKey) => {
          ctx.api.columns.setPin(columnKey, "none")
        },
      }
    },
    on: {
      "column-pin"(payload) {
        const pinPayload = resolveColumnPinPayload(payload)
        if (!pinPayload) {
          return
        }
        this.setPin(pinPayload.columnKey, pinPayload.pin)
      },
    },
  })

  const createColumnVisibility = (): DataGridFeature<TRow, "columnVisibility", DataGridColumnVisibilityFeatureApi> => columnVisibilityFeature({
    install(ctx) {
      const setVisible = (columnKey: string, visible: boolean): void => {
        ctx.api.columns.setVisibility(columnKey, visible)
      }
      const isVisible = (columnKey: string): boolean => {
        return ctx.api.columns.get(columnKey)?.visible !== false
      }
      const toggleVisible = (columnKey: string): boolean => {
        const nextVisible = !isVisible(columnKey)
        setVisible(columnKey, nextVisible)
        return nextVisible
      }
      const getHiddenColumns = (): readonly string[] => {
        return ctx.api.columns.getSnapshot().columns
          .filter(column => !column.visible)
          .map(column => column.key)
      }
      const showAll = (): void => {
        for (const column of ctx.api.columns.getSnapshot().columns) {
          if (!column.visible) {
            setVisible(column.key, true)
          }
        }
      }
      return {
        setVisible,
        isVisible,
        toggleVisible,
        getHiddenColumns,
        showAll,
      }
    },
    on: {
      "column-visibility"(payload) {
        const visibilityPayload = resolveColumnVisibilityPayload(payload)
        if (!visibilityPayload) {
          return
        }
        this.setVisible(visibilityPayload.columnKey, visibilityPayload.visible)
      },
      "column-visibility:toggle"(payload) {
        const columnKey = resolveColumnKeyPayload(payload)
        if (!columnKey) {
          return
        }
        this.toggleVisible(columnKey)
      },
    },
  })

  const createColumnAutosize = (): DataGridFeature<TRow, "columnAutosize", DataGridColumnAutosizeFeatureApi> => columnAutosizeFeature({
    install(ctx) {
      const defaults = {
        minWidth: Math.max(48, Math.trunc(options.columnAutosize?.minWidth ?? 64)),
        maxWidth: Math.max(96, Math.trunc(options.columnAutosize?.maxWidth ?? 640)),
        maxRows: Math.max(1, Math.trunc(options.columnAutosize?.maxRows ?? 400)),
        charWidth: Math.max(4, Math.trunc(options.columnAutosize?.charWidth ?? 8)),
        padding: Math.max(8, Math.trunc(options.columnAutosize?.padding ?? 28)),
      }
      const estimateWidth = (columnKey: string): number | null => {
        const column = resolveColumnFromRuntimeSnapshot(ctx, columnKey)
        if (!column) {
          return null
        }
        const rowCount = Math.min(defaults.maxRows, Math.max(0, ctx.api.rows.getCount()))
        const headerLabel = column.column.label?.trim() || column.key
        let maxChars = headerLabel.length
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
          const row = ctx.api.rows.get(rowIndex)?.row as Record<string, unknown> | undefined
          if (!row) {
            continue
          }
          const cellText = options.resolveCellTextValue?.(row[columnKey], columnKey) ?? resolveTextValue(row[columnKey])
          if (cellText.length > maxChars) {
            maxChars = cellText.length
          }
        }
        const bounds = resolveColumnWidthBounds(column, {
          minWidth: defaults.minWidth,
          maxWidth: defaults.maxWidth,
        })
        const measured = Math.trunc(maxChars * defaults.charWidth + defaults.padding)
        return Math.max(bounds.minWidth, Math.min(bounds.maxWidth, measured))
      }
      const autosizeColumn = (columnKey: string): number | null => {
        const width = estimateWidth(columnKey)
        if (!Number.isFinite(width)) {
          return null
        }
        ctx.api.columns.setWidth(columnKey, width)
        return width
      }
      const autosizeColumns = (columnKeys?: readonly string[]): readonly string[] => {
        const keys = columnKeys ?? ctx.runtime.columnSnapshot.value.visibleColumns.map(column => column.key)
        const resized: string[] = []
        for (const key of keys) {
          if (autosizeColumn(key) != null) {
            resized.push(key)
          }
        }
        return resized
      }
      return {
        estimateWidth,
        autosizeColumn,
        autosizeColumns,
      }
    },
    on: {
      "column-autosize"(payload) {
        const columnKey = resolveColumnKeyPayload(payload)
        if (!columnKey) {
          return
        }
        this.autosizeColumn(columnKey)
      },
      "columns-autosize"(payload) {
        if (Array.isArray(payload)) {
          this.autosizeColumns(payload.filter((entry): entry is string => typeof entry === "string"))
          return
        }
        this.autosizeColumns()
      },
    },
  })

  const createColumnMenu = (): DataGridFeature<TRow, "columnMenu", DataGridColumnMenuFeatureApi> => columnMenuFeature({
    install() {
      const state = ref<{
        open: boolean
        columnKey: string | null
        anchor: { x: number; y: number } | null
      }>({
        open: false,
        columnKey: null,
        anchor: null,
      })
      return {
        state,
        open: (columnKey, anchor = null) => {
          state.value = {
            open: true,
            columnKey,
            anchor,
          }
        },
        close: () => {
          state.value = {
            ...state.value,
            open: false,
          }
        },
        toggle: (columnKey, anchor = null) => {
          const isSameColumn = state.value.columnKey === columnKey
          if (state.value.open && isSameColumn) {
            state.value = {
              ...state.value,
              open: false,
            }
            return
          }
          state.value = {
            open: true,
            columnKey,
            anchor,
          }
        },
      }
    },
    on: {
      "column-menu:open"(payload) {
        const menuPayload = resolveColumnMenuPayload(payload)
        if (!menuPayload) {
          return
        }
        this.open(menuPayload.columnKey, menuPayload.anchor ?? null)
      },
      "column-menu:close"() {
        this.close()
      },
      "column-menu:toggle"(payload) {
        const menuPayload = resolveColumnMenuPayload(payload)
        if (!menuPayload) {
          return
        }
        this.toggle(menuPayload.columnKey, menuPayload.anchor ?? null)
      },
    },
  })

  const installColumnResizeApi = (ctx: GridContext<TRow>): DataGridColumnResizeFeatureApi => {
    return {
      setWidth: (columnKey, width) => {
        ctx.api.columns.setWidth(columnKey, width)
      },
      getWidth: (columnKey) => {
        return ctx.api.columns.get(columnKey)?.width ?? null
      },
      resetWidth: (columnKey) => {
        ctx.api.columns.setWidth(columnKey, null)
      },
    }
  }

  const onColumnResize = {
    "column-resize"(payload: unknown) {
      const resizePayload = resolveColumnResizePayload(payload)
      if (!resizePayload) {
        return
      }
      this.setWidth(resizePayload.columnKey, resizePayload.width)
    },
  } satisfies {
    "column-resize": (this: DataGridColumnResizeFeatureApi, payload: unknown) => void
  }

  const createColumnResize = (): DataGridFeature<TRow, "columnResize", DataGridColumnResizeFeatureApi> => columnResizeFeature({
    install(ctx) {
      return installColumnResizeApi(ctx)
    },
    on: onColumnResize,
  })

  const createResize = (): DataGridFeature<TRow, "resize", DataGridColumnResizeFeatureApi> => resizeFeature({
    install(ctx) {
      return installColumnResizeApi(ctx)
    },
    on: onColumnResize,
  })

  const createColumnReorder = (): DataGridFeature<TRow, "columnReorder", DataGridColumnReorderFeatureApi> => columnReorderFeature({
    install(ctx) {
      const getOrder = (): readonly string[] => ctx.api.columns.getSnapshot().order
      const setOrder = (order: readonly string[]): void => {
        ctx.api.columns.setOrder(order)
      }
      const moveColumn = (columnKey: string, toIndex: number): boolean => {
        const currentOrder = getOrder()
        if (!currentOrder.includes(columnKey)) {
          return false
        }
        const nextOrder = currentOrder.filter(key => key !== columnKey)
        const safeIndex = clamp(toIndex, 0, nextOrder.length)
        nextOrder.splice(safeIndex, 0, columnKey)
        setOrder(nextOrder)
        return true
      }
      return {
        getOrder,
        setOrder,
        moveColumn,
      }
    },
    on: {
      "column-reorder"(payload) {
        const reorderPayload = resolveColumnReorderPayload(payload)
        if (!reorderPayload) {
          return
        }
        this.setOrder(reorderPayload.order)
      },
      "column-move"(payload) {
        const movePayload = resolveColumnMovePayload(payload)
        if (!movePayload) {
          return
        }
        this.moveColumn(movePayload.columnKey, movePayload.toIndex)
      },
    },
  })

  const createColumnVirtualization = (): DataGridFeature<TRow, "columnVirtualization", DataGridColumnVirtualizationFeatureApi> => columnVirtualizationFeature({
    install(ctx) {
      const viewportService = ctx.runtime.core.getService("viewport") as {
        setColumnVirtualizationEnabled?: (enabled: boolean) => void
        setHorizontalVirtualizationEnabled?: (enabled: boolean) => void
        getColumnVirtualizationEnabled?: () => boolean
        getHorizontalVirtualizationEnabled?: () => boolean
      }
      const enabled = ref(
        viewportService.getColumnVirtualizationEnabled?.()
        ?? viewportService.getHorizontalVirtualizationEnabled?.()
        ?? true,
      )
      const setEnabled = (next: boolean): void => {
        enabled.value = next
        viewportService.setColumnVirtualizationEnabled?.(next)
        viewportService.setHorizontalVirtualizationEnabled?.(next)
        ctx.emit("column-virtualization:changed", { enabled: next })
      }
      const getEnabled = (): boolean => enabled.value
      return {
        enabled,
        setEnabled,
        getEnabled,
      }
    },
    on: {
      "column-virtualization"(payload) {
        const enabled = resolveBooleanPayload(payload)
        if (enabled == null) {
          return
        }
        this.setEnabled(enabled)
      },
    },
  })

  const createRowHeight = (): DataGridFeature<TRow, "rowHeight", DataGridRowHeightFeatureApi> => rowHeightFeature({
    install(ctx) {
      const mode = ref<"fixed" | "auto">("fixed")
      const base = ref(24)
      return {
        mode,
        base,
        setMode: (nextMode) => {
          mode.value = nextMode
          ctx.api.view.setRowHeightMode(nextMode)
        },
        setBase: (height) => {
          const nextHeight = Math.max(8, Math.trunc(height))
          base.value = nextHeight
          ctx.api.view.setBaseRowHeight(nextHeight)
        },
        measure: () => {
          ctx.api.view.measureRowHeight()
        },
        setOverride: (rowIndex, height) => {
          const nextHeight = typeof height === "number" ? Math.max(0, Math.trunc(height)) : null
          ctx.api.view.setRowHeightOverride(rowIndex, nextHeight)
        },
        getOverride: (rowIndex) => {
          return ctx.api.view.getRowHeightOverride(rowIndex)
        },
        clearOverrides: () => {
          ctx.api.view.clearRowHeightOverrides()
        },
      }
    },
  })

  const createServerSideRowModel = (): DataGridFeature<TRow, "serverSideRowModel", DataGridServerSideRowModelFeatureApi> => serverSideRowModelFeature({
    install(ctx) {
      const kind = computed<DataGridRowModelKind>(() => ctx.api.meta.getRowModelKind())
      return {
        kind,
        isServerModel: () => kind.value === "server",
        refresh: () => {
          void ctx.api.view.refresh()
        },
        pause: () => ctx.api.data.pause(),
        resume: () => ctx.api.data.resume(),
        flush: () => ctx.api.data.flush(),
      }
    },
  })

  const createRowSelectionModes = (): DataGridFeature<TRow, "rowSelectionModes", DataGridRowSelectionModesFeatureApi> => rowSelectionModesFeature({
    install() {
      const mode = ref<DataGridRowSelectionMode>("multiple")
      return {
        mode,
        setMode: (nextMode) => {
          mode.value = nextMode
        },
        getMode: () => mode.value,
      }
    },
  })

  const createSelectionOverlay = (): DataGridFeature<TRow, "selectionOverlay", DataGridSelectionOverlayFeatureApi> => selectionOverlayFeature({
    install(ctx) {
      const resolveSelection = (): DataGridSelectionFeatureApi | null => {
        const feature = ctx.features.get("selection")
        return feature && typeof feature === "object" ? feature as DataGridSelectionFeatureApi : null
      }
      const overlays = ref<readonly DataGridSelectionOverlayRect[]>([])
      const refresh = (): readonly DataGridSelectionOverlayRect[] => {
        const snapshot = resolveSelection()?.getSnapshot()
        if (!snapshot || snapshot.ranges.length === 0) {
          overlays.value = []
          return overlays.value
        }
        overlays.value = snapshot.ranges.map(range => ({
          startRow: range.startRow,
          endRow: range.endRow,
          startColumn: range.startCol,
          endColumn: range.endCol,
        }))
        return overlays.value
      }
      refresh()
      return {
        overlays,
        refresh,
      }
    },
  })

  const createExport = (): DataGridFeature<TRow, "export", DataGridExportFeatureApi> => dataExportFeature({
    install(ctx) {
      const exportCsv = async (
        params: { delimiter?: string; includeHeaders?: boolean } = {},
      ): Promise<DataGridExportPayload> => {
        const delimiter = params.delimiter ?? ","
        const includeHeaders = params.includeHeaders ?? true
        const columns = resolveVisibleColumnsWithLabels(ctx).map(column => ({
          key: column.key,
          label: column.label,
        }))
        const rows = resolveExportRows(ctx)
        const context: DataGridExportContext<TRow> = {
          rows,
          columns,
          delimiter,
          includeHeaders,
        }
        if (options.resolveExportCsv) {
          return normalizeExportPayload(
            await options.resolveExportCsv(context),
            "datagrid.csv",
            "text/csv;charset=utf-8",
          )
        }
        const table: string[][] = []
        if (includeHeaders) {
          table.push(columns.map(column => column.label))
        }
        for (const row of rows) {
          const rowRecord = row as Record<string, unknown>
          table.push(columns.map(column => (
            options.resolveCellTextValue?.(rowRecord[column.key], column.key)
            ?? resolveTextValue(rowRecord[column.key])
          )))
        }
        return {
          text: serializeDelimitedTable(table, delimiter),
          fileName: "datagrid.csv",
          mimeType: "text/csv;charset=utf-8",
        }
      }
      return {
        exportCsv,
        downloadCsv: async (fileName = "datagrid.csv") => {
          const payload = await exportCsv({ delimiter: ",", includeHeaders: true })
          const withFileName = {
            ...payload,
            fileName,
          }
          downloadTextFile(withFileName)
          return withFileName
        },
      }
    },
  })

  const createExportExcel = (): DataGridFeature<TRow, "exportExcel", DataGridExportExcelFeatureApi> => exportExcelFeature({
    install(ctx) {
      const exportExcel = async (
        params: { delimiter?: string; includeHeaders?: boolean } = {},
      ): Promise<DataGridExportPayload> => {
        const delimiter = params.delimiter ?? "\t"
        const includeHeaders = params.includeHeaders ?? true
        const columns = resolveVisibleColumnsWithLabels(ctx).map(column => ({
          key: column.key,
          label: column.label,
        }))
        const rows = resolveExportRows(ctx)
        const context: DataGridExportContext<TRow> = {
          rows,
          columns,
          delimiter,
          includeHeaders,
        }
        if (options.resolveExportExcel) {
          return normalizeExportPayload(
            await options.resolveExportExcel(context),
            "datagrid.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          )
        }
        const table: string[][] = []
        if (includeHeaders) {
          table.push(columns.map(column => column.label))
        }
        for (const row of rows) {
          const rowRecord = row as Record<string, unknown>
          table.push(columns.map(column => (
            options.resolveCellTextValue?.(rowRecord[column.key], column.key)
            ?? resolveTextValue(rowRecord[column.key])
          )))
        }
        return {
          text: serializeDelimitedTable(table, delimiter),
          fileName: "datagrid.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      }
      return {
        exportExcel,
        downloadExcel: async (fileName = "datagrid.xlsx") => {
          const payload = await exportExcel({ delimiter: "\t", includeHeaders: true })
          const withFileName = {
            ...payload,
            fileName,
          }
          downloadTextFile(withFileName)
          return withFileName
        },
      }
    },
  })

  const createCellEditors = (): DataGridFeature<TRow, "cellEditors", DataGridCellEditorsFeatureApi<TRow>> => cellEditorsFeature({
    install(ctx) {
      const activeCell = ref<DataGridCellEditorsActiveCell | null>(null)

      const isEditing = (): boolean => activeCell.value !== null
      const getActiveCell = (): DataGridCellEditorsActiveCell | null => activeCell.value
      const startEdit = (rowIndex: number, columnKey: string): boolean => {
        if (ctx.api.rows.get(rowIndex) == null || ctx.api.columns.get(columnKey) == null) {
          return false
        }
        activeCell.value = { rowIndex, columnKey }
        return true
      }
      const commitEdit = (value: unknown, options: { emit?: boolean; reapply?: boolean } = {}): boolean => {
        if (!ctx.api.rows.hasPatchSupport() || !activeCell.value) {
          return false
        }
        const rowNode = ctx.api.rows.get(activeCell.value.rowIndex)
        if (!rowNode) {
          return false
        }
        try {
          const patch = {
            [activeCell.value.columnKey]: value,
          } as Partial<TRow> & Record<string, unknown>
          ctx.api.rows.applyEdits(
            [{ rowId: rowNode.rowId, data: patch }],
            {
              emit: options.emit ?? true,
              reapply: options.reapply ?? true,
            },
          )
          activeCell.value = null
          return true
        } catch {
          return false
        }
      }
      const cancelEdit = (): void => {
        activeCell.value = null
      }

      return {
        isEditing,
        getActiveCell,
        startEdit,
        commitEdit,
        cancelEdit,
      }
    },
    on: {
      "cell-edit:start"(payload) {
        const editPayload = resolveCellEditStartPayload(payload)
        if (!editPayload) {
          return
        }
        this.startEdit(editPayload.rowIndex, editPayload.columnKey)
      },
      "cell-edit:commit"(payload) {
        const commitPayload = resolveCellEditCommitPayload(payload)
        if (!commitPayload) {
          return
        }
        this.commitEdit(commitPayload.value, {
          emit: commitPayload.emit,
          reapply: commitPayload.reapply,
        })
      },
      "cell-edit:cancel"() {
        this.cancelEdit()
      },
    },
  })

  const createKeyboard = (): DataGridFeature<TRow, "keyboard", DataGridKeyboardFeatureApi> => keyboardFeature({
    install(ctx) {
      const resolveFeature = <T,>(name: string): T | null => {
        const feature = ctx.features.get(name)
        if (!feature || typeof feature !== "object") {
          return null
        }
        return feature as T
      }

      const handleKeydown = async (event: KeyboardEvent): Promise<boolean> => {
        const ctrlOrMeta = event.metaKey || event.ctrlKey
        const key = event.key.toLowerCase()
        const clipboard = resolveFeature<DataGridClipboardFeatureApi>("clipboard")
        const history = resolveFeature<DataGridHistoryFeatureApi>("history")
        const fillHandle = resolveFeature<DataGridFillHandleFeatureApi>("fillHandle")
        const navigation = resolveFeature<DataGridNavigationFeatureApi>("navigation")
        const selection = resolveFeature<DataGridSelectionFeatureApi>("selection")

        if (ctrlOrMeta && key === "c" && clipboard) {
          event.preventDefault()
          await clipboard.copy()
          return true
        }

        if (ctrlOrMeta && key === "x" && clipboard) {
          event.preventDefault()
          await clipboard.cut()
          return true
        }

        if (ctrlOrMeta && key === "v" && clipboard) {
          event.preventDefault()
          await clipboard.paste()
          return true
        }

        if (ctrlOrMeta && key === "d" && fillHandle) {
          event.preventDefault()
          fillHandle.fillSelection()
          return true
        }

        if (ctrlOrMeta && key === "z") {
          if (!history?.supported()) {
            return false
          }
          event.preventDefault()
          if (event.shiftKey) {
            await history.redo()
            return true
          }
          await history.undo()
          return true
        }

        if (ctrlOrMeta && key === "y") {
          if (!history?.supported()) {
            return false
          }
          event.preventDefault()
          await history.redo()
          return true
        }

        if (event.key === "Delete" || event.key === "Backspace") {
          if (!clipboard) {
            return false
          }
          event.preventDefault()
          clipboard.clear()
          return true
        }

        if (event.key === "Escape") {
          if (!selection) {
            return false
          }
          event.preventDefault()
          selection.clear()
          return true
        }

        if (navigation?.handleKeydown(event)) {
          event.preventDefault()
          return true
        }

        return false
      }

      return {
        handleKeydown,
      }
    },
    on: {
      keydown(payload) {
        const event = resolveKeyboardEventPayload(payload)
        if (!event) {
          return
        }
        void this.handleKeydown(event)
      },
    },
  })

  return {
    selection: createSelection,
    clipboard: createClipboard,
    advancedClipboard: createAdvancedClipboard,
    excelCompatibleClipboard: createExcelCompatibleClipboard,
    fill: createFillHandle,
    fillHandle: createFillHandle,
    navigation: createNavigation,
    keyboard: createKeyboard,
    history: createHistory,
    sorting: createSorting,
    pivot: createPivot,
    advancedPivotEngine: createAdvancedPivotEngine,
    pivotPanel: createPivotPanel,
    grouping: createGrouping,
    groupPanel: createGroupPanel,
    aggregation: createAggregation,
    aggregationFunctionsRegistry: createAggregationFunctionsRegistry,
    filterDsl: createFilterDsl,
    filterBuilderUI: createFilterBuilderUi,
    columnPinning: createColumnPinning,
    columnVisibility: createColumnVisibility,
    columnAutosize: createColumnAutosize,
    columnMenu: createColumnMenu,
    columnResize: createColumnResize,
    columnReorder: createColumnReorder,
    columnVirtualization: createColumnVirtualization,
    cellEditors: createCellEditors,
    serverSideRowModel: createServerSideRowModel,
    rowHeight: createRowHeight,
    rowSelectionModes: createRowSelectionModes,
    selectionOverlay: createSelectionOverlay,
    export: createExport,
    exportExcel: createExportExcel,
    rangeMove: () => rangeMoveFeature<unknown, TRow>({ install: () => true }),
    pointerPreview: () => pointerPreviewFeature<unknown, TRow>({ install: () => true }),
    autoScroll: () => autoScrollFeature<unknown, TRow>({ install: () => true }),
    resize: createResize,
  }
}
