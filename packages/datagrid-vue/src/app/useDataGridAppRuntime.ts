import { onBeforeUnmount, ref, type Ref } from "vue"
import type { DataGridColumnInput, DataGridRowNodeInput, DataGridTreeDataFilterMode } from "@affino/datagrid-core"
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
    resolveRowInputs: (rows: readonly TRow[]) => readonly DataGridRowNodeInput<TRow>[]
  }
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
  let workerPortA: MessagePort | null = null
  let workerPortB: MessagePort | null = null

  if (mode === "worker" && options.worker) {
    const channel = new MessageChannel()
    channel.port1.start()
    channel.port2.start()
    workerPortA = channel.port1
    workerPortB = channel.port2
    workerHost = createDataGridWorkerOwnedRowModelHost<TRow>({
      source: channel.port2,
      target: channel.port2,
      rows: options.worker.resolveRowInputs(options.rows.value),
    })
    workerRowModel = createDataGridWorkerOwnedRowModel<TRow>({
      source: channel.port1,
      target: channel.port1,
    })
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
  const unsubscribeRows = runtime.rowModel.subscribe(() => {
    rowVersion.value += 1
  })

  onBeforeUnmount(() => {
    unsubscribeRows()
    workerHost?.dispose()
    workerPortA?.close()
    workerPortB?.close()
  })

  return {
    runtime,
    rowVersion,
  }
}
