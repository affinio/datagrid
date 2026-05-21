import { describe, expect, it } from "vitest"
import {
  cloneCellAddress,
  formatSpreadsheetCellPreviewValue,
  normalizeCellRawInput,
  parsePlainCellDisplayValue,
} from "../spreadsheetCellRuntime.js"
import { createSpreadsheetCellStoreRuntime } from "../spreadsheetCellStoreRuntime.js"
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
