import {
  cloneSpreadsheetSheetColumnMutation,
  cloneSpreadsheetSheetRowMutation,
} from "./spreadsheetMutationSnapshotRuntime.js"
import type {
  DataGridSpreadsheetSheetColumnMutation,
  DataGridSpreadsheetSheetListener,
  DataGridSpreadsheetSheetRowMutation,
  DataGridSpreadsheetSheetRowMutationKind,
  DataGridSpreadsheetSheetSnapshot,
} from "./sheetModel.js"

export interface SpreadsheetSheetSnapshotMetrics {
  rowCount: number
  columnCount: number
  formulaCellCount: number
  errorCellCount: number
}

export interface SpreadsheetSheetLifecycleRuntimeOptions {
  sheetId: string | null
  sheetName: string | null
  getMetrics: () => SpreadsheetSheetSnapshotMetrics
}

export interface SpreadsheetSheetLifecycleRuntime {
  ensureActive(): void
  getSnapshot(): DataGridSpreadsheetSheetSnapshot
  emit(): void
  subscribe(listener: DataGridSpreadsheetSheetListener): () => void
  dispose(clear: () => void): void
  incrementRevision(): void
  incrementValueRevision(): void
  incrementFormulaStructureRevision(): void
  incrementStyleRevision(): void
  recordRowMutation(kind: DataGridSpreadsheetSheetRowMutationKind, index: number, count: number): void
  recordColumnRenameMutation(previousKey: string, nextKey: string): void
  clearMutations(): void
  resetRevisions(): void
  getValueRevision(): number
  getFormulaStructureRevision(): number
}

export function createSpreadsheetSheetLifecycleRuntime(
  options: SpreadsheetSheetLifecycleRuntimeOptions,
): SpreadsheetSheetLifecycleRuntime {
  let disposed = false
  let revision = 0
  let valueRevision = 0
  let formulaStructureRevision = 0
  let styleRevision = 0
  let rowMutationRevision = 0
  let columnMutationRevision = 0
  let lastRowMutation: DataGridSpreadsheetSheetRowMutation | null = null
  let lastColumnMutation: DataGridSpreadsheetSheetColumnMutation | null = null
  const listeners = new Set<DataGridSpreadsheetSheetListener>()

  const getSnapshot = (): DataGridSpreadsheetSheetSnapshot => {
    const metrics = options.getMetrics()
    return {
      revision,
      valueRevision,
      formulaStructureRevision,
      styleRevision,
      rowCount: metrics.rowCount,
      columnCount: metrics.columnCount,
      formulaCellCount: metrics.formulaCellCount,
      errorCellCount: metrics.errorCellCount,
      sheetId: options.sheetId,
      sheetName: options.sheetName,
      lastRowMutation: cloneSpreadsheetSheetRowMutation(lastRowMutation),
      lastColumnMutation: cloneSpreadsheetSheetColumnMutation(lastColumnMutation),
    }
  }

  return {
    ensureActive() {
      if (disposed) {
        throw new Error("DataGridSpreadsheetSheetModel has been disposed")
      }
    },
    getSnapshot,
    emit() {
      if (listeners.size === 0 || disposed) {
        return
      }
      const snapshot = getSnapshot()
      for (const listener of listeners) {
        listener(snapshot)
      }
    },
    subscribe(listener) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose(clear) {
      if (disposed) {
        return
      }
      disposed = true
      listeners.clear()
      clear()
      revision = 0
      valueRevision = 0
      formulaStructureRevision = 0
      styleRevision = 0
    },
    incrementRevision() {
      revision += 1
    },
    incrementValueRevision() {
      valueRevision += 1
    },
    incrementFormulaStructureRevision() {
      formulaStructureRevision += 1
    },
    incrementStyleRevision() {
      styleRevision += 1
    },
    recordRowMutation(kind, index, count) {
      rowMutationRevision += 1
      lastRowMutation = {
        revision: rowMutationRevision,
        kind,
        index,
        count,
      }
    },
    recordColumnRenameMutation(previousKey, nextKey) {
      columnMutationRevision += 1
      lastColumnMutation = {
        revision: columnMutationRevision,
        kind: "rename",
        previousKey,
        nextKey,
      }
    },
    clearMutations() {
      lastRowMutation = null
      lastColumnMutation = null
    },
    resetRevisions() {
      revision = 0
      valueRevision = 0
      formulaStructureRevision = 0
      styleRevision = 0
    },
    getValueRevision() {
      return valueRevision
    },
    getFormulaStructureRevision() {
      return formulaStructureRevision
    },
  }
}
