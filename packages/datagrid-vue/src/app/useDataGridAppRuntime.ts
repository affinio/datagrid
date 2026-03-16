import { isRef, onBeforeUnmount, ref, watch, type Ref } from "vue"
import type {
  DataGridColumnInput,
  DataGridRowModelSnapshot,
  DataGridRowNodeInput,
  DataGridTreeDataFilterMode,
} from "@affino/datagrid-core"
import type { DataGridPivotSpec } from "@affino/datagrid-pivot"
import { useDataGridRuntime, type UseDataGridRuntimeOptions, type UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import {
  createDataGridWorkerOwnedRowModel,
  createDataGridWorkerOwnedRowModelHost,
  type DataGridWorkerOwnedRowModel,
  type DataGridWorkerOwnedRowModelHost,
} from "../worker"

type MaybeRef<T> = T | Ref<T>

function resolveMaybeRef<T>(value: MaybeRef<T>): T {
  if (typeof value === "object" && value !== null && "value" in value) {
    return value.value as T
  }
  return value
}

export type DataGridAppRuntimeMode = "base" | "tree" | "pivot" | "worker"

export interface UseDataGridAppRuntimeOptions<TRow> {
  mode: MaybeRef<DataGridAppRuntimeMode>
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnInput[]>
  services?: UseDataGridRuntimeOptions<TRow>["services"]
  treeData?: {
    getDataPath: (row: TRow) => readonly string[]
    filterMode?: DataGridTreeDataFilterMode
  }
  initialPivotModel?: DataGridPivotSpec | null
  worker?: {
    rowInputs?: MaybeRef<readonly DataGridRowNodeInput<TRow>[]>
    resolveRowInputs?: (rows: readonly TRow[]) => readonly DataGridRowNodeInput<TRow>[]
    resolveRowInputsOnDemand?: () => readonly DataGridRowNodeInput<TRow>[]
    rowInputsUpdateKey?: MaybeRef<unknown>
    createHostWorker?: () => Worker
  }
}

interface DataGridWorkerHostInitMessage<TRow> {
  __datagridWorkerHostInit: true
  rows: readonly DataGridRowNodeInput<TRow>[]
}

function postWorkerHostInit<TRow>(
  worker: Worker,
  rows: readonly DataGridRowNodeInput<TRow>[],
): void {
  const message: DataGridWorkerHostInitMessage<TRow> = {
    __datagridWorkerHostInit: true,
    rows,
  }
  worker.postMessage(message)
}

export interface UseDataGridAppRuntimeResult<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  rowVersion: Ref<number>
}

export function useDataGridAppRuntime<TRow>(
  options: UseDataGridAppRuntimeOptions<TRow>,
): UseDataGridAppRuntimeResult<TRow> {
  const mode = resolveMaybeRef(options.mode)
  let workerHost: DataGridWorkerOwnedRowModelHost | null = null
  let workerRowModel: DataGridWorkerOwnedRowModel<TRow> | null = null
  let hostWorker: Worker | null = null
  let workerPortA: MessagePort | null = null
  let workerPortB: MessagePort | null = null
  const resolveWorkerRowInputs = (): readonly DataGridRowNodeInput<TRow>[] => {
    if (!options.worker) {
      return []
    }
    if (options.worker.resolveRowInputsOnDemand) {
      return options.worker.resolveRowInputsOnDemand()
    }
    if (options.worker.rowInputs) {
      return resolveMaybeRef(options.worker.rowInputs)
    }
    if (options.worker.resolveRowInputs) {
      return options.worker.resolveRowInputs(options.rows.value)
    }
    return []
  }

  if (mode === "worker" && options.worker) {
    const initialRowInputs = resolveWorkerRowInputs()
    if (options.worker.createHostWorker) {
      hostWorker = options.worker.createHostWorker()
      postWorkerHostInit(hostWorker, initialRowInputs)
      workerRowModel = createDataGridWorkerOwnedRowModel<TRow>({
        source: hostWorker,
        target: hostWorker,
      })
    } else {
      const channel = new MessageChannel()
      channel.port1.start()
      channel.port2.start()
      workerPortA = channel.port1
      workerPortB = channel.port2
      workerHost = createDataGridWorkerOwnedRowModelHost<TRow>({
        source: channel.port2,
        target: channel.port2,
        rows: initialRowInputs,
      })
      workerRowModel = createDataGridWorkerOwnedRowModel<TRow>({
        source: channel.port1,
        target: channel.port1,
      })
    }
  }

  const clientRowModelOptions: UseDataGridRuntimeOptions<TRow>["clientRowModelOptions"] = mode === "tree" && options.treeData
    ? {
        initialTreeData: {
          mode: "path",
          getDataPath: options.treeData.getDataPath,
          filterMode: options.treeData.filterMode ?? "include-descendants",
        },
      }
    : mode === "pivot" && options.initialPivotModel
      ? {
          initialPivotModel: options.initialPivotModel,
        }
      : undefined

  const runtime = useDataGridRuntime<TRow>({
    rows: options.rows,
    columns: options.columns,
    services: options.services,
    rowModel: workerRowModel ?? undefined,
    clientRowModelOptions,
  })

  const rowVersion = ref(0)
  const resolveRowModelVersionKey = (snapshot: DataGridRowModelSnapshot<TRow>): string => {
    return [
      snapshot.kind,
      snapshot.revision ?? "",
      snapshot.rowCount,
      snapshot.loading ? 1 : 0,
      snapshot.projection?.recomputeVersion ?? snapshot.projection?.version ?? "",
    ].join("|")
  }
  let lastRowModelVersionKey = resolveRowModelVersionKey(runtime.rowModel.getSnapshot())
  const unsubscribeRows = runtime.rowModel.subscribe(() => {
    const nextVersionKey = resolveRowModelVersionKey(runtime.rowModel.getSnapshot())
    if (nextVersionKey === lastRowModelVersionKey) {
      return
    }
    lastRowModelVersionKey = nextVersionKey
    rowVersion.value += 1
  })

  if (mode === "worker" && options.worker) {
    if (options.worker.resolveRowInputsOnDemand && options.worker.rowInputsUpdateKey !== undefined) {
      watch(() => resolveMaybeRef(options.worker?.rowInputsUpdateKey as MaybeRef<unknown>), () => {
        workerRowModel?.setRows(resolveWorkerRowInputs())
      })
    } else if (options.worker.rowInputs && isRef(options.worker.rowInputs)) {
      watch(options.worker.rowInputs, rowInputs => {
        workerRowModel?.setRows(rowInputs)
      })
    } else if (options.worker.resolveRowInputs && isRef(options.rows)) {
      watch(options.rows, rows => {
        workerRowModel?.setRows(options.worker?.resolveRowInputs?.(rows) ?? [])
      })
    }
  }

  onBeforeUnmount(() => {
    unsubscribeRows()
    workerHost?.dispose()
    hostWorker?.terminate()
    workerPortA?.close()
    workerPortB?.close()
  })

  return {
    runtime,
    rowVersion,
  }
}
