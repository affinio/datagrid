# App component API

Status: public API reference.

This page documents the public surface of DataGrid from @affino/datagrid-vue-app. It is a practical index; types and editor completion remain the authoritative details for option objects.

## Data inputs

| Prop | Purpose |
| --- | --- |
| rows | Local row records or row-node inputs. Prefer a stable rowId/id. |
| row-model | Existing row model, used instead of rows for server, worker, or custom runtime ownership. |
| rows-update-mode | "replace" or "patch" handling for reactive row updates. |
| client-row-model-options | Client row-model options such as resolveRowId. |
| columns | Column definitions. Each column normally has key and label. |
| external-filter-indicators | Active filter conditions owned by the host app; shown in the matching header with a plain-text tooltip and included in its accessible label. |
| computed-fields / formulas | Computed and formula-backed field definitions. |
| formula-functions | Named formula function registry. |
| aggregation-model | Core aggregation configuration. |
| sort-model / filter-model | Controlled projection state. |
| group-by / pivot-model | Grouping and pivot projection state. |

Active group-by levels appear in the toolbar in hierarchy order. Adding a level scrolls the grouping tree column to the start of the center viewport. Removing a level from its chip rebuilds the hierarchy with the remaining levels; collapsing a group returns focus to its visible disclosure control.

Use rows for ordinary local tables. Use row-model when data ownership or lifecycle belongs to another runtime; do not provide both for the same grid.

External conditions can be surfaced without registering them in the grid's filter model:

```ts
const externalFilterIndicators = [{
  id: "saved-query-status",
  columnKey: "status",
  active: true,
  description: "Only records in the saved query are shown",
}]
```

Pass this list to `DataGrid`. Inactive indicators are omitted; multiple active
descriptions on the same column are combined. IDs are unique across the list.
The descriptor only reports filtering owned elsewhere and does not change rows
or the grid's built-in filter state.

## View and interaction props

| Prop | Purpose |
| --- | --- |
| virtualization | Enable/configure virtual row and column rendering. |
| sticky-group-rows | Opt-in root group headers that stick below the table header and are pushed off at the end of their group. |
| pagination / page-size / current-page | Pagination mode and page state. |
| render-mode | "virtualization" or "pagination" mode selection. |
| layout-mode / min-rows / max-rows | Grid height contract: fill or bounded auto-height. |
| row-height-mode / base-row-height | Fixed or measured row height. |
| row-selection / row-selection-state | Full-row checkbox selection and controlled selection state. The checkbox column defaults to 48px; `rowSelection` accepts `enabled`, `columnWidth`, and `isSelectable`. Group-row checkboxes affect selectable data descendants. |
| row-header | Chooses what the row-index header does: `select-cells` (default, selects visible data cells across a row and supports Shift/drag ranges), `select-records`, or `none`. The checkbox column independently controls record selection. |
| fill-handle / range-move | Spreadsheet range workflows. Both are opt-in. |
| row-reorder | Row drag/reorder behavior. |
| show-row-index | Show the row-index surface. |
| index-column-style | CSS styles for the row-index column. Set `width: "auto"` to size it to the built-in decimal row labels; numeric pixel widths remain fixed. |
| row-hover / striped-rows | Visual row presentation. |
| column-menu / cell-menu / row-index-menu | Built-in contextual menus. |
| column-layout / column-reorder | Column visibility, order, sizing, and pinning controls. |
| quick-filter / advanced-filter / find-replace | Optional query and editing tools. |
| grid-lines | Grid-line presentation preset/options. |
| history | Built-in or injected undo/redo controls. |
| server-history | Enable synchronization with datasource-backed server history. Defaults to `true`; set `:server-history="false"` when the backend does not expose history endpoints. This is independent from local `history`. |
| empty-state | Optional typed renderer for content shown inside the row body when no rows are available. |
| empty-state-alignment | `"content"` (default) centers across the virtual content; `"viewport"` centers within the visible center table viewport and remains anchored during horizontal scrolling. |
| chrome / toolbar-modules | Toolbar placement, density, and host-provided modules. `DataGridModuleHost` accepts the same `theme` and `chrome` props when modules are rendered outside the grid. |
| toolbar-layout | Declarative rows and start/center/end placement for built-in toolbar items and custom modules, plus text or icon presentation for undo/redo. |
| theme | Theme preset or theme configuration. |

`sticky-group-rows` accepts `{ enabled, mode: "root-only", transition: "push-off" }`.

`grouping-presentation` opts into a generated hierarchy column while grouping is active:

```ts
{
  display: "hierarchy-column",
  hierarchyColumn: {
    headerName: "Group / task",
    leafColumnId: "task",
    hideLeafSourceColumn: true,
    showCount: true,
    showGroupFieldLabel: "auto",
  },
}
```

