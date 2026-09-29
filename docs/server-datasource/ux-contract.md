# Server Datasource UX Contract

This document defines the integration contract for getting the same server-backed UX that the sandbox route `/vue/server-data-source-grid` demonstrates.

Use it when a host app owns the backend table and wants DataGrid to behave like a local spreadsheet:

- rows stay visible while sort/filter/group requests are in flight
- edits feel immediate and reconcile through the datasource path
- undo/redo uses server history without full-grid reloads when row snapshots are returned
- polling or push updates do not blank the viewport

## Golden Path

Create one datasource-backed row model, keep it alive, and let DataGrid drive server reads through the row model.

```ts
import { createDataSourceBackedRowModel } from "@affino/datagrid-vue"
import { createAffinoDatasource } from "@affino/datagrid-server-adapters"

const datasource = createAffinoDatasource<Row>({
  baseUrl,
  tableId: "auctions",
})

const rowModel = createDataSourceBackedRowModel<Row>({
  dataSource: datasource,
  resolveRowId: row => row.id,
  initialTotal: 0,
})
```

```vue
<DataGrid
  :row-model="rowModel"
  :columns="columns"
/>
```

For this path, sorting, column filters, quick filter, advanced filter, grouping, pivoting, aggregation, viewport loading, edits, fill, history, and invalidations all pass through the same row-model lifecycle.

That lifecycle is what provides stale-while-refresh behavior: cached visible rows remain readable while the server request is unresolved, and the cache is replaced only after a successful response.

## Enterprise Contract

For enterprise integrations, use `createDataSourceBackedRowModel` with `createAffinoDatasource` or an equivalent `DataGridDataSource` implementation. The older block-style `createServerBackedRowModel` is a lower-level path and does not represent the full invalidation, mutation, history, and change-feed UX contract.

The backend integration must provide:

- stable row ids and stable projection indexes
- deterministic sorting/filtering with stable tie-breakers
- `revision` and `datasetVersion` on pull and mutation responses
- `baseRevision` on edit/fill commits from the frontend
- `projectionHash` and `boundaryToken` for fill commit continuity
- narrow row snapshots or invalidation for edits, fill, undo/redo, and change-feed events
- stack undo/redo scope using workspace/table/user/session

Current unsupported behavior:

- WebSocket live transport is available for compatible change-feed endpoints; use polling-backed live updates as the default fallback, and treat SSE as custom/host-owned
- offline mutation queue and mutation replay after reconnect
- server-side grouping/tree/pivot projection in the FastAPI demo pull path
- server-side series fill

If a host app needs one of those capabilities, treat it as a separate backend capability slice with protocol, tests, and UX recovery behavior. Do not imply support by passing frontend query fields through an unimplemented backend projection path.

## Offline And Reconnect UX

Current policy:

- keep cached visible rows mounted while the network is interrupted
- show loading/error/retry state from the datasource row model rather than remounting the grid
- resume reads and live updates on reconnect
- refresh the active viewport before treating visible data as current
- recover incomplete change-feed replay through dataset invalidation

Current non-goals:

- no offline edit/fill/history queue
- no automatic mutation replay after reconnect
- no hidden retry of failed edits, fill commits, undo, or redo

If a mutation fails while offline or during reconnect, keep the failure explicit. Optimistic local UI must either be reconciled by the row model response or rolled back; the user should retry only after the datasource has refreshed from the server.

## Required Host App Rules

### Keep The Row Model Stable

Do:

- create the datasource-backed row model once per table/session
- dispose it on unmount
- keep `<DataGrid>` mounted during refreshes
- use `loading`, `initialLoading`, and `refreshing` only for indicators

Do not:

- recreate `rowModel` on every filter, sort, tab, or search change
- change the grid `key` to force remounts during refresh
- hide or unmount the grid body when `loading` becomes true
- clear host-side row collections before a server response if those rows are also feeding the grid

### Let Server Queries Flow Through The Row Model

The backend must receive query state through datasource `pull(request)`:

- `request.range`
- `request.sortModel`
- `request.filterModel`
- `request.groupBy`
- `request.groupExpansion`
- `request.aggregationModel`
- `request.pivotModel`
- `request.pagination`

If a host app has custom filter controls outside DataGrid, those controls must still update the row-model query path. They should not run a separate app-level reload that fetches rows and pushes them into the grid as external updates.

The package can preserve visible rows during native row-model refreshes. It cannot infer that a host app's custom `fetch -> replace collections -> push rows` flow is logically a server filter refresh.

