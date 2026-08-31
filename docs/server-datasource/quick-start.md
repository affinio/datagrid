# Server Datasource Quick Start

This is the shortest path for wiring Affino DataGrid to a backend-owned table.

First success only requires one read endpoint:

```text
POST /api/{tableId}/pull
```

Use `@affino/datagrid-server-adapters` first. It provides the current app-facing datasource factory for the Affino HTTP endpoint shape. Reach for `@affino/datagrid-server-client` only when you need lower-level polling, invalidation, or custom transport helpers.

For sandbox-equivalent behavior, follow the [server datasource UX contract](./ux-contract.md). In short: keep one datasource-backed row model alive, let server sort/filter state flow through `pull(request)`, and do not replace it with app-level reloads for normal filtering.
The supported corrected 0.5.x package matrix is `@affino/datagrid-vue-app@0.5.1`, `@affino/datagrid-vue@0.5.1`, `@affino/datagrid-core@0.5.1`, `@affino/datagrid-orchestration@0.5.1`, `@affino/datagrid-worker@0.5.1`, and `@affino/datagrid-pivot@0.1.3`, with `@affino/datagrid-theme@0.2.5`. These versions are released as a compatible set; consumers should not pin an older pivot or theme package alongside them.

## 1. Read-Only In 10 Minutes

### Install

Frontend:

```bash
pnpm add @affino/datagrid-vue-app @affino/datagrid-vue @affino/datagrid-server-adapters
```

Backend package, when using the Affino Python backend helpers:

```bash
uv add affino-grid-backend
```

or:

```bash
pip install affino-grid-backend
```

See also:

- [Package installation](./package-installation.md)
- [Backend FastAPI reference](./backend-fastapi.md)
- [Backend template](./backend-template.md)

### Minimal Backend Contract

`createAffinoDatasource({ tableId })` calls endpoints under `/api/{tableId}`.

For a read-only grid, implement only:

- `POST /api/{tableId}/pull`

The pull request body is:

```json
{
  "range": { "startRow": 0, "endRow": 50 },
  "sortModel": [{ "colId": "amount", "sort": "desc" }],
  "filterModel": null
}
```

`endRow` is exclusive. Return rows either as raw row objects with `id` and `index`, or as datasource row entries with `rowId`, `index`, and `row`.

Minimal raw-row response:

```json
{
  "rows": [
    { "id": "row-1", "index": 0, "title": "Auction 1", "status": "open", "amount": 1200 }
  ],
  "total": 1,
  "revision": "7",
  "datasetVersion": 7
}
```

### Minimal Frontend Usage

Create the datasource with `createAffinoDatasource`, wrap it in a datasource-backed row model, and pass that row model to `DataGrid`.

```vue
<script setup lang="ts">
import { onBeforeUnmount } from "vue"
import { createDataSourceBackedRowModel } from "@affino/datagrid-vue"
import { DataGrid } from "@affino/datagrid-vue-app"
import { createAffinoDatasource } from "@affino/datagrid-server-adapters"

type AuctionRow = {
  id: string
  index: number
  title: string
  status: string
  amount: number
}

const datasource = createAffinoDatasource<AuctionRow>({
  baseUrl: "http://localhost:8000",
  tableId: "auctions",
})

const rowModel = createDataSourceBackedRowModel<AuctionRow>({
  dataSource: datasource,
  initialTotal: 0,
})

const columns = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status", capabilities: { sortable: true, filterable: true } },
  {
    key: "amount",
    label: "Amount",
    dataType: "number",
    capabilities: { sortable: true, filterable: true },
    presentation: { align: "right", headerAlign: "right" },
  },
]

onBeforeUnmount(() => {
  rowModel.dispose()
})
</script>

<template>
  <DataGrid
    :row-model="rowModel"
    :columns="columns"
    virtualization
  />
</template>
```

With this minimal contract, the grid can:

- pull viewport rows from the backend
- send sort model changes to `POST /api/{tableId}/pull`
- send filter model changes to `POST /api/{tableId}/pull`

The reference backend implementation is in:

