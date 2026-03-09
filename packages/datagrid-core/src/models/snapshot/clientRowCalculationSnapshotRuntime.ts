import type {
  DataGridAggregationModel,
  DataGridProjectionFormulaDiagnostics,
  DataGridRowId,
  DataGridRowModelSnapshot,
} from "../rowModel.js"
import type {
  ClientRowComputedRowBoundSnapshot,
} from "../materialization/clientRowComputedSnapshotRuntime.js"
import type {
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
} from "../rowModel.js"

export interface DataGridCalculationSnapshotRestoreOptions {
  emit?: boolean
  rowBindingPolicy?: "strict" | "reconcile"
}

export interface DataGridCalculationSnapshot<T = unknown> {
  kind: "client-calculation"
  rowIds: readonly DataGridRowId[]
  computedSnapshot: ClientRowComputedRowBoundSnapshot
  modelSnapshot: DataGridRowModelSnapshot<T>
  aggregationModel: DataGridAggregationModel<T> | null
  formulaComputeStage: DataGridFormulaComputeStageDiagnostics | null
  formulaRowRecompute: DataGridFormulaRowRecomputeDiagnostics | null
}

export interface DataGridCalculationHistoryEntry<T = unknown> {
  id: number
  label: string | null
  snapshot: DataGridCalculationSnapshot<T>
}

export interface DataGridCalculationHistory<T = unknown> {
  index: number
  entries: readonly DataGridCalculationHistoryEntry<T>[]
}

export interface DataGridCalculationSnapshotInspection {
  rowBindingPolicy: "strict" | "reconcile"
  restorable: boolean
  fullyBound: boolean
  reordered: boolean
  snapshotRowCount: number
  currentRowCount: number
  matchedRowCount: number
  missingRowIds: readonly DataGridRowId[]
  extraRowIds: readonly DataGridRowId[]
  computedFields: readonly string[]
  overlayValueCounts: Readonly<Record<string, number>>
}

export interface CreateClientRowCalculationSnapshotRuntimeOptions<T> {
  getBaseSourceRows(): readonly { rowId: DataGridRowId }[]
  createComputedSnapshot(): ClientRowComputedRowBoundSnapshot
  getModelSnapshot(): DataGridRowModelSnapshot<T>
  getAggregationModel(): DataGridAggregationModel<T> | null
  cloneAggregationModel(
    model: DataGridAggregationModel<T> | null,
  ): DataGridAggregationModel<T> | null
  getFormulaComputeStageDiagnosticsSnapshot(): DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnosticsSnapshot(): DataGridFormulaRowRecomputeDiagnostics | null
  applySnapshotRestore(
    snapshot: DataGridCalculationSnapshot<T>,
    inspection: DataGridCalculationSnapshotInspection,
    options: DataGridCalculationSnapshotRestoreOptions,
  ): boolean
}

export interface DataGridClientRowCalculationSnapshotRuntime<T> {
  createCalculationSnapshot(): DataGridCalculationSnapshot<T>
  inspectCalculationSnapshot(
    snapshot: DataGridCalculationSnapshot<T>,
    options?: Pick<DataGridCalculationSnapshotRestoreOptions, "rowBindingPolicy">,
  ): DataGridCalculationSnapshotInspection
  restoreCalculationSnapshot(
    snapshot: DataGridCalculationSnapshot<T>,
    options?: DataGridCalculationSnapshotRestoreOptions,
  ): boolean
  pushCalculationSnapshot(label?: string): DataGridCalculationHistoryEntry<T>
  undoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
  redoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
  getCalculationSnapshotHistory(): DataGridCalculationHistory<T>
}

export function cloneProjectionFormulaDiagnostics(
  diagnostics: DataGridProjectionFormulaDiagnostics | null | undefined,
): DataGridProjectionFormulaDiagnostics | null {
  if (!diagnostics) {
    return null
  }
  return {
    recomputedFields: [...diagnostics.recomputedFields],
    runtimeErrorCount: diagnostics.runtimeErrorCount,
    runtimeErrors: diagnostics.runtimeErrors.map(error => ({ ...error })),
    ...(diagnostics.compileCache
      ? {
        compileCache: { ...diagnostics.compileCache },
      }
      : {}),
  }
}

