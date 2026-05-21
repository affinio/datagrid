import type {
  DataGridRowNode,
  DataGridViewportRange,
} from "../rowModel.js"

export interface CreateClientRowAccessHostRuntimeOptions<T> {
  ensureActive: () => void
  getMaterializedSourceRows: () => readonly DataGridRowNode<T>[]
  getRowRevision: () => number
  getFormulaStructureRevision: () => number
  getRows: () => readonly DataGridRowNode<T>[]
  normalizeViewportRange: (range: DataGridViewportRange, rowCount: number) => DataGridViewportRange
  materializeOutputRow: (row: DataGridRowNode<T> | undefined) => DataGridRowNode<T> | undefined
  materializeOutputRowsInRange: (
    rows: readonly DataGridRowNode<T>[],
    start: number,
    end: number,
  ) => DataGridRowNode<T>[]
}

export interface ClientRowAccessHostRuntime<T> {
  getSourceRows(): readonly DataGridRowNode<T>[]
  getSourceRowsRevision(): number
  getFormulaStructureRevision(): number
  getRowCount(): number
  getRow(index: number): DataGridRowNode<T> | undefined
  getRowsInRange(range: DataGridViewportRange): DataGridRowNode<T>[]
}

export function createClientRowAccessHostRuntime<T>(
  options: CreateClientRowAccessHostRuntimeOptions<T>,
): ClientRowAccessHostRuntime<T> {
  return {
    getSourceRows() {
      options.ensureActive()
      return options.getMaterializedSourceRows()
    },
    getSourceRowsRevision() {
      options.ensureActive()
      return options.getRowRevision()
    },
    getFormulaStructureRevision() {
      options.ensureActive()
      return options.getFormulaStructureRevision()
    },
    getRowCount() {
      return options.getRows().length
    },
    getRow(index) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      return options.materializeOutputRow(options.getRows()[Math.max(0, Math.trunc(index))])
    },
    getRowsInRange(range) {
      const rows = options.getRows()
      const normalized = options.normalizeViewportRange(range, rows.length)
      if (rows.length === 0) {
        return []
      }
      return options.materializeOutputRowsInRange(rows, normalized.start, normalized.end)
    },
  }
}
