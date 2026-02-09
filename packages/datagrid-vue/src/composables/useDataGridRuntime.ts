import { isRef, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue"
import type {
  CreateDataGridCoreOptions,
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridCoreServiceRegistry,
  DataGridRowNode,
  DataGridRowModel,
  DataGridViewportRange,
} from "@affino/datagrid-core"
import {
  createDataGridVueRuntime,
  type CreateDataGridVueRuntimeOptions,
  type DataGridVueRuntime,
} from "../runtime/createDataGridVueRuntime"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

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

type MutableRowsRowModel<TRow> = DataGridRowModel<TRow> & {
  setRows: (rows: readonly TRow[]) => void
}

function isMutableRowsModel<TRow>(model: DataGridRowModel<TRow>): model is MutableRowsRowModel<TRow> {
  return typeof (model as { setRows?: unknown }).setRows === "function"
}

export function useDataGridRuntime<TRow = unknown>(
  options: UseDataGridRuntimeOptions<TRow>,
): UseDataGridRuntimeResult<TRow> {
  const runtime = createDataGridVueRuntime<TRow>({
    rows: options.rows ? resolveMaybeRef(options.rows) : [],
    columns: resolveMaybeRef(options.columns),
    services: options.services as CreateDataGridVueRuntimeOptions<TRow>["services"],
    startupOrder: options.startupOrder,
  })
  const { rowModel, columnModel, core, api } = runtime

  const columnSnapshot = ref<DataGridColumnModelSnapshot>(api.getColumnModelSnapshot())

  let disposed = false
  let started = false
  let unsubscribeColumns: (() => void) | null = null

  function setRows(rows: readonly TRow[]) {
    if (!isMutableRowsModel(rowModel)) {
      return
    }
    rowModel.setRows(rows)
  }

  function ensureColumnSubscription() {
    if (unsubscribeColumns) {
      return
    }
    columnSnapshot.value = api.getColumnModelSnapshot()
    unsubscribeColumns = columnModel.subscribe(next => {
      columnSnapshot.value = next
    })
  }

  async function start(): Promise<void> {
    if (disposed || started) {
      return
    }
    ensureColumnSubscription()
    await api.start()
    started = true
  }

  function stop() {
    if (disposed) {
      return
    }
    unsubscribeColumns?.()
    unsubscribeColumns = null
    void core.dispose()
    started = false
    disposed = true
  }

  if (options.rows && isRef(options.rows)) {
    watch(options.rows, rows => {
      if (disposed) {
        return
      }
      setRows(rows)
    })
  }

  if (isRef(options.columns)) {
    watch(options.columns, columns => {
      if (disposed) {
        return
      }
      columnModel.setColumns(columns)
    })
  }

  const shouldAutoStart = options.autoStart !== false
  if (shouldAutoStart) {
    onMounted(() => {
      void start()
    })
  } else {
    ensureColumnSubscription()
  }

  onBeforeUnmount(() => {
    stop()
  })

  function syncRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[] {
    api.setViewportRange(range)
    return api.getRowsInRange<TRow>(range)
  }

  return {
    rowModel,
    columnModel,
    core,
    api,
    columnSnapshot,
    setRows,
    start,
    stop,
    syncRowsInRange,
  }
}