- [`backend/app/features/server_demo/router.py`](../../backend/app/features/server_demo/router.py)
- [`backend/app/features/server_demo/repository.py`](../../backend/app/features/server_demo/repository.py)
- [`backend/app/features/server_demo/schemas.py`](../../backend/app/features/server_demo/schemas.py)

## 2. Add Histograms

Add histograms when the column filter UI should show server-backed value lists.

Add:

- `POST /api/{tableId}/histogram`

Histogram request body:

```json
{
  "columnId": "status",
  "filterModel": null,
  "options": {
    "ignoreSelfFilter": true,
    "search": "op",
    "orderBy": "valueAsc",
    "limit": 25
  }
}
```

Histogram response:

```json
{
  "entries": [
    { "value": "open", "text": "Open", "count": 12 },
    { "value": "closed", "text": "Closed", "count": 4 }
  ]
}
```

Adapter-level controls that affect histogram and request behavior:

- `headers` forwards request headers on all adapter requests
- `histogram.ignoreSelfFilter` sets the default for histogram requests

## 3. Add Edits

Add edits when user changes should be committed through the backend.

Add:

- `POST /api/{tableId}/edits`

`createAffinoDatasource` wires this through `DataGridDataSource.commitEdits` when the backend implements the endpoint.

If your edits need workspace, user, or session scope, pass `historyScope` to `createAffinoDatasource`. The adapter forwards it into edit, fill, and history request bodies as `workspace_id`, `user_id`, and `session_id`, while keeping `table_id` on table-scoped endpoints.

Read next:

- [UX contract](./ux-contract.md)
- [Integration playbook](./integration-playbook.md)
- [Protocol](./protocol.md)

## 4. Add Fill

Add fill when spreadsheet-style fill handle operations should be resolved by the backend, especially across unloaded ranges.

Add:

- `POST /api/{tableId}/fill-boundary`
- `POST /api/{tableId}/fill/commit`

Use these when you want server-backed fill handle operations through the datasource.

Read next:

- [Protocol](./protocol.md)
- [Backend FastAPI reference](./backend-fastapi.md)

## 5. Add Server History

Add server history when undo/redo must be durable and backend-owned.

Optional table-scoped endpoints:

- `POST /api/{tableId}/operations/{operationId}/undo`
- `POST /api/{tableId}/operations/{operationId}/redo`

Optional shared endpoints:

- `POST /api/history/undo`
- `POST /api/history/redo`
- `POST /api/history/status`

Use these when you want stack undo/redo backed by the server.

Read next:

- [History](../datagrid-history.md)
- [Consistency](./consistency.md)
- [Protocol](./protocol.md)

## 6. Add Live Updates

Add live updates when the client should observe backend changes after the initial pull.

Optional endpoint:

- `GET /api/changes?sinceVersion=...`

Use this for polling-based change feed updates. The `server_demo` backend also documents WebSocket-style live updates where available.

Read next:

- [Consistency](./consistency.md)
- [Frontend adapter reference](./frontend-adapter.md)
- [HTTP protocol](./protocol.md)

## 7. Advanced Protocol And Consistency

Use the advanced docs when your integration needs revisions, dataset versions, invalidation, conflict behavior, retries, selection semantics, or server-side operation guarantees.

- [HTTP protocol](./protocol.md)
- [Consistency](./consistency.md)
- [Server selection operations](./selection-operations.md)
- [Integration checklist](./checklist.md)

The `server_demo` backend shows the full shape:

- [Backend FastAPI reference](./backend-fastapi.md)
- [`backend/app/features/server_demo/history_router.py`](../../backend/app/features/server_demo/history_router.py)
- [`backend/app/features/server_demo/changes_router.py`](../../backend/app/features/server_demo/changes_router.py)

## Low-Level Client Package

`@affino/datagrid-server-client` is intentionally lower-level. Use it when the Affino adapter endpoint shape is not enough and you need to build your own datasource adapter around:

- `createServerDatasourceHttpClient`
- `createChangeFeedPoller`
- `normalizeDatasourceInvalidation`
- `normalizeRowSnapshots`
- `normalizeDatasetVersion`

For ordinary Affino HTTP backend integration, start with `@affino/datagrid-server-adapters`.
