# `@affino/datagrid-dom`

Framework-independent DOM adapter for Affino DataGrid. It mounts a `div` grid
with ARIA grid roles and exposes the shared Core API. It intentionally
does not add a second state model or a framework dependency.

The Gantt view uses the headless `@affino/datagrid-gantt` runtime dependency
and is enabled with `viewMode: "gantt"` plus `gantt` field options. It renders a
canvas timeline beside the same Core row view with task/baseline bars, progress,
milestones, dependencies, critical flags, and derived group summaries. With a
patch-capable row source, mouse dragging moves task bars and resizes their ends;
Escape cancels a draft and committed edits participate in Ctrl/Cmd+Z history.
Touch input keeps native timeline scrolling. Runtime zoom controls are not
implemented in the DOM adapter.

```ts
import { mountDataGrid } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"

const grid = mountDataGrid(document.querySelector("#grid")!, {
  label: "People",
  rows: [{ id: "p1", name: "Ada" }],
  columns: [{ key: "name", field: "name", label: "Name" }],
})

await grid.ready
const visibleRows = grid.api.rows.getProjectedRows()
await grid.destroy()
```

`visibleRows` is the current Core projection, not a list read from rendered DOM.
By default the package renders all projected rows and columns. Opt into
fixed-height row virtualization with `rowVirtualization` and horizontal column
virtualization with `columnVirtualization`; Core's viewport controller owns
range math and scroll/reveal behavior, while the adapter renders the requested
windows with spacers. The row option requires `rowHeight` to match the rendered
layout. Horizontal virtualization retains pinned edge columns.

For app-style composition, `mountDataGridShell` keeps the same `rows`,
`columns`, and feature option names while adding a standard toolbar. Its
`quickFilter` option follows Vue's `boolean | options` shape (`placeholder`,
`columns`, `mode`, `applyMode`, `debounceMs`) and updates the existing Core
`filterModel.quickFilter`, preserving other filter clauses. `toolbar.actions`
adds framework-independent buttons whose callbacks receive the same Core API.
`columnMenu` adds a shell-owned menu to each column header. The menu provides
Core-backed ascending/descending/clear sort, group/ungroup, pin/unpin, and
value-set filtering. It supports a header button, context menu, or both; the
default includes both. `maxFilterValues` bounds the initial histogram list, and
search narrows larger value sets.
`mountDataGrid` remains available when the caller owns all surrounding UI.
The shell follows Vue's default of enabling record checkboxes unless
`rowSelection: false` is supplied. DOM row/column virtualization remains
explicit because fixed row geometry is a renderer-specific requirement.

```ts
import { mountDataGridShell } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"

const grid = mountDataGridShell(document.querySelector("#app")!, {
  rows,
  columns,
  rowSelection: true,
  quickFilter: { columns: ["owner", "region"], applyMode: "debounce" },
  columnMenu: { trigger: "button+contextmenu", maxFilterValues: 120 },
  toolbar: {
    actions: [{ key: "clear-filters", label: "Clear filters", onAction: api => api.rows.setFilterModel(null) }],
  },
})

await grid.ready
await grid.destroy()
```

