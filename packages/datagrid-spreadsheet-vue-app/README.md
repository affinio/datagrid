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
          { key: "qty", title: "Qty" },
          { key: "price", title: "Price" },
          { key: "total", title: "Total" },
        ],
        rows: [
          {
            id: "order-1",
            cells: {
              qty: 4,
              price: 120,
              total: "=[qty]@row * [price]@row",
            },
          },
        ],
      },
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
- `measureOperation(label, run)`
- `runWorkbookIntent(descriptor, run)`

Use `runWorkbookIntent(...)` for external workbook mutations such as rename sheet, insert/remove row, or remove sheet so they join the same undo/redo stack as formula-bar edits.

## Notes

- The workbook model remains the source of truth.
- Sort and filter are view concerns on the active sheet; cell edits and fill still commit through `sheetModel`.
- Undo and redo restore workbook state, not generic rendered row snapshots.
- Direct cross-sheet refs, rename rewrites, and structural row rewrites come from `@affino/datagrid-core`, not this package.
