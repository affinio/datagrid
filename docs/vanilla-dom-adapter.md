# Vanilla DOM adapter

`@affino/datagrid-dom` is the framework-independent browser renderer. It owns
DOM creation, browser event lifecycles, and view materialization. Canonical
rows, columns, selection, and API state remain in `@affino/datagrid-core`;
shared interaction lifecycles come from `@affino/datagrid-orchestration`.

## Current slice

The adapter renders a `div` grid with ARIA grid roles and exposes the Core API
through `mountDataGrid`. Rendering all rows and columns is the default. Fixed-height row
virtualization is opt-in via `rowVirtualization: { rowHeight, overscan? }` and
uses Core's viewport controller for range math and scroll coordination. The
configured row height must match the rendered layout. Horizontal column
virtualization is opt-in via `columnVirtualization: { overscan? }`; it uses
Core's column metrics and retains pinned edge columns. Both axes can be enabled
together. The adapter requires Core and orchestration. The opt-in Gantt view
uses the separately published `@affino/datagrid-gantt` projection package.
`@affino/datagrid-theme` remains an optional peer and is not loaded
automatically. The adapter's CSS reads theme variables with fallbacks.

Gantt view is opt-in with `viewMode: "gantt"` and `gantt` field options. It
keeps the same Core-backed table projection beside a canvas timeline and
synchronizes vertical scrolling between the panes. It draws task and baseline
bars, progress, milestones, dependencies, critical flags, and derived group
summaries. With a patch-capable row source, mouse dragging moves task bars and
their end handles resize them. Escape cancels a draft; committed edits update
Core rows and enter the DOM adapter's Ctrl/Cmd+Z history. Touch remains native
timeline scrolling. Runtime zoom controls and variable-height row alignment
remain future work. The `@affino/datagrid-gantt` package owns timeline math and
bar/dependency models.


The base page at `/` verifies initial rendering and runtime startup. The
`/examples/sorting/` example sorts by clicking column headers; Shift-click adds
a secondary sort key. Headers ignore columns with `capabilities.sortable:
false`, expose active direction through `aria-sort`, and update row order through
`api.rows.setSortModel`. Toolbar buttons use the same Core API path.
Each scenario has its own page and adjacent Vitest test. Run the focused suite
with `pnpm --filter @affino/datagrid-dom-sandbox test`.

The `/examples/updates/` example adds, removes, and restores rows through
`api.rows.appendData`, `removeData`, and `setData`. The DOM is updated from
adapter subscriptions; the example does not patch rendered rows directly.

The `/examples/selection/` example selects one cell at a time through the Core
selection API. The `/examples/range-selection/` example extends from that cell with
Shift-click or mouse drag and uses Core's advanced range-geometry helper; a
regular click starts a new range. Ctrl/Cmd-click adds a single-cell range, while
Ctrl/Cmd-drag adds a rectangular range and keeps earlier ranges. Its anchor
stays on the original cell while focus follows the gesture. The renderer draws
a perimeter around each selected range while retaining the internal grid
lines. The anchor uses the same selection highlight as the rest of the range,
including in pinned columns. When a range crosses pinned and center columns,
its outer edges form one continuous frame; there are no extra borders at pane
seams.
The DOM adapter owns modifier-key gesture handling, while Core owns the
revision-stamped selection snapshot. Native text selection is disabled on grid
cells so mouse gestures do not paint text over the cell range; touch scrolling
remains browser-owned. Dragging near a viewport edge uses the shared
orchestration auto-scroll helper.

The `/examples/selection-summary/` page subscribes to Core selection events and
uses `api.selection.summarize` to report selected cell/row counts, numeric sum,
and average. It refreshes on selection, row changes/edits, and projection
recomputes. Its scope is `selected-loaded`; the summary marks partial coverage
when selected rows are not materialized, so local results are not presented as
a complete server-side aggregate.

The `/examples/pivot/` page switches between source rows and a Core pivot
projection through `api.pivot.setModel`. It exercises generated value columns,
per-team aggregation, and column grand totals in the DOM renderer. In pivot
mode, source columns used only for the pivoted column/value axes are hidden;
their previous visibility is restored when the pivot is cleared. Pivot column
headers are currently rendered as flat leaf headers; grouped multi-row pivot
headers and drilldown interactions are not part of this slice.