The generated column uses the stable id `DATA_GRID_HIERARCHY_COLUMN_ID` (`__affino_hierarchy__`). Include a regular column config with this key when you need to set its width, pinning, or initial order; the grouping presentation supplies the group and leaf contents. Normal state props can also refer to this id. `leafColumnId` must name an existing data column; it cannot name the hierarchy column or a service column. Hiding the source column requires `leafColumnId`. Its visibility is suppressed only while grouping presentation is active and restored afterward, preserving its prior visibility state. The source column remains in the data schema and is used for leaf value access and edits. `showGroupFieldLabel: "auto"` omits the field label for one grouping level and includes it for nested grouping.

When a source column renderer is reused for a hierarchy leaf, renderer `column`/`displayColumn` identify the visible hierarchy column and `sourceColumn` identifies the original data-column definition. Indentation is visual only; clipboard text comes from the source cell value, without the disclosure or count decoration. The grouping menu retains grouping-key actions; use the original column's filter controls before enabling source suppression when no separate filter panel is configured.
Only expanded root groups with visible descendants stick. The same row identity
is rendered in the sticky layer; pinned columns remain fixed while center
columns follow horizontal scrolling. It defaults to disabled.

### Column-menu filter conditions

When the column menu is enabled, it includes **Filter by condition** by
default. Its submenu keeps the controls in the column menu: choose an available
condition from the native dropdown and enter its value or formula below. When
the condition is active, the column header's filter icon is shown as well as
the badge on **Filter by condition**.
The condition remains a draft until the column menu's shared **Apply** button
is pressed. **Clear filter** applies immediately and closes the column menu.
The available operators follow the column data type: numeric/date columns expose
comparison operators, ranges, and membership; text columns expose text matching;
boolean columns expose true/false comparisons. Empty and null checks are also
available. Applying edits the selected column's condition in place, preserving
other conditions and adding an AND condition when that column has no condition yet.
Closing the menu without applying leaves the current filter unchanged.

Hide the action globally or for selected columns:

```ts
const columnMenu = {
  enabled: true,
  hide: ["condition"],
  columns: {
    internalNote: { hide: ["condition"] },
  },
}
```

The `advancedFilter` prop and `advanced-filter` package entrypoint remain
available for compatibility. Their default visible label is now **Filter**.

### Empty state

The grid renders a default message inside the row body when the stable row
model result is empty. Headers, the toolbar, and filter controls remain
visible. The empty state is not rendered while the row model is loading or in
an error state.

Use `emptyState` when the application needs localized or domain-specific copy:

```vue
<script setup lang="ts">
import { h } from "vue"
import { DataGrid, type DataGridEmptyStateProps } from "@affino/datagrid-vue-app"

const renderEmptyState = ({ reason }: DataGridEmptyStateProps) =>
  h("p", { class: "trades-empty-state" }, reason === "filtered"
    ? "No trades match the current filters."
    : "No trades have been added yet.")
</script>

<DataGrid
  :rows="trades"
  :columns="columns"
  :empty-state="renderEmptyState"
/>
```

The renderer receives `{ reason, hasActiveFilters, rowCount }`. `reason` is
`"no-rows"` when the row model has no rows and `"filtered"` when active filters
produce zero matches. `rowCount` is always `0` for this renderer. The same
contract applies to client-side and datasource-backed row models.

The default body uses semantic `role="status"`, a polite live region, and
public CSS custom properties. Applications can theme it without relying on
internal DOM selectors:

```css
.orders-grid {
  --datagrid-empty-state-color: var(--app-muted-text);
  --datagrid-empty-state-background: var(--app-surface);
  --datagrid-empty-state-min-height: 8rem;
  --datagrid-empty-state-padding: 2rem;
}
```

Use `empty-state-alignment="viewport"` for wide tables when the message
should remain centered in the visible center viewport instead of the full virtual
content width. The viewport is the center scrollport, excluding pinned columns;
the message remains anchored there while horizontal scrolling. The default
`"content"` mode preserves the previous full-content centering behavior.

```vue
<DataGrid
  :rows="trades"
  :columns="columns"
  :empty-state="renderEmptyState"
  empty-state-alignment="viewport"
/>
```

Both alignment modes are compatible with `auto-height`, `fill`, bounded `maxRows`,
column virtualization, and pinned columns. The prop does not create rows or
change filtering, selection, or server query semantics.

## State props

state is the unified controlled state boundary. It can include model projection, columns, selection, transactions, and other serializable runtime state. Use the dedicated props only when the host intentionally controls one smaller slice:

- column-state
- column-order
- hidden-column-keys
- column-widths
- column-pins
- row-selection-state
- view-mode

For automatic preferences, use [`state-persistence`](./datagrid-state-persistence.md). It owns restore timing and saving after resize; do not restore again from `ready`. Use `state` for parent-controlled state and saved-view helpers for explicit named views.

`getSavedView({ include })` captures a separate view snapshot. The default
includes columns, sorting, filters, grouping, pagination, pivot, aggregation,
and view mode. Selection and viewport position are opt-in; callers can choose
any subset:

