import { isRef, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue"
import type {
  CreateDataGridCoreOptions,
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
  patchRows: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void
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

  return {
    rowModel,
    columnModel,
    core,
    api,
    columnSnapshot,
    virtualWindow,
    setRows: runtime.setRows,
    patchRows: runtime.patchRows,
    start: runtime.start,
    stop,
    syncRowsInRange: runtime.syncRowsInRange,
  }
}
