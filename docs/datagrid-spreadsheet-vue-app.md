# datagrid-spreadsheet-vue-app

`@affino/datagrid-spreadsheet-vue-app` is the public workbook shell for spreadsheet-style applications.

## Layering

- `@affino/datagrid-core`
  Owns workbook models, sheet models, formula parsing/evaluation, cross-sheet refs, rename/remove rewrites, and structural mutations.

- `@affino/datagrid-vue-app`
  Owns the reusable grid stage and app surface primitives: viewport, menus, advanced filter popover, overlays, resize, fill-handle UI.

- `@affino/datagrid-spreadsheet-vue-app`
  Owns the spreadsheet app shell: sheet tabs, formula bar, reference map, diagnostics drawer, and spreadsheet-aware edit/fill commit path.

## Why It Exists

Spreadsheet UX should not write through generic row patches.

For workbook-backed grids:

- cell edits must go through `sheetModel.setCellInput(...)`
- fill/paste must go through `sheetModel.setCellInputs(...)`
- formula state must stay aligned with workbook sync

This package is the layer that translates the reusable grid surface into workbook-safe behavior.

## Public Surface

- `DataGridSpreadsheetWorkbookApp`

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
- `measureOperation(label, run)`

Use that slot for product-specific buttons such as sheet rename, row insertion, or demo reset while still reporting the action in the diagnostics drawer.
