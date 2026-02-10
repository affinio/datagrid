import { ref, type Ref } from "vue"
import type {
  DataGridColumnDef,
  DataGridCoreTransactionService,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import { createDataGridTransactionService } from "@affino/datagrid-core/advanced"
import {
  useDataGridRuntime,
  type UseDataGridRuntimeOptions,
  type UseDataGridRuntimeResult,
} from "../../useDataGridRuntime"
import { toReadonlyRef, type MaybeRef } from "./useAffinoDataGridIdentity"

interface AffinoDataGridMutationSnapshot<TRow> {
  rows: readonly TRow[]
  selection: DataGridSelectionSnapshot | null
}

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

  const applyMutationSnapshot = (snapshot: AffinoDataGridMutationSnapshot<TRow>): void => {
    rows.value = snapshot.rows
    internalSelectionSnapshot.value = snapshot.selection
  }

  const internalTransactionEngine = createDataGridTransactionService({
    execute(command, context) {
      if (context.direction === "apply") {
        return
      }
      const snapshot = command.payload as AffinoDataGridMutationSnapshot<TRow>
      applyMutationSnapshot(snapshot)
    },
  })

  const internalTransactionService: DataGridCoreTransactionService = {
    name: "transaction",
    getTransactionSnapshot: internalTransactionEngine.getSnapshot,
    beginTransactionBatch: internalTransactionEngine.beginBatch,
    commitTransactionBatch: internalTransactionEngine.commitBatch,
    rollbackTransactionBatch: internalTransactionEngine.rollbackBatch,
    applyTransaction: internalTransactionEngine.applyTransaction,
    canUndoTransaction: internalTransactionEngine.canUndo,
    canRedoTransaction: internalTransactionEngine.canRedo,
    undoTransaction: internalTransactionEngine.undo,
    redoTransaction: internalTransactionEngine.redo,
    dispose: internalTransactionEngine.dispose,
  }

  const runtimeServices: UseDataGridRuntimeOptions<TRow>["services"] = {
    ...options.services,
    transaction: options.services?.transaction ?? internalTransactionService,
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
