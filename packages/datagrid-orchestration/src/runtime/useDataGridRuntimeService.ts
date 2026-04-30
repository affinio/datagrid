import type {
  DataGridColumnDef,
  DataGridColumnInput,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridPivotColumn,
  DataGridRowNode,
  DataGridRowModel,
  DataGridViewportRange,
} from "@affino/datagrid-core"
import { createDataGridRuntime, type CreateDataGridRuntimeOptions, type DataGridRuntime } from "./createDataGridRuntime"

type MutableRowsRowModel<TRow> = DataGridRowModel<TRow> & {
  setRows: (rows: readonly TRow[]) => void
  patchRows?: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void | Promise<void>
}

function isMutableRowsModel<TRow>(model: DataGridRowModel<TRow>): model is MutableRowsRowModel<TRow> {
  return typeof (model as { setRows?: unknown }).setRows === "function"
}

export interface UseDataGridRuntimeServiceOptions<TRow = unknown> extends CreateDataGridRuntimeOptions<TRow> {}

export interface DataGridRuntimeVirtualWindowSnapshot {
  rowStart: number
  rowEnd: number
  rowTotal: number
  colStart: number
  colEnd: number
  colTotal: number
  overscan: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

export interface UseDataGridRuntimeServiceResult<TRow = unknown> extends DataGridRuntime<TRow> {
  getColumnSnapshot: () => DataGridColumnModelSnapshot
  subscribeColumnSnapshot: (listener: (snapshot: DataGridColumnModelSnapshot) => void) => () => void
  getVirtualWindowSnapshot: () => DataGridRuntimeVirtualWindowSnapshot | null
  subscribeVirtualWindow: (
    listener: (snapshot: DataGridRuntimeVirtualWindowSnapshot | null) => void,
  ) => () => void
  setRows: (rows: readonly TRow[]) => void
  patchRows: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void | Promise<void>
  setColumns: (columns: readonly DataGridColumnInput[]) => void
  setViewportRange: (range: DataGridViewportRange) => void
  setVirtualWindowRange: (range: DataGridViewportRange) => void
  start: () => Promise<void>
  stop: () => void
  syncRowsInRange: (range: DataGridViewportRange) => readonly DataGridRowNode<TRow>[]
  isStarted: () => boolean
  isDisposed: () => boolean
}

function normalizeCount(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.trunc(value as number))
}

function normalizeRange(start: unknown, end: unknown, total: number): { start: number; end: number } {
  if (total <= 0) {
    return { start: 0, end: 0 }
  }
  const safeStart = Math.max(0, Math.min(total - 1, normalizeCount(start)))
  const safeEnd = Math.max(safeStart, Math.min(total - 1, normalizeCount(end)))
  return {
    start: safeStart,
    end: safeEnd,
  }
}

function cloneVirtualWindow(
  snapshot: DataGridRuntimeVirtualWindowSnapshot | null,
): DataGridRuntimeVirtualWindowSnapshot | null {
  if (!snapshot) {
    return null
  }
  return {
    rowStart: snapshot.rowStart,
    rowEnd: snapshot.rowEnd,
    rowTotal: snapshot.rowTotal,
    colStart: snapshot.colStart,
    colEnd: snapshot.colEnd,
    colTotal: snapshot.colTotal,
    overscan: {
      top: snapshot.overscan.top,
      bottom: snapshot.overscan.bottom,
      left: snapshot.overscan.left,
      right: snapshot.overscan.right,
    },
  }
}

function isSameVirtualWindow(
  left: DataGridRuntimeVirtualWindowSnapshot | null,
  right: DataGridRuntimeVirtualWindowSnapshot | null,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  return (
    left.rowStart === right.rowStart &&
    left.rowEnd === right.rowEnd &&
    left.rowTotal === right.rowTotal &&
    left.colStart === right.colStart &&
    left.colEnd === right.colEnd &&
    left.colTotal === right.colTotal &&
    left.overscan.top === right.overscan.top &&
    left.overscan.bottom === right.overscan.bottom &&
    left.overscan.left === right.overscan.left &&
    left.overscan.right === right.overscan.right
  )
}

