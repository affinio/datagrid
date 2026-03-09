// Snapshot host wiring for row-model snapshots and calculation snapshots.
// Keep snapshot/calc-history orchestration here instead of in the main host file.
import type {
  ClientRowSnapshotRuntime,
} from "../snapshot/clientRowSnapshotRuntime.js"
import type {
  DataGridCalculationHistory,
  DataGridCalculationSnapshot,
  DataGridCalculationSnapshotInspection,
  DataGridCalculationSnapshotRestoreOptions,
  DataGridClientRowCalculationSnapshotRuntime,
} from "../snapshot/clientRowCalculationSnapshotRuntime.js"
import type {
  DataGridProjectionDiagnostics,
  DataGridRowModelSnapshot,
} from "../rowModel.js"

export interface CreateClientRowSnapshotHostRuntimeOptions<T> {
  snapshotRuntime: ClientRowSnapshotRuntime<T>
  calculationSnapshotRuntime: DataGridClientRowCalculationSnapshotRuntime<T>
}

export interface DataGridClientRowSnapshotHostRuntime<T> {
  getProjectionDiagnostics: () => DataGridProjectionDiagnostics
  getSnapshot: () => DataGridRowModelSnapshot<T>
  createCalculationSnapshot: () => DataGridCalculationSnapshot<T>
  inspectCalculationSnapshot: (
    snapshot: DataGridCalculationSnapshot<T>,
    options?: Pick<DataGridCalculationSnapshotRestoreOptions, "rowBindingPolicy">,
  ) => DataGridCalculationSnapshotInspection
  restoreCalculationSnapshot: (
    snapshot: DataGridCalculationSnapshot<T>,
    options?: DataGridCalculationSnapshotRestoreOptions,
  ) => boolean
  pushCalculationSnapshot: (label?: string) => { id: number; label: string | null; snapshot: DataGridCalculationSnapshot<T> }
  undoCalculationSnapshot: (options?: DataGridCalculationSnapshotRestoreOptions) => boolean
  redoCalculationSnapshot: (options?: DataGridCalculationSnapshotRestoreOptions) => boolean
  getCalculationSnapshotHistory: () => DataGridCalculationHistory<T>
}

export function createClientRowSnapshotHostRuntime<T>(
  options: CreateClientRowSnapshotHostRuntimeOptions<T>,
): DataGridClientRowSnapshotHostRuntime<T> {
  return {
    getProjectionDiagnostics: () => options.snapshotRuntime.getProjectionDiagnostics(),
    getSnapshot: () => options.snapshotRuntime.getSnapshot(),
    createCalculationSnapshot: () => options.calculationSnapshotRuntime.createCalculationSnapshot(),
    inspectCalculationSnapshot: (snapshot, runtimeOptions) =>
      options.calculationSnapshotRuntime.inspectCalculationSnapshot(snapshot, runtimeOptions),
    restoreCalculationSnapshot: (snapshot, runtimeOptions) =>
      options.calculationSnapshotRuntime.restoreCalculationSnapshot(snapshot, runtimeOptions),
    pushCalculationSnapshot: (label) => options.calculationSnapshotRuntime.pushCalculationSnapshot(label),
    undoCalculationSnapshot: (runtimeOptions) =>
      options.calculationSnapshotRuntime.undoCalculationSnapshot(runtimeOptions),
    redoCalculationSnapshot: (runtimeOptions) =>
      options.calculationSnapshotRuntime.redoCalculationSnapshot(runtimeOptions),
    getCalculationSnapshotHistory: () => options.calculationSnapshotRuntime.getCalculationSnapshotHistory(),
  }
}
