# @affino/datagrid-server-adapters

Opinionated server datasource adapters for Affino DataGrid.

Use this package when you want the simplest path from a backend-owned table to a working grid datasource.

## When To Use

- use this package for the primary frontend integration path
- use `@affino/datagrid-server-client` only when you need low-level transport or change-feed helpers
- keep sandbox-specific adapter code in the sandbox package, not here

## Install

```bash
pnpm add @affino/datagrid-server-adapters
```

## Minimal Example

```ts
import { createAffinoDatasource } from "@affino/datagrid-server-adapters"

type AuctionRow = {
  id: string
  index: number
  title: string
  status: string
}

const datasource = createAffinoDatasource<AuctionRow>({
  baseUrl: "http://localhost:8000",
  tableId: "auctions",
})
```

`createAffinoDatasource()` returns a `DataGridDataSource<T>`-compatible facade with the additional change-feed and history helpers surfaced on the typed return value.

## Optional Options

- `headers` forwards request headers on adapter-owned requests
- `historyScope` forwards `workspace_id`, `user_id`, and `session_id` into edit, fill, and history bodies
- `histogram.ignoreSelfFilter` sets the default histogram behavior for requests that should ignore the active column filter
- `queryCodec` configures the default pull request codec, including `columnIdMap`, `quickFilterModeFallback`, and `legacyAdvancedFilters`
- `mapQuery` receives the normalized backend DTO and can adapt it to a backend-specific request body
- `mapPullRequest` receives the raw `DataGridDataSourcePullRequest` and bypasses the package codec entirely

## Server Query Codec

Pull requests are normalized into a stable backend DTO by default. The codec is a boundary helper: it converts DataGrid request state into JSON-safe transport data, but it is not a SQL compiler, ORM adapter, permissions layer, or backend execution engine.

```ts
import { normalizeDataGridServerQuery } from "@affino/datagrid-server-adapters"

const query = normalizeDataGridServerQuery(request, {
  columnIdMap: {
    updatedAt: "updated_at",
  },
  quickFilterModeFallback: "contains",
  legacyAdvancedFilters: "preserve",
})
```

The normalized shape keeps request concerns explicit:

```ts
{
  range: { startRow: 0, endRow: 50 },
  sortModel: [{ colId: "updated_at", sort: "desc" }],
  filterModel: {
    columnFilters: {
      status: { kind: "valueSet", tokens: ["string:active"] },
    },
    quickFilter: {
      query: "platform",
      columns: ["name", "status"],
      mode: "tokens",
    },
  },
  pagination: { pageSize: 50, currentPage: 0 },
}
```

`quickFilter` stays inside `filterModel`. The codec trims the query, dedupes columns, defaults invalid modes to `"contains"` unless configured otherwise, and never creates a top-level `search` field.

## Request Mapping

Use the default normalized DTO when your backend accepts the package request shape:

```ts
const datasource = createAffinoDatasource<AuctionRow>({
  baseUrl: "http://localhost:8000",
  tableId: "auctions",
  queryCodec: {
    columnIdMap: {
      updatedAt: "updated_at",
    },
  },
})
```

Use `mapQuery` when the backend needs small shape changes while still relying on the package codec:

```ts
const datasource = createAffinoDatasource<AuctionRow>({
  baseUrl: "http://localhost:8000",
  tableId: "auctions",
  mapQuery: query => ({
    rows: query.range,
    order: query.sortModel ?? [],
    filters: query.filterModel,
  }),
})
```

Use `mapPullRequest` only when the backend expects the raw DataGrid protocol or a fully custom body:

```ts
const datasource = createAffinoDatasource<AuctionRow>({
  baseUrl: "http://localhost:8000",
  tableId: "auctions",
  mapPullRequest: request => ({
    range: request.range,
    sortModel: request.sortModel,
    filterModel: request.filterModel,
    groupBy: request.groupBy,
    groupExpansion: request.groupExpansion,
    treeData: request.treeData,
    pagination: request.pagination,
  }),
})
```

## Backend Capabilities

The adapter works best when the backend supports:

- histograms for `POST /api/{tableId}/histogram`
- edits for `POST /api/{tableId}/edits`
- fill for `POST /api/{tableId}/fill-boundary` and `POST /api/{tableId}/fill/commit`
- history for `POST /api/history/undo`, `POST /api/history/redo`, and `POST /api/history/status`

If a backend omits one of these endpoints, keep the feature disabled at the host-app layer.

## Docs

- [Server datasource quick start](../../docs/server-datasource/quick-start.md)
- [Server datasource UX contract](../../docs/server-datasource/ux-contract.md)
- [Frontend adapter reference](../../docs/server-datasource/frontend-adapter.md)
- [Server client package](../datagrid-server-client/README.md)
