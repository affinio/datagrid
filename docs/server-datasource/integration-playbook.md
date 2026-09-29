# Server datasource integration playbook

Status: maintained public integration guide.

Use this page when the [quick start](./quick-start.md) works and you are
integrating a real backend table. It explains the implementation order and
ownership decisions. Exact HTTP payloads belong to the
[protocol reference](./reference/protocol.md); reusable Python and TypeScript
starting points belong to the [templates](./templates/).

## Before writing code

Decide these boundaries first:

| Decision | Recommended owner |
| --- | --- |
| Canonical rows, filtering, sorting, paging | Backend repository/query layer |
| Column permissions and coercion | Backend column registry |
| Revision and dataset version | Backend persistence layer |
| Selection, editing, and viewport UX | DataGrid row model and app layer |
| Workspace scope | `X-Workspace-Id` initially; authenticated scope in production |
| HTTP request/response naming | JSON protocol aliases; keep them stable |

Do not put SQL translation in a FastAPI route or replace the datasource-backed
row model with app-level reloads for ordinary filter and sort changes. The
server owns data access; the grid owns projection and interaction state.

## Step 1: Define the table contract

Create one table definition that connects the ORM model, stable row identity,
ordering, workspace scope, timestamps, and column registry.

```py
AUCTIONS_TABLE = GridTableDefinition(
    table_id="auctions",
    model=AuctionRowModel,
    row_id_attr="id",
    workspace_id_attr="workspace_id",
    row_index_attr="row_index",
    updated_at_attr="updated_at",
    columns=AUCTION_COLUMNS,
    default_sort_column_id="index",
)
```

The row id must remain stable across pulls and mutations. Use one deterministic
ordering field; do not introduce a second index with different semantics.

Define the column registry next. Each column should explicitly state whether it
is editable, sortable, filterable, histogram-enabled, and which value type it
uses. Keep the registry in the host app unless it is a reusable table package.
See the [backend template](./templates/backend-template.md) for the complete
registry shape.

## Step 2: Implement projection and persistence

The repository or adapter should own:

- workspace-scoped row queries;
- translation of `sortModel` and `filterModel` into safe query expressions;
- exclusive `range.endRow` handling;
- total-count calculation;
- row serialization to the public response shape;
- revision and dataset-version reads;
- narrow invalidation after mutations.

The router should only resolve dependencies, read the workspace scope, call the
repository, and return a response model. Compare the current FastAPI wiring in
the [backend reference](./reference/backend-fastapi.md).

## Step 3: Add the HTTP surface incrementally

Implement endpoints in this order:

1. `POST /api/{tableId}/pull`
2. `POST /api/{tableId}/histogram`
3. `POST /api/{tableId}/edits`
4. `POST /api/{tableId}/fill-boundary`
5. `POST /api/{tableId}/fill/commit`
6. history endpoints;
7. `GET /api/changes?sinceVersion=...` or a compatible push transport.

The first endpoint must return stable row ids, `index`, `rows`, `total`, and a
revision/dataset version when the backend has them. Add mutation tokens before
shipping edits or fill. The exact required and optional fields are maintained
in the [HTTP protocol reference](./reference/protocol.md).

## Step 4: Preserve consistency tokens

For every mutation path, decide how the backend handles:

- `baseRevision` stale-write checks;
- `projectionHash` and `boundaryToken` for fill;
- `operationId` duplicate detection;
- `revision` and `datasetVersion` advancement;
- cell, range, row, or dataset invalidation;
- history scope and redo-branch invalidation.

Do not invent a second conflict model in the frontend. The client must preserve
the tokens returned by the backend and apply the returned invalidation or row
snapshots. See [consistency reference](./reference/consistency.md).

## Step 5: Wire the frontend adapter

Use `createAffinoDatasource` for the standard Affino HTTP shape. Use the lower-
level `@affino/datagrid-server-client` only when the backend transport or URL
shape requires a custom adapter.

```ts
const datasource = createAffinoDatasource<AuctionRow>({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  tableId: "auctions",
  historyScope: {
    workspaceId: "workspace-a",
    sessionId: "session-a",
  },
})
```

Pass the datasource to the datasource-backed row model and keep that row model
instance stable for the lifetime of the grid. Dispose it when the host is
unmounted. The adapter reference documents custom mapping and live-update
boundaries.

## Step 6: Add the app layer

The normal Vue integration remains the app-facing `DataGrid` component. Keep
backend concerns in the datasource and row model; do not make the component
call pull endpoints directly.

```vue
<DataGrid
  :row-model="rowModel"
  :columns="columns"
  virtualization
/>
```

For server-backed editing, fill, history, and live updates, verify the UX rules
in the [server datasource UX contract](./ux-contract.md) before adding toolbar
or keyboard actions.

## Step 7: Test the boundary you own

Backend contract tests should cover:

- workspace isolation and authorization;
- stable row identity and exclusive range boundaries;
- sort/filter translation and histogram scope;
- stale revision and duplicate operation handling;
- fill boundary/commit token validation;
- scoped undo/redo;
- change-feed replay and dataset invalidation fallback.

Frontend integration tests should cover:

- datasource-backed row-model creation and disposal;
- request cancellation during viewport churn;
- mutation invalidation and row snapshot application;
- reconnect behavior and live-update cursor recovery.

Use the [integration checklist](./checklist.md) as the release gate. Do not
copy the full protocol examples into each test or guide; link to the canonical
reference and add only the payload fragment relevant to the behavior under
test.

## Reference implementation and templates

- [FastAPI reference](./reference/backend-fastapi.md) — current repository backend.
- [Frontend adapter reference](./reference/frontend-adapter.md) — standard client mapping.
- [Backend template](./templates/backend-template.md) — reusable Python skeleton.
- [Frontend template](./templates/frontend-template.md) — custom HTTP adapter skeleton.
- [Protocol](./reference/protocol.md) — exact request/response contract.
- [Consistency](./reference/consistency.md) — revisions, invalidation, conflicts, and history.
- [Selection operations](./reference/selection-operations.md) — delegated operations over loaded/unloaded data.

## Current limitations

The current FastAPI demo does not implement every enterprise projection or
offline mutation mode. Treat limitations in the protocol and consistency
references as part of the contract, not as implied future behavior.
