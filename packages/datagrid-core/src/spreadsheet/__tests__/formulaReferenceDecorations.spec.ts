import { describe, expect, it } from "vitest"

import {
  analyzeDataGridSpreadsheetCellInput,
  createDataGridSpreadsheetFormulaReferenceDecorations,
  resolveDataGridSpreadsheetFormulaReferenceBounds,
} from "../index.js"

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
  allowSheetQualifiedReferences: true,
}

describe("spreadsheet formula reference decorations", () => {
  it("resolves rectangular bounds against the referenced sheet columns", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=orders![price]2:[qty]4", {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })
    const reference = analysis.references[0]

    expect(reference).toBeDefined()

    const bounds = resolveDataGridSpreadsheetFormulaReferenceBounds(reference!, {
      resolveSheet: (targetReference) => {
        if (targetReference.sheetReference !== "orders") {
          return null
        }
        return {
          id: "orders",
          columns: [
            { key: "qty" },
            { key: "price" },
            { key: "total" },
          ],
        }
      },
    })

    expect(bounds).toEqual({
      referenceKey: reference!.key,
      referencedSheetId: "orders",
      startRowIndex: 1,
      endRowIndex: 3,
      startColumnIndex: 0,
      endColumnIndex: 1,
      startColumnKey: "qty",
      endColumnKey: "price",
    })
  })

  it("builds active-sheet decorations and filters out references outside the active sheet", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=orders![qty]2 + [price]@row + summary![metric]1", {
      currentRowIndex: 1,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })
    const localReferenceKey = analysis.references.find(reference => reference.referenceName === "price")?.key ?? null

    const decorations = createDataGridSpreadsheetFormulaReferenceDecorations(analysis.references, {
      activeReferenceKey: localReferenceKey,
      activeSheetId: "orders",
      requireActiveSheet: true,
      resolveSheet: (reference) => {
        if (!reference.sheetReference || reference.sheetReference === "orders") {
          return {
            id: "orders",
            columns: [
              { key: "qty" },
              { key: "price" },
              { key: "total" },
            ],
          }
        }
        if (reference.sheetReference === "summary") {
          return {
            id: "summary",
            columns: [
              { key: "metric" },
              { key: "value" },
            ],
          }
        }
        return null
      },
    })

    expect(decorations).toHaveLength(2)
    expect(decorations.map(decoration => ({
      referenceKey: decoration.referenceKey,
      referencedSheetId: decoration.referencedSheetId,
      startColumnKey: decoration.startColumnKey,
      endColumnKey: decoration.endColumnKey,
      active: decoration.active,
    }))).toEqual([
      {
        referenceKey: analysis.references[0]?.key,
        referencedSheetId: "orders",
        startColumnKey: "qty",
        endColumnKey: "qty",
        active: false,
      },
      {
        referenceKey: localReferenceKey,
        referencedSheetId: "orders",
        startColumnKey: "price",
        endColumnKey: "price",
        active: true,
      },
    ])
  })

  it("resolves bounds for references that target a column formula alias", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=[Unit price]2", {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })
    const reference = analysis.references[0]

    expect(reference).toBeDefined()

    const bounds = resolveDataGridSpreadsheetFormulaReferenceBounds(reference!, {
      resolveSheet: () => ({
        id: "orders",
        columns: [
          { key: "qty", formulaAlias: "Qty" },
          { key: "price", formulaAlias: "Unit price" },
          { key: "total", formulaAlias: "Total" },
        ],
      }),
    })

    expect(bounds).toEqual({
      referenceKey: reference!.key,
      referencedSheetId: "orders",
      startRowIndex: 1,
      endRowIndex: 1,
      startColumnIndex: 1,
      endColumnIndex: 1,
      startColumnKey: "price",
      endColumnKey: "price",
    })
  })
})