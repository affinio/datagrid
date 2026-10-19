import { describe, expect, it } from "vitest"
import type { DataGridSpreadsheetFormulaReferenceBinding } from "../formulaEditorModel"
import { rewriteSpreadsheetWorkbookRowReference } from "../workbookReferenceMutation"

function reference(
  rowSelector: Extract<DataGridSpreadsheetFormulaReferenceBinding, { kind: "reference" }>["rowSelector"],
): DataGridSpreadsheetFormulaReferenceBinding {
  return {
    key: "binding",
    index: 0,
    kind: "reference",
    sheetReference: "Orders",
    referenceName: "amount",
    rangeReferenceName: null,
    rowSelector,
  }
}

describe("rewriteSpreadsheetWorkbookRowReference", () => {
  const aliases = new Set(["orders"])

  it("shifts absolute rows and ranges on insertion", () => {
    expect(rewriteSpreadsheetWorkbookRowReference(reference({ kind: "absolute", rowIndex: 4 }), aliases, {
      revision: 1,
      kind: "insert",
      index: 3,
      count: 2,
    })).toMatchObject({ rowSelector: { kind: "absolute", rowIndex: 6 } })

    expect(rewriteSpreadsheetWorkbookRowReference(reference({ kind: "absolute-window", startRowIndex: 1, endRowIndex: 4 }), aliases, {
      revision: 2,
      kind: "insert",
      index: 3,
      count: 2,
    })).toMatchObject({ rowSelector: { kind: "absolute-window", startRowIndex: 1, endRowIndex: 6 } })
  })

  it("invalidates deleted points and keeps surviving absolute range indexes contiguous", () => {
    expect(rewriteSpreadsheetWorkbookRowReference(reference({ kind: "absolute", rowIndex: 3 }), aliases, {
      revision: 3,
      kind: "remove",
      index: 2,
      count: 2,
    })).toEqual({ key: "binding", index: 0, kind: "invalid" })

    expect(rewriteSpreadsheetWorkbookRowReference(reference({ kind: "absolute-window", startRowIndex: 1, endRowIndex: 3 }), aliases, {
      revision: 4,
      kind: "remove",
      index: 2,
      count: 1,
    })).toMatchObject({ rowSelector: { kind: "absolute-window", startRowIndex: 1, endRowIndex: 2 } })
  })

  it("ignores current sheet and nonmatching aliases", () => {
    expect(rewriteSpreadsheetWorkbookRowReference(reference({ kind: "absolute", rowIndex: 3 }), new Set(["customers"]), {
      revision: 5,
      kind: "insert",
      index: 2,
      count: 1,
    })).toBeNull()
    expect(rewriteSpreadsheetWorkbookRowReference({
      key: "current",
      index: 1,
      kind: "reference",
      sheetReference: null,
      referenceName: "amount",
      rangeReferenceName: null,
      rowSelector: { kind: "absolute", rowIndex: 3 },
    }, aliases, { revision: 6, kind: "insert", index: 2, count: 1 })).toBeNull()
  })
})
