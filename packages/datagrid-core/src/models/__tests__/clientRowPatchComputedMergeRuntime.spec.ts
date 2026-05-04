import { describe, expect, it } from "vitest"
import { createClientRowPatchComputedMergeRuntime } from "../mutation/clientRowPatchComputedMergeRuntime"
import type { ApplyClientRowPatchUpdatesResult } from "../mutation/clientRowPatchRuntime"
import type { DataGridRowNode } from "../rowModel"

type RowShape = {
  id: string
  score: number
}

function createLeaf(rowId: string, row: RowShape): DataGridRowNode<RowShape> {
  return {
    kind: "leaf",
    data: row,
    row,
    rowKey: rowId,
    rowId,
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: 0,
    state: {},
  }
}

describe("clientRowPatchComputedMergeRuntime", () => {
  it("skips computed merge work when no computed fields are registered", () => {
    const previousRow = createLeaf("r1", { id: "r1", score: 1 })
    const nextRow = createLeaf("r1", { id: "r1", score: 2 })
    const nextSourceRows = [nextRow]
    const patchResult: ApplyClientRowPatchUpdatesResult<RowShape> = {
      nextSourceRows,
      changed: true,
      computedChanged: false,
      changedRowIds: ["r1"],
      changedUpdatesById: new Map([["r1", { score: 2 }]]),
      previousRowsById: new Map([["r1", previousRow]]),
      nextRowsById: new Map([["r1", nextRow]]),
    }
    const prepared: Array<{
      rows: readonly DataGridRowNode<RowShape>[]
      rowIds: readonly string[]
    }> = []
    const invalidatedRowIds: string[] = []

    const runtime = createClientRowPatchComputedMergeRuntime<RowShape>({
      hasComputedFields: () => false,
      invalidateSourceColumnValuesByRowIds: rowIds => {
        invalidatedRowIds.push(...rowIds.map(String))
      },
      isRecord: value => typeof value === "object" && value !== null,
      applyComputedFieldsToSourceRows: () => {
        throw new Error("computed fields should not run")
      },
      commitFormulaDiagnostics: () => {
        throw new Error("formula diagnostics should not be committed")
      },
      commitFormulaComputeStageDiagnostics: () => {
        throw new Error("compute diagnostics should not be committed")
      },
      commitFormulaRowRecomputeDiagnostics: () => {
        throw new Error("row recompute diagnostics should not be committed")
      },
      mergeRowPatch: (current, patch) => ({ ...current, ...patch }),
      getBaseSourceRows: () => nextSourceRows,
      getMaterializedSourceRowAtIndex: () => {
        throw new Error("materialized rows should not be read")
      },
      getSourceRowIndexById: () => new Map([["r1", 0]]),
      preparePatchedBaseRows: (rows, rowIds) => {
        prepared.push({ rows, rowIds: rowIds.map(String) })
      },
    })

    const result = runtime.applyComputedFieldsToPatchResult(patchResult)

    expect(result).toBe(patchResult)
    expect(prepared).toEqual([{ rows: nextSourceRows, rowIds: ["r1"] }])
    expect(invalidatedRowIds).toEqual(["r1"])
  })
})