The `/examples/column-groups/` page uses Core `columnGroup` metadata to render
nested header bands above the leaf headers. Group bands are split at pinned-pane
boundaries; a group label appears once and its continuation stays visually
connected across the seam. Empty hierarchy levels merge into the leaf header so
they do not leave blank header bands. The header rows are included in grid row
indices; group resizing and drag reordering of whole groups remain future work.

The `/examples/aggregation/` page configures Core group aggregation with sum,
average, minimum, maximum, and count operations. It renders the aggregate values
on group rows and keeps expansion and aggregation controls on the public rows API.

Clipboard, fill, move, and history operations batch rendering only for their
synchronous application phase. If a row write awaits a datasource, unrelated
row, selection, and viewport changes continue to render while it is pending.

Inline edits and clipboard paste/fill are recorded in the Core transaction
service. Consumers can call `api.transaction.undo()` and `api.transaction.redo()`;
with the grid focused, Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
redoes. Undo restores patched row fields and the previous cell selection. Direct
application mutations and structural row changes are outside the initial
history scope. The `/examples/history/` page demonstrates the API and shortcuts.

The `/examples/clipboard/` page also shows the copied cell range with a brief
dashed frame that clears after the clipboard flash interval. The renderer reads
the existing orchestration clipboard range; copy feedback does not alter cell
selection or row data.

The `/examples/keyboard-navigation/` example gives the grid root keyboard focus on
cell click. Keyboard behavior uses the shared orchestration navigation router
also used by Vue: arrows move between cells, Shift+Arrow extends from the range
focus, Enter moves down one row, Shift+Enter moves up, and Tab wraps between
rows. Plain navigation after an extended range resumes from its anchor. The
active descendant is exposed to assistive technology. The viewport stays put
while navigation remains inside its visible bounds; crossing an edge scrolls
only enough to reveal the active cell.

The renderer exposes logical aria-rowcount/aria-colcount, row and column
indices, and an aria-activedescendant that points to the active mounted cell.
Group disclosure buttons expose aria-expanded; row-selection checkboxes expose
their state and accessible labels. The grid package tests these DOM contracts,
including pinned column indices and keyboard navigation. Custom cell renderers
remain responsible for accessible names and semantics of content they create.
These checks do not claim complete WCAG conformance or replace manual testing
with supported screen readers and browsers.

The `/examples/filtering/` example controls a Core `valueSet` filter through a
native select. The row model owns the filter snapshot and projection; the DOM
adapter renders the projected rows and reports the current result count.

The adapter renders a built-in empty message when the projected row count is
zero. `emptyState` can replace it with a renderer receiving `reason`,
`hasActiveFilters`, and `rowCount`; return a fresh `Node`, a string, or `null`.
`emptyStateAlignment: "viewport"` aligns the message to the visible body rather
than the content width. Empty state is suppressed during loading and errors.
The `/examples/empty-state/` page demonstrates empty data, filtered results, and
restoring rows.

For a ready-made DOM app composition, use `mountDataGridShell`. It has the same
`rows`/`columns` foundation and forwards DOM adapter options, then can add
Vue-compatible `quickFilter` settings and framework-independent toolbar
actions. `columnMenu` adds Core-backed sort, group/ungroup, pin/unpin, value-set
filters, and typed predicate filters. It can open from a header button, a
context menu, or both; the default is both. Predicate operators follow the
column's numeric or text type. Histogram-backed value lists are capped by
`maxFilterValues` and can be narrowed with search. Quick filter writes the
existing Core `filterModel.quickFilter` snapshot and preserves other filter
clauses. Use `mountDataGrid` directly when the application provides its own
toolbar and controls. The `/examples/shell/` page combines these controls with
record selection, editing, fill, column reordering, cell highlights, and row
virtualization. Its multi-level column groups span the pinned and center panes.
The compound-filter controls build typed Core AND/OR expressions while
preserving quick and column filters. The shell showcase also exposes Core
grouping, group aggregation, and a pivot view from toolbar actions so these
features can be explored without leaving the complete account grid.

The `/examples/quick-filter/` example applies Core `filterModel.quickFilter`
across explicitly configured columns. Phrase matching and all-word token
matching are selectable, and clearing the query restores the complete row
projection.

