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

  it("rewrites cross-sheet column references and table field literals when source columns are renamed", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
              { id: "order-2", cells: { customerId: 1, total: 200 } },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "id" }, { key: "spend" }],
            rows: [
              {
                id: "customer-1",
                cells: {
                  id: 1,
                  spend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)",
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
                  value: "=SUM(TABLE('orders', 'total')) + orders![total]1",
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

    expect(ordersSheet?.renameColumn("total", "amount")).toBe(true)

    const spendAfterAmountRename = customersSheet?.getCell({
      sheetId: "customers",
      rowId: "customer-1",
      rowIndex: 0,
      columnKey: "spend",
    })
    const summaryAfterAmountRename = summarySheet?.getCell({
      sheetId: "summary",
      rowId: "summary-1",
      rowIndex: 0,
      columnKey: "value",
    })

    expect(spendAfterAmountRename?.rawInput).toBe("=ROLLUP('orders', 'customerId', [id]@row, 'amount', 'sum', 0)")
    expect(spendAfterAmountRename?.displayValue).toBe(300)
    expect(summaryAfterAmountRename?.rawInput).toBe("=SUM(TABLE('orders', 'amount')) + orders![amount]1")
    expect(summaryAfterAmountRename?.displayValue).toBe(400)

    expect(ordersSheet?.renameColumn("customerId", "clientId")).toBe(true)

    const spendAfterClientRename = customersSheet?.getCell({
      sheetId: "customers",
      rowId: "customer-1",
      rowIndex: 0,
      columnKey: "spend",
    })

    expect(spendAfterClientRename?.rawInput).toBe("=ROLLUP('orders', 'clientId', [id]@row, 'amount', 'sum', 0)")
    expect(spendAfterClientRename?.displayValue).toBe(300)

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

  it("materializes left join view sheets and recomputes them from right-side edits", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
              { id: "order-2", cells: { customerId: 2, total: 200 } },
              { id: "order-3", cells: { customerId: 3, total: 300 } },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            columns: [{ key: "id" }, { key: "name" }, { key: "tier" }],
            rows: [
              { id: "customer-1", cells: { id: 1, name: "Atlas", tier: "Enterprise" } },
              { id: "customer-2", cells: { id: 2, name: "Northwind", tier: "SMB" } },
            ],
          },
        },
        {
          id: "orders-enriched",
          name: "Orders enriched",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "customers",
              on: { leftKey: "customerId", rightKey: "id" },
              select: [
                { key: "name", as: "customerName", label: "Customer" },
                { key: "tier", label: "Tier" },
              ],
            },
          ],
        },
      ],
    })

    const viewSheet = workbook.getSheet("orders-enriched")?.sheetModel
    const customersSheet = workbook.getSheet("customers")?.sheetModel

    expect(viewSheet?.getSnapshot().rowCount).toBe(3)
    expect(viewSheet?.getCell({
      sheetId: "orders-enriched",
      rowId: "order-1",
      rowIndex: 0,
      columnKey: "customerName",
    })?.displayValue).toBe("Atlas")
    expect(viewSheet?.getCell({
      sheetId: "orders-enriched",
      rowId: "order-3",
      rowIndex: 2,
      columnKey: "customerName",
    })?.displayValue).toBeNull()

    expect(customersSheet?.setCellInput({
      sheetId: "customers",
      rowId: "customer-2",
      rowIndex: 1,
      columnKey: "tier",
    }, "Enterprise")).toBe(true)

    expect(viewSheet?.getCell({
      sheetId: "orders-enriched",
      rowId: "order-2",
      rowIndex: 1,
      columnKey: "tier",
    })?.displayValue).toBe("Enterprise")

    workbook.dispose()
  })

  it("supports inner join view sheets", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
              { id: "order-2", cells: { customerId: 99, total: 200 } },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            columns: [{ key: "id" }, { key: "name" }],
            rows: [
              { id: "customer-1", cells: { id: 1, name: "Atlas" } },
            ],
          },
        },
        {
          id: "matched-orders",
          name: "Matched orders",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "customers",
              mode: "inner",
              on: { leftKey: "customerId", rightKey: "id" },
              select: [{ key: "name", as: "customerName" }],
            },
          ],
        },
      ],
    })

    const matchedOrders = workbook.getSheet("matched-orders")?.sheetModel

    expect(matchedOrders?.getSnapshot().rowCount).toBe(1)
    expect(matchedOrders?.getCell({
      sheetId: "matched-orders",
      rowId: "order-1",
      rowIndex: 0,
      columnKey: "customerName",
    })?.displayValue).toBe("Atlas")

    workbook.dispose()
  })

  it("supports explode join view sheets with stable generated row ids", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
              { id: "order-2", cells: { customerId: 2, total: 200 } },
            ],
          },
        },
        {
          id: "contacts",
          name: "Contacts",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "contactName" }],
            rows: [
              { id: "contact-1", cells: { customerId: 1, contactName: "Ada" } },
              { id: "contact-2", cells: { customerId: 1, contactName: "Bea" } },
              { id: "contact-3", cells: { customerId: 2, contactName: "Cy" } },
            ],
          },
        },
        {
          id: "orders-with-contacts",
          name: "Orders with contacts",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "contacts",
              on: { leftKey: "customerId", rightKey: "customerId" },
              select: [{ key: "contactName" }],
              multiMatch: "explode",
            },
          ],
        },
      ],
    })

    const viewSheet = workbook.getSheet("orders-with-contacts")?.sheetModel
    const rows = viewSheet?.getRows() ?? []

    expect(rows).toHaveLength(3)
    expect(rows.map(row => row.id)).toEqual([
      "join:7:order-1|9:contact-1|0",
      "join:7:order-1|9:contact-2|1",
      "join:7:order-2|9:contact-3|0",
    ])
    expect(viewSheet?.getCell({
      sheetId: "orders-with-contacts",
      rowId: "join:7:order-1|9:contact-1|0",
      rowIndex: 0,
      columnKey: "contactName",
    })?.displayValue).toBe("Ada")
    expect(viewSheet?.getCell({
      sheetId: "orders-with-contacts",
      rowId: "join:7:order-1|9:contact-2|1",
      rowIndex: 1,
      columnKey: "contactName",
    })?.displayValue).toBe("Bea")

    workbook.dispose()
  })

  it("supports chained view sheets after join enrichment", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
              { id: "order-2", cells: { customerId: 2, total: 220 } },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            columns: [{ key: "id" }, { key: "name" }, { key: "segment" }],
            rows: [
              { id: "customer-1", cells: { id: 1, name: "Atlas", segment: "ENT" } },
              { id: "customer-2", cells: { id: 2, name: "Northwind", segment: "SMB" } },
            ],
          },
        },
        {
          id: "orders-enriched",
          name: "Orders enriched",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "customers",
              on: { leftKey: "customerId", rightKey: "id" },
              select: [
                { key: "name", as: "customerName" },
                { key: "segment" },
              ],
            },
          ],
        },
        {
          id: "enterprise-orders",
          name: "Enterprise orders",
          kind: "view",
          sourceSheetId: "orders-enriched",
          pipeline: [
            {
              type: "filter",
              clauses: [{ key: "segment", operator: "equals", value: "ENT" }],
            },
            {
              type: "project",
              columns: ["customerName", "total"],
            },
          ],
        },
      ],
    })

    const enterpriseOrders = workbook.getSheet("enterprise-orders")?.sheetModel
    const customersSheet = workbook.getSheet("customers")?.sheetModel

    expect(enterpriseOrders?.getSnapshot().rowCount).toBe(1)
    expect(enterpriseOrders?.getCell({
      sheetId: "enterprise-orders",
      rowId: "order-1",
      rowIndex: 0,
      columnKey: "customerName",
    })?.displayValue).toBe("Atlas")

    expect(customersSheet?.setCellInput({
      sheetId: "customers",
      rowId: "customer-2",
      rowIndex: 1,
      columnKey: "segment",
    }, "ENT")).toBe(true)

    expect(enterpriseOrders?.getSnapshot().rowCount).toBe(2)
    expect(enterpriseOrders?.getCell({
      sheetId: "enterprise-orders",
      rowId: "order-2",
      rowIndex: 1,
      columnKey: "customerName",
    })?.displayValue).toBe("Northwind")

    workbook.dispose()
  })

  it("materializes ambiguous join matches as readable error sheets when multiMatch is strict", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            columns: [{ key: "id" }, { key: "name" }],
            rows: [
              { id: "customer-1", cells: { id: 1, name: "Atlas" } },
              { id: "customer-2", cells: { id: 1, name: "Atlas duplicate" } },
            ],
          },
        },
        {
          id: "orders-enriched",
          name: "Orders enriched",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "customers",
              on: { leftKey: "customerId", rightKey: "id" },
              select: [{ key: "name", as: "customerName" }],
              multiMatch: "error",
            },
          ],
        },
      ],
    })

    const viewSheet = workbook.getSheet("orders-enriched")?.sheetModel

    expect(viewSheet?.getSnapshot().rowCount).toBe(1)
    expect(viewSheet?.getCell({
      sheetId: "orders-enriched",
      rowId: "orders-enriched-error",
      rowIndex: 0,
      columnKey: "status",
    })?.displayValue).toBe("Error")
    expect(viewSheet?.getCell({
      sheetId: "orders-enriched",
      rowId: "orders-enriched-error",
      rowIndex: 0,
      columnKey: "message",
    })?.displayValue).toContain("multiple matches")
    expect(workbook.getSnapshot().diagnostics).toEqual([
      expect.objectContaining({
        code: "derived-view-join-ambiguous-match",
        severity: "error",
        sheetId: "orders-enriched",
        relatedSheetId: "customers",
      }),
    ])

    workbook.dispose()
  })

  it("surfaces workbook diagnostics when a join dependency sheet is missing", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
            ],
          },
        },
        {
          id: "orders-enriched",
          name: "Orders enriched",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "customers",
              on: { leftKey: "customerId", rightKey: "id" },
              select: [{ key: "name", as: "customerName" }],
            },
          ],
        },
      ],
    })

    const diagnostics = workbook.getSnapshot().diagnostics

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "derived-view-join-sheet-missing",
        severity: "error",
        sheetId: "orders-enriched",
        relatedSheetId: "customers",
      }),
    ])

    workbook.dispose()
  })

  it("exposes workbook diagnostics for direct refs into unstable join and pivot view sheets", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "customerId" }, { key: "customerName" }, { key: "quarter" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, customerName: "Atlas", quarter: "Q1", total: 100 } },
              { id: "order-2", cells: { customerId: 2, customerName: "Northwind", quarter: "Q2", total: 200 } },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "id" }, { key: "segment" }],
            rows: [
              { id: "customer-1", cells: { id: 1, segment: "ENT" } },
              { id: "customer-2", cells: { id: 2, segment: "SMB" } },
            ],
          },
        },
        {
          id: "orders-enriched",
          name: "Orders enriched",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "customers",
              on: { leftKey: "customerId", rightKey: "id" },
              select: [{ key: "segment" }],
            },
          ],
        },
        {
          id: "orders-pivot",
          name: "Orders pivot",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "pivot",
              spec: {
                rows: ["customerName"],
                columns: ["quarter"],
                values: [{ field: "total", agg: "sum" }],
              },
            },
          ],
        },
        {
          id: "summary",
          name: "Summary",
          sheetModelOptions: {
            referenceParserOptions: SHEET_QUALIFIED_REFERENCE_OPTIONS,
            columns: [{ key: "joinRef" }, { key: "pivotRef" }],
            rows: [
              {
                id: "summary-1",
                cells: {
                  joinRef: "=orders-enriched![segment]1",
                  pivotRef: "=orders-pivot![customerName]1",
                },
              },
            ],
          },
        },
      ],
    })

    const diagnostics = workbook.getSnapshot().diagnostics

    expect(diagnostics).toHaveLength(2)
    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      "derived-direct-reference-unstable",
      "derived-direct-reference-unstable",
    ])
    expect(diagnostics.map(diagnostic => diagnostic.relatedSheetId)).toEqual([
      "orders-enriched",
      "orders-pivot",
    ])
    expect(diagnostics.every(diagnostic => diagnostic.sheetId === "summary")).toBe(true)
    expect(diagnostics[0]?.message).toContain("Prefer TABLE(")

    workbook.dispose()
  })

  it("materializes pivot view sheets and recomputes them from source edits", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerName" }, { key: "quarter" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerName: "Atlas", quarter: "Q1", total: 100 } },
              { id: "order-2", cells: { customerName: "Atlas", quarter: "Q2", total: 260 } },
              { id: "order-3", cells: { customerName: "Northwind", quarter: "Q1", total: 200 } },
            ],
          },
        },
        {
          id: "orders-pivot",
          name: "Orders pivot",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "pivot",
              spec: {
                rows: ["customerName"],
                columns: ["quarter"],
                values: [{ field: "total", agg: "sum" }],
              },
            },
          ],
        },
      ],
    })

    const pivotSheet = workbook.getSheet("orders-pivot")?.sheetModel
    const ordersSheet = workbook.getSheet("orders")?.sheetModel
    const pivotColumns = pivotSheet?.getColumns() ?? []
    const q1Column = pivotColumns.find(column => column.title === "Q1")
    const q2Column = pivotColumns.find(column => column.title === "Q2")
    const atlasRow = pivotSheet?.getRows().find(row => (
      pivotSheet.getCell({
        sheetId: "orders-pivot",
        rowId: row.id,
        rowIndex: row.rowIndex,
        columnKey: "customerName",
      })?.displayValue === "Atlas"
    ))
    const northwindRow = pivotSheet?.getRows().find(row => (
      pivotSheet.getCell({
        sheetId: "orders-pivot",
        rowId: row.id,
        rowIndex: row.rowIndex,
        columnKey: "customerName",
      })?.displayValue === "Northwind"
    ))

    expect(pivotColumns.map(column => column.title)).toEqual([
      "customerName",
      "Q1",
      "Q2",
    ])
    expect(atlasRow).toBeDefined()
    expect(northwindRow).toBeDefined()
    expect(q1Column?.style).toEqual({ textAlign: "right" })
    expect(pivotSheet?.getCell({
      sheetId: "orders-pivot",
      rowId: atlasRow!.id,
      rowIndex: atlasRow!.rowIndex,
      columnKey: q1Column!.key,
    })?.displayValue).toBe(100)
    expect(pivotSheet?.getCell({
      sheetId: "orders-pivot",
      rowId: atlasRow!.id,
      rowIndex: atlasRow!.rowIndex,
      columnKey: q2Column!.key,
    })?.displayValue).toBe(260)
    expect(pivotSheet?.getCell({
      sheetId: "orders-pivot",
      rowId: northwindRow!.id,
      rowIndex: northwindRow!.rowIndex,
      columnKey: q1Column!.key,
    })?.displayValue).toBe(200)

    expect(ordersSheet?.setCellInput({
      sheetId: "orders",
      rowId: "order-3",
      rowIndex: 2,
      columnKey: "quarter",
    }, "Q2")).toBe(true)

    const refreshedQ1Column = pivotSheet?.getColumns().find(column => column.title === "Q1")
    const refreshedQ2Column = pivotSheet?.getColumns().find(column => column.title === "Q2")
    const refreshedNorthwindRow = pivotSheet?.getRows().find(row => (
      pivotSheet.getCell({
        sheetId: "orders-pivot",
        rowId: row.id,
        rowIndex: row.rowIndex,
        columnKey: "customerName",
      })?.displayValue === "Northwind"
    ))

    expect(refreshedNorthwindRow).toBeDefined()
    expect(pivotSheet?.getCell({
      sheetId: "orders-pivot",
      rowId: refreshedNorthwindRow!.id,
      rowIndex: refreshedNorthwindRow!.rowIndex,
      columnKey: refreshedQ1Column!.key,
    })?.displayValue).toBeNull()
    expect(pivotSheet?.getCell({
      sheetId: "orders-pivot",
      rowId: refreshedNorthwindRow!.id,
      rowIndex: refreshedNorthwindRow!.rowIndex,
      columnKey: refreshedQ2Column!.key,
    })?.displayValue).toBe(200)

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
    expect(workbook.getSnapshot().diagnostics).toEqual([
      expect.objectContaining({
        code: "derived-view-source-missing",
        severity: "error",
        sheetId: "orders-by-customer",
        relatedSheetId: "orders",
      }),
    ])

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
    expect(workbook.getSnapshot().diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      "derived-view-cycle",
      "derived-view-cycle",
    ])

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

  it("restores exported state with join view definitions intact", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
              { id: "order-2", cells: { customerId: 2, total: 200 } },
            ],
          },
        },
        {
          id: "customers",
          name: "Customers",
          sheetModelOptions: {
            columns: [{ key: "id" }, { key: "name" }],
            rows: [
              { id: "customer-1", cells: { id: 1, name: "Atlas" } },
              { id: "customer-2", cells: { id: 2, name: "Northwind" } },
            ],
          },
        },
        {
          id: "orders-enriched",
          name: "Orders enriched",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "customers",
              on: { leftKey: "customerId", rightKey: "id" },
              select: [{ key: "name", as: "customerName" }],
            },
          ],
        },
      ],
    })

    const exportedState = workbook.exportState()
    const customersSheet = workbook.getSheet("customers")?.sheetModel

    expect(customersSheet?.setCellInput({
      sheetId: "customers",
      rowId: "customer-2",
      rowIndex: 1,
      columnKey: "name",
    }, "Changed")).toBe(true)
    expect(workbook.restoreState(exportedState)).toBe(true)

    const restoredJoinSheet = workbook.getSheet("orders-enriched")

    expect(restoredJoinSheet?.kind).toBe("view")
    expect(restoredJoinSheet?.viewDefinition?.sourceSheetId).toBe("orders")
    expect(restoredJoinSheet?.sheetModel.getCell({
      sheetId: "orders-enriched",
      rowId: "order-2",
      rowIndex: 1,
      columnKey: "customerName",
    })?.displayValue).toBe("Northwind")

    workbook.dispose()
  })

  it("restores exported state with explode join view definitions intact", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerId: 1, total: 100 } },
            ],
          },
        },
        {
          id: "contacts",
          name: "Contacts",
          sheetModelOptions: {
            columns: [{ key: "customerId" }, { key: "contactName" }],
            rows: [
              { id: "contact-1", cells: { customerId: 1, contactName: "Ada" } },
              { id: "contact-2", cells: { customerId: 1, contactName: "Bea" } },
            ],
          },
        },
        {
          id: "orders-with-contacts",
          name: "Orders with contacts",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "join",
              sheetId: "contacts",
              on: { leftKey: "customerId", rightKey: "customerId" },
              select: [{ key: "contactName" }],
              multiMatch: "explode",
            },
          ],
        },
      ],
    })

    const exportedState = workbook.exportState()
    const contactsSheet = workbook.getSheet("contacts")?.sheetModel

    expect(contactsSheet?.setCellInput({
      sheetId: "contacts",
      rowId: "contact-2",
      rowIndex: 1,
      columnKey: "contactName",
    }, "Changed")).toBe(true)
    expect(workbook.restoreState(exportedState)).toBe(true)

    const restoredJoinSheet = workbook.getSheet("orders-with-contacts")?.sheetModel

    expect(restoredJoinSheet?.getSnapshot().rowCount).toBe(2)
    expect(restoredJoinSheet?.getCell({
      sheetId: "orders-with-contacts",
      rowId: "join:7:order-1|9:contact-2|1",
      rowIndex: 1,
      columnKey: "contactName",
    })?.displayValue).toBe("Bea")

    workbook.dispose()
  })

  it("restores exported state with pivot view definitions intact", () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            columns: [{ key: "customerName" }, { key: "quarter" }, { key: "total" }],
            rows: [
              { id: "order-1", cells: { customerName: "Atlas", quarter: "Q1", total: 100 } },
              { id: "order-2", cells: { customerName: "Northwind", quarter: "Q2", total: 200 } },
            ],
          },
        },
        {
          id: "orders-pivot",
          name: "Orders pivot",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "pivot",
              spec: {
                rows: ["customerName"],
                columns: ["quarter"],
                values: [{ field: "total", agg: "sum" }],
              },
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

    const restoredPivotSheet = workbook.getSheet("orders-pivot")
    const restoredQ2Column = restoredPivotSheet?.sheetModel.getColumns().find(column => (
      column.title === "Q2"
    ))
    const restoredNorthwindRow = restoredPivotSheet?.sheetModel.getRows().find(row => (
      restoredPivotSheet.sheetModel.getCell({
        sheetId: "orders-pivot",
        rowId: row.id,
        rowIndex: row.rowIndex,
        columnKey: "customerName",
      })?.displayValue === "Northwind"
    ))

    expect(restoredPivotSheet?.kind).toBe("view")
    expect(restoredPivotSheet?.viewDefinition?.sourceSheetId).toBe("orders")
    expect(restoredPivotSheet?.sheetModel.getCell({
      sheetId: "orders-pivot",
      rowId: restoredNorthwindRow!.id,
      rowIndex: restoredNorthwindRow!.rowIndex,
      columnKey: restoredQ2Column!.key,
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
