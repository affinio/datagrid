# @affino/datagrid-spreadsheet-vue-app

Workbook-first spreadsheet shell for Affino DataGrid.

For the complete user guide, workbook model contract, derived views, formula
behavior, slots, rename semantics, and history rules, see
[Spreadsheet Vue app documentation](../../docs/datagrid-spreadsheet-vue-app.md).

## When to use it

Use this package when the product needs workbook semantics such as:

- multiple sheets and sheet tabs;
- formula bar and spreadsheet-aware formula editing;
- cross-sheet references and derived view sheets;
- workbook-scoped undo/redo;
- spreadsheet fill, paste, and style actions.

For an ordinary table, use `@affino/datagrid-vue-app` instead.

## Layer ownership

- `@affino/datagrid-core` owns workbook, sheet, formula, reference-rewrite, and
  structural mutation semantics.
- `@affino/datagrid-vue-app` owns the reusable grid stage, viewport, menus,
  filtering, and fill surface.
- This package owns workbook tabs, formula bar, diagnostics, derived-view UX,
  and workbook-aware mutation/history wiring.

## Public exports

- `DataGridSpreadsheetWorkbookApp`
- `DataGridSpreadsheetFormulaEditor`
- `useDataGridSpreadsheetWorkbookHistory`

## Minimal usage

```vue
<script setup lang="ts">
import { createDataGridSpreadsheetWorkbookModel } from "@affino/datagrid-core"
import { DataGridSpreadsheetWorkbookApp } from "@affino/datagrid-spreadsheet-vue-app"

const workbook = createDataGridSpreadsheetWorkbookModel({
  activeSheetId: "orders",
  sheets: [
    {
      id: "orders",
      name: "Orders",
      sheetModelOptions: {
        columns: [
          { key: "item", title: "Item" },
          { key: "quantity", title: "Quantity" },
          { key: "total", title: "Total" },
        ],
        rows: [
          {
            id: "order-1",
            cells: { item: "Notebook", quantity: 2, total: "=[quantity]@row * 10" },
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
    title="Orders"
  />
</template>
```

The workbook model is the source of truth. Formula edits, fill, paste, and
structural workbook actions must go through workbook/sheet APIs so they remain
consistent with formula recalculation and workbook history.

## Related docs

- [Spreadsheet Vue app guide](../../docs/datagrid-spreadsheet-vue-app.md)
- [Formula engine guide](../../docs/datagrid-formula-engine-guide.md)
- [DataGrid app layer](../../docs/app-layer.md)
- [DataGrid history](../../docs/datagrid-history.md)
