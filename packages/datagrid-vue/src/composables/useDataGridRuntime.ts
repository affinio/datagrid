import { isRef, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue"
import type {
  CreateDataGridCoreOptions,
  DataGridAggregationModel,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridRowNode,
  DataGridRowModel,
  DataGridViewportRange,
} from "@affino/datagrid-core"
import {
  useDataGridRuntimeService,
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
  start: () => Promise<void>
  stop: () => void
  syncRowsInRange: (range: DataGridViewportRange) => readonly DataGridRowNode<TRow>[]
}

export function useDataGridRuntime<TRow = unknown>(
  options: UseDataGridRuntimeOptions<TRow>,
): UseDataGridRuntimeResult<TRow> {
  const runtime = useDataGridRuntimeService<TRow>({
    rows: options.rows ? resolveMaybeRef(options.rows) : [],
    rowModel: options.rowModel,
    columns: resolveMaybeRef(options.columns),
    services: options.services,
    startupOrder: options.startupOrder,
  })
  const { rowModel, columnModel, core, api } = runtime
  const columnSnapshot = ref<DataGridColumnModelSnapshot>(runtime.getColumnSnapshot())
  const buildFallbackVirtualWindow = (): DataGridRuntimeVirtualWindowSnapshot => {
    const rowTotal = Math.max(0, api.getRowCount())
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
    api.reapplyView()
  }

  function patchRows(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) {
    runtime.patchRows(updates, options)
  }

  function applyEdits(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options: DataGridEditOptions = {},
  ) {
    const freezeView = options.freezeView ?? !autoReapply.value
    runtime.patchRows(updates, {
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
    setAggregationModel: api.setAggregationModel,
    getAggregationModel: api.getAggregationModel,
    patchRows,
    applyEdits,
    reapplyView,
    autoReapply,
    start: runtime.start,
    stop,
    syncRowsInRange: runtime.syncRowsInRange,
  }
}
