import { ref, type Ref } from "vue"
import type { DataGridColumnDef, DataGridSelectionSnapshot } from "@affino/datagrid-core"
import {
  useDataGridRuntime,
  type UseDataGridRuntimeOptions,
  type UseDataGridRuntimeResult,
} from "../../useDataGridRuntime"
import { toReadonlyRef, type MaybeRef } from "./useAffinoDataGridIdentity"

export interface UseAffinoDataGridRuntimeBootstrapOptions<TRow> {
  rows: MaybeRef<readonly TRow[]>
  columns: MaybeRef<readonly DataGridColumnDef[]>
  services?: UseDataGridRuntimeOptions<TRow>["services"]
  startupOrder?: UseDataGridRuntimeOptions<TRow>["startupOrder"]
  autoStart?: boolean
}

export interface UseAffinoDataGridRuntimeBootstrapResult<TRow> {
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnDef[]>
  runtime: UseDataGridRuntimeResult<TRow>
  internalSelectionSnapshot: Ref<DataGridSelectionSnapshot | null>
}

export function useAffinoDataGridRuntimeBootstrap<TRow>(
  options: UseAffinoDataGridRuntimeBootstrapOptions<TRow>,
): UseAffinoDataGridRuntimeBootstrapResult<TRow> {
  const rows = toReadonlyRef(options.rows)
  const columns = toReadonlyRef(options.columns)

  const internalSelectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
  const internalSelectionService: NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>["selection"] = {
    name: "selection",
    getSelectionSnapshot() {
      return internalSelectionSnapshot.value
    },
    setSelectionSnapshot(snapshot) {
      internalSelectionSnapshot.value = snapshot
    },
    clearSelection() {
      internalSelectionSnapshot.value = null
    },
  }

  const runtimeServices: UseDataGridRuntimeOptions<TRow>["services"] = {
    ...options.services,
    selection: options.services?.selection ?? internalSelectionService,
  }

  const runtime = useDataGridRuntime<TRow>({
    rows,
    columns,
    services: runtimeServices,
    startupOrder: options.startupOrder,
    autoStart: options.autoStart ?? true,
  })

  return {
    rows,
    columns,
    runtime,
    internalSelectionSnapshot,
  }
}
