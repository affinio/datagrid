import { describe, expect, it } from "vitest"
import {
  createDataGridSpreadsheetSheetModel,
  createDataGridSpreadsheetWorkbookModel,
} from "../index.js"

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
}

const SHEET_QUALIFIED_REFERENCE_OPTIONS = {
  ...SPREADSHEET_REFERENCE_OPTIONS,
  allowSheetQualifiedReferences: true as const,
}

describe("createDataGridSpreadsheetWorkbookModel", () => {
  it("computes cross-sheet formula values immediately on workbook creation", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      activeSheetId: "orders",
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
            columns: [{ key: "customerId" }, { key: "total" }, { key: "customerName" }],
            rows: [
              {
                id: "order-1",
                cells: {
                  customerId: 1,
                  total: 100,
                  customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')",
                },
              },
              {
                id: "order-2",
                cells: {
                  customerId: 2,
                  total: 200,
                  customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')",
                },
              },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
            columns: [{ key: "id" }, { key: "name" }, { key: "ordersCount" }, { key: "totalSpend" }],
            rows: [
              {
                id: "customer-1",
                cells: {
                  id: 1,
                  name: "Atlas",
                  ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'customerId', 'count', 0)",
                  totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)",
                },
              },
              {
                id: "customer-2",
                cells: {
                  id: 2,
                  name: "Northwind",
                  ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'customerId', 'count', 0)",
                  totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)",
                },
              },
            ],
          },
        },
        {
          id: "summary",
          name: "Summary",
          sheetModelOptions: {
            referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
            columns: [{ key: "metric" }, { key: "value" }],
            rows: [
              {
                id: "summary-1",
                cells: {
                  metric: "Gross sales",
                  value: "=SUM(TABLE('orders', 'total'))",
                },
              },
              {
                id: "summary-2",
                cells: {
                  metric: "Top customer spend",
                  value: "=MAX(TABLE('customers', 'totalSpend'))",
                },
              },
            ],
          },
        },
      ],
    })

    const ordersSheet = workbook.getSheet("orders")?.sheetModel
    const customersSheet = workbook.getSheet("customers")?.sheetModel
    const summarySheet = workbook.getSheet("summary")?.sheetModel

    expect(ordersSheet?.getCell({ sheetId: "orders", rowId: "order-1", rowIndex: 0, columnKey: "customerName" })?.displayValue).toBe("Atlas")
    expect(ordersSheet?.getCell({ sheetId: "orders", rowId: "order-2", rowIndex: 1, columnKey: "customerName" })?.displayValue).toBe("Northwind")
    expect(customersSheet?.getCell({ sheetId: "customers", rowId: "customer-1", rowIndex: 0, columnKey: "ordersCount" })?.displayValue).toBe(1)
    expect(customersSheet?.getCell({ sheetId: "customers", rowId: "customer-1", rowIndex: 0, columnKey: "totalSpend" })?.displayValue).toBe(100)
    expect(summarySheet?.getCell({ sheetId: "summary", rowId: "summary-1", rowIndex: 0, columnKey: "value" })?.displayValue).toBe(300)
    expect(summarySheet?.getCell({ sheetId: "summary", rowId: "summary-2", rowIndex: 1, columnKey: "value" })?.displayValue).toBe(200)

    workbook.dispose()
  })

  it("computes row-relative formulas immediately on sheet creation", () => {
    const sheet = createDataGridSpreadsheetSheetModel({
      sheetId: "orders",
      sheetName: "Orders",
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      columns: [{ key: "qty" }, { key: "price" }, { key: "total" }],
      rows: [
        {
          id: "order-1",
          cells: {
            qty: 4,
            price: 420,
            total: "=[qty]@row * [price]@row",
          },
        },
        {
          id: "order-2",
          cells: {
            qty: 2,
            price: 780,
            total: "=[qty]@row * [price]@row",
          },
        },
      ],
    })

    expect(sheet.getCell({ sheetId: "orders", rowId: "order-1", rowIndex: 0, columnKey: "total" })?.displayValue).toBe(1680)
    expect(sheet.getCell({ sheetId: "orders", rowId: "order-2", rowIndex: 1, columnKey: "total" })?.displayValue).toBe(1560)

    sheet.dispose()
  })

  it("computes cross-sheet formulas immediately when bootstrapped from provided sheet models", () => {
    const ordersSheet = createDataGridSpreadsheetSheetModel({
      sheetId: "orders",
      sheetName: "Orders",
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      columns: [{ key: "customerId" }, { key: "total" }, { key: "customerName" }],
      rows: [
        {
          id: "order-1",
          cells: {
            customerId: 1,
            total: 100,
            customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')",
          },
        },
      ],
    })
    const customersSheet = createDataGridSpreadsheetSheetModel({
      sheetId: "customers",
      sheetName: "Customers",
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      columns: [{ key: "id" }, { key: "name" }, { key: "totalSpend" }],
      rows: [
        {
          id: "customer-1",
          cells: {
            id: 1,
            name: "Atlas",
            totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)",
          },
        },
      ],
    })
    const summarySheet = createDataGridSpreadsheetSheetModel({
      sheetId: "summary",
      sheetName: "Summary",
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      columns: [{ key: "metric" }, { key: "value" }],
      rows: [
        {
          id: "summary-1",
          cells: {
            metric: "Gross sales",
            value: "=SUM(TABLE('orders', 'total'))",
          },
        },
      ],
    })

    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        { id: "orders", name: "Orders", sheetModel: ordersSheet },
        { id: "customers", name: "Customers", sheetModel: customersSheet },
        { id: "summary", name: "Summary", sheetModel: summarySheet },
      ],
    })

    expect(ordersSheet.getCell({ sheetId: "orders", rowId: "order-1", rowIndex: 0, columnKey: "customerName" })?.displayValue).toBe("Atlas")
    expect(customersSheet.getCell({ sheetId: "customers", rowId: "customer-1", rowIndex: 0, columnKey: "totalSpend" })?.displayValue).toBe(100)
    expect(summarySheet.getCell({ sheetId: "summary", rowId: "summary-1", rowIndex: 0, columnKey: "value" })?.displayValue).toBe(100)

    workbook.dispose()
  })

  it("computes and rewrites sheet-qualified references across workbook renames", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "total" }],
            rows: [
              {
                id: "order-1",
                cells: {
                  total: 100,
                },
              },
              {
                id: "order-2",
                cells: {
                  total: 200,
                },
              },
            ],
          },
        },
        {
          id: "summary",
          name: "Summary",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "value" }],
            rows: [
              {
                id: "summary-1",
                cells: {
                  value: "=orders![total]1 + orders![total]2",
                },
              },
            ],
          },
        },
      ],
    })

    const summarySheet = workbook.getSheet("summary")?.sheetModel
    const initialCell = summarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "value",
    })

    expect(initialCell?.displayValue).toBe(300)
    expect(initialCell?.analysis.references.map(reference => reference.sheetReference)).toEqual([
      "orders",
      "orders",
    ])

    expect(workbook.renameSheet("orders", "Revenue Plan")).toBe(true)

    const rewrittenCell = summarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "value",
    })

    expect(workbook.getSheet("orders")?.name).toBe("Revenue Plan")
    expect(rewrittenCell?.rawInput).toBe("='revenue plan'![total]1 + 'revenue plan'![total]2")
    expect(rewrittenCell?.displayValue).toBe(300)
    expect(rewrittenCell?.analysis.references.map(reference => reference.sheetReference)).toEqual([
      "revenue plan",
      "revenue plan",
    ])

    workbook.dispose()
  })

  it("rewrites cross-sheet absolute references when source rows are inserted", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "total" }],
            rows: [
              { id: "order-1", cells: { total: 100 } },
              { id: "order-2", cells: { total: 200 } },
            ],
          },
        },
        {
          id: "summary",
          name: "Summary",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "value" }],
            rows: [
              {
                id: "summary-1",
                cells: {
                  value: "=orders![total]2",
                },
              },
            ],
          },
        },
      ],
    })

    const ordersSheet = workbook.getSheet("orders")?.sheetModel
    const summarySheet = workbook.getSheet("summary")?.sheetModel

    expect(ordersSheet?.insertRowsAt(0, [{ id: "order-0", cells: { total: 50 } }])).toBe(true)

    const summaryCell = summarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "value",
    })

    expect(summaryCell?.rawInput).toBe("=orders![total]3")
    expect(summaryCell?.displayValue).toBe(200)

    workbook.dispose()
  })

  it("rewrites and invalidates cross-sheet absolute references when source rows are removed", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "total" }],
            rows: [
              { id: "order-1", cells: { total: 100 } },
              { id: "order-2", cells: { total: 200 } },
              { id: "order-3", cells: { total: 300 } },
            ],
          },
        },
        {
          id: "summary",
          name: "Summary",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "value" }],
            rows: [
              {
                id: "summary-1",
                cells: {
                  value: "=orders![total]2",
                },
              },
              {
                id: "summary-2",
                cells: {
                  value: "=orders![total]3",
                },
              },
            ],
          },
        },
      ],
    })

    const ordersSheet = workbook.getSheet("orders")?.sheetModel
    const summarySheet = workbook.getSheet("summary")?.sheetModel

    expect(ordersSheet?.removeRowsAt(1)).toBe(true)

    const invalidatedCell = summarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "value",
    })
    const shiftedCell = summarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-2",
      rowIndex: 1,
      columnKey: "value",
    })

    expect(invalidatedCell?.rawInput).toBe("=#REF!")
    expect(invalidatedCell?.analysis.isFormulaValid).toBe(false)
    expect(invalidatedCell?.errorValue).not.toBeNull()
    expect(shiftedCell?.rawInput).toBe("=orders![total]2")
    expect(shiftedCell?.displayValue).toBe(300)

    workbook.dispose()
  })

  it("invalidates direct references when a referenced sheet is removed", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "total" }],
            rows: [
              { id: "order-1", cells: { total: 100 } },
            ],
          },
        },
        {
          id: "summary",
          name: "Summary",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "value" }],
            rows: [
              {
                id: "summary-1",
                cells: {
                  value: "=orders![total]1",
                },
              },
            ],
          },
        },
      ],
    })

    const summarySheet = workbook.getSheet("summary")?.sheetModel

    expect(workbook.removeSheet("orders")).toBe(true)

    const invalidatedCell = summarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "value",
    })

    expect(invalidatedCell?.rawInput).toBe("=#REF!")
    expect(invalidatedCell?.analysis.isFormulaValid).toBe(false)
    expect(invalidatedCell?.errorValue).not.toBeNull()

    workbook.dispose()
  })
})