```ts
const view = grid.getSavedView({ include: ["columns", "sorting", "filters", "grouping"] })
grid.applySavedView(view, { interaction: "reject" })
```

New snapshots record their included parts; omitted state is not restored.
Transaction history, runtime diagnostics, and virtualized window state are
always omitted. Snapshots created before the inclusion manifest was added keep
their legacy restore behavior. Restore migrates and validates the snapshot
before applying it atomically. An active editor or pointer interaction blocks
restore by default; pass `{ interaction: "cancel" }` to cancel it through the
grid's normal interaction lifecycle before restoring. A pending edit commit
cannot be canceled and therefore still blocks restore.

## Events

| Event | Payload |
| --- | --- |
| ready | { api, rowModel } after runtime initialization. |
| cell-change | Cell mutation notification. |
| cell-edit | { rowId, columnKey, oldValue, newValue, patch }. |
| data-change | `{ source, edits }` for successfully applied row value changes; one event per call, coalesced inside `rows.batchMutations()`. |
| selection-change | Cell/range selection snapshot change. |
| row-selection-change | Full-row selection snapshot change. |
| update:state | New unified state snapshot or null. |
| update:row-selection-state | Controlled row-selection snapshot. |
| update:column-state | Unified column state. |
| update:column-order | Ordered column keys. |
| update:hidden-column-keys | Hidden column keys. |
| update:column-widths | Column width map. |
| update:column-pins | Column pin map. |
| update:group-by | Group-by model. |
| update:view-mode | Current app view mode. |
| toolbar-modules-change | Resolved toolbar module list when the host owns toolbar placement. |

Vue templates use kebab-case event names, for example @cell-edit and @update:state.

`data-change` includes changes from inline edits, checkbox edits, paste, paste special,
fill, clear, find/replace, and local undo/redo that replay row edits. Its `edits`
contain one entry per changed row (`rowId`, `oldData`, `newData`, and the fields
actually changed in `patch`). It is emitted after the row model has applied the
operation, including edits to filtered or collapsed rows. Empty and no-op edits
produce no event. `cell-change` remains the row-model snapshot notification and
`cell-edit` remains the single-cell inline-edit notification.

`source: "grid"` marks an operation initiated by grid UI or history replay.
`source: "application"` marks a call made through the public API; this is the
default. When synchronizing an application-owned model from `data-change`, apply
only events with `source === "grid"`. This keeps the echo from the host out of the
domain update path. The event's `newData` is the value after the successful edit.

The public row API already supports explicit ID-based deltas. It avoids diffing a
replacement array and keeps the current model/component instance:

```ts
const api = gridRef.value?.getApi()
api?.rows.insertDataAfter("r1", [{ row: { id: "r2", amount: 4 }, rowId: "r2" }])
api?.rows.removeData(["r3"])
api?.rows.applyEdits([{ rowId: "r1", data: { amount: 5 } }], { source: "application" })
```

Use `rowsUpdateMode="patch"` for declarative replacement arrays with unchanged
row count and ID order. It still scans the old and new arrays and compares their
values. A length or ID-order change uses the existing replace path. It does not
represent an O(changed rows) delta; use the explicit row API above for that.

## Component ref

```vue
<script setup lang="ts">
import { useDataGridRef } from "@affino/datagrid-vue-app"

type Order = { rowId: string; amount: number }
const gridRef = useDataGridRef<Order>()

function saveView() {
  const state = gridRef.value?.getState()
  if (state) localStorage.setItem("orders-grid", JSON.stringify(state))
}
</script>
`

The public ref exposes:

- getApi() and getRuntime() for integration ownership;
- getState(), migrateState(), and applyState() for unified state;
- getSavedView(), migrateSavedView(), and applySavedView() for app saved views;
- history / getHistory() for undo and redo;
- focus-anchor capture/restore and selection aggregate helpers.

Use getApi() only when the component-level props/events do not express the integration. For core namespace semantics, see [Core API](./core-api.md).

### Server history synchronization

`server-history` (`DataGridServerHistoryProp`) controls only the automatic server-history integration for a datasource-backed row model. With `:server-history="false"`, DataGrid does not call `getHistoryStatus()`, does not subscribe through `subscribeHistoryStatus()`, and does not call server undo/redo methods. The local `history` prop keeps its existing meaning and remains independent.

```vue
<DataGrid
  :row-model="rowModel"
  :columns="columns"
  :history="false"
  :server-history="false"
/>
```

The default is enabled for backwards compatibility. Set it to `false` for read-only tables or backends that do not implement the history endpoints.

## Optional feature entrypoints

The root import is the ordinary table path. Use explicit subpaths for optional features:

- @affino/datagrid-vue-app/quick-filter
- @affino/datagrid-vue-app/advanced-filter
- @affino/datagrid-vue-app/find-replace
- @affino/datagrid-vue-app/aggregations
- @affino/datagrid-vue-app/gantt

See [API stability](./api-stability.md) before depending on advanced or internal entrypoints.
