import { describe, expect, it } from "vitest"
import {
  cloneCellAddress,
  formatSpreadsheetCellPreviewValue,
  normalizeCellRawInput,
  parsePlainCellDisplayValue,
} from "../spreadsheetCellRuntime.js"
import { createSpreadsheetCellStoreRuntime } from "../spreadsheetCellStoreRuntime.js"
import {
  collectSpreadsheetFormulaDependentClosure,
  createSpreadsheetFormulaDiagnosticError,
  deleteSpreadsheetFormulaDependentLink,
  setSpreadsheetFormulaDependentLinkInMap,
  type SpreadsheetFormulaCellState,
} from "../spreadsheetFormulaRuntime.js"
import { createSpreadsheetSheetStateRuntime } from "../spreadsheetSheetStateRuntime.js"
import {
  hasCurrentSheetAbsoluteReferencesAtOrAfter,
} from "../spreadsheetStructuralMutationRuntime.js"
import {
  resolveFormulaTableBindingName,
  resolveFormulaTableContextKey,
} from "../spreadsheetFormulaTableRuntime.js"
import {
  buildSpreadsheetColumnReferenceLookup,
  normalizeColumnKey,
  resolveSpreadsheetColumnKeysForReferenceRange,
} from "../spreadsheetReferenceRuntime.js"
import {
  areSpreadsheetSheetStatesEquivalent,
  mergeSpreadsheetStyles,
  normalizeSpreadsheetStyle,
} from "../spreadsheetStyleRuntime.js"
import type { DataGridSpreadsheetSheetState } from "../sheetModel.js"