The shell also forwards the DOM adapter options for editing, selection, range
operations, grouping, and virtualization. Its column menu supports sorting,
grouping, pinning, predicate filters, and histogram-backed value filters.
Vue-only app panels are not implied by matching option names. The
`/examples/shell/` sandbox page combines the shell with a realistic account
dataset and these menu actions.
The header is rendered in a separate, vertically stationary viewport. The body
owns scrolling and mirrors horizontal offset to the header. Pinned columns use
the column model's pin state and cumulative offsets, including when horizontal
virtualization is disabled; CSS sticky cells retain them within the body
viewport. Separate left, center, and right pane lanes are not implemented in
this adapter. Selection frame overlays do not change the sticky positioning of
pinned cells, so selecting a pinned cell keeps it aligned to its viewport edge.
The adapter supports click, Shift-click, and mouse-drag cell selection through Core.
Ctrl/Cmd-click adds a single-cell range; Ctrl/Cmd-drag adds a rectangular range
while preserving earlier ranges. The active anchor uses the same selection
highlight as the rest of the range, including in pinned columns. A range
crossing pinned and center columns has one continuous outer frame without an
extra border at the pane seams. Dragging near a viewport edge uses shared
orchestration auto-scroll. Keyboard
navigation follows the shared orchestration router used by Vue: arrows move
between cells, Shift+Arrow extends from the current range focus, Enter moves
down one row, Shift+Enter moves up, Tab moves through cells with row wrapping,
and Home/End/Page Up/Page Down use the same navigation rules. Plain arrow
navigation after extending a range resumes from its anchor, matching the Vue
grid behavior. Navigation does not scroll while the active cell remains inside
the viewport; crossing an edge scrolls only enough to reveal the target cell.
Filtering, sorting, pagination, and row updates are driven by the corresponding
Core API operations.
When the projected row count is zero, the adapter renders a built-in empty
message. `emptyState` may provide a custom renderer receiving `{ reason,
hasActiveFilters, rowCount }`, where `reason` is `"no-rows"` or `"filtered"` and
`rowCount` is `0`. Return a fresh DOM `Node`, a string, or `null`.
`emptyStateAlignment` accepts `"content"` (default) or `"viewport"`. Empty state
is hidden while rows are loading or the row model reports an error. The renderer
uses the grid empty-state CSS tokens and remains independent of any UI framework.
Set `rowSelection: true` to add a pinned checkbox column backed by
`api.rowSelection`. The header checkbox selects or clears the current projected
leaf rows, while row checkboxes toggle records individually or extend a record
range with Shift. This record selection remains independent from cell selection;
grouped rows are skipped in ranges and are not selectable.
The selection header matches the column-header height, and header separators
are owned by the first visible pane so pinned-pane seams do not draw duplicate
left borders.
Grouping and tree data use Core row projections. Supply `treeData` at mount
time to enable path-based or parent-linked hierarchies; the adapter renders
their expandable rows, lets Space toggle the active node, and indents leaf
labels to match hierarchy depth.
Pass `formulas` to register formula fields before the first render. Formula
definitions and recomputation stay in Core; matching columns read their
computed target fields and use Core cell formatting. Copying a formula cell
copies its computed value. The
`/examples/formulas/` sandbox page demonstrates dependent totals updating
after source cells are edited.
Rendered header, row, and cell elements are reconciled in place as Core state
changes so selection and edits preserve DOM identity. Cell content stays on one
line and is ellipsized within its track; pasted values do not change row height
or expand the rendered grid tracks.
For direct source-backed columns marked `capabilities.editable`, typing while a
cell is selected opens a native text editor with the typed character as its
draft and places the caret after it; double-click opens the editor with the
current value and places the caret at the end without selecting the text. Enter commits
through `api.rows.applyEdits` and selects the same column in the next row,
Shift+Enter commits and selects the previous row, Escape cancels, and blur
commits in place. Custom setter/accessor edit paths and typed editor controls
are not part of this initial adapter slice. Select-backed columns open a native
select on double-click or Enter/F2; choosing an option commits its typed value
through the same Core edit path.
Boolean cells marked editable render native checkboxes. Clicking the cell or
pressing Space toggles the Core row value and records an Undo/Redo edit.
Copy exports the active cell range as TSV. Paste targets the active cell (or
the selected range's top-left cell), writes only direct editable row-patch
cells through `api.rows.applyEdits`, and selects the pasted range afterward. A
single pasted cell fills a selected multi-cell range. Number and boolean input
is parsed against the current source value; invalid values and unsupported
write targets are skipped. Native clipboard behavior remains available inside
the inline editor.

Inline cell edits and clipboard paste/fill are recorded in the Core transaction
service. Consumers can run `api.transaction.undo()` and `api.transaction.redo()`;
while the grid has focus, Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
redoes. Undo restores the edited row fields and the prior cell selection. This
initial history scope does not record direct application mutations or row
structure changes.

Required runtime dependencies are `@affino/datagrid-core`,
`@affino/datagrid-orchestration`, and `@affino/datagrid-gantt`.
`@affino/datagrid-theme` is an optional peer;
the adapter does not import it at runtime. Its stylesheet consumes the package's
canonical CSS variables, so a consumer can apply theme tokens to the mount host
with `applyGridTheme` or define the variables in its own stylesheet. Fallbacks
keep the grid usable without the theme package.

The complete token catalog remains owned by `@affino/datagrid-theme`; this
adapter does not duplicate its full token map or declare inactive token names in
CSS. As grid features are added, their styles consume the relevant tokens. The
package test checks that every `--datagrid-*` variable referenced by adapter CSS
exists in the theme package's canonical token map.

## XLSX export

Install `@affino/export-xlsx` only when XLSX export is needed, then import the
optional `@affino/datagrid-dom/xlsx` entry point. The regular DOM entry point
does not load the writer. Install `@affino/datagrid-formula-engine` as well only
when using `formulas: "excel"`; value exports do not load it. The
`exportDataGridDomXlsx(api, options)` helper captures Core's
complete current projection, resolves computed cell values, and serializes the
workbook in a Web Worker. It returns bytes and row/column counts; use
`downloadDataGridDomXlsx` for a browser download or consume the bytes directly.
Column definitions may include `export` metadata for header labels, Excel data
types, number formats, widths, and basic text/fill styles.
The XLSX `export.style` metadata is workbook-only; for matching DOM appearance,
apply the equivalent style through the adapter's `cellStyle` resolver. The
sandbox example uses the same Total-cell fill and text weight in both places.

The current export includes projected group rows and outline levels, refuses
loading, placeholder, or incomplete server projections, and exports pivot
projections using visible generated columns with flattened pivot labels and
calculated values. This writes the current pivot result as a worksheet; it does
not create an interactive Excel PivotTable. Formula fields export computed
values by default;
`formulas: "excel"` translates supported same-row Affino expressions to Excel
formulas with cached values. References to omitted columns, cross-sheet/other-row
references, and unsupported functions return an explicit unsupported result.
When an aggregate can be represented by the exported visible rows,
`formulas: "excel"` also writes group totals as Excel `SUBTOTAL` formulas;
source-basis/custom/unsupported aggregates remain cached values with a warning.
The `/examples/xlsx-export/` page demonstrates a virtualized 2,000-row grid;
the workbook follows Core's sorted/filtered projection rather than the mounted
DOM window.

Internally, `adapter/mountDataGrid.ts` is the composition root for runtime and
DOM lifecycle. Cell selection, navigation, clipboard, and inline editing live
in adapter controllers; viewport window materialization lives under
`adapter/viewport`; browser-specific service bindings live under
`adapter/platform`. These modules coordinate through Core APIs and callbacks,
without keeping parallel row or selection state.

```ts
import { applyGridTheme, defaultStyleConfig, resolveGridThemeTokens } from "@affino/datagrid-theme"

const host = document.querySelector<HTMLElement>("#grid")!
applyGridTheme(host, resolveGridThemeTokens(defaultStyleConfig, { document }))
const grid = mountDataGrid(host, { rows, columns })
```

The resolved theme honors the document's light/dark variant when configured in
`defaultStyleConfig`. Reapply the tokens to the host when the application
changes theme at runtime.

The public `style.css` entry points to `src/styles/index.css`, which orders the
focused `grid.css`, `rows.css`, `cells.css`, `selection.css`, and `gantt.css` modules. Add a
stylesheet module and its import there when new rendering responsibilities
appear; keep the public CSS entry stable.

The `/examples/gantt/` sandbox route covers the opt-in timeline and task editing.
Separate pinned pane lanes remain out of scope. The stress harness is available
in `packages/datagrid-dom-sandbox`; filtering, sorting, pagination, row updates,
grouping, tree data, editing, and virtualization are covered by separate sandbox
routes and focused contract tests.