function stableSerializeUnknown(value: unknown, active = new WeakSet<object>()): string {
  if (value == null) {
    return JSON.stringify(value)
  }
  if (typeof value === "bigint") {
    return JSON.stringify(`${value}n`)
  }
  if (typeof value === "function") {
    return JSON.stringify(`[Function:${value.name || "anonymous"}]`)
  }
  if (typeof value === "symbol") {
    return JSON.stringify(String(value))
  }
  if (typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  if (value instanceof RegExp) {
    return JSON.stringify(String(value))
  }
  if (active.has(value)) {
    return JSON.stringify("[Circular]")
  }
  active.add(value)
  try {
    if (Array.isArray(value)) {
      return `[${value.map(entry => stableSerializeUnknown(entry, active)).join(",")}]`
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerializeUnknown(nested, active)}`)
    return `{${entries.join(",")}}`
  } finally {
    active.delete(value)
  }
}

function cloneColumnInput(column: DataGridColumnInput): DataGridColumnInput {
  return {
    ...column,
    initialState: column.initialState ? { ...column.initialState } : undefined,
    presentation: column.presentation ? { ...column.presentation } : undefined,
    capabilities: column.capabilities ? { ...column.capabilities } : undefined,
    constraints: column.constraints ? { ...column.constraints } : undefined,
    meta: column.meta ? { ...column.meta } : undefined,
  }
}

function serializeBaseColumnsSignature(columns: readonly DataGridColumnInput[]): string {
  return columns
    .map((column) => {
      return [
        column.key,
        column.field ?? "",
        column.label ?? "",
        column.dataType ?? "",
        column.minWidth ?? "",
        column.maxWidth ?? "",
        stableSerializeUnknown(column.presentation ?? null),
        stableSerializeUnknown(column.capabilities ?? null),
        stableSerializeUnknown(column.constraints ?? null),
        typeof column.valueGetter === "function" ? "getter:1" : "getter:0",
        typeof column.valueSetter === "function" ? "setter:1" : "setter:0",
        stableSerializeUnknown(column.meta ?? null),
      ].join("|")
    })
    .join("||")
}

function serializePivotColumnsSignature(columns: readonly DataGridPivotColumn[]): string {
  return columns
    .map((column) => {
      const path = column.columnPath
        .map(segment => `${segment.field}=${segment.value}`)
        .join(">")
      return [
        column.id,
        column.valueField,
        column.agg,
        column.label,
        path,
      ].join("|")
    })
    .join("||")
}

function buildSourceColumnLabelsByKey(
  baseColumns: readonly DataGridColumnInput[],
): ReadonlyMap<string, string> {
  return new Map(
    baseColumns.map(column => [column.key, column.label ?? column.key] as const),
  )
}

function resolvePivotValueLabel(
  column: DataGridPivotColumn,
  sourceColumnLabelsByKey: ReadonlyMap<string, string>,
): string {
  const fieldLabel = sourceColumnLabelsByKey.get(column.valueField) ?? column.valueField
  return column.agg === "sum" ? fieldLabel : `${column.agg.toUpperCase()} ${fieldLabel}`
}

function createPivotHeaderMeta(
  column: DataGridPivotColumn,
  sourceColumnLabelsByKey: ReadonlyMap<string, string>,
  hasSingleMetric: boolean,
): Record<string, unknown> {
  const pathLabels = column.columnPath
    .map(segment => segment.value)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
  const valueLabel = resolvePivotValueLabel(column, sourceColumnLabelsByKey)
  let groupLabels: string[] = []
  let leafLabel = column.label
  let kind = "value"

  if (column.grandTotal) {
    kind = "grand-total"
    leafLabel = hasSingleMetric ? "Total" : `Total ${valueLabel}`
  } else if (column.subtotal) {
    kind = "subtotal"
    const subtotalLabels = pathLabels.length > 0
      ? [...pathLabels.slice(0, -1), `${pathLabels[pathLabels.length - 1]} subtotal`]
      : []
    if (hasSingleMetric) {
      groupLabels = subtotalLabels.slice(0, -1)
      leafLabel = subtotalLabels[subtotalLabels.length - 1] ?? "Subtotal"
    } else {
      groupLabels = subtotalLabels
      leafLabel = valueLabel
    }
  } else if (pathLabels.length === 0) {
    leafLabel = valueLabel
  } else if (hasSingleMetric) {
    groupLabels = pathLabels.slice(0, -1)
    leafLabel = pathLabels[pathLabels.length - 1] ?? valueLabel
  } else {
    groupLabels = pathLabels
    leafLabel = valueLabel
  }

  return {
    fullLabel: column.label,
    groupLabel: groupLabels[0],
    groupLabels,
    leafLabel,
    pathLabels,
    valueLabel,
    kind,
  }
}

function createPivotColumnDef(
  column: DataGridPivotColumn,
  sourceColumnLabelsByKey: ReadonlyMap<string, string>,
  hasSingleMetric: boolean,
): DataGridColumnDef {
  return {
    key: column.id,
    label: column.label,
    meta: {
      affinoPivot: true,
      valueField: column.valueField,
      agg: column.agg,
      columnPath: column.columnPath.map(segment => ({
        field: segment.field,
        value: segment.value,
      })),
      affinoPivotHeader: createPivotHeaderMeta(column, sourceColumnLabelsByKey, hasSingleMetric),
    },
  }
}

interface ColumnStateSnapshot {
  visible: boolean
  pin: DataGridColumnPin
  width: number | undefined
}

function buildColumnStateByKey(snapshot: DataGridColumnModelSnapshot): Map<string, ColumnStateSnapshot> {
  const stateByKey = new Map<string, ColumnStateSnapshot>()
  for (const column of snapshot.columns) {
    stateByKey.set(column.key, {
      visible: column.visible,
      pin: column.pin,
      width: column.width ?? undefined,
    })
  }
  return stateByKey
}

function applyPersistedColumnState(
  column: DataGridColumnInput,
  state: ColumnStateSnapshot | undefined,
): DataGridColumnInput {
  if (!state) {
    return column
  }
  return {
    ...column,
    initialState: {
      visible: state.visible,
      pin: state.pin,
      width: state.width,
    },
  }
}

function buildEffectiveColumns(
  baseColumns: readonly DataGridColumnInput[],
  pivotColumns: readonly DataGridPivotColumn[],
  stateByKey: ReadonlyMap<string, ColumnStateSnapshot>,
): DataGridColumnInput[] {
  const seen = new Set<string>()
  const effective: DataGridColumnInput[] = []
  const sourceColumnLabelsByKey = buildSourceColumnLabelsByKey(baseColumns)
  const metricKeys = new Set(pivotColumns.map(column => `${column.valueField}:${column.agg}`))
  const hasSingleMetric = metricKeys.size <= 1

  for (const baseColumn of baseColumns) {
    const normalized = cloneColumnInput(baseColumn)
    if (!normalized.key || seen.has(normalized.key)) {
      continue
    }
    seen.add(normalized.key)
    effective.push(applyPersistedColumnState(normalized, stateByKey.get(normalized.key)))
  }

  for (const pivotColumn of pivotColumns) {
    if (!pivotColumn.id || seen.has(pivotColumn.id)) {
      continue
    }
    seen.add(pivotColumn.id)
    const columnDef = createPivotColumnDef(pivotColumn, sourceColumnLabelsByKey, hasSingleMetric)
    effective.push(applyPersistedColumnState(columnDef, stateByKey.get(columnDef.key)))
  }

  return effective
}

export function useDataGridRuntimeService<TRow = unknown>(
  options: UseDataGridRuntimeServiceOptions<TRow>,
): UseDataGridRuntimeServiceResult<TRow> {
  const runtime = createDataGridRuntime(options)
  const { rowModel, columnModel, core, api } = runtime
  let baseColumns: DataGridColumnInput[] = Array.isArray(options.columns)
    ? options.columns.map(cloneColumnInput)
    : []
  let lastColumnsSyncSignature = ""

  let started = false
  let disposed = false
  const virtualWindowListeners = new Set<(snapshot: DataGridRuntimeVirtualWindowSnapshot | null) => void>()

  const resolveVirtualWindowFromViewportService = (): DataGridRuntimeVirtualWindowSnapshot | null => {
    const viewportService = core.getService("viewport") as {
      getVirtualWindow?: () => unknown
    }
    const rawWindow = viewportService.getVirtualWindow?.()
    if (!rawWindow || typeof rawWindow !== "object") {
      return null
    }
    const value = rawWindow as Record<string, unknown>
    const rowTotal = normalizeCount(value.rowTotal)
    const colTotal = normalizeCount(value.colTotal)
    const rowRange = normalizeRange(value.rowStart, value.rowEnd, rowTotal)
    const colRange = normalizeRange(value.colStart, value.colEnd, colTotal)
    const overscanSource = value.overscan as Record<string, unknown> | undefined
    return {
      rowStart: rowRange.start,
      rowEnd: rowRange.end,
      rowTotal,
      colStart: colRange.start,
      colEnd: colRange.end,
      colTotal,
      overscan: {
        top: normalizeCount(overscanSource?.top),
        bottom: normalizeCount(overscanSource?.bottom),
        left: normalizeCount(overscanSource?.left),
        right: normalizeCount(overscanSource?.right),
      },
    }
  }

  const buildFallbackVirtualWindow = (): DataGridRuntimeVirtualWindowSnapshot => {
    const rowSnapshot = rowModel.getSnapshot()
    const rowTotal = normalizeCount(rowSnapshot.rowCount)
    const rowRange = normalizeRange(rowSnapshot.viewportRange.start, rowSnapshot.viewportRange.end, rowTotal)
    const colTotal = normalizeCount(columnModel.getSnapshot().visibleColumns.length)
    const colRange = normalizeRange(0, Math.max(0, colTotal - 1), colTotal)
    return {
      rowStart: rowRange.start,
      rowEnd: rowRange.end,
      rowTotal,
      colStart: colRange.start,
      colEnd: colRange.end,
      colTotal,
      overscan: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    }
  }

  const resolveVirtualWindowSnapshot = (): DataGridRuntimeVirtualWindowSnapshot => (
    resolveVirtualWindowFromViewportService() ?? buildFallbackVirtualWindow()
  )

  let virtualWindowSnapshot: DataGridRuntimeVirtualWindowSnapshot | null = resolveVirtualWindowSnapshot()

  const emitVirtualWindow = () => {
    for (const listener of virtualWindowListeners) {
      listener(cloneVirtualWindow(virtualWindowSnapshot))
    }
  }

  const recomputeVirtualWindow = () => {
    const nextSnapshot = resolveVirtualWindowSnapshot()
    if (isSameVirtualWindow(virtualWindowSnapshot, nextSnapshot)) {
      return
    }
    virtualWindowSnapshot = nextSnapshot
    emitVirtualWindow()
  }

  const setVirtualWindowRange = (range: DataGridViewportRange) => {
    if (disposed) {
      return
    }
    const currentSnapshot = virtualWindowSnapshot ?? resolveVirtualWindowSnapshot()
    const rowTotal = currentSnapshot?.rowTotal ?? normalizeCount(rowModel.getRowCount())
    const normalizedRowRange = normalizeRange(range.start, range.end, rowTotal)
    const nextSnapshot: DataGridRuntimeVirtualWindowSnapshot = {
      rowStart: normalizedRowRange.start,
      rowEnd: normalizedRowRange.end,
      rowTotal,
      colStart: currentSnapshot?.colStart ?? 0,
      colEnd: currentSnapshot?.colEnd ?? 0,
      colTotal: currentSnapshot?.colTotal ?? normalizeCount(columnModel.getSnapshot().visibleColumns.length),
      overscan: currentSnapshot?.overscan ?? {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    }
    if (isSameVirtualWindow(virtualWindowSnapshot, nextSnapshot)) {
      return
    }
    virtualWindowSnapshot = nextSnapshot
    emitVirtualWindow()
  }

  const syncColumnsFromRowPivot = (force = false): void => {
    const rowSnapshot = rowModel.getSnapshot()
    const pivotColumns = rowSnapshot.pivotColumns ?? []
    const signature = `${serializeBaseColumnsSignature(baseColumns)}::${serializePivotColumnsSignature(pivotColumns)}`
    if (!force && signature === lastColumnsSyncSignature) {
      return
    }
    const stateByKey = buildColumnStateByKey(columnModel.getSnapshot())
    const effectiveColumns = buildEffectiveColumns(baseColumns, pivotColumns, stateByKey)
    columnModel.setColumns(effectiveColumns)
    lastColumnsSyncSignature = signature
  }

  const unsubscribeRowModel = rowModel.subscribe(() => {
    syncColumnsFromRowPivot()
    recomputeVirtualWindow()
  })
  const unsubscribeColumnModelForWindow = columnModel.subscribe(() => {
    recomputeVirtualWindow()
  })

  function getColumnSnapshot(): DataGridColumnModelSnapshot {
    return api.columns.getSnapshot()
  }

  function subscribeColumnSnapshot(listener: (snapshot: DataGridColumnModelSnapshot) => void): () => void {
    listener(getColumnSnapshot())
    const unsubscribe = columnModel.subscribe(next => {
      listener(next)
    })
    return () => {
      unsubscribe()
    }
  }

  function setRows(rows: readonly TRow[]) {
    if (disposed || !isMutableRowsModel(rowModel)) {
      return
    }
    rowModel.setRows(rows)
    recomputeVirtualWindow()
  }

  function patchRows(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) {
    if (disposed || !isMutableRowsModel(rowModel) || typeof rowModel.patchRows !== "function") {
      return
    }
    rowModel.patchRows(updates, options)
    recomputeVirtualWindow()
  }

  function setColumns(columns: readonly DataGridColumnInput[]) {
    if (disposed) {
      return
    }
    baseColumns = Array.isArray(columns)
      ? columns.map(cloneColumnInput)
      : []
    syncColumnsFromRowPivot(true)
    recomputeVirtualWindow()
  }

  async function start(): Promise<void> {
    if (disposed || started) {
      return
    }
    await api.start()
    started = true
    recomputeVirtualWindow()
  }

  function stop() {
    if (disposed) {
      return
    }
    unsubscribeRowModel()
    unsubscribeColumnModelForWindow()
    virtualWindowListeners.clear()
    void core.dispose()
    started = false
    disposed = true
  }

  function setViewportRange(range: DataGridViewportRange) {
    if (disposed || api.lifecycle.state === "disposed") {
      return
    }
    api.view.setViewportRange(range)
    recomputeVirtualWindow()
  }

  function syncRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[] {
    if (disposed || api.lifecycle.state === "disposed") {
      return []
    }
    setViewportRange(range)
    const rows = rowModel.getRowsInRange(range)
    return rows
  }

  syncColumnsFromRowPivot(true)

  function getVirtualWindowSnapshot(): DataGridRuntimeVirtualWindowSnapshot | null {
    return cloneVirtualWindow(virtualWindowSnapshot)
  }

  function subscribeVirtualWindow(
    listener: (snapshot: DataGridRuntimeVirtualWindowSnapshot | null) => void,
  ): () => void {
    listener(getVirtualWindowSnapshot())
    virtualWindowListeners.add(listener)
    return () => {
      virtualWindowListeners.delete(listener)
    }
  }

  return {
    rowModel,
    columnModel,
    core,
    api,
    getColumnSnapshot,
    subscribeColumnSnapshot,
    getVirtualWindowSnapshot,
    subscribeVirtualWindow,
    setRows,
    patchRows,
    setColumns,
    setViewportRange,
    setVirtualWindowRange,
    start,
    stop,
    syncRowsInRange,
    isStarted: () => started,
    isDisposed: () => disposed,
  }
}
