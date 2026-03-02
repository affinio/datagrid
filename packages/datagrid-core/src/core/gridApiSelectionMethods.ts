import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type { DataGridSelectionSummarySnapshot } from "../selection/selectionSummary"
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
}

export interface CreateDataGridApiSelectionMethodsInput<TRow = unknown> {
  getSelectionCapability: () => DataGridSelectionCapability | null
  summarize: (
    selectionSnapshot: DataGridSelectionSnapshot,
    options?: DataGridSelectionSummaryApiOptions<TRow>,
  ) => DataGridSelectionSummarySnapshot | null
}

export function createDataGridApiSelectionMethods<TRow = unknown>(
  input: CreateDataGridApiSelectionMethodsInput<TRow>,
): DataGridApiSelectionMethods<TRow> {
  const { getSelectionCapability, summarize } = input

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
    },
    clearSelection() {
      const selection = assertSelectionCapability(getSelectionCapability())
      selection.clearSelection()
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
  }
}
