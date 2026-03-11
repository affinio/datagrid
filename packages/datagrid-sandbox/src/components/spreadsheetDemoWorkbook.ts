import {
  createDataGridSpreadsheetWorkbookModel,
  type DataGridSpreadsheetWorkbookModel,
} from "@affino/datagrid-core"

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
  allowSheetQualifiedReferences: true as const,
}

export const INITIAL_ORDER_SEED = 1011

export function buildSpreadsheetDemoOrderRow(orderNumber: number) {
  return {
    id: `order-${orderNumber}`,
    cells: {
      orderId: `SO-${orderNumber}`,
      customerId: 1,
      item: "Inserted scenario",
      status: "Draft",
      qty: 9,
      price: 99,
      total: "=[qty]@row * [price]@row",
      customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')",
    },
  }
}

export function createSpreadsheetDemoWorkbookModel(): DataGridSpreadsheetWorkbookModel {
  const workbook = createDataGridSpreadsheetWorkbookModel({
    activeSheetId: "orders",
    sheets: [
      {
        id: "orders",
        name: "Orders",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(255, 255, 255, 0.78)",
          },
          columns: [
            { key: "orderId", title: "Order", style: { fontWeight: 600 } },
            { key: "customerId", title: "Customer ID", style: { textAlign: "right" } },
            { key: "item", title: "Item" },
            { key: "status", title: "Status" },
            { key: "qty", title: "Qty", style: { textAlign: "right" } },
            { key: "price", title: "Price", style: { textAlign: "right" } },
            { key: "total", title: "Total", style: { textAlign: "right", fontWeight: 600 } },
            { key: "customerName", title: "Customer", style: { color: "#1d4ed8", fontWeight: 500 } },
          ],
          rows: [
            { id: "order-1001", cells: { orderId: "SO-1001", customerId: 1, item: "Pipeline Audit", status: "Won", qty: 4, price: 420, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1002", cells: { orderId: "SO-1002", customerId: 2, item: "Growth Workshop", status: "Won", qty: 2, price: 780, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1003", cells: { orderId: "SO-1003", customerId: 3, item: "Retention Sprint", status: "Active", qty: 6, price: 185, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1004", cells: { orderId: "SO-1004", customerId: 4, item: "Quarterly Model", status: "Won", qty: 1, price: 1480, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1005", cells: { orderId: "SO-1005", customerId: 5, item: "Ops Playbook", status: "Active", qty: 3, price: 320, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1006", cells: { orderId: "SO-1006", customerId: 1, item: "Forecast Pack", status: "Won", qty: 5, price: 250, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1007", cells: { orderId: "SO-1007", customerId: 6, item: "Renewal Deck", status: "Won", qty: 2, price: 910, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1008", cells: { orderId: "SO-1008", customerId: 2, item: "Pricing Review", status: "Active", qty: 7, price: 110, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1009", cells: { orderId: "SO-1009", customerId: 4, item: "Board Memo", status: "Won", qty: 1, price: 1950, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1010", cells: { orderId: "SO-1010", customerId: 3, item: "Expansion Pack", status: "Active", qty: 8, price: 145, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
          ],
        },
      },
      {
        id: "customers",
        name: "Customers",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(255, 252, 245, 0.85)",
          },
          columns: [
            { key: "id", title: "ID", style: { textAlign: "right", fontWeight: 600 } },
            { key: "name", title: "Name" },
            { key: "region", title: "Region" },
            { key: "tier", title: "Tier" },
            { key: "ordersCount", title: "Orders", style: { textAlign: "right" } },
            { key: "totalSpend", title: "Spend", style: { textAlign: "right", fontWeight: 600 } },
          ],
          rows: [
            { id: "customer-1", cells: { id: 1, name: "Atlas Labs", region: "UK", tier: "Enterprise", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-2", cells: { id: 2, name: "Northwind", region: "US", tier: "Growth", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-3", cells: { id: 3, name: "Sundial", region: "DE", tier: "Scale", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-4", cells: { id: 4, name: "Kiteworks", region: "FR", tier: "Enterprise", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-5", cells: { id: 5, name: "Juniper House", region: "CA", tier: "SMB", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-6", cells: { id: 6, name: "Velvet Cloud", region: "UK", tier: "Scale", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
          ],
        },
      },
      {
        id: "summary",
        name: "Summary",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(245, 250, 255, 0.88)",
          },
          columns: [
            { key: "metric", title: "Metric", style: { fontWeight: 600 } },
            { key: "value", title: "Value", style: { textAlign: "right", fontWeight: 700 } },
            { key: "note", title: "Why it matters", style: { color: "#475569" } },
          ],
          rows: [
            { id: "summary-1", cells: { metric: "Orders 1 + 2", value: "=orders![total]1 + orders![total]2", note: "Direct cross-sheet absolute refs. Edit the first two Orders totals and this cell follows them." }, style: { background: "rgba(59, 130, 246, 0.08)" } },
            { id: "summary-2", cells: { metric: "Customer 1 name", value: "=customers![name]1", note: "Direct text ref across sheets without TABLE() or RELATED()." } },
            { id: "summary-3", cells: { metric: "Gross sales", value: "=SUM(TABLE('orders', 'total'))", note: "Workbook-wide aggregate still uses TABLE() because direct refs are fixed-address links." } },
            { id: "summary-4", cells: { metric: "Top customer spend", value: "=MAX(TABLE('customers', 'totalSpend'))", note: "ROLLUP output on Customers reused downstream through TABLE()." } },
          ],
        },
      },
    ],
  })
  workbook.sync()
  return workbook
}