The `/examples/condition-filter/` example applies Core numeric predicate
filters, including lower/upper bounds and a between condition, through the
public row filter model.

The `/examples/advanced-filter/` example composes typed conditions into a Core
AND/OR expression. The UI only edits the expression snapshot; Core evaluates it
as part of the row projection.

The `/examples/histogram/` example reads value counts through
`api.columns.getHistogram`, applies a region filter, and uses the returned team
values as a faceted filter. Histogram counts ignore their own column filter
while respecting other active filters.

The DOM adapter's `fillHandle: true` option adds a pointer handle to the active
editable range. A drag extends the range along one axis only and previews it
with one overlay per pinned pane rather than styling every cell. Numeric seeds
default to series fill; the post-fill options menu can switch between Series
and Copy. Reapplying an option replaces the prior fill history step so one Undo
restores the original values. Fills use Core row edits. The feature is disabled
by default. The `/examples/fill-handle/` page demonstrates axis-constrained fill,
behavior choice, and undo.

The `/examples/range-move/` page demonstrates moving a selected editable range:
drag from its outer edge to a translated destination. A small edge zone shows
the grab cursor; the rest of each selected cell remains available for normal
cell selection. The adapter draws a pane-aware overlay during the gesture,
applies the move through Core row edits, and records one undoable history
operation. This interaction is desktop-pointer-only; touch remains scroll-first.

The `/examples/row-selection/` example opts into `rowSelection: true`, which
adds a pinned checkbox column backed by `api.rowSelection`. A normal checkbox
click changes one record. Shift-click applies the clicked checkbox state to the
range from the last row-checkbox anchor and preserves selected records outside
that range; if the anchor is no longer resolvable, the click changes only the
target record. The header checkbox selects or clears leaf rows in the current
projection, and uses Core's scope-aware selection checks for its checked and
mixed states. Group rows are skipped in ranges and are not selectable. Record
selection does not change cell ranges. Row anchors follow Core projection
revisions, and positional copied-range feedback is cleared when row order or
column order changes.

Editable source-backed cells enter inline edit when the selected cell receives
printable input; that first character replaces the source value. Enter commits
and selects the cell below, Shift+Enter commits and selects the cell above,
Escape cancels, and blur commits without moving selection.

Columns with `presentation.options` use a searchable ARIA combobox editor. It
filters option labels and values, supports arrow/Home/End navigation, preserves
typed option values, and commits through the same Core row patch and history
path as other editors. Enter moves vertically, Tab moves to the next editable
cell, Escape cancels, and selecting an option keeps the current row active. The
`/examples/combobox-cell/` page demonstrates this editor with a larger option set.

The `/examples/pagination/` example uses Core pagination state to change the
projected rows and page size. The DOM adapter renders only the current logical
page; it does not slice source rows itself.

The `/examples/cell-renderer/` page shows the typed `cellRenderer` column hook.
It receives the row, column, resolved value, formatted display text, and the
owning document; it can return text or a fresh DOM node. It replaces only leaf
cell content. Group rows and the grid's cell shells, selection, and interaction
ownership remain with the adapter. Renderers should be pure and create a new
node per invocation; they run when cells are materialized or a full view update
rebuilds them, not for viewport-only reuse of already-mounted cells.

The adapter-level `cellClass` and `cellStyle` resolvers style projected body
cells without replacing their content or interaction. They receive the Core row
node, projected row index, column snapshot, and visible column index, matching
the Vue adapter callback contract. Class results accept a string, string array,
or boolean map; style results accept CSS property names (camelCase or kebab-case)
and CSS custom properties with string values. Previous resolver output is
removed when a cell is reused and the resolver no longer returns it. Use custom
class names outside the reserved `affino-grid-dom__` prefix. The
`/examples/cell-styles/` page demonstrates data-driven status and progress styles.

For a cell-level action, define the Core `cellInteraction` contract on the
column. The grid cell receives its configured role and ARIA state. Pointerdown
selects the cell; click invokes the configured action. Enter and Space are
handled by the active cell according to `cellInteraction.keyboard`, while Enter
without a configured action keeps its normal row-navigation behavior. A
renderer can draw a visual affordance such as a text link or badge without
creating a nested button or another tab stop.

