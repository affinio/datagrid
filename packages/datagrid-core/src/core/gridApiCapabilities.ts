import type {
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridRowModel,
  DataGridSortAndFilterModelInput,
} from "../models"
import type {
  DataGridCoreSelectionService,
  DataGridCoreTransactionService,
} from "./gridCore"

export type DataGridSelectionCapability = Required<
  Pick<DataGridCoreSelectionService, "getSelectionSnapshot" | "setSelectionSnapshot" | "clearSelection">
>

export type DataGridPatchCapability<TRow = unknown> = {
  patchRows: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void
}

export type DataGridSortFilterBatchCapability = {
  setSortAndFilterModel: (input: DataGridSortAndFilterModelInput) => void
}

export type DataGridColumnHistogramCapability = {
  getColumnHistogram: (columnId: string, options?: DataGridColumnHistogramOptions) => DataGridColumnHistogram
}

export type DataGridTransactionCapability = Required<
  Pick<
    DataGridCoreTransactionService,
    | "getTransactionSnapshot"
    | "beginTransactionBatch"
    | "commitTransactionBatch"
    | "rollbackTransactionBatch"
    | "applyTransaction"
    | "canUndoTransaction"
    | "canRedoTransaction"
    | "undoTransaction"
    | "redoTransaction"
  >
>

export function resolveSelectionCapability(
  service: DataGridCoreSelectionService | null,
): DataGridSelectionCapability | null {
  if (!service) {
    return null
  }
  if (
    typeof service.getSelectionSnapshot !== "function" ||
    typeof service.setSelectionSnapshot !== "function" ||
    typeof service.clearSelection !== "function"
  ) {
    return null
  }
  return {
    getSelectionSnapshot: service.getSelectionSnapshot,
    setSelectionSnapshot: service.setSelectionSnapshot,
    clearSelection: service.clearSelection,
  }
}

export function resolveTransactionCapability(
  service: DataGridCoreTransactionService | null,
): DataGridTransactionCapability | null {
  if (!service) {
    return null
  }
  if (
    typeof service.getTransactionSnapshot !== "function" ||
    typeof service.beginTransactionBatch !== "function" ||
    typeof service.commitTransactionBatch !== "function" ||
    typeof service.rollbackTransactionBatch !== "function" ||
    typeof service.applyTransaction !== "function" ||
    typeof service.canUndoTransaction !== "function" ||
    typeof service.canRedoTransaction !== "function" ||
    typeof service.undoTransaction !== "function" ||
    typeof service.redoTransaction !== "function"
  ) {
    return null
  }

  return {
    getTransactionSnapshot: service.getTransactionSnapshot,
    beginTransactionBatch: service.beginTransactionBatch,
    commitTransactionBatch: service.commitTransactionBatch,
    rollbackTransactionBatch: service.rollbackTransactionBatch,
    applyTransaction: service.applyTransaction,
    canUndoTransaction: service.canUndoTransaction,
    canRedoTransaction: service.canRedoTransaction,
    undoTransaction: service.undoTransaction,
    redoTransaction: service.redoTransaction,
  }
}

export function assertSelectionCapability(
  capability: DataGridSelectionCapability | null,
): DataGridSelectionCapability {
  if (!capability) {
    throw new Error('[DataGridApi] "selection" service is present but does not implement selection capabilities.')
  }
  return capability
}

export function assertTransactionCapability(
  capability: DataGridTransactionCapability | null,
): DataGridTransactionCapability {
  if (!capability) {
    throw new Error(
      '[DataGridApi] "transaction" service is present but does not implement transaction capabilities.',
    )
  }
  return capability
}

export function resolvePatchCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): DataGridPatchCapability<TRow> | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<DataGridPatchCapability<TRow>>
  if (typeof candidate.patchRows !== "function") {
    return null
  }
  return {
    patchRows: candidate.patchRows.bind(rowModel),
  }
}

export function resolveSortFilterBatchCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): DataGridSortFilterBatchCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<DataGridSortFilterBatchCapability>
  if (typeof candidate.setSortAndFilterModel !== "function") {
    return null
  }
  return {
    setSortAndFilterModel: candidate.setSortAndFilterModel.bind(rowModel),
  }
}

export function resolveColumnHistogramCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): DataGridColumnHistogramCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<DataGridColumnHistogramCapability>
  if (typeof candidate.getColumnHistogram !== "function") {
    return null
  }
  return {
    getColumnHistogram: candidate.getColumnHistogram.bind(rowModel),
  }
}

export function assertPatchCapability<TRow>(
  capability: DataGridPatchCapability<TRow> | null,
): DataGridPatchCapability<TRow> {
  if (!capability) {
    throw new Error('[DataGridApi] rowModel does not implement patchRows capability.')
  }
  return capability
}
