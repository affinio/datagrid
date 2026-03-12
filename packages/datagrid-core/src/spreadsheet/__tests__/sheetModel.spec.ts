import { describe, expect, it } from "vitest"
import { createDataGridSpreadsheetSheetModel } from "../index.js"

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
}

const SHEET_QUALIFIED_REFERENCE_OPTIONS = {
  ...SPREADSHEET_REFERENCE_OPTIONS,
  allowSheetQualifiedReferences: true as const,
}

describe("createDataGridSpreadsheetSheetModel", () => {
  it("rewrites surviving absolute references when rows are removed", () => {
    const sheet = createDataGridSpreadsheetSheetModel({
      sheetId: "orders",
      sheetName: "Orders",
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      columns: [{ key: "value" }, { key: "echo" }],
      rows: [
        {
          id: "row-1",
          cells: {
            value: 10,
            echo: "=[value]4",
          },
        },
        {
          id: "row-2",
          cells: {
            value: 20,
          },
        },
        {
          id: "row-3",
          cells: {
            value: 30,
          },
        },
        {
          id: "row-4",
          cells: {
            value: 40,
          },
        },
      ],
    })

    expect(sheet.removeRowsAt(1, 1)).toBe(true)

    const cell = sheet.getCell({
      sheetId: "orders",
      rowId: "row-1",
      rowIndex: 0,
      columnKey: "echo",
    })
    const snapshot = sheet.getSnapshot()

    expect(snapshot.rowCount).toBe(3)
    expect(snapshot.lastRowMutation).toEqual({
      revision: 1,
      kind: "remove",
      index: 1,
      count: 1,
    })
    expect(cell?.rawInput).toBe("=[value]3")
    expect(cell?.displayValue).toBe(40)

    sheet.dispose()
  })

  it("marks deleted absolute references as #REF!", () => {
    const sheet = createDataGridSpreadsheetSheetModel({
      sheetId: "orders",
      sheetName: "Orders",
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      columns: [{ key: "value" }, { key: "echo" }],
      rows: [
        {
          id: "row-1",
          cells: {
            value: 10,
            echo: "=[value]2",
          },
        },
        {
          id: "row-2",
          cells: {
            value: 20,
          },
        },
        {
          id: "row-3",
          cells: {
            value: 30,
          },
        },
      ],
    })

    expect(sheet.removeRowsAt(1)).toBe(true)

    const cell = sheet.getCell({
      sheetId: "orders",
      rowId: "row-1",
      rowIndex: 0,
      columnKey: "echo",
    })
    const snapshot = sheet.getSnapshot()

    expect(snapshot.lastRowMutation).toEqual({
      revision: 1,
      kind: "remove",
      index: 1,
      count: 1,
    })
    expect(cell?.rawInput).toBe("=#REF!")
    expect(cell?.analysis.isFormulaValid).toBe(false)
    expect(cell?.errorValue).not.toBeNull()

    sheet.dispose()
  })

  it("preserves shifted row-relative formulas across row inserts and removals", () => {
    const sheet = createDataGridSpreadsheetSheetModel({
      sheetId: "orders",
      sheetName: "Orders",
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      columns: [{ key: "qty" }, { key: "price" }, { key: "total" }],
      rows: [
        {
          id: "row-1",
          cells: {
            qty: 2,
            price: 10,
            total: "=[qty]@row * [price]@row",
          },
        },
        {
          id: "row-2",
          cells: {
            qty: 3,
            price: 7,
            total: "=[qty]@row * [price]@row",
          },
        },
      ],
    })

    expect(sheet.insertRowsAt(0, [{
      id: "row-0",
      cells: {
        qty: 5,
        price: 4,
        total: "=[qty]@row * [price]@row",
      },
    }])).toBe(true)

    expect(sheet.getCell({
      sheetId: "orders",
      rowId: "row-0",
      rowIndex: 0,
      columnKey: "total",
    })?.displayValue).toBe(20)
    expect(sheet.getCell({
      sheetId: "orders",
      rowId: "row-1",
      rowIndex: 1,
      columnKey: "total",
    })?.displayValue).toBe(20)
    expect(sheet.getCell({
      sheetId: "orders",
      rowId: "row-2",
      rowIndex: 2,
      columnKey: "total",
    })?.displayValue).toBe(21)

    expect(sheet.removeRowsAt(0, 1)).toBe(true)
    expect(sheet.getCell({
      sheetId: "orders",
      rowId: "row-1",
      rowIndex: 0,
      columnKey: "total",
    })?.displayValue).toBe(20)
    expect(sheet.getCell({
      sheetId: "orders",
      rowId: "row-2",
      rowIndex: 1,
      columnKey: "total",
    })?.displayValue).toBe(21)

    sheet.dispose()
  })

  it("surfaces missing sheet-qualified references as errors instead of falling back to the local sheet", () => {
    const sheet = createDataGridSpreadsheetSheetModel({
      sheetId: "summary",
      sheetName: "Summary",
      referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
      columns: [{ key: "value" }, { key: "echo" }],
      rows: [
        {
          id: "summary-1",
          cells: {
            value: 999,
            echo: "=orders![value]1",
          },
        },
      ],
    })

    const cell = sheet.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "echo",
    })

    expect(cell?.displayValue).toMatchObject({
      kind: "error",
      code: "EVAL_ERROR",
    })
    expect(cell?.errorValue?.message).toContain("Unknown sheet reference 'orders'")
    expect(cell?.analysis.diagnostics[0]?.message).toContain("Unknown sheet reference 'orders'")

    sheet.dispose()
  })
})
