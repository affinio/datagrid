import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type { DataGridSelectionSummarySnapshot } from "../selection/selectionSummary"
import type {
  DataGridRowModel,
} from "../models/index.js"
import {
  assertSelectionCapability,
  type DataGridSelectionCapability,
} from "./gridApiCapabilities"
import type { DataGridSelectionSummaryApiOptions } from "./gridApiContracts"

export interface DataGridApiSelectionMethods<TRow = unknown> {
  hasSelectionSupport: () => boolean
  getSelectionSnapshot: () => DataGridSelectionSnapshot | null
  setSelectionSnapshot: (snapshot: DataGridSelectionSnapshot) => void
  clearSelection: () => void
  summarizeSelection: (options?: DataGridSelectionSummaryApiOptions<TRow>) => DataGridSelectionSummarySnapshot | null
  getRangeRowData: () => TRow[]
}

export interface CreateDataGridApiSelectionMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getSelectionCapability: () => DataGridSelectionCapability | null
  onChanged?: (snapshot: DataGridSelectionSnapshot | null) => void
  summarize: (
    selectionSnapshot: DataGridSelectionSnapshot,
    options?: DataGridSelectionSummaryApiOptions<TRow>,
  ) => DataGridSelectionSummarySnapshot | null
}

export function createDataGridApiSelectionMethods<TRow = unknown>(
  input: CreateDataGridApiSelectionMethodsInput<TRow>,
): DataGridApiSelectionMethods<TRow> {
  const { rowModel, getSelectionCapability, summarize, onChanged } = input

  return {
    hasSelectionSupport() {
      return getSelectionCapability() !== null
    },
    getSelectionSnapshot() {
      const selectionCapability = getSelectionCapability()
      if (!selectionCapability) {
        return null
      }
      return selectionCapability.getSelectionSnapshot()
    },
    setSelectionSnapshot(snapshot: DataGridSelectionSnapshot) {
      const selection = assertSelectionCapability(getSelectionCapability())
      selection.setSelectionSnapshot(snapshot)
      onChanged?.(selection.getSelectionSnapshot())
    },
    clearSelection() {
      const selection = assertSelectionCapability(getSelectionCapability())
      selection.clearSelection()
      onChanged?.(selection.getSelectionSnapshot())
    },
    summarizeSelection(options: DataGridSelectionSummaryApiOptions<TRow> = {}) {
      const selectionCapability = getSelectionCapability()
      if (!selectionCapability) {
        return null
      }
      const selectionSnapshot = selectionCapability.getSelectionSnapshot()
      if (!selectionSnapshot) {
        return null
      }
      return summarize(selectionSnapshot, options)
    },
    getRangeRowData() {
      const selectionSnapshot = getSelectionCapability()?.getSelectionSnapshot() ?? null
      const materialRanges = selectionSnapshot?.ranges.filter(range => (
        range.startRow !== range.endRow || range.startCol !== range.endCol
      )) ?? []
      if (materialRanges.length === 0) {
        return []
      }

      const rowCount = rowModel.getRowCount()
      if (rowCount <= 0) {
        return []
      }
      const touchedRowIndexes = new Set<number>()
      for (const range of materialRanges) {
        const startRow = Math.max(0, Math.min(rowCount - 1, Math.min(range.startRow, range.endRow)))
        const endRow = Math.max(0, Math.min(rowCount - 1, Math.max(range.startRow, range.endRow)))
        for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
          touchedRowIndexes.add(rowIndex)
        }
      }

      return Array.from(touchedRowIndexes)
        .sort((left, right) => left - right)
        .map(rowIndex => rowModel.getRow(rowIndex))
        .filter((rowNode): rowNode is NonNullable<ReturnType<DataGridRowModel<TRow>["getRow"]>> => (
          rowNode?.kind === "leaf"
        ))
        .map(rowNode => rowNode.data)
    },
  }
}
