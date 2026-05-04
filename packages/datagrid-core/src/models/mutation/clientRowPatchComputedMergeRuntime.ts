import type {
  DataGridRowId,
  DataGridRowNode,
} from "../rowModel.js"
import type { ApplyClientRowPatchUpdatesResult } from "./clientRowPatchRuntime.js"
import type {
  ApplyComputedFieldsToSourceRowsOptions,
  ApplyComputedFieldsToSourceRowsResult,
} from "../compute/clientRowComputedExecutionRuntime.js"

export interface ClientRowPatchComputedMergeRuntimeContext<T> {
  invalidateSourceColumnValuesByRowIds: (rowIds: readonly DataGridRowId[]) => void
  isRecord: (value: unknown) => value is Record<string, unknown>
  applyComputedFieldsToSourceRows: (
    options?: ApplyComputedFieldsToSourceRowsOptions,
  ) => ApplyComputedFieldsToSourceRowsResult<T>
  commitFormulaDiagnostics: (diagnostics: ApplyComputedFieldsToSourceRowsResult<T>["formulaDiagnostics"]) => void
  commitFormulaComputeStageDiagnostics: (diagnostics: ApplyComputedFieldsToSourceRowsResult<T>["computeStageDiagnostics"]) => void
  commitFormulaRowRecomputeDiagnostics: (diagnostics: ApplyComputedFieldsToSourceRowsResult<T>["rowRecomputeDiagnostics"]) => void
  mergeRowPatch: (current: Partial<T>, patch: Partial<T>) => Partial<T>
  getBaseSourceRows: () => readonly DataGridRowNode<T>[]
  getMaterializedSourceRowAtIndex: (rowIndex: number) => DataGridRowNode<T> | null | undefined
  getSourceRowIndexById: () => ReadonlyMap<DataGridRowId, number>
  preparePatchedBaseRows: (rows: readonly DataGridRowNode<T>[], changedRowIds: readonly DataGridRowId[]) => void
  hasComputedFields: () => boolean
}

export interface ClientRowPatchComputedMergeRuntime<T> {
  applyComputedFieldsToPatchResult: (
    patchResult: ApplyClientRowPatchUpdatesResult<T>,
  ) => ApplyClientRowPatchUpdatesResult<T>
}

export function createClientRowPatchComputedMergeRuntime<T>(
  context: ClientRowPatchComputedMergeRuntimeContext<T>,
): ClientRowPatchComputedMergeRuntime<T> {
  const applyComputedFieldsToPatchResult = (
    patchResult: ApplyClientRowPatchUpdatesResult<T>,
  ): ApplyClientRowPatchUpdatesResult<T> => {
    if (!context.hasComputedFields()) {
      context.preparePatchedBaseRows(patchResult.nextSourceRows, patchResult.changedRowIds)
      context.invalidateSourceColumnValuesByRowIds(patchResult.changedRowIds)
      return patchResult
    }

    const sourceRowIndexById = context.getSourceRowIndexById()
    const previousEffectiveRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    for (const rowId of patchResult.changedRowIds) {
      const rowIndex = sourceRowIndexById.get(rowId)
      const previousRow = typeof rowIndex === "number"
        ? context.getMaterializedSourceRowAtIndex(rowIndex)
        : undefined
      if (previousRow) {
        previousEffectiveRowsById.set(rowId, previousRow)
      }
    }
    context.preparePatchedBaseRows(patchResult.nextSourceRows, patchResult.changedRowIds)
    context.invalidateSourceColumnValuesByRowIds(patchResult.changedRowIds)
    const changedFieldsByRowId = new Map<DataGridRowId, ReadonlySet<string>>()
    for (const [rowId, patch] of patchResult.changedUpdatesById.entries()) {
      const fields = new Set<string>()
      if (context.isRecord(patch)) {
        for (const key of Object.keys(patch)) {
          fields.add(key)
        }
      }
      changedFieldsByRowId.set(rowId, fields)
    }
    const computedResult = context.applyComputedFieldsToSourceRows({
      rowIds: new Set<DataGridRowId>(patchResult.changedRowIds),
      changedFieldsByRowId,
      captureRowPatchMaps: true,
    })
    context.commitFormulaDiagnostics(computedResult.formulaDiagnostics)
    context.commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
    context.commitFormulaRowRecomputeDiagnostics(computedResult.rowRecomputeDiagnostics)
    const materializedNextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    for (const rowId of patchResult.changedRowIds) {
      const rowIndex = sourceRowIndexById.get(rowId)
      const nextRow = typeof rowIndex === "number"
        ? context.getMaterializedSourceRowAtIndex(rowIndex)
        : undefined
      if (nextRow) {
        materializedNextRowsById.set(rowId, nextRow)
      }
    }
    if (!computedResult.changed) {
      return {
        ...patchResult,
        nextSourceRows: context.getBaseSourceRows(),
        previousRowsById: previousEffectiveRowsById,
        nextRowsById: materializedNextRowsById,
      }
    }

    const mergedChangedUpdatesById = new Map<DataGridRowId, Partial<T>>(patchResult.changedUpdatesById)
    for (const [rowId, computedPatch] of computedResult.computedUpdatesByRowId.entries()) {
      const existingPatch = mergedChangedUpdatesById.get(rowId)
      if (existingPatch) {
        mergedChangedUpdatesById.set(rowId, context.mergeRowPatch(existingPatch, computedPatch))
      } else {
        mergedChangedUpdatesById.set(rowId, computedPatch)
      }
    }

    const mergedPreviousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>(previousEffectiveRowsById)
    for (const [rowId, previousRow] of computedResult.previousRowsById.entries()) {
      if (!mergedPreviousRowsById.has(rowId)) {
        mergedPreviousRowsById.set(rowId, previousRow)
      }
    }

    const mergedNextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>(materializedNextRowsById)
    for (const [rowId, nextRow] of computedResult.nextRowsById.entries()) {
      mergedNextRowsById.set(rowId, nextRow)
    }

    const changedRowIdSet = new Set<DataGridRowId>(patchResult.changedRowIds)
    for (const rowId of computedResult.changedRowIds) {
      changedRowIdSet.add(rowId)
    }

    return {
      nextSourceRows: context.getBaseSourceRows(),
      changed: true,
      computedChanged: true,
      changedRowIds: Array.from(changedRowIdSet),
      changedUpdatesById: mergedChangedUpdatesById,
      previousRowsById: mergedPreviousRowsById,
      nextRowsById: mergedNextRowsById,
    } satisfies ApplyClientRowPatchUpdatesResult<T>
  }

  return {
    applyComputedFieldsToPatchResult,
  }
}
