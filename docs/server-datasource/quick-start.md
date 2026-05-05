# Quick Start

This is the smallest useful path for wiring a grid to a backend datasource.

## 1. Frontend Setup

Create an HTTP datasource adapter and pass it to the grid path that expects a `DataGridDataSource<T>`.

The reference adapter lives at:

- [`packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts`](../../packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts)

The reference fill wrapper lives at:

- [`packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts`](../../packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts)

Minimal shape:

```ts
import { createServerDemoDatasourceHttpAdapter } from "./serverDatasourceDemo/serverDemoDatasourceHttpAdapter"
import { createServerDemoDatasourceHttpFillDataSource } from "./serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource"

const httpDatasource = createServerDemoDatasourceHttpAdapter({
  baseUrl: "http://localhost:8000",
})

const gridDatasource = createServerDemoDatasourceHttpFillDataSource({
  enabled: true,
  fallbackDataSource: httpDatasource,
  httpDatasource,
})
```

In the sandbox app, that datasource is then passed to the grid component that renders the server-data-source demo route.

## 2. Minimal Backend Endpoints

You need these endpoints for the current feature set:

- `GET /api/server-demo/health`
- `POST /api/server-demo/pull`
- `POST /api/server-demo/histogram`
- `POST /api/server-demo/edits`
- `POST /api/server-demo/fill-boundary`
- `POST /api/server-demo/fill/commit`
- `POST /api/server-demo/operations/{operation_id}/undo`
- `POST /api/server-demo/operations/{operation_id}/redo`

The demo router is in [`backend/app/features/server_demo/router.py`](../../backend/app/features/server_demo/router.py).

## 3. Basic Flow

### Pull Rows

Send the requested row window, sort model, and filter model to `pull`.

```json
{
  "range": { "startRow": 0, "endRow": 50 },
  "sortModel": [{ "colId": "value", "sort": "desc" }],
  "filterModel": {
    "status": { "type": "equals", "filter": "Active" }
  }
}
```

### Commit an Edit

Send a row edit with the current `baseRevision` if you want stale-write protection.

```json
{
  "baseRevision": "17",
  "edits": [
    {
      "rowId": "srv-000010",
      "columnId": "name",
      "value": "Renamed Account 10",
      "previousValue": "Account 00010"
    }
  ]
}
```

### Resolve a Fill Boundary

Ask the backend how far the fill can safely extend for the current projection.

```json
{
  "direction": "down",
  "baseRange": { "startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0 },
  "fillColumns": ["status"],
  "referenceColumns": ["status"],
  "projection": {
    "sortModel": [],
    "filterModel": null,
    "groupBy": null,
    "groupExpansion": { "expandedByDefault": false, "toggledGroupKeys": [] },
    "treeData": null,
    "pivot": null,
    "pagination": null
  },
  "startRowIndex": 20,
  "startColumnIndex": 0,
  "limit": 3
}
```

### Commit a Fill

Send the fill boundary metadata back with the source and target row ids.

```json
{
  "operationId": "fill-123",
  "baseRevision": "17",
  "projectionHash": "sha256:...",
  "boundaryToken": "v1:...",
  "sourceRange": { "startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0 },
  "targetRange": { "startRow": 20, "endRow": 21, "startColumn": 0, "endColumn": 0 },
  "sourceRowIds": ["srv-000020"],
  "targetRowIds": ["srv-000020", "srv-000021"],
  "fillColumns": ["status"],
  "referenceColumns": ["status"],
  "mode": "copy",
  "projection": { "...": "same projection snapshot as boundary" }
}
```

### Undo and Redo

Use the operation id returned by the write response.

```bash
POST /api/server-demo/operations/fill-123/undo
POST /api/server-demo/operations/fill-123/redo
```

## Practical Notes

- `pull` is the only required read path for basic scrolling.
- `commitEdits` should return a revision string so the frontend can invalidate cached rows.
- `resolveFillBoundary` and `commitFillOperation` are only needed if you want the grid's fill handle to be server-backed.
- `undo` and `redo` are operation-id based. There is no stack cursor in the protocol.
- If you do not need fill yet, you can defer the fill endpoints and keep edit/pull working first.
