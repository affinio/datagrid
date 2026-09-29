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
| computed-fields / formulas | Computed and formula-backed field definitions. |
| formula-functions | Named formula function registry. |
| aggregation-model | Core aggregation configuration. |
| sort-model / filter-model | Controlled projection state. |
| group-by / pivot-model | Grouping and pivot projection state. |

Use rows for ordinary local tables. Use row-model when data ownership or lifecycle belongs to another runtime; do not provide both for the same grid.

## View and interaction props

| Prop | Purpose |
| --- | --- |
| virtualization | Enable/configure virtual row and column rendering. |
| pagination / page-size / current-page | Pagination mode and page state. |
| render-mode | "virtualization" or "pagination" mode selection. |
| layout-mode / min-rows / max-rows | Grid height contract: fill or bounded auto-height. |
| row-height-mode / base-row-height | Fixed or measured row height. |
| row-selection / row-selection-state | Full-row checkbox selection and controlled selection state. |
| fill-handle / range-move | Spreadsheet range workflows. Both are opt-in. |
| row-reorder | Row drag/reorder behavior. |
| show-row-index | Show the row-index surface. |
| row-hover / striped-rows | Visual row presentation. |
| column-menu / cell-menu / row-index-menu | Built-in contextual menus. |
| column-layout / column-reorder | Column visibility, order, sizing, and pinning controls. |
| quick-filter / advanced-filter / find-replace | Optional query and editing tools. |
| grid-lines | Grid-line presentation preset/options. |
| history | Built-in or injected undo/redo controls. |
| chrome / toolbar-modules | Toolbar placement, density, and host-provided modules. |
| theme | Theme preset or theme configuration. |

## State props

state is the unified controlled state boundary. It can include model projection, columns, selection, transactions, and other serializable runtime state. Use the dedicated props only when the host intentionally controls one smaller slice:

- column-state
- column-order
- hidden-column-keys
- column-widths
- column-pins
- row-selection-state
- view-mode

For persistence, prefer the unified `state` prop or the saved-view helpers and component ref methods documented below. Restore state after the row model and columns are ready.

## Events

| Event | Payload |
| --- | --- |
| ready | { api, rowModel } after runtime initialization. |
| cell-change | Cell mutation notification. |
| cell-edit | { rowId, columnKey, oldValue, newValue, patch }. |
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

## Optional feature entrypoints

The root import is the ordinary table path. Use explicit subpaths for optional features:

- @affino/datagrid-vue-app/quick-filter
- @affino/datagrid-vue-app/advanced-filter
- @affino/datagrid-vue-app/find-replace
- @affino/datagrid-vue-app/aggregations
- @affino/datagrid-vue-app/gantt

See [API stability](./api-stability.md) before depending on advanced or internal entrypoints.