### Treat Refreshing As Background Work

`initialLoading` means there is no useful visible cache yet. A full empty or skeleton state is reasonable.

`refreshing` means a query-affecting request is in flight while cached rows are still available. The grid should remain visible. Use a subtle status indicator, toolbar spinner, or diagnostics text.

Avoid overlays or layout branches that cover or replace the grid body during `refreshing`.

## External Filters

External filters are common, but they must be wired carefully.

Preferred pattern:

1. Convert the external filter state into DataGrid filter state.
2. Apply it through DataGrid/row-model filter APIs.
3. Let `pull(request)` send the resulting `filterModel` to the backend.

Acceptable pattern:

1. Store external filter state in datasource closure or adapter state.
2. Trigger a row-model refresh without clearing cache.
3. Include the external state in the next `pull(request)` body through `mapQuery` or `mapPullRequest`.

Risky pattern:

1. Watch external filters in the app.
2. Fetch rows through an app service.
3. Replace local collections.
4. Push row updates into an already mounted grid.

That path bypasses the built-in sort/filter stale-while-refresh contract. Use it only when you deliberately own the entire cache swap behavior in the host app.

## Edits

Use datasource `commitEdits(request)` for inline editing. The general editor
state machine, keyboard behavior, validation, and focus ownership are defined
in [DataGrid Editing](../datagrid-editing.md). This server contract adds only
the reconciliation rule: prefer returned row snapshots or narrow invalidation
over a full row-model reset.

The exact mutation response fields are maintained in the
[protocol reference](./reference/protocol.md). A custom `patchRows` fallback
must not silently turn every edit into `commitEdits() -> full refresh` when the
backend provides a narrower result.

## Undo And Redo

The ownership decision and client history modes are defined in the
[History API guide](../datagrid-history.md). For server-backed grids, route
undo/redo through server stack history. Apply returned row snapshots first,
then narrow invalidation, and use a full refresh only when neither is
available. Server undo/redo is a mutation and must advance the backend version
state; see the [consistency reference](./reference/consistency.md).

## Change Feed And Polling

Polling or push updates should be treated as datasource invalidations or row snapshots.

Do:

- track `datasetVersion`
- ignore stale change responses
- apply returned row snapshots directly when possible
- apply narrow invalidations for changed rows/cells/ranges
- use full dataset refresh only for dataset-level invalidations or protocol mismatch

Do not:

- refresh the full grid for every change-feed event
- clear the current visible cache before polling completes
- mix independent app-level row replacement with row-model cache ownership

## Backend Requirements

The complete request/response and consistency requirements live in the
[protocol reference](./reference/protocol.md) and
[consistency reference](./reference/consistency.md). At the UX boundary, the
important rule is that every response must give the row model enough
information to reconcile without unnecessarily blanking or remounting the
grid: return row snapshots when possible, otherwise return a narrow
invalidation, and always advance the relevant version token.

## Host App Anti-Patterns

Avoid these patterns if you expect sandbox-equivalent behavior:

- remounting DataGrid to "reload" data
- using `v-if` to remove DataGrid while a request is in flight
- storing the canonical visible rows in the app and treating the row model as a passive renderer
- clearing app collections before a server filter response
- using app-level soft reload for filters while DataGrid owns sorting and viewport loading
- performing undo/redo as `POST -> full refresh` when the server can return row snapshots
- using global `loading` to hide the grid during row-model `refreshing`

## Diagnostics Checklist

When behavior differs from the sandbox, check:

- the same `rowModel` instance survives filter/sort changes
- `<DataGrid>` is not remounted
- `pull(request)` receives the expected `sortModel` and `filterModel`
- the host app is not fetching rows outside the datasource for normal server filters
- `initialLoading` is only true before the first useful cache
- `refreshing` is true during sort/filter refreshes with cached rows
- edit responses include invalidation or snapshots
- undo/redo responses include snapshots before falling back to refresh
- change-feed events do not trigger full refreshes unless required

## When To Own The Cache In The Host App

A host app may deliberately bypass the datasource-backed row model for a highly custom workflow. In that case, the host app owns the equivalent UX contract:

- keep old visible rows until the new query succeeds
- stage incoming rows off-screen or in temporary state
- atomically swap rows, total, and indexes
- preserve selection/focus where possible
- distinguish initial loading from background refresh
- avoid grid remounts

This is a valid advanced architecture, but it is no longer the package golden path.