`interactive.activate(trigger)` remains available when a renderer owns a
separate sub-control and handles its events itself. Such handlers should stop
the corresponding click/keydown propagation to avoid the grid invoking the
same action a second time. Let pointerdown reach the cell when the interaction
should also select it. Without `cellInteraction`, `interactive` is `null` and
renderer output is presentation-only.

```ts
{
  key: "status",
  field: "status",
  cellInteraction: {
    click: true,
    keyboard: ["enter", "space"],
    role: "button",
    label: ({ row }) => `Open ${row?.status}`,
    onInvoke: ({ row, trigger }) => openStatus(row, trigger),
  },
  cellRenderer: ({ document, value, displayValue }) => {
    const badge = document.createElement("span")
    badge.className = Number(value) === 0 ? "status-badge status-badge--empty" : "status-badge"
    badge.textContent = displayValue
    return badge
  },
}
```

String results are assigned through `textContent`, never parsed as HTML.

The `/examples/virtualization/` example mounts 10,000 rows with a bounded DOM
window. Core owns the visible range and overscan; the DOM adapter renders that
range with top and bottom spacers. The header is a separate, non-scrolling
vertical surface; the body owns scrolling and mirrors its horizontal offset to
the header. Keyboard reveal uses the same Core viewport controller.

The `/examples/column-virtualization/` example mounts 120 columns and keeps a
bounded center window in the DOM while retaining pinned first and last columns.
Core owns horizontal range math and widths; the DOM adapter renders spacer
tracks and positions pinned cells. Without column virtualization, pinning still
uses the column model's pin state and cumulative offsets. The body viewport owns
horizontal scrolling. When fixed center columns leave spare viewport width, the
last center track expands into that space so right-pinned header and body cells
stay aligned. Keyboard navigation uses the same reveal behavior with
and without virtualization: mounted cells are measured against the usable body
area after pinned panes are reserved, so a sticky cell cannot hide the active
cell. If a virtualized target is not mounted yet, reveal falls back to Core's
column metrics. Both body and header route horizontal wheel gestures
through orchestration's `useDataGridManagedWheelScroll`, also used by Vue;
the body and header offsets are written in the same wheel task. Native body
scroll events remain the fallback for scrollbar, touch and programmatic scroll.
The header is a peer, not a second owner: header-origin scroll notifications
never write back into the body. The center pane width follows the body's usable
width minus pinned pane widths, and is refreshed on resize or column layout
changes. The width is kept on a root CSS variable so DOM reconciliation cannot
remove it or trigger a measurement after each render.
Horizontal overscroll is disabled; vertical wheel and touch panning stay native.
Cell-range drags may start in pinned columns and continue into the center while
edge autoscroll keeps the pinned origin in place.

When grouping adds a level, the grouping presentation settles the label column
and visibility changes before refreshing virtual column metrics. The DOM body
then returns its horizontal scroll owner to the first center column, matching
the Vue column-menu behavior and keeping the group labels available. Header and
body continue to share the same horizontal offset after the reset.

For the Chromium scroll regression, start the standalone sandbox, then run
`DATAGRID_DOM_SANDBOX_URL=http://localhost:5175 node packages/datagrid-dom-sandbox/scripts/check-scroll-sync.mjs`.
The check covers horizontal wheel over body/header, offset synchronization in
the wheel task and subsequent animation frames, header/body cell geometry at
horizontal boundaries after virtual-window replacement, and grouped-view
alignment, including equal header/body column widths, while horizontally
scrolling and in the generated pivot view. A passing headless
run does not replace precision-trackpad and real touch-device verification.

Viewport notifications do not automatically rebuild cells. If rendered column
indices, widths, pinned offsets and spacer widths are unchanged, scrolling uses
the existing DOM. When the window changes, retained rows/cells/spacers stay
mounted; only entering cells resolve values and allocate DOM. Row reuse requires
both the projected index and rowId to match. Data, selection and column changes
still take the full update path, so this optimization does not cache canonical
values or selection. See [horizontal scroll measurements](./perf/datagrid-dom-horizontal-scroll.md)
for the profiling command and its limits.

All standalone pages show the same inline loading cover before module styles
and the grid runtime are ready. The page content is inert until startup
completes; a startup failure leaves an accessible error message in the cover.