export function createClientRowCalculationSnapshotRuntime<T>(
  options: CreateClientRowCalculationSnapshotRuntimeOptions<T>,
): DataGridClientRowCalculationSnapshotRuntime<T> {
  let historyEntries: DataGridCalculationHistoryEntry<T>[] = []
  let historyIndex = -1
  let historySequence = 0

  const inspectCalculationSnapshot = (
    snapshot: DataGridCalculationSnapshot<T>,
    restoreOptions: Pick<DataGridCalculationSnapshotRestoreOptions, "rowBindingPolicy"> = {},
  ): DataGridCalculationSnapshotInspection => {
    const rowBindingPolicy = restoreOptions.rowBindingPolicy === "strict" ? "strict" : "reconcile"
    const currentRowIds = options.getBaseSourceRows().map(row => row.rowId)
    const currentRowIdSet = new Set<DataGridRowId>(currentRowIds)
    const snapshotRowIdSet = new Set<DataGridRowId>(snapshot.rowIds)
    const missingRowIds: DataGridRowId[] = []
    const extraRowIds: DataGridRowId[] = []
    let matchedRowCount = 0
    for (const rowId of snapshot.rowIds) {
      if (currentRowIdSet.has(rowId)) {
        matchedRowCount += 1
      } else {
        missingRowIds.push(rowId)
      }
    }
    for (const rowId of currentRowIds) {
      if (!snapshotRowIdSet.has(rowId)) {
        extraRowIds.push(rowId)
      }
    }
    const reordered = snapshot.rowIds.length === currentRowIds.length
      && snapshot.rowIds.some((rowId, index) => !Object.is(rowId, currentRowIds[index]))
    const fullyBound = missingRowIds.length === 0
    const restorable = rowBindingPolicy === "strict"
      ? fullyBound && extraRowIds.length === 0 && !reordered
      : true
    const overlayValueCounts: Record<string, number> = {}
    for (const [field, entries] of Object.entries(snapshot.computedSnapshot.overlayValuesByField ?? {})) {
      overlayValueCounts[field] = Array.isArray(entries) ? entries.length : 0
    }
    return {
      rowBindingPolicy,
      restorable,
      fullyBound,
      reordered,
      snapshotRowCount: snapshot.rowIds.length,
      currentRowCount: currentRowIds.length,
      matchedRowCount,
      missingRowIds,
      extraRowIds,
      computedFields: [...snapshot.computedSnapshot.computedFields],
      overlayValueCounts,
    }
  }

  const createCalculationSnapshot = (): DataGridCalculationSnapshot<T> => ({
    kind: "client-calculation",
    rowIds: options.getBaseSourceRows().map(row => row.rowId),
    computedSnapshot: options.createComputedSnapshot(),
    modelSnapshot: options.getModelSnapshot(),
    aggregationModel: options.cloneAggregationModel(options.getAggregationModel()),
    formulaComputeStage: options.getFormulaComputeStageDiagnosticsSnapshot(),
    formulaRowRecompute: options.getFormulaRowRecomputeDiagnosticsSnapshot(),
  })

  const restoreCalculationSnapshot = (
    snapshot: DataGridCalculationSnapshot<T>,
    restoreOptions: DataGridCalculationSnapshotRestoreOptions = {},
  ): boolean => {
    const inspection = inspectCalculationSnapshot(snapshot, restoreOptions)
    if (!inspection.restorable) {
      return false
    }
    if (inspection.rowBindingPolicy === "strict") {
      if (inspection.snapshotRowCount !== inspection.currentRowCount || inspection.reordered) {
        return false
      }
    }
    return options.applySnapshotRestore(snapshot, inspection, restoreOptions)
  }

  const pushCalculationSnapshot = (label?: string): DataGridCalculationHistoryEntry<T> => {
    const entry: DataGridCalculationHistoryEntry<T> = {
      id: ++historySequence,
      label: typeof label === "string" && label.trim().length > 0 ? label.trim() : null,
      snapshot: createCalculationSnapshot(),
    }
    if (historyIndex < historyEntries.length - 1) {
      historyEntries = historyEntries.slice(0, historyIndex + 1)
    }
    historyEntries.push(entry)
    historyIndex = historyEntries.length - 1
    return entry
  }

  const getCalculationSnapshotHistory = (): DataGridCalculationHistory<T> => ({
    index: historyIndex,
    entries: historyEntries.map(entry => ({
      id: entry.id,
      label: entry.label,
      snapshot: entry.snapshot,
    })),
  })

  const undoCalculationSnapshot = (
    restoreOptions: DataGridCalculationSnapshotRestoreOptions = {},
  ): boolean => {
    if (historyIndex <= 0) {
      return false
    }
    const nextIndex = historyIndex - 1
    const entry = historyEntries[nextIndex]
    if (!entry || !restoreCalculationSnapshot(entry.snapshot, restoreOptions)) {
      return false
    }
    historyIndex = nextIndex
    return true
  }

  const redoCalculationSnapshot = (
    restoreOptions: DataGridCalculationSnapshotRestoreOptions = {},
  ): boolean => {
    if (historyIndex >= historyEntries.length - 1) {
      return false
    }
    const nextIndex = historyIndex + 1
    const entry = historyEntries[nextIndex]
    if (!entry || !restoreCalculationSnapshot(entry.snapshot, restoreOptions)) {
      return false
    }
    historyIndex = nextIndex
    return true
  }

  return {
    createCalculationSnapshot,
    inspectCalculationSnapshot,
    restoreCalculationSnapshot,
    pushCalculationSnapshot,
    undoCalculationSnapshot,
    redoCalculationSnapshot,
    getCalculationSnapshotHistory,
  }
}
