import { isRef, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue"
import type {
  DataGridApiCapabilities,
  DataGridApiEventName,
  DataGridApiEventPayload,
  DataGridApiPluginDefinition,
  DataGridApiProjectionMode,
  DataGridApiRuntimeInfo,
  DataGridApiSchemaSnapshot,
  CreateDataGridCoreOptions,
  DataGridAggregationModel,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridPivotLayoutImportOptions,
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
  DataGridRowNode,
  DataGridRowModel,
  DataGridViewportRange,
} from "@affino/datagrid-core"
import {
  createDataGridWorkerOwnedRowModel,
  type CreateDataGridWorkerOwnedRowModelOptions,
} from "@affino/datagrid-worker"
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
  plugins?: readonly DataGridApiPluginDefinition<TRow>[]
  workerOwnedRowModelOptions?: CreateDataGridWorkerOwnedRowModelOptions<TRow>
  clientRowModelOptions?: CreateDataGridRuntimeOptions<TRow>["clientRowModelOptions"]
  columns: MaybeRef<readonly DataGridColumnDef[]>
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
  autoStart?: boolean
}

export interface UseDataGridRuntimeResult<TRow = unknown> extends DataGridVueRuntime<TRow> {
  columnSnapshot: Ref<DataGridColumnModelSnapshot>
  virtualWindow: Ref<DataGridRuntimeVirtualWindowSnapshot | null>
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
  start: () => Promise<void>
  stop: () => void
  syncRowsInRange: (range: DataGridViewportRange) => readonly DataGridRowNode<TRow>[]
}

export function useDataGridRuntime<TRow = unknown>(
  options: UseDataGridRuntimeOptions<TRow>,
): UseDataGridRuntimeResult<TRow> {
  const initialRows = options.rows ? resolveMaybeRef(options.rows) : []
  const resolvedRowModel = options.rowModel ?? (
    options.workerOwnedRowModelOptions
      ? createDataGridWorkerOwnedRowModel(options.workerOwnedRowModelOptions)
      : undefined
  )
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
  const columnSnapshot = ref<DataGridColumnModelSnapshot>(runtime.getColumnSnapshot())
  const buildFallbackVirtualWindow = (): DataGridRuntimeVirtualWindowSnapshot => {
    const rowTotal = Math.max(0, api.rows.getCount())
    const colTotal = Math.max(0, columnSnapshot.value.visibleColumns.length)
    return {
      rowStart: 0,
      rowEnd: Math.max(0, rowTotal - 1),
      rowTotal,
      colStart: 0,
      colEnd: Math.max(0, colTotal - 1),
      colTotal,
      overscan: { top: 0, bottom: 0, left: 0, right: 0 },
    }
  }
  const virtualWindow = ref<DataGridRuntimeVirtualWindowSnapshot | null>(
    runtime.getVirtualWindowSnapshot() ?? buildFallbackVirtualWindow(),
  )

  const unsubscribeColumns = runtime.subscribeColumnSnapshot(next => {
    columnSnapshot.value = next
  })
  const unsubscribeVirtualWindow = runtime.subscribeVirtualWindow(next => {
    virtualWindow.value = next ?? buildFallbackVirtualWindow()
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

  return {
    rowModel,
    columnModel,
    core,
    api,
    columnSnapshot,
    virtualWindow,
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
  }
}
