# @affino/datagrid-spreadsheet-vue-app

Workbook-first spreadsheet shell for Affino DataGrid.

`@affino/datagrid-spreadsheet-vue-app` sits one layer above:

- [`@affino/datagrid-core`](/Users/anton/Projects/affinio/datagrid/packages/datagrid-core/README.md) for workbook, sheet, formula, and rewrite semantics
- [`@affino/datagrid-vue-app`](/Users/anton/Projects/affinio/datagrid/packages/datagrid-vue-app/README.md) for the grid stage, menus, filter UI, viewport, and fill-handle surface

This package is the user-facing spreadsheet app layer.

Public export:

- `DataGridSpreadsheetWorkbookApp`
- `useDataGridSpreadsheetWorkbookHistory`

## What It Owns

- workbook tabs
- formula bar
- derived read-only view sheets backed by workbook materialization
- active-sheet sort and filter surface
- reference map
- formula diagnostics drawer
- style copy/paste controls
- spreadsheet-aware fill / paste path that writes through `sheetModel`, not generic row patches
- workbook-scoped undo / redo across formula edits, fill / paste, styles, and structural workbook mutations

## Quick Start

```vue
<script setup lang="ts">
import {
  createDataGridSpreadsheetWorkbookModel,
} from "@affino/datagrid-core"
import { DataGridSpreadsheetWorkbookApp } from "@affino/datagrid-spreadsheet-vue-app"

const workbook = createDataGridSpreadsheetWorkbookModel({
  activeSheetId: "orders",
  sheets: [
    {
      id: "orders",
      name: "Orders",
      sheetModelOptions: {
        referenceParserOptions: {
          syntax: "smartsheet",
          smartsheetAbsoluteRowBase: 1,
          allowSheetQualifiedReferences: true,
        },
        columns: [
          { key: "customerName", title: "Customer" },
          { key: "qty", title: "Qty" },
          { key: "price", title: "Price" },
          { key: "total", title: "Total" },
        ],
        rows: [
          {
            id: "order-1",
            cells: {
              customerName: "Atlas Labs",
              qty: 4,
              price: 120,
              total: "=[qty]@row * [price]@row",
            },
          },
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

workbook.sync()
</script>

<template>
  <DataGridSpreadsheetWorkbookApp
    :workbook-model="workbook"
    title="Revenue workbook"
    footer-text="Spreadsheet shell on top of datagrid-vue-app + datagrid-core."
  />
</template>
```

## Slots

Use slots to inject product-specific copy or controls without forking the workbook shell.

- `sidebar-top`
- `sidebar-bottom`
- `toolbar-actions`
- `gridActions`
- `footer`

`gridActions` receives:

- `workbookModel`
- `activeSheet`
- `activeSheetReadOnly`
- `measureOperation(label, run)`
- `runWorkbookIntent(descriptor, run)`

Use `runWorkbookIntent(...)` for external workbook mutations such as rename sheet, insert/remove row, or remove sheet so they join the same undo/redo stack as formula-bar edits.

## Notes

- The workbook model remains the source of truth.
- View sheets are declared in the workbook with `kind: "view"`, `sourceSheetId`, and a declarative `pipeline`.
- View sheets are rendered as read-only in the app shell, but they still fully support selection, copy, sort, filter, and diagnostics.
- Direct refs into a view sheet are still address-based links to the current materialized result; use `TABLE(...)` when you need dynamic scans over the full derived table.
- Sort and filter are view concerns on the active sheet; cell edits and fill still commit through `sheetModel`.
- Undo and redo restore workbook state, not generic rendered row snapshots.
- Direct cross-sheet refs, rename rewrites, and structural row rewrites come from `@affino/datagrid-core`, not this package.