describe("spreadsheet runtime helpers", () => {
  it("normalizes cell input and preview values without sheet state", () => {
    const date = new Date("2026-05-21T00:00:00.000Z")

    expect(normalizeCellRawInput(null)).toBe("")
    expect(normalizeCellRawInput(date)).toBe("2026-05-21T00:00:00.000Z")
    expect(parsePlainCellDisplayValue(" TRUE ")).toBe(true)
    expect(parsePlainCellDisplayValue("42.5")).toBe(42.5)
    expect(parsePlainCellDisplayValue("001A")).toBe("001A")
    expect(formatSpreadsheetCellPreviewValue(false)).toBe("FALSE")
    expect(formatSpreadsheetCellPreviewValue(new Date(Number.NaN))).toBe("")
    expect(cloneCellAddress({
      rowIndex: 3,
      columnKey: "amount",
    })).toEqual({
      sheetId: null,
      rowId: null,
      rowIndex: 3,
      columnKey: "amount",
    })
  })

  it("resolves column references with stable key priority and unique aliases", () => {
    const columns = [
      { key: "amount", formulaAlias: "Total Amount" },
      { key: "status", formulaAlias: "State" },
      { key: "state", formulaAlias: "State" },
    ]
    const lookup = buildSpreadsheetColumnReferenceLookup(columns)

    expect(normalizeColumnKey(" amount ")).toBe("amount")
    expect(lookup.get("amount")).toBe("amount")
    expect(resolveSpreadsheetColumnKeysForReferenceRange("Total Amount", "state", columns, lookup)).toEqual([
      "amount",
      "status",
      "state",
    ])
    expect(lookup.get("State")).toBeUndefined()
  })

  it("normalizes formula table context keys", () => {
    expect(resolveFormulaTableContextKey(" Orders ")).toBe("table:orders")
    expect(resolveFormulaTableContextKey("")).toBe("tables")
    expect(resolveFormulaTableBindingName("table:orders")).toBe("orders")
    expect(resolveFormulaTableBindingName("tables")).toBe("")
  })

  it("owns sparse raw input and cell style storage", () => {
    const store = createSpreadsheetCellStoreRuntime({
      rawInputByRowIndex: [new Map()],
      cellStyleByRowIndex: [new Map()],
    })

    store.setRawInput(0, "amount", "42")
    store.setCellStyle(0, "amount", { color: "red" })

    expect(store.hasRawInput(0, "amount")).toBe(true)
    expect(store.getRawInput(0, "amount")).toBe("42")
    expect([...store.iterateRawInputs()]).toEqual([["0\u001famount", "42"]])
    expect(store.getCellStyle(0, "amount")).toEqual({ color: "red" })

    store.deleteRawInput(0, "amount")
    store.deleteCellStyle(0, "amount")

    expect(store.hasRawInput(0, "amount")).toBe(false)
    expect(store.getCellStyle(0, "amount")).toBeUndefined()
  })

  it("owns sheet row and column state indexes", () => {
    const runtime = createSpreadsheetSheetStateRuntime({
      columns: [{ key: "amount" }],
      rows: [{ id: "row-1" }],
    })

    const cellKey = runtime.resolveCellKey({ rowIndex: 0, columnKey: "amount" })

    expect(runtime.columns[0]?.title).toBe("amount")
    expect(runtime.rowIndexById.get("row-1")).toBe(0)
    expect(cellKey).toBe("0\u001famount")
    expect(runtime.resolveAddressFromCellKey("sheet-a", cellKey)).toEqual({
      sheetId: "sheet-a",
      rowId: "row-1",
      rowIndex: 0,
      columnKey: "amount",
    })
    expect(runtime.setResolvedCellValueOnRow(runtime.rows[0], "amount", 42)).toBe(true)
    expect(runtime.getResolvedCellValue(runtime.rows[0], "amount")).toBe(42)
    expect(runtime.createResolvedRowData(runtime.rows[0]!)).toEqual({ amount: 42 })
  })

  it("owns formula dependent closure helpers", () => {
    const dependentsByCellKey = new Map<string, Set<string>>()
    const formulaCell = {
      key: "1\u001famount",
      address: { rowIndex: 1, columnKey: "amount" },
      analysis: {
        diagnostics: [{ message: "Invalid amount" }],
      },
    } as SpreadsheetFormulaCellState
    const formulaCellByKey = new Map<string, SpreadsheetFormulaCellState>([[formulaCell.key, formulaCell]])

    setSpreadsheetFormulaDependentLinkInMap(dependentsByCellKey, "0\u001famount", formulaCell.key)

    expect([...collectSpreadsheetFormulaDependentClosure(
      new Set(["0\u001famount"]),
      dependentsByCellKey,
      formulaCellByKey,
    )]).toEqual([formulaCell.key])
    expect(createSpreadsheetFormulaDiagnosticError(formulaCell.analysis).message).toBe("Invalid amount")

    deleteSpreadsheetFormulaDependentLink(dependentsByCellKey, "0\u001famount", formulaCell.key)

    expect(dependentsByCellKey.size).toBe(0)
  })

  it("owns structural absolute-reference detection", () => {
    const runtimeModel = {
      bindings: [{
        kind: "reference",
        sheetReference: null,
        rowSelector: { kind: "absolute", rowIndex: 4 },
      }],
    }
    const isCurrentSheetReference = () => true

    expect(hasCurrentSheetAbsoluteReferencesAtOrAfter(runtimeModel, 4, isCurrentSheetReference)).toBe(true)
    expect(hasCurrentSheetAbsoluteReferencesAtOrAfter(runtimeModel, 5, isCurrentSheetReference)).toBe(false)
  })

  it("compares and merges spreadsheet styles outside the sheet facade", () => {
    const baseState: DataGridSpreadsheetSheetState = {
      sheetId: "sheet-a",
      sheetName: "Sheet A",
      columns: [{ key: "amount", title: "Amount", formulaAlias: "Amount", style: null }],
      rows: [{
        id: "row-1",
        style: null,
        cells: [{ columnKey: "amount", rawInput: "42", resolvedValue: 42, style: null }],
      }],
      sheetStyle: null,
      formulaTables: [],
      runtimeErrorPolicy: "error-value",
    }
    const equivalentState: DataGridSpreadsheetSheetState = {
      ...baseState,
      rows: [{
        id: "row-1",
        style: null,
        cells: [{ columnKey: "amount", rawInput: "42", resolvedValue: 100, style: null }],
      }],
    }
    const style = normalizeSpreadsheetStyle({ color: "red", "": "ignored" })

    expect(style).toEqual({ color: "red" })
    expect(Object.isFrozen(style)).toBe(true)
    expect(mergeSpreadsheetStyles({ color: "red" }, { width: 120 }, { color: "blue" }, null)).toEqual({
      color: "blue",
      width: 120,
    })
    expect(areSpreadsheetSheetStatesEquivalent(baseState, equivalentState)).toBe(true)
  })
})
