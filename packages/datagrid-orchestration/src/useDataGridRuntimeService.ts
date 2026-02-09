import type {
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridRowNode,
  DataGridRowModel,
  DataGridViewportRange,
} from "@affino/datagrid-core"
import { createDataGridRuntime, type CreateDataGridRuntimeOptions, type DataGridRuntime } from "./createDataGridRuntime"

type MutableRowsRowModel<TRow> = DataGridRowModel<TRow> & {
  setRows: (rows: readonly TRow[]) => void
}

function isMutableRowsModel<TRow>(model: DataGridRowModel<TRow>): model is MutableRowsRowModel<TRow> {
  return typeof (model as { setRows?: unknown }).setRows === "function"
}

export interface UseDataGridRuntimeServiceOptions<TRow = unknown> extends CreateDataGridRuntimeOptions<TRow> {}

export interface UseDataGridRuntimeServiceResult<TRow = unknown> extends DataGridRuntime<TRow> {
  getColumnSnapshot: () => DataGridColumnModelSnapshot
  subscribeColumnSnapshot: (listener: (snapshot: DataGridColumnModelSnapshot) => void) => () => void
  setRows: (rows: readonly TRow[]) => void
  setColumns: (columns: readonly DataGridColumnDef[]) => void
  start: () => Promise<void>
  stop: () => void
  syncRowsInRange: (range: DataGridViewportRange) => readonly DataGridRowNode<TRow>[]
  isStarted: () => boolean
  isDisposed: () => boolean
}

export function useDataGridRuntimeService<TRow = unknown>(
  options: UseDataGridRuntimeServiceOptions<TRow>,
): UseDataGridRuntimeServiceResult<TRow> {
  const runtime = createDataGridRuntime(options)
  const { rowModel, columnModel, core, api } = runtime

  let started = false
  let disposed = false

  function getColumnSnapshot(): DataGridColumnModelSnapshot {
    return api.getColumnModelSnapshot()
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
  }

  function setColumns(columns: readonly DataGridColumnDef[]) {
    columnModel.setColumns(columns)
  }

  async function start(): Promise<void> {
    if (disposed || started) {
      return
    }
    await api.start()
    started = true
  }

  function stop() {
    if (disposed) {
      return
    }
    void core.dispose()
    started = false
    disposed = true
  }

  function syncRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[] {
    api.setViewportRange(range)
    return api.getRowsInRange<TRow>(range)
  }

  return {
    rowModel,
    columnModel,
    core,
    api,
    getColumnSnapshot,
    subscribeColumnSnapshot,
    setRows,
    setColumns,
    start,
    stop,
    syncRowsInRange,
    isStarted: () => started,
    isDisposed: () => disposed,
  }
}
