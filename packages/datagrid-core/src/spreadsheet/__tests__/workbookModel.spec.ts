import { describe, expect, it } from "vitest"
import {
  createDataGridSpreadsheetSheetModel,
  createDataGridSpreadsheetWorkbookModel,
} from "../index.js"

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
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
})