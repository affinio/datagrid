import type {
  DataGridCalculationHistory,
  DataGridCalculationHistoryEntry,
  DataGridCalculationSnapshot,
  DataGridCalculationSnapshotInspection,
  DataGridCalculationSnapshotRestoreOptions,
} from "../snapshot/clientRowCalculationSnapshotRuntime.js"

export interface CreateClientRowCalculationSnapshotFacadeRuntimeOptions<T> {
  ensureActive: () => void
  snapshotHostRuntime: {
    createCalculationSnapshot(): DataGridCalculationSnapshot<T>
    restoreCalculationSnapshot(
      snapshot: DataGridCalculationSnapshot<T>,
      options?: DataGridCalculationSnapshotRestoreOptions,
    ): boolean
    inspectCalculationSnapshot(
      snapshot: DataGridCalculationSnapshot<T>,
      options?: Pick<DataGridCalculationSnapshotRestoreOptions, "rowBindingPolicy">,
    ): DataGridCalculationSnapshotInspection
    pushCalculationSnapshot(label?: string): DataGridCalculationHistoryEntry<T>
    undoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
    redoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
    getCalculationSnapshotHistory(): DataGridCalculationHistory<T>
  }
}

export interface ClientRowCalculationSnapshotFacadeRuntime<T> {
  createCalculationSnapshot(): DataGridCalculationSnapshot<T>
  restoreCalculationSnapshot(
    snapshot: DataGridCalculationSnapshot<T>,
    options?: DataGridCalculationSnapshotRestoreOptions,
  ): boolean
  inspectCalculationSnapshot(
    snapshot: DataGridCalculationSnapshot<T>,
    options?: Pick<DataGridCalculationSnapshotRestoreOptions, "rowBindingPolicy">,
  ): DataGridCalculationSnapshotInspection
  pushCalculationSnapshot(label?: string): DataGridCalculationHistoryEntry<T>
  undoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
  redoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
  getCalculationSnapshotHistory(): DataGridCalculationHistory<T>
}

export function createClientRowCalculationSnapshotFacadeRuntime<T>(
  options: CreateClientRowCalculationSnapshotFacadeRuntimeOptions<T>,
): ClientRowCalculationSnapshotFacadeRuntime<T> {
  return {
    createCalculationSnapshot() {
      options.ensureActive()
      return options.snapshotHostRuntime.createCalculationSnapshot()
    },
    restoreCalculationSnapshot(snapshot, restoreOptions = {}) {
      options.ensureActive()
      return options.snapshotHostRuntime.restoreCalculationSnapshot(snapshot, restoreOptions)
    },
    inspectCalculationSnapshot(snapshot, inspectOptions = {}) {
      options.ensureActive()
      return options.snapshotHostRuntime.inspectCalculationSnapshot(snapshot, inspectOptions)
    },
    pushCalculationSnapshot(label) {
      options.ensureActive()
      return options.snapshotHostRuntime.pushCalculationSnapshot(label)
    },
    undoCalculationSnapshot(restoreOptions = {}) {
      options.ensureActive()
      return options.snapshotHostRuntime.undoCalculationSnapshot(restoreOptions)
    },
    redoCalculationSnapshot(restoreOptions = {}) {
      options.ensureActive()
      return options.snapshotHostRuntime.redoCalculationSnapshot(restoreOptions)
    },
    getCalculationSnapshotHistory() {
      options.ensureActive()
      return options.snapshotHostRuntime.getCalculationSnapshotHistory()
    },
  }
}
