# datagrid-spreadsheet-vue-app

`@affino/datagrid-spreadsheet-vue-app` is the public workbook shell for spreadsheet-style applications.

## Layering

- `@affino/datagrid-core`
  Owns workbook models, sheet models, formula parsing/evaluation, cross-sheet refs, rename/remove rewrites, and structural mutations.

- `@affino/datagrid-vue-app`
  Owns the reusable grid stage and app surface primitives: viewport, menus, advanced filter popover, overlays, resize, fill-handle UI.

- `@affino/datagrid-spreadsheet-vue-app`
  Owns the spreadsheet app shell: sheet tabs, formula bar, reference map, diagnostics drawer, derived-view read-only UX, and spreadsheet-aware edit/fill commit path.

## Why It Exists

Spreadsheet UX should not write through generic row patches.

For workbook-backed grids:

- cell edits must go through `sheetModel.setCellInput(...)`
- fill/paste must go through `sheetModel.setCellInputs(...)`
- formula state must stay aligned with workbook sync

This package is the layer that translates the reusable grid surface into workbook-safe behavior.

It also owns workbook-scoped undo/redo, so formula edits, fill handle operations, style changes, and external sheet mutations all replay against workbook state instead of generic row snapshots.

## Derived Views

Workbook sheets can now be declared as derived views instead of raw data sheets:

```ts
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
}
```

Current first-wave pipeline steps:

- `filter`
- `sort`
- `project`
- `group`

View sheets rematerialize automatically during workbook sync. In the app shell they are read-only, but users can still:

- inspect cells in the formula bar
- copy selections
- sort and filter the active materialized view
- use diagnostics

Direct refs into view sheets still target the current materialized row addresses. For dynamic scans across the whole derived result, prefer `TABLE('view-id', 'columnKey')`.

## Public Surface

- `DataGridSpreadsheetWorkbookApp`
- `useDataGridSpreadsheetWorkbookHistory`

Core prop:

- `workbookModel: DataGridSpreadsheetWorkbookModel`

Useful customization props:

- `title`
- `subtitle`
- `badgeLabel`
- `formulaPlaceholder`
- `footerText`
- `styleActions`
- `advancedFilter`
- `diagnostics`

Slots:

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

Use `runWorkbookIntent(...)` for product-specific workbook mutations such as sheet rename, row insertion, or sheet removal so they participate in the same undo/redo stack as formula-bar edits.
