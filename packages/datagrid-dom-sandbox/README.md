# DataGrid DOM sandbox

This is a standalone browser demo for `@affino/datagrid-dom`. It uses plain
HTML, TypeScript, and CSS; it does not install or bundle Vue.

From the workspace root:

```sh
pnpm run datagrid-dom:sandbox
```

Open <http://localhost:5175> for the basic grid,
<http://localhost:5175/examples/sorting/> for sorting, or
<http://localhost:5175/examples/updates/> for row updates, or
<http://localhost:5175/examples/selection/> for single-cell selection, or
<http://localhost:5175/examples/range-selection/> for Shift-click ranges, or
<http://localhost:5175/examples/keyboard-navigation/> for keyboard navigation
(arrows, Enter, Tab, Home/End, and Page Up/Down), or
<http://localhost:5175/examples/filtering/> for Core-backed filtering, or
<http://localhost:5175/examples/pagination/> for Core-backed pagination.
<http://localhost:5175/examples/virtualization/> demonstrates vertical row
virtualization, and <http://localhost:5175/examples/column-virtualization/>
demonstrates horizontal column virtualization. The base page mounts the grid, reports the row count through the public API, and
disposes the runtime when the page is left. The sorting page sends native
toolbar commands through Core and renders the resulting projection. The updates
page exercises append, remove, and reset through the public rows API. Each
page header includes an example picker for direct navigation. Each example has
a colocated Vitest test; run them with
`pnpm --filter @affino/datagrid-dom-sandbox test`.
The range page extends a selection from its anchor using Core's range-geometry
helper; a regular click starts a new single-cell selection. The keyboard page
uses the shared orchestration router, matching Vue's anchor/focus rules, Enter
movement, Tab wrapping, and boundary handling. Filtering and pagination both update the Core row projection before
rendering. The virtualization pages render bounded row and column windows from
large datasets and keep pinned edge columns mounted. All pages share a loading
cover that stays visible until styles and the Core runtime are ready.

The column-virtualization page reports its live grid and page DOM node counts
while scrolling. It intentionally keeps the header in normal flow; pinned edge
columns remain horizontally pinned.

The cell-editing page enters a native text editor when typing into a selected
cell marked `capabilities.editable`; double-click opens its current value. Enter
commits and moves down, Shift+Enter commits and moves up, blur commits in place,
and Escape discards the draft.

The clipboard page copies cell selections as TSV and pastes into editable cells.
It demonstrates multi-cell copy, typed row-patch updates, and single-cell fill
across a selected range.
The clipboard page copies selected cell ranges as TSV and pastes into editable
row-patch cells through the Core API. It supports single-cell fill across a
selected range and preserves native text clipboard behavior inside the editor.
The `/examples/history/` page records inline edits and clipboard paste/fill in
the Core transaction service. Its controls and grid shortcuts demonstrate
Undo/Redo while preserving the previous cell selection.
The `/examples/formulas/` page declares dependent formula fields at mount and
edits unit prices inline to demonstrate Core recalculation in rendered columns.
The `/examples/select-editing/` page edits a select-backed source cell with a
native control, preserving its typed option value and rendering its Core label.
The `/examples/checkbox-cells/` page toggles Core boolean cells by pointer or
Space and records those edits in the transaction history.
The `/examples/date-editing/` page edits `date` and `datetime` columns with
native browser controls and stores Core-parsed `Date` values in row history.
The `/examples/numeric-editing/` page edits number, currency, and percent values
through Core parsing, keeps invalid drafts open, and exposes their invalid state.
The `/examples/edit-validation/` page focuses on invalid-state accessibility,
recovery, and confirming that invalid values do not mutate rows.

The stress page combines 10,000 rows and 120 columns with row and column
virtualization enabled. Its viewport pass moves both windows repeatedly and
reports the mounted rows, cells, and DOM node count.

The `/examples/xlsx-export/` page uses the optional `@affino/datagrid-dom/xlsx`
entry point with `@affino/export-xlsx`. It exports Core's complete current
projection from a 2,000-row virtualized grid, including computed formula
values or Excel formulas, typed number formats, and cell styles; the file is built in a Web
Worker and downloaded by the example toolbar.

The `/examples/column-resizing/` page shows pointer and keyboard resizing,
double-click autosizing, and resetting widths through `api.columns.setWidth`.
The `/examples/column-reordering/` page enables `columnReorder: true` and
exercises both center-column order and cross-zone drops into pinned columns.
The `/examples/column-layout/` page demonstrates Core-backed column visibility
and left/center/right pinning controls.
The `/examples/row-selection/` page adds an opt-in pinned checkbox column,
select-all for the current projected leaf rows, Shift ranges, and record-level
selection actions through Core. Record selection remains independent from cell
ranges.
The `/examples/aggregation/` page changes Core group aggregation between sum,
average, minimum, maximum, and count and verifies the resulting values per team.
The `/examples/combobox-cell/` page filters a select-backed cell's options and
commits the selected typed value through Core.
The `/examples/server-row-model/` page supplies a Core
`createDataSourceBackedRowModel` to the DOM adapter, demonstrating sparse
viewport pulls, datasource-side sorting/filtering, stale row retention during
refresh, loading skeletons instead of blank rows, and retry after a failed
pull. The example owns and disposes its row model after destroying the grid.
Applications can also pass datasources from the framework-neutral
`@affino/datagrid-server-adapters` or `@affino/datagrid-server-client` packages
to the same Core row-model factory and DOM adapter.