The public `@affino/datagrid-dom/style.css` entry is composed from focused
modules under `packages/datagrid-dom/src/styles/`: grid root, rows, cells, and
selection. These styles consume the canonical variables from
`@affino/datagrid-theme`, including typography, row/cell spacing, borders,
range fill, anchor fill, and selection frame. The theme package stays optional:
the adapter does not import it, and consumers can either apply tokens to the
mount host with `applyGridTheme` or define the same CSS variables themselves.

The full token catalog stays owned by `@affino/datagrid-theme`; the DOM adapter
does not keep a second list of inactive variables. New rendering features adopt
their relevant tokens as they are implemented. The DOM package test checks that
every theme variable referenced in its CSS is present in the canonical token
map.

The range perimeter is a positioned pseudo-element overlay on selected cells.
Its edges do not change cell border widths or grid track sizes, so selecting a
range does not shift the table layout.

The `/examples/stress/` page combines both virtualization axes over 10,000 rows
and 120 columns. Its repeatable viewport pass exercises distant row and column
windows while reporting mounted rows, cells, and DOM nodes. The Vitest contract
checks that this combined render window remains bounded.

Row virtualization still uses fixed row heights. Variable-height rows and
separate left/center/right body lanes remain outside the current adapter slice;
pinned body cells use CSS sticky positioning within the shared body viewport.
The header uses separate left-pinned, center-scrollable, and right-pinned panes,
matching the Vue adapter. Only the center header pane mirrors the body's
horizontal offset; pin changes recalculate its available width after reserving
the pinned panes.

Cell borders are drawn on shared edges only once to avoid double-weight internal
grid lines during fractional horizontal scrolling. This does not change column
geometry or selection-frame layout.

The `/examples/column-resizing/` page demonstrates header resizing through the
shared orchestration resize lifecycle. Drag the separator with a mouse or touch,
use Left/Right while the separator is focused for 10px keyboard steps, or
double-click it to estimate a width from the label and projected row values.
The controller commits widths through `api.columns.setWidth`; Core remains the
width owner. System columns marked with `meta.isSystem` do not get resize handles.
While a column resize gesture is active, the `col-resize` cursor stays visible
across the grid body and clears when the gesture ends or the grid is destroyed.

Column header drag reordering is opt-in with `columnReorder: true` in
`DataGridDomOptions`; it is off by default. Drops reorder within or between
pinned zones through Core's column model. An active cell/range is remapped by
column key so it stays attached to the same logical columns after the order
changes. The `/examples/column-reordering/` page demonstrates center-zone
reordering and moving columns into pinned zones.

The `/examples/column-layout/` page connects native visibility checkboxes and
pin-zone selectors to `api.columns.setVisibility` and `api.columns.setPin`.
Core publishes the updated column snapshot; the adapter rerenders the logical
visible order and recalculates pinned positions. No parallel layout state is
kept in the sandbox controls. The example draws persistent separators at the
left and right pinned-zone boundaries in both the header and body.

The `/examples/grouping/` page applies Core row grouping by team, status, or
team then status. As in the Vue app, group rows render their label in the first
eligible visible column on the left, and grouped source columns are suppressed
while grouping is active. The adapter restores each column's prior visibility
when it is no longer suppressed. Nested groups and leaf labels indent by
hierarchy depth; group labels show the field and child count. Group cells
participate in range selection and keyboard navigation. Disclosure controls
route through `api.rows.toggleGroup`; Space toggles the active group row or a
focused disclosure control. The example also exercises
`expandAllGroups` and `collapseAllGroups`. Core computes a sum of `points` for
each group; the DOM adapter renders non-empty group aggregates as right-aligned
numeric cells. If collapsing a group hides the active descendant, the cell
selection moves to that group's row so its overlay remains visible. Column
resizing starts from the rendered width when a column is flex-sized, avoiding a
jump to the fallback width on the first drag.

The `/examples/tree-data/` page uses `mountDataGrid({ treeData })` to build a
path hierarchy in Core. The DOM adapter renders Core's group rows in the first
eligible visible column, routes disclosure controls through
`api.rows.toggleGroup`, and Space toggles the active or focused tree node.
When collapsing a tree node hides the active descendant, the cell selection
moves to the collapsed node so its overlay remains visible. Leaf labels are
indented by their hierarchy depth. The mount
option accepts both Core tree modes (`path` and `parent`); the standalone
example currently exercises path mode.

