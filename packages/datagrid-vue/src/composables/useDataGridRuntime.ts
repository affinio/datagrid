import { isRef, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from "vue"
import type {
  DataGridApiCapabilities,
  DataGridApiEventName,
  DataGridApiEventPayload,
  DataGridApiPluginDefinition,
  DataGridApiProjectionMode,
  DataGridApiRuntimeInfo,
  DataGridApiSchemaSnapshot,
  DataGridMigrateStateOptions,
  CreateDataGridCoreOptions,
  DataGridAggregationModel,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridColumnInput,
  DataGridColumnModelSnapshot,
  DataGridRowNode,
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridViewportRange,
  DataGridSetStateOptions,
  DataGridUnifiedState,
} from "@affino/datagrid-core"
import type {
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridPivotLayoutImportOptions,
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import {
  useDataGridRuntimeService,
  type CreateDataGridRuntimeOptions,
  type DataGridRuntimeVirtualWindowSnapshot,
  type DataGridRuntimeOverrides,
} from "@affino/datagrid-orchestration"
import type { DataGridVueRuntime } from "../runtime/createDataGridVueRuntime"

export type {
  DataGridRuntimeVirtualWindowSnapshot,
}

type MaybeRef<T> = T | Ref<T>

function resolveMaybeRef<T>(value: MaybeRef<T>): T {
  return isRef(value) ? value.value : value
}

export interface DataGridEditOptions extends Omit<
  DataGridClientRowPatchOptions,
  "recomputeSort" | "recomputeFilter" | "recomputeGroup"
> {
  /**
   * Excel-style default: freeze sort/filter/group projection during edit patches.
   */
  freezeView?: boolean
  /**
   * Explicitly reapply projection after patch (sort/filter/group).
   */
  reapplyView?: boolean
}

export interface UseDataGridRuntimeOptions<TRow = unknown> {
  rows?: MaybeRef<readonly TRow[]>
  rowModel?: DataGridRowModel<TRow>
  workerOwnedRowModelOptions?: {
    source: unknown
    target: unknown
    channel?: string | null
    initialSnapshot?: DataGridRowModelSnapshot<TRow> | null
    requestInitialSync?: boolean
    viewportCoalescingStrategy?: "split" | "simple"
  }
  plugins?: readonly DataGridApiPluginDefinition<TRow>[]
  clientRowModelOptions?: CreateDataGridRuntimeOptions<TRow>["clientRowModelOptions"]
  columns: MaybeRef<readonly DataGridColumnInput[]>
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
  autoStart?: boolean
}

export interface UseDataGridRuntimeResult<TRow = unknown> extends DataGridVueRuntime<TRow> {
  columnSnapshot: Ref<DataGridColumnModelSnapshot>
  /**
   * Scroll-window snapshot in body-row coordinates only.
   * Pinned top and pinned bottom rows are excluded from rowStart, rowEnd, and rowTotal.
   */
  virtualWindow: Ref<DataGridRuntimeVirtualWindowSnapshot | null>
  /**
   * Partition of the current runtime row model into scrollable body rows and pinned lanes.
   */
  rowPartition: Ref<DataGridRuntimeRowPartitionSnapshot<TRow>>
  setRows: (rows: readonly TRow[]) => void
  setAggregationModel: (aggregationModel: DataGridAggregationModel<TRow> | null) => void
  getAggregationModel: () => DataGridAggregationModel<TRow> | null
  setPivotModel: (pivotModel: DataGridPivotSpec | null) => void
  getPivotModel: () => DataGridPivotSpec | null
  getPivotCellDrilldown: (
    input: DataGridPivotCellDrilldownInput,
  ) => DataGridPivotCellDrilldown<TRow> | null
  exportPivotLayout: () => DataGridPivotLayoutSnapshot<TRow>
  exportPivotInterop: () => DataGridPivotInteropSnapshot<TRow> | null
  importPivotLayout: (
    layout: DataGridPivotLayoutSnapshot<TRow>,
    options?: DataGridPivotLayoutImportOptions,
  ) => void
  patchRows: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void
  applyEdits: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridEditOptions,
  ) => void
  reapplyView: () => void
  autoReapply: Ref<boolean>
  getProjectionMode: () => DataGridApiProjectionMode
  setProjectionMode: (mode: DataGridApiProjectionMode) => DataGridApiProjectionMode
  getSchema: () => DataGridApiSchemaSnapshot
  getApiCapabilities: () => DataGridApiCapabilities
  getRuntimeInfo: () => DataGridApiRuntimeInfo
  registerPlugin: (plugin: DataGridApiPluginDefinition<TRow>) => boolean
  unregisterPlugin: (id: string) => boolean
  hasPlugin: (id: string) => boolean
  listPlugins: () => readonly string[]
  clearPlugins: () => void
  getUnifiedState: () => DataGridUnifiedState<TRow>
  migrateUnifiedState: (
    state: unknown,
    options?: DataGridMigrateStateOptions,
  ) => DataGridUnifiedState<TRow> | null
  setUnifiedState: (state: DataGridUnifiedState<TRow>, options?: DataGridSetStateOptions) => void
  start: () => Promise<void>
  stop: () => void
  syncRowsInRange: (range: DataGridViewportRange) => readonly DataGridRowNode<TRow>[]
  /**
   * Sync rows for a body-relative viewport range.
   * The range must address only scrollable body rows.
   */
  syncBodyRowsInRange: (range: DataGridBodyViewportRange) => readonly DataGridRowNode<TRow>[]
  /**
   * Resolve a scrollable body row by body-relative index.
   */
  getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<TRow> | null
  /**
   * Resolve a scrollable body row index by row id.
   */
  resolveBodyRowIndexById: (rowId: string | number) => number
  /**
   * Set the current body-relative viewport range.
   * Pinned rows are excluded from this coordinate system.
   */
  setViewportRange: (range: DataGridViewportRange) => void
  /**
   * Get the current body-relative viewport range.
   * Pinned rows are excluded from this coordinate system.
   */
  getViewportRange: () => DataGridBodyViewportRange
}

/**
 * Viewport coordinates for the scrollable body lane only.
 * Pinned top and pinned bottom rows never participate in this range.
 */
export type DataGridBodyViewportRange = DataGridViewportRange

export interface DataGridRuntimeRowPartitionSnapshot<TRow = unknown> {
  bodyRowCount: number
  pinnedTopRows: readonly DataGridRowNode<TRow>[]
  pinnedBottomRows: readonly DataGridRowNode<TRow>[]
}

interface DataGridRuntimeResolvedRowPartition<TRow = unknown> {
  bodyRows: (DataGridRowNode<TRow> | undefined)[]
  bodyDisplayIndexes: number[]
  bodyRowIndexById: Map<string | number, number>
  snapshot: DataGridRuntimeRowPartitionSnapshot<TRow>
  signature: string
}

function isWorkerBackedRowModel<TRow>(rowModel: DataGridRowModel<TRow>): boolean {
  return typeof (
    rowModel as DataGridRowModel<TRow> & {
      getWorkerProtocolDiagnostics?: () => unknown
    }
  ).getWorkerProtocolDiagnostics === "function"
}

function isPinnedBodyExcludedRow<TRow>(row: DataGridRowNode<TRow>): boolean {
  return row.state.pinned === "top" || row.state.pinned === "bottom"
}

function normalizeReadableViewportRange(
  range: DataGridViewportRange,
  rowCount: number,
): DataGridViewportRange {
  if (rowCount <= 0) {
    return { start: 0, end: 0 }
  }
  const start = Math.max(0, Math.min(rowCount - 1, Math.trunc(range.start)))
  const end = Math.max(start, Math.min(rowCount - 1, Math.trunc(range.end)))
  return { start, end }
}

function buildSparseRowPartitionSnapshot<TRow>(
  api: Pick<UseDataGridRuntimeResult<TRow>["api"], "rows">,
  snapshot: DataGridRowModelSnapshot<TRow>,
): DataGridRuntimeResolvedRowPartition<TRow> {
  const total = api.rows.getCount()
  const bodyRows: Array<DataGridRowNode<TRow> | undefined> = []
  const bodyDisplayIndexes: number[] = []
  const bodyRowIndexById = new Map<string | number, number>()
  const pinnedTopRows: DataGridRowNode<TRow>[] = []
  const pinnedBottomRows: DataGridRowNode<TRow>[] = []
  const visibleRows = total > 0 && typeof api.rows.getRange === "function"
    ? api.rows.getRange(normalizeReadableViewportRange(snapshot.viewportRange, total))
    : []

  for (const row of visibleRows) {
    if (row.state.pinned === "top") {
      pinnedTopRows.push(row)
      continue
    }
    if (row.state.pinned === "bottom") {
      pinnedBottomRows.push(row)
      continue
    }
    const bodyIndex = Math.max(0, Math.trunc(row.displayIndex))
    bodyRows[bodyIndex] = row
    bodyDisplayIndexes[bodyIndex] = Math.max(0, Math.trunc(row.displayIndex))
    if (typeof row.rowId === "string" || typeof row.rowId === "number") {
      bodyRowIndexById.set(row.rowId, bodyIndex)
    }
  }

  return {
    bodyRows,
    bodyDisplayIndexes,
    bodyRowIndexById,
    snapshot: {
      bodyRowCount: Math.max(0, total),
      pinnedTopRows,
      pinnedBottomRows,
    },
    signature: `${snapshot.revision ?? ""}|${total}|${snapshot.viewportRange.start}:${snapshot.viewportRange.end}`,
  }
}

function buildRowPartitionSignature<TRow>(snapshot: DataGridRowModelSnapshot<TRow>): string {
  return JSON.stringify({
    revision: snapshot.revision ?? null,
    kind: snapshot.kind,
    rowCount: snapshot.rowCount,
    loading: snapshot.loading,
    pagination: snapshot.pagination,
    sortModel: snapshot.sortModel,
    filterModel: snapshot.filterModel,
    groupBy: snapshot.groupBy,
    pivotModel: snapshot.pivotModel ?? null,
    groupExpansion: snapshot.groupExpansion,
  })
}

function buildIndexedRowPartitionSnapshot<TRow>(
  api: Pick<UseDataGridRuntimeResult<TRow>["api"], "rows">,
  snapshot: DataGridRowModelSnapshot<TRow>,
): DataGridRuntimeResolvedRowPartition<TRow> {
  const nextPartition = buildRowPartitionSnapshot(api)
  return {
    ...nextPartition,
    signature: buildRowPartitionSignature(snapshot),
  }
}

function normalizeBodyViewportRange(
  range: DataGridViewportRange,
  bodyRowCount: number,
): DataGridBodyViewportRange {
  if (bodyRowCount <= 0) {
    return { start: 0, end: 0 }
  }
  const start = Math.max(0, Math.min(bodyRowCount - 1, Math.trunc(range.start)))
  const end = Math.max(start, Math.min(bodyRowCount - 1, Math.trunc(range.end)))
  return { start, end }
}

function resolveBodyVirtualWindowSnapshot(
  snapshot: DataGridRuntimeVirtualWindowSnapshot | null,
  bodyRowCount: number,
  columnCount: number,
): DataGridRuntimeVirtualWindowSnapshot {
  const normalizedBodyRange = normalizeBodyViewportRange(
    snapshot
      ? { start: snapshot.rowStart, end: snapshot.rowEnd }
      : { start: 0, end: Math.max(0, bodyRowCount - 1) },
    bodyRowCount,
  )
  const colTotal = Math.max(0, columnCount)
  const colStart = snapshot ? Math.max(0, Math.min(Math.max(0, colTotal - 1), Math.trunc(snapshot.colStart))) : 0
  const colEnd = snapshot
    ? Math.max(colStart, Math.min(Math.max(0, colTotal - 1), Math.trunc(snapshot.colEnd)))
    : Math.max(0, colTotal - 1)

  return {
    rowStart: normalizedBodyRange.start,
    rowEnd: normalizedBodyRange.end,
    rowTotal: bodyRowCount,
    colStart,
    colEnd,
    colTotal,
    overscan: snapshot?.overscan ?? { top: 0, bottom: 0, left: 0, right: 0 },
  }
}

function buildRowPartitionSnapshot<TRow>(
  api: Pick<UseDataGridRuntimeResult<TRow>["api"], "rows">,
): DataGridRuntimeResolvedRowPartition<TRow> {
  const total = api.rows.getCount()
  const getRow = api.rows.get
  const pinnedTopRows: DataGridRowNode<TRow>[] = []
  const pinnedBottomRows: DataGridRowNode<TRow>[] = []
  const bodyRows: Array<DataGridRowNode<TRow> | undefined> = []
  const bodyDisplayIndexes: number[] = []
  const bodyRowIndexById = new Map<string | number, number>()

  if (typeof getRow !== "function" || total <= 0) {
    return {
      bodyRows,
      bodyDisplayIndexes: [],
      bodyRowIndexById,
      snapshot: {
        bodyRowCount: Math.max(0, total),
        pinnedTopRows,
        pinnedBottomRows,
      },
      signature: `empty|${Math.max(0, total)}`,
    }
  }

  for (let rowIndex = 0; rowIndex < total; rowIndex += 1) {
    const row = getRow(rowIndex)
    if (!row) {
      continue
    }
    if (row.state.pinned === "top") {
      pinnedTopRows.push(row)
      continue
    }
    if (row.state.pinned === "bottom") {
      pinnedBottomRows.push(row)
      continue
    }
    bodyRows.push(row)
    bodyDisplayIndexes.push(rowIndex)
    if (typeof row.rowId === "string" || typeof row.rowId === "number") {
      bodyRowIndexById.set(row.rowId, bodyRows.length - 1)
    }
  }

  return {
    bodyRows,
    bodyDisplayIndexes,
    bodyRowIndexById,
    snapshot: {
      bodyRowCount: bodyDisplayIndexes.length,
      pinnedTopRows,
      pinnedBottomRows,
    },
    signature: buildRowPartitionSignature(api.rows.getSnapshot()),
  }
}

export function useDataGridRuntime<TRow = unknown>(
  options: UseDataGridRuntimeOptions<TRow>,
): UseDataGridRuntimeResult<TRow> {
  const initialRows = options.rows ? resolveMaybeRef(options.rows) : []
  if (!options.rowModel && options.workerOwnedRowModelOptions) {
    throw new Error(
      "[DataGridRuntime] workerOwnedRowModelOptions are not supported in the stable entrypoint. "
      + "Pass a prebuilt rowModel or import worker helpers from '@affino/datagrid-vue/worker'.",
    )
  }
  const resolvedRowModel = options.rowModel
  const runtime = useDataGridRuntimeService<TRow>({
    rows: initialRows,
    rowModel: resolvedRowModel,
    plugins: options.plugins,
    clientRowModelOptions: options.clientRowModelOptions,
    columns: resolveMaybeRef(options.columns),
    services: options.services,
    startupOrder: options.startupOrder,
  })

  if (resolvedRowModel && options.rows) {
    runtime.setRows(initialRows)
  }

  const { rowModel, columnModel, core, api } = runtime
  const workerBackedRowModel = isWorkerBackedRowModel(rowModel)
  const columnSnapshot = ref<DataGridColumnModelSnapshot>(runtime.getColumnSnapshot())
  const initialRowPartition = workerBackedRowModel
    ? buildSparseRowPartitionSnapshot<TRow>(api, rowModel.getSnapshot())
    : buildIndexedRowPartitionSnapshot<TRow>(api, rowModel.getSnapshot())
  const rowPartition = shallowRef<DataGridRuntimeRowPartitionSnapshot<TRow>>(
    initialRowPartition.snapshot,
  )
  let bodyRows = initialRowPartition.bodyRows
  let bodyDisplayIndexes = initialRowPartition.bodyDisplayIndexes
  let bodyRowIndexById = initialRowPartition.bodyRowIndexById
  let rowPartitionSignature = initialRowPartition.signature
  const resolveCurrentBodyVirtualWindow = (
    snapshot: DataGridRuntimeVirtualWindowSnapshot | null = runtime.getVirtualWindowSnapshot(),
  ): DataGridRuntimeVirtualWindowSnapshot => {
    return resolveBodyVirtualWindowSnapshot(
      snapshot,
      rowPartition.value.bodyRowCount,
      columnSnapshot.value.visibleColumns.length,
    )
  }
  const virtualWindow = shallowRef<DataGridRuntimeVirtualWindowSnapshot | null>(
    resolveCurrentBodyVirtualWindow(),
  )

  const unsubscribeColumns = runtime.subscribeColumnSnapshot(next => {
    columnSnapshot.value = next
    virtualWindow.value = resolveCurrentBodyVirtualWindow()
  })
  const unsubscribeVirtualWindow = runtime.subscribeVirtualWindow(next => {
    virtualWindow.value = resolveCurrentBodyVirtualWindow(next)
  })
  const unsubscribeRowPartition = rowModel.subscribe((snapshot) => {
    if (workerBackedRowModel) {
      const nextPartition = buildSparseRowPartitionSnapshot<TRow>(api, snapshot)
      bodyRows = nextPartition.bodyRows
      bodyDisplayIndexes = nextPartition.bodyDisplayIndexes
      bodyRowIndexById = nextPartition.bodyRowIndexById
      rowPartitionSignature = nextPartition.signature
      rowPartition.value = nextPartition.snapshot
      virtualWindow.value = resolveCurrentBodyVirtualWindow()
      return
    }

    const nextSignature = buildRowPartitionSignature(snapshot)
    if (nextSignature !== rowPartitionSignature) {
      const nextPartition = buildIndexedRowPartitionSnapshot<TRow>(api, snapshot)
      bodyRows = nextPartition.bodyRows
      bodyDisplayIndexes = nextPartition.bodyDisplayIndexes
      bodyRowIndexById = nextPartition.bodyRowIndexById
      rowPartitionSignature = nextPartition.signature
      rowPartition.value = nextPartition.snapshot
    }
    virtualWindow.value = resolveCurrentBodyVirtualWindow()
  })

  const shouldAutoStart = options.autoStart !== false
  const autoReapply = ref(false)

  if (options.rows && isRef(options.rows)) {
    watch(options.rows, rows => {
      if (runtime.isDisposed()) {
        return
      }
      runtime.setRows(rows)
    })
  }

  if (isRef(options.columns)) {
    watch(options.columns, columns => {
      if (runtime.isDisposed()) {
        return
      }
      runtime.setColumns(columns)
    })
  }

  if (shouldAutoStart) {
    onMounted(() => {
      void runtime.start()
    })
  }

  function stop() {
    if (runtime.isDisposed()) {
      return
    }
    unsubscribeColumns()
    unsubscribeVirtualWindow()
    unsubscribeRowPartition()
    runtime.stop()
  }

  onBeforeUnmount(() => {
    stop()
  })

  function reapplyView() {
    api.view.reapply()
  }

  function patchRows(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) {
    if (api.policy.getProjectionMode() === "immutable") {
      throw new Error("[DataGridRuntime] patchRows is blocked while projection mode is immutable.")
    }
    runtime.patchRows(updates, options)
  }

  function applyEdits(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options: DataGridEditOptions = {},
  ) {
    const freezeView = options.freezeView ?? !autoReapply.value
    patchRows(updates, {
      emit: options.emit,
      recomputeSort: freezeView ? false : true,
      recomputeFilter: freezeView ? false : true,
      recomputeGroup: freezeView ? false : true,
    })
    if (options.reapplyView) {
      reapplyView()
    }
  }

  function syncBodyRowsInRange(range: DataGridBodyViewportRange): readonly DataGridRowNode<TRow>[] {
    const normalizedRange = normalizeBodyViewportRange(range, rowPartition.value.bodyRowCount)
    const syncedRows = runtime.syncRowsInRange(normalizedRange)
    if (workerBackedRowModel) {
      for (const row of syncedRows) {
        if (isPinnedBodyExcludedRow(row)) {
          continue
        }
        const bodyIndex = Math.max(0, Math.trunc(row.displayIndex))
        bodyRows[bodyIndex] = row
        if (typeof row.rowId === "string" || typeof row.rowId === "number") {
          bodyRowIndexById.set(row.rowId, bodyIndex)
        }
      }
      return syncedRows.filter(row => !isPinnedBodyExcludedRow(row))
    }
    if (rowPartition.value.bodyRowCount === 0 || bodyRows.length === 0) {
      return []
    }
    const endExclusive = Math.min(bodyRows.length, normalizedRange.end + 1)
    if (normalizedRange.start >= endExclusive) {
      return []
    }
    return bodyRows.slice(normalizedRange.start, endExclusive) as DataGridRowNode<TRow>[]
  }

  function getBodyRowAtIndex(rowIndex: number): DataGridRowNode<TRow> | null {
    if (rowPartition.value.bodyRowCount === 0) {
      return null
    }
    const normalizedIndex = Math.max(0, Math.min(rowPartition.value.bodyRowCount - 1, Math.trunc(rowIndex)))
    const cachedRow = bodyRows[normalizedIndex]
    if (cachedRow) {
      return cachedRow
    }
    const displayIndex = bodyDisplayIndexes[normalizedIndex]
    if (typeof displayIndex !== "number" || !Number.isFinite(displayIndex)) {
      return null
    }
    const row = api.rows.get(displayIndex)
    if (!row || isPinnedBodyExcludedRow(row)) {
      return null
    }
    bodyRows[normalizedIndex] = row
    if (typeof row.rowId === "string" || typeof row.rowId === "number") {
      bodyRowIndexById.set(row.rowId, normalizedIndex)
    }
    return row
  }

  function resolveBodyRowIndexById(rowId: string | number): number {
    const cachedIndex = bodyRowIndexById.get(rowId)
    if (typeof cachedIndex === "number") {
      return cachedIndex
    }
    for (let bodyIndex = 0; bodyIndex < bodyDisplayIndexes.length; bodyIndex += 1) {
      const displayIndex = bodyDisplayIndexes[bodyIndex]
      if (typeof displayIndex !== "number" || !Number.isFinite(displayIndex)) {
        continue
      }
      const row = api.rows.get(displayIndex)
      if (!row || isPinnedBodyExcludedRow(row)) {
        continue
      }
      if (typeof row.rowId === "string" || typeof row.rowId === "number") {
        bodyRowIndexById.set(row.rowId, bodyIndex)
      }
      if (row.rowId === rowId) {
        bodyRows[bodyIndex] = row
        return bodyIndex
      }
    }
    return -1
  }

  function setViewportRange(range: DataGridBodyViewportRange) {
    runtime.setViewportRange(normalizeBodyViewportRange(range, rowPartition.value.bodyRowCount))
  }

  function getViewportRange(): DataGridBodyViewportRange {
    return normalizeBodyViewportRange(
      api.rows.getSnapshot().viewportRange,
      rowPartition.value.bodyRowCount,
    )
  }

  return {
    rowModel,
    columnModel,
    core,
    api,
    columnSnapshot,
    virtualWindow,
    rowPartition,
    setRows: runtime.setRows,
    setAggregationModel: api.rows.setAggregationModel,
    getAggregationModel: api.rows.getAggregationModel,
    setPivotModel: api.pivot.setModel,
    getPivotModel: api.pivot.getModel,
    getPivotCellDrilldown: api.pivot.getCellDrilldown,
    exportPivotLayout: api.pivot.exportLayout,
    exportPivotInterop: api.pivot.exportInterop,
    importPivotLayout: api.pivot.importLayout,
    patchRows,
    applyEdits,
    reapplyView,
    autoReapply,
    start: runtime.start,
    stop,
    syncRowsInRange: runtime.syncRowsInRange,
    syncBodyRowsInRange,
    getBodyRowAtIndex,
    resolveBodyRowIndexById,
    setViewportRange,
    getViewportRange,
    getProjectionMode: api.policy.getProjectionMode,
    setProjectionMode(mode: DataGridApiProjectionMode) {
      const nextMode = api.policy.setProjectionMode(mode)
      autoReapply.value = nextMode === "mutable"
      return nextMode
    },
    getSchema: api.meta.getSchema,
    getApiCapabilities: api.meta.getCapabilities,
    getRuntimeInfo: api.meta.getRuntimeInfo,
    registerPlugin(plugin: DataGridApiPluginDefinition<TRow>) {
      return api.plugins.register({
        ...plugin,
        onEvent: plugin.onEvent
          ? (event: DataGridApiEventName<TRow>, payload: DataGridApiEventPayload<TRow>) => {
            plugin.onEvent?.(event, payload)
          }
          : undefined,
      })
    },
    unregisterPlugin: api.plugins.unregister,
    hasPlugin: api.plugins.has,
    listPlugins: api.plugins.list,
    clearPlugins: api.plugins.clear,
    getUnifiedState: api.state.get,
    migrateUnifiedState: api.state.migrate,
    setUnifiedState: api.state.set,
  }
}
