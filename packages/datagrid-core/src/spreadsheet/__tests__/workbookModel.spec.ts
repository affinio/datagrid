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

  it("materializes grouped view sheets and recomputes them from source edits", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerName" }, { key: "status" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerName: "Atlas", status: "Won", total: 100 } },
              { id: "order-2", cells: { customerName: "Atlas", status: "Active", total: 260 } },
              { id: "order-3", cells: { customerName: "Northwind", status: "Won", total: 200 } },
            ],
          },
        },
        {
          id: "orders-by-customer",
          name: "Orders by customer",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "group",
              by: [{ key: "customerName", label: "Customer" }],
              aggregations: [
                { key: "ordersCount", agg: "count", label: "Orders" },
                { key: "revenue", field: "total", agg: "sum", label: "Revenue" },
              ],
            },
            {
              type: "sort",
              fields: [{ key: "revenue", direction: "desc" }],
            },
          ],
        },
      ],
    })

    const viewSheet = workbook.getSheet("orders-by-customer")
    const ordersSheet = workbook.getSheet("orders")?.sheetModel

    expect(viewSheet?.kind).toBe("view")
    expect(viewSheet?.readOnly).toBe(true)
    expect(viewSheet?.viewDefinition?.sourceSheetId).toBe("orders")
    expect(viewSheet?.sheetModel.getCell({
      sheetId: "orders-by-customer",
      rowId: "group:customerName=Atlas",
      rowIndex: 0,
      columnKey: "revenue",
    })?.displayValue).toBe(360)
    expect(viewSheet?.sheetModel.getCell({
      sheetId: "orders-by-customer",
      rowId: "group:customerName=Northwind",
      rowIndex: 1,
      columnKey: "revenue",
    })?.displayValue).toBe(200)

    expect(ordersSheet?.setCellInput({
      sheetId: "orders",
      rowId: "order-3",
      rowIndex: 2,
      columnKey: "total",
    }, 420)).toBe(true)

    expect(viewSheet?.sheetModel.getCell({
      sheetId: "orders-by-customer",
      rowId: "group:customerName=Northwind",
      rowIndex: 0,
      columnKey: "customerName",
    })?.displayValue).toBe("Northwind")
    expect(viewSheet?.sheetModel.getCell({
      sheetId: "orders-by-customer",
      rowId: "group:customerName=Northwind",
      rowIndex: 0,
      columnKey: "revenue",
    })?.displayValue).toBe(420)

    workbook.dispose()
  })

  it("supports chained view sheets", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerName" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerName: "Atlas", total: 360 } },
              { id: "order-2", cells: { customerName: "Northwind", total: 200 } },
            ],
          },
        },
        {
          id: "orders-by-customer",
          name: "Orders by customer",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "group",
              by: [{ key: "customerName", label: "Customer" }],
              aggregations: [{ key: "revenue", field: "total", agg: "sum", label: "Revenue" }],
            },
          ],
        },
        {
          id: "enterprise-customers",
          name: "Enterprise customers",
          kind: "view",
          sourceSheetId: "orders-by-customer",
          pipeline: [
            {
              type: "filter",
              clauses: [{ key: "revenue", operator: "gte", value: 300 }],
            },
            {
              type: "sort",
              fields: [{ key: "revenue", direction: "desc" }],
            },
            {
              type: "project",
              columns: [
                { key: "customerName", label: "Customer" },
                { key: "revenue", label: "Revenue" },
              ],
            },
          ],
        },
      ],
    })

    const enterpriseView = workbook.getSheet("enterprise-customers")?.sheetModel
    const ordersSheet = workbook.getSheet("orders")?.sheetModel

    expect(enterpriseView?.getSnapshot().rowCount).toBe(1)
    expect(enterpriseView?.getCell({
      sheetId: "enterprise-customers",
      rowId: "group:customerName=Atlas",
      rowIndex: 0,
      columnKey: "customerName",
    })?.displayValue).toBe("Atlas")

    expect(ordersSheet?.setCellInput({
      sheetId: "orders",
      rowId: "order-2",
      rowIndex: 1,
      columnKey: "total",
    }, 420)).toBe(true)

    expect(enterpriseView?.getSnapshot().rowCount).toBe(2)
    expect(enterpriseView?.getCell({
      sheetId: "enterprise-customers",
      rowId: "group:customerName=Northwind",
      rowIndex: 0,
      columnKey: "customerName",
    })?.displayValue).toBe("Northwind")

    workbook.dispose()
  })

  it("materializes missing view sources as readable error sheets", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders-by-customer",
          name: "Orders by customer",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "group",
              by: [{ key: "customerName" }],
              aggregations: [{ key: "revenue", field: "total", agg: "sum" }],
            },
          ],
        },
      ],
    })

    const viewSheet = workbook.getSheet("orders-by-customer")?.sheetModel

    expect(viewSheet?.getSnapshot().rowCount).toBe(1)
    expect(viewSheet?.getCell({
      sheetId: "orders-by-customer",
      rowId: "orders-by-customer-error",
      rowIndex: 0,
      columnKey: "status",
    })?.displayValue).toBe("Error")
    expect(viewSheet?.getCell({
      sheetId: "orders-by-customer",
      rowId: "orders-by-customer-error",
      rowIndex: 0,
      columnKey: "message",
    })?.displayValue).toBe("Source sheet 'orders' is missing.")

    workbook.dispose()
  })

  it("turns circular view dependencies into readable error sheets", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "view-a",
          name: "View A",
          kind: "view",
          sourceSheetId: "view-b",
          pipeline: [
            {
              type: "project",
              columns: ["message"],
            },
          ],
        },
        {
          id: "view-b",
          name: "View B",
          kind: "view",
          sourceSheetId: "view-a",
          pipeline: [
            {
              type: "project",
              columns: ["message"],
            },
          ],
        },
      ],
    })

    const viewA = workbook.getSheet("view-a")?.sheetModel
    const viewB = workbook.getSheet("view-b")?.sheetModel

    expect(viewA?.getCell({
      sheetId: "view-a",
      rowId: "view-a-error",
      rowIndex: 0,
      columnKey: "message",
    })?.displayValue).toContain("Circular view dependency detected")
    expect(viewB?.getCell({
      sheetId: "view-b",
      rowId: "view-b-error",
      rowIndex: 0,
      columnKey: "message",
    })?.displayValue).toContain("Circular view dependency detected")

    workbook.dispose()
  })

  it("restores exported state with derived view definitions intact", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerName" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerName: "Atlas", total: 100 } },
              { id: "order-2", cells: { customerName: "Northwind", total: 200 } },
            ],
          },
        },
        {
          id: "orders-by-customer",
          name: "Orders by customer",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "group",
              by: [{ key: "customerName" }],
              aggregations: [{ key: "revenue", field: "total", agg: "sum" }],
            },
          ],
        },
      ],
    })

    const exportedState = workbook.exportState()
    const ordersSheet = workbook.getSheet("orders")?.sheetModel

    expect(ordersSheet?.setCellInput({
      sheetId: "orders",
      rowId: "order-2",
      rowIndex: 1,
      columnKey: "total",
    }, 420)).toBe(true)
    expect(workbook.restoreState(exportedState)).toBe(true)

    const restoredViewSheet = workbook.getSheet("orders-by-customer")

    expect(restoredViewSheet?.kind).toBe("view")
    expect(restoredViewSheet?.viewDefinition?.sourceSheetId).toBe("orders")
    expect(restoredViewSheet?.sheetModel.getCell({
      sheetId: "orders-by-customer",
      rowId: "group:customerName=Northwind",
      rowIndex: 1,
      columnKey: "revenue",
    })?.displayValue).toBe(200)

    workbook.dispose()
  })

  it("restores workbook state after structural and formula rewrites", () => {
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
                  value: "=orders![total]1 + orders![total]2",
                },
              },
            ],
          },
        },
      ],
    })

    const summarySheet = workbook.getSheet("summary")?.sheetModel
    const ordersSheet = workbook.getSheet("orders")?.sheetModel
    workbook.setActiveSheet("summary")
    summarySheet?.setCellStyle(
      {
        sheetId: "summary",
        rowId: "summary-1",
        rowIndex: 0,
        columnKey: "value",
      },
      { backgroundColor: "salmon" },
    )

    const exportedState = workbook.exportState()

    expect(ordersSheet?.insertRowsAt(0, [{ id: "order-0", cells: { total: 50 } }])).toBe(true)
    expect(workbook.renameSheet("orders", "Revenue Plan")).toBe(true)
    expect(workbook.removeSheet("orders")).toBe(true)

    expect(workbook.restoreState(exportedState)).toBe(true)

    const restoredSummarySheet = workbook.getSheet("summary")?.sheetModel
    const restoredOrdersSheet = workbook.getSheet("orders")?.sheetModel
    const restoredSummaryCell = restoredSummarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "value",
    })

    expect(workbook.getActiveSheetId()).toBe("summary")
    expect(workbook.getSheet("orders")?.name).toBe("Orders")
    expect(restoredOrdersSheet?.getSnapshot().rowCount).toBe(2)
    expect(restoredSummaryCell?.rawInput).toBe("=orders![total]1 + orders![total]2")
    expect(restoredSummaryCell?.displayValue).toBe(300)
    expect(restoredSummaryCell?.ownStyle).toEqual({ backgroundColor: "salmon" })

    workbook.dispose()
  })
})
