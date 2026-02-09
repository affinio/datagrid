import { isRef, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue"
import type {
  CreateDataGridCoreOptions,
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridRowNode,
  DataGridViewportRange,
} from "@affino/datagrid-core"
import {
  useDataGridRuntimeService,
  type DataGridRuntimeOverrides,
} from "@affino/datagrid-orchestration"
import type { DataGridVueRuntime } from "../runtime/createDataGridVueRuntime"

type MaybeRef<T> = T | Ref<T>

function resolveMaybeRef<T>(value: MaybeRef<T>): T {
  return isRef(value) ? value.value : value
}

export interface UseDataGridRuntimeOptions<TRow = unknown> {
  rows?: MaybeRef<readonly TRow[]>
  columns: MaybeRef<readonly DataGridColumnDef[]>
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
  autoStart?: boolean
}

export interface UseDataGridRuntimeResult<TRow = unknown> extends DataGridVueRuntime<TRow> {
  columnSnapshot: Ref<DataGridColumnModelSnapshot>
  setRows: (rows: readonly TRow[]) => void
  start: () => Promise<void>
  stop: () => void
  syncRowsInRange: (range: DataGridViewportRange) => readonly DataGridRowNode<TRow>[]
}

export function useDataGridRuntime<TRow = unknown>(
  options: UseDataGridRuntimeOptions<TRow>,
): UseDataGridRuntimeResult<TRow> {
  const runtime = useDataGridRuntimeService<TRow>({
    rows: options.rows ? resolveMaybeRef(options.rows) : [],
    columns: resolveMaybeRef(options.columns),
    services: options.services,
    startupOrder: options.startupOrder,
  })
  const { rowModel, columnModel, core, api } = runtime
  const columnSnapshot = ref<DataGridColumnModelSnapshot>(runtime.getColumnSnapshot())

  const unsubscribeColumns = runtime.subscribeColumnSnapshot(next => {
    columnSnapshot.value = next
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
    setRows: runtime.setRows,
    start: runtime.start,
    stop,
    syncRowsInRange: runtime.syncRowsInRange,
  }
}