The `/examples/formulas/` page passes initial formula definitions through the
DOM adapter's `formulas` option. Core owns dependency evaluation and computed
row values; the renderer displays those values for columns whose field matches
a formula target, using Core's cell formatting. Inline editing a source field updates
dependent formula columns without creating formula state in the adapter;
copying a formula cell copies its computed value.

Select-backed source columns can be marked editable. Double-click or Enter/F2
opens a native select using the column's option labels and values; choosing an
option commits its typed value through Core. The `/examples/select-editing/`
page demonstrates this path.

Editable boolean cells render native checkboxes. Clicking the cell or pressing
Space toggles the source value through Core and records the mutation in grid
history. The `/examples/checkbox-cells/` page demonstrates pointer, keyboard,
and history behavior.

Editable `date` and `datetime` columns open native date and datetime-local
controls on double-click, Enter, or F2. Core parses and validates the draft;
commits use the normal row patch and history path. The
`/examples/date-editing/` page demonstrates both types.

Editable `number`, `currency`, and `percent` columns use a decimal text input so
currency symbols and percent suffixes can be entered. Core parses and validates
the draft before the row patch; invalid drafts stay open with `aria-invalid`
until corrected or canceled. The
`/examples/numeric-editing/` page demonstrates all three types.
The `/examples/edit-validation/` page shows invalid drafts remaining active,
exposing `aria-invalid`, and committing only after correction.

`mountDataGrid` accepts exactly one row source: a local `rows` array or a
caller-supplied Core `rowModel`. A supplied model remains caller-owned; await
`handle.destroy()` before calling `rowModel.dispose()`. For sparse/server row
models, enable row virtualization so the adapter requests and renders the
viewport window. Core's sparse range API supplies explicit loading-row nodes;
the DOM adapter renders those slots as inert skeleton cells instead of leaving
white gaps. The adapter passes each rendered Core row and column snapshot to
Core's cell value resolver, so loaded rows render without requiring a global
row-id lookup. Sorting and filtering use the row-model API and its datasource
projection contract.

The framework-neutral `@affino/datagrid-server-adapters` and
`@affino/datagrid-server-client` packages can provide the `DataGridDataSource`
used to create that Core row model. Pass the resulting row model through
`mountDataGrid({ rowModel })`; no Vue bridge is needed. The sandbox keeps its
in-memory datasource for deterministic viewport and failure-state checks.

```ts
const dataSource = createAffinoDatasource<Order>({ baseUrl, tableId: "orders" })
const rowModel = createDataSourceBackedRowModel({ dataSource, resolveRowId: row => row.id })
const grid = mountDataGrid(root, { rowModel, columns, rowVirtualization: { rowHeight: 38 } })

// Teardown in ownership order:
await grid.destroy()
rowModel.dispose()
```

The `/examples/server-row-model/` page uses Core's
`createDataSourceBackedRowModel` with an in-memory datasource. It demonstrates
viewport range pulls, datasource-side sorting and filtering, loading/error
state, and retry. Its teardown destroys the grid handle first, then disposes
the externally owned row model.

The `/examples/pinned-bottom/` page demonstrates Core row nodes with
`state.pinned: "bottom"`. The DOM adapter keeps these rows in a separate
bottom rowgroup while the ordinary rows scroll, and synchronizes its horizontal
offset with the header and body. This first slice applies when row
virtualization is disabled; partitioning pinned rows out of Core's virtual row
coordinate space remains a separate follow-up.

`mountDataGrid` can opt into `gridChrome: "canvas"` when both fixed-height row
virtualization and column virtualization are enabled. The Canvas layer draws
body grid lines across the left, center, and right panes; header lines and all
cell content remain DOM-rendered. The Canvas is decorative and hidden from
assistive technology. DOM cell borders remain visible until the Canvas has a
valid viewport model and frame, and also remain the fallback when Canvas is
unavailable. The default `gridChrome: "dom"` keeps cell borders.
`/examples/canvas-chrome/` demonstrates two-axis scrolling, pinned columns, and
2,000 logical rows.
