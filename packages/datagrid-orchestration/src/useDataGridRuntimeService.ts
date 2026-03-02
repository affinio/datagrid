import type {
  DataGridColumnDef,
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
  ) => void
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
  ) => void
  setColumns: (columns: readonly DataGridColumnDef[]) => void
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

function stableSerializeUnknown(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerializeUnknown).join(",")}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerializeUnknown(nested)}`)
  return `{${entries.join(",")}}`
}

function cloneColumnDef(column: DataGridColumnDef): DataGridColumnDef {
  return {
    ...column,
    meta: column.meta ? { ...column.meta } : undefined,
  }
}

function serializeBaseColumnsSignature(columns: readonly DataGridColumnDef[]): string {
  return columns
    .map((column) => {
      return [
        column.key,
        column.label ?? "",
        column.width ?? "",
        column.minWidth ?? "",
        column.maxWidth ?? "",
        column.visible === false ? "0" : "1",
        column.pin ?? "none",
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

function createPivotColumnDef(column: DataGridPivotColumn): DataGridColumnDef {
  return {
    key: column.id,
    label: column.label,
    visible: true,
    pin: "none",
    meta: {
      affinoPivot: true,
      valueField: column.valueField,
      agg: column.agg,
      columnPath: column.columnPath.map(segment => ({
        field: segment.field,
        value: segment.value,
      })),
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
  column: DataGridColumnDef,
  state: ColumnStateSnapshot | undefined,
): DataGridColumnDef {
  if (!state) {
    return column
  }
  return {
    ...column,
    visible: state.visible,
    pin: state.pin,
    width: state.width,
  }
}

function buildEffectiveColumns(
  baseColumns: readonly DataGridColumnDef[],
  pivotColumns: readonly DataGridPivotColumn[],
  stateByKey: ReadonlyMap<string, ColumnStateSnapshot>,
): DataGridColumnDef[] {
  const seen = new Set<string>()
  const effective: DataGridColumnDef[] = []

  for (const baseColumn of baseColumns) {
    const normalized = cloneColumnDef(baseColumn)
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
    const columnDef = createPivotColumnDef(pivotColumn)
    effective.push(applyPersistedColumnState(columnDef, stateByKey.get(columnDef.key)))
  }

  return effective
}

export function useDataGridRuntimeService<TRow = unknown>(
  options: UseDataGridRuntimeServiceOptions<TRow>,
): UseDataGridRuntimeServiceResult<TRow> {
  const runtime = createDataGridRuntime(options)
  const { rowModel, columnModel, core, api } = runtime
  let baseColumns: DataGridColumnDef[] = Array.isArray(options.columns)
    ? options.columns.map(cloneColumnDef)
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
    if (!isMutableRowsModel(rowModel)) {
      return
    }
    rowModel.setRows(rows)
    recomputeVirtualWindow()
  }

  function patchRows(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) {
    if (!isMutableRowsModel(rowModel) || typeof rowModel.patchRows !== "function") {
      return
    }
    rowModel.patchRows(updates, options)
    recomputeVirtualWindow()
  }

  function setColumns(columns: readonly DataGridColumnDef[]) {
    baseColumns = Array.isArray(columns)
      ? columns.map(cloneColumnDef)
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

  function syncRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[] {
    api.view.setViewportRange(range)
    const rows = api.rows.getRange(range)
    recomputeVirtualWindow()
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
    start,
    stop,
    syncRowsInRange,
    isStarted: () => started,
    isDisposed: () => disposed,
  }
}
