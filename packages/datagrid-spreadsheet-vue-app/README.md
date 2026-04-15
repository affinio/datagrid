# @affino/datagrid-spreadsheet-vue-app

Workbook-first spreadsheet shell for Affino DataGrid.

`@affino/datagrid-spreadsheet-vue-app` sits one layer above:

- [`@affino/datagrid-core`](https://github.com/affinio/affinio/tree/main/packages/datagrid-core#readme) for workbook, sheet, formula, and rewrite semantics
- [`@affino/datagrid-vue-app`](https://github.com/affinio/affinio/tree/main/packages/datagrid-vue-app#readme) for the grid stage, menus, filter UI, viewport, and fill-handle surface

This package is the user-facing spreadsheet app layer.

Public export:

- `DataGridSpreadsheetWorkbookApp`
- `DataGridSpreadsheetFormulaEditor`
- `useDataGridSpreadsheetWorkbookHistory`

Useful customization props:

- `theme`
- `formulaPlaceholder`
- `clipboardCopyMode`
- `footerText`

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
    theme="industrial-neutral"
    footer-text="Spreadsheet shell on top of datagrid-vue-app + datagrid-core."
  />
</template>
```

## Workbook UX Highlights

- Column-menu value filters and advanced filters resolve workbook display/formula values, not only raw row payloads.
- The workbook shell can show a bottom-right aggregate overlay for the current selection.
- `Ctrl/Cmd + click` adds independent cells or ranges to the committed workbook selection.
- Clicking a column header selects the full visible column; `Shift` extends from the active column and `Ctrl/Cmd` adds another full-column range.
- Column rename is split into display-title rename and reference-key rename so formulas do not break when users only want to relabel a header.
- Spreadsheet columns can also expose a `formulaAlias` so formulas can reference the user-facing name instead of the raw key. When omitted, the initial alias defaults to the column title.
- `DataGridSpreadsheetFormulaEditor` is exported separately when you need to embed the workbook formula bar inside a custom shell.

## Column Rename And Formulas

The workbook shell exposes two different rename paths from the column menu:

- `Display title`: updates the visible header text only. This calls `sheetModel.setColumnTitle(...)` and leaves formula references unchanged.
- `Formula alias`: updates the user-facing formula token. This calls `sheetModel.setColumnFormulaAlias(...)` and rewrites workbook formulas that reference that alias.
- `Reference key`: renames the semantic column key. This calls `sheetModel.renameColumn(...)` and rewrites workbook formulas that reference that column.

Use title rename when the user is changing copy or presentation. Use formula-alias rename when the visible spreadsheet formula token should change. Use key rename only when the underlying reference identity of the column is actually changing.

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
- `theme` accepts the same `DataGridThemeProp` shapes as `@affino/datagrid-vue-app`; workbook-specific shell tokens are merged on top.
- Direct refs into a view sheet are still address-based links to the current materialized result; use `TABLE(...)` when you need dynamic scans over the full derived table.
- Sort and filter are view concerns on the active sheet; cell edits and fill still commit through `sheetModel`.
- Undo and redo restore workbook state, not generic rendered row snapshots.
- Direct cross-sheet refs, rename rewrites, and structural row rewrites come from `@affino/datagrid-core`, not this package.
