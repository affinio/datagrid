# Protocol

This document defines the HTTP contract used by the current server-backed datasource implementation.

The examples below match the current `server_demo` shape. If your table uses different domain fields, keep the transport structure and swap only the row payload.

## Conventions

- All mutation endpoints are `POST`.
- `GET /api/changes?sinceVersion=...` is the current change-feed endpoint.
- Requests and responses are JSON.
- Errors are JSON with at least `code` and `message`.
- `range.endRow` is exclusive.
- `revision` is a monotonic string.
- `datasetVersion` is the externally visible table-version token and is returned by pull and mutation responses.
- `baseRevision` is optional, but recommended for edits and fill commits.
- `projectionHash` and `boundaryToken` are optional on fill commit, but strongly recommended.
- `X-Workspace-Id` is the current workspace scope header.
- Normal undo/redo scope uses `workspace_id`, `table_id`, `user_id`, and/or `session_id`.

## Enterprise Integration Profile

The protocol stays backward-compatible for existing demos and older clients, but enterprise integrations should treat the following fields as required:

- Pull responses: stable row ids, stable projection indexes, `total`, `revision`, and `datasetVersion`.
- Edit commits: `operationId` and `baseRevision`.
- Fill boundary responses: `revision`, `projectionHash`, and `boundaryToken`.
- Fill commits: `operationId`, `baseRevision`, `projectionHash`, and `boundaryToken`.
- Mutation responses: `revision`, `datasetVersion`, narrow `invalidation` or row snapshots, and history state when history is enabled.
- Change feed: monotonic `datasetVersion`, narrow invalidation when possible, and dataset invalidation fallback when replay is incomplete.

Backward-compatible endpoints may still accept omitted tokens. That does not make tokenless writes enterprise-ready. A host app that omits these fields owns the stale-write and projection-drift risk.

## Row Identity And Projection Rules

Every server-backed projection must provide deterministic identity:

- Leaf rows must have stable row ids that do not change across sorting, filtering, refresh, edits, undo/redo, or change-feed replay.
- `index` must be stable within the returned projection snapshot and must match the requested `range`.
- If server grouping/tree/pivot projection is implemented, group, tree, aggregate, and pivot rows must use deterministic ids that include enough projection context to avoid collisions with leaf row ids.
- Placeholder/loading row ids are owned by the client row model and must not be returned by the backend as real row ids.
- Sort ties must use a stable tie-breaker such as row id or source index.

Current `server_demo` pull supports range, sort, filter, and single-level `groupBy.fields = ["region"]` projection. Server-side tree projection and pivot projection are not implemented in the current backend path; their fields are only part of frontend/core request and fill consistency contracts until a dedicated backend projection slice implements them.

When unsupported `groupBy` fields, `treeData`, or `pivot` are sent to `POST /api/server-demo/pull` with a non-empty payload, the backend returns `400 unsupported-server-projection`. This is intentional: demo integrations should fail explicitly rather than returning flat rows for an unsupported grouped/tree/pivot request.

## Capabilities

`GET /api/server-demo/capabilities`

The reference backend exposes current projection support separately from `pull` so clients and diagnostics can distinguish supported, blocked, and not-yet-implemented modes before sending projection-heavy requests.

Current response shape:

```json
{
  "tableId": "server_demo",
  "projection": {
    "range": { "supported": true, "rowShape": "row" },
    "sort": { "supported": true, "rowShape": "row" },
    "filter": { "supported": true, "rowShape": "row" },
    "groupBy": {
      "supported": true,
      "supportedFields": [["region"]],
      "supportedOperations": [],
      "maxDepth": 1,
      "rowShape": "entry",
      "groupRowIdPrefix": "group:region:"
    },
    "treeData": {
      "supported": true,
      "supportedFields": [["region"]],
      "supportedOperations": [
        "set-group-by",
        "set-group-expansion",
        "toggle-group",
        "expand-group",
        "collapse-group",
        "expand-all-groups",
        "collapse-all-groups"
      ],
      "maxDepth": 1,
      "rowShape": "entry",
      "groupRowIdPrefix": "group:region:",
      "unsupportedReason": "Only region group pull context is supported; hierarchical tree projection is not implemented."
    },
    "pivot": {
      "supported": false,
      "unsupportedReason": "Server demo does not implement backend pivot projection yet."
    }
  }
}
```

`treeData` here means the existing datasource tree pull context used by group expand/collapse operations. It does not mean arbitrary hierarchical tree projection. This endpoint is reference-backend metadata, not a new DataGrid core public API. Hosts can expose an equivalent endpoint if their app needs capability-driven UI or diagnostics.

## Pull

`POST /api/server-demo/pull`

### Request

```json
{
  "range": { "startRow": 0, "endRow": 50 },
  "sortModel": [
    { "colId": "currentPrice", "sort": "desc" }
  ],
  "filterModel": {
    "status": { "type": "equals", "filter": "Open" }
  }
}
```

### Response

```json
{
  "rows": [
    {
      "id": "srv-000010",
      "index": 10,
      "name": "Account 00010",
      "segment": "Growth",
      "status": "Active",
      "region": "EMEA",
      "value": 970,
      "updatedAt": "2025-01-01T00:10:00Z"
    }
  ],
  "total": 100000,
  "revision": "17",
  "datasetVersion": 17
}
```

Required fields:

- `range.startRow`
- `range.endRow`

Recommended fields:

- `sortModel`
- `filterModel`

Supported projection in the current `server_demo` pull path:

- `groupBy.fields = ["region"]`
- `groupExpansion` for region group keys such as `group:region:AMER`
- `treeData` pull context for region group expand/collapse operations

Unsupported in the current `server_demo` pull path:

- `groupBy` fields other than `region`
- arbitrary `treeData` / hierarchical tree projection
- `pivot`

Pivot boundary:

- the default `@affino/datagrid-server-adapters` query codec does not serialize `request.pivot`
- pivot-capable enterprise backends should use `mapPullRequest` and map the raw `DataGridDataSourcePullRequest.pivot` into an approved backend-specific API shape
- integrations without server pivot support should keep returning `400 unsupported-server-projection` when a pivot payload reaches their backend contract

Backward compatibility:

- older clients may omit `sortModel` and `filterModel`
- the backend should still return `rows`, `total`, and `revision`

## Histogram

`POST /api/server-demo/histogram`

### Request

```json
{
  "columnId": "region",
  "filterModel": {
    "status": { "type": "equals", "filter": "Active" }
  }
}
```

### Response

```json
{
  "columnId": "region",
  "entries": [
    { "value": "AMER", "count": 25000 },
    { "value": "APAC", "count": 25000 },
    { "value": "EMEA", "count": 25000 },
    { "value": "LATAM", "count": 25000 }
  ]
}
```

Required fields:

- `columnId`

Optional fields:

- `filterModel`

## Commit Edits

`POST /api/server-demo/edits`

### Request

```json
{
  "operationId": "edit-123",
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

### Response

```json
{
  "operationId": "edit-123",
  "committed": [
    {
      "rowId": "srv-000010",
      "columnId": "name",
      "revision": "2025-05-05T12:00:00Z"
    }
  ],
  "committedRowIds": ["srv-000010"],
  "rejected": [],
  "revision": "18",
  "datasetVersion": 18,
  "affectedRows": 1,
  "affectedCells": 1,
  "invalidation": {
    "type": "cell",
    "cells": [{ "rowId": "srv-000010", "columnId": "name" }],
    "rows": [],
    "range": null
  },
  "canUndo": true,
  "canRedo": false,
  "latestUndoOperationId": "edit-123",
  "latestRedoOperationId": null
}
```

Required fields:

- `edits`

Recommended fields:

- `operationId`
- `baseRevision`

Backward compatibility:

- if all edits are rejected, the backend may still return `200`
- `operationId` may be `null` when nothing was committed

## Fill Boundary

`POST /api/server-demo/fill-boundary`

### Request

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

### Response

```json
{
  "endRowIndex": 21,
  "endRowId": "srv-000021",
  "boundaryKind": "cache-boundary",
  "scannedRowCount": 3,
  "truncated": true,
  "revision": "18",
  "projectionHash": "c5c7...",
  "boundaryToken": "v1:8f1e..."
}
```

Required fields:

- `direction`
- `baseRange`
- `fillColumns`
- `referenceColumns`
- `projection`
- `startRowIndex`
- `startColumnIndex`

Optional fields:

- `limit`

Consistency fields:

- `revision`
- `projectionHash`
- `boundaryToken`

## Fill Commit

`POST /api/server-demo/fill/commit`

### Request

```json
{
  "operationId": "fill-123",
  "baseRevision": "18",
  "projectionHash": "c5c7...",
  "boundaryToken": "v1:8f1e...",
  "sourceRange": { "startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0 },
  "targetRange": { "startRow": 20, "endRow": 21, "startColumn": 0, "endColumn": 0 },
  "sourceRowIds": ["srv-000020"],
  "targetRowIds": ["srv-000020", "srv-000021"],
  "fillColumns": ["status"],
  "referenceColumns": ["status"],
  "mode": "copy",
  "projection": {
    "sortModel": [],
    "filterModel": null,
    "groupBy": null,
    "groupExpansion": { "expandedByDefault": false, "toggledGroupKeys": [] },
    "treeData": null,
    "pivot": null,
    "pagination": null
  },
  "metadata": {
    "origin": "double-click-fill"
  }
}
```

### Response

```json
{
  "operationId": "fill-123",
  "affectedRowCount": 1,
  "affectedCellCount": 1,
  "revision": "19",
  "datasetVersion": 19,
  "affectedRows": 1,
  "affectedCells": 1,
  "canUndo": true,
  "canRedo": false,
  "latestUndoOperationId": "fill-123",
  "latestRedoOperationId": null,
  "invalidation": {
    "type": "range",
    "cells": [],
    "rows": [],
    "range": { "startRow": 21, "endRow": 21, "startColumn": "status", "endColumn": "status" }
  },
  "warnings": []
}
```

Required fields:

- `sourceRange`
- `targetRange`
- `sourceRowIds`
- `targetRowIds`
- `fillColumns`
- `referenceColumns`
- `mode`
- `projection`

Recommended fields:

- `operationId`
- `baseRevision`
- `projectionHash`
- `boundaryToken`

Backward compatibility:

- if `baseRevision` is omitted, the backend may skip stale-write rejection for that commit
- if `projectionHash` is omitted, the backend may still accept the request when it can safely do so
- if `boundaryToken` is omitted, the backend may still accept the request when it can safely do so
- server-side `series` mode is currently rejected with `400 unsupported-fill-mode`

## Selection Operations

Server-delegated selection operations are documented in [Server selection operations](./selection-operations.md).

Current protocol status:

- Server fill boundary and commit are implemented.
- Unified server datasource operations are exposed through the optional `DataGridDataSource.executeOperation` client hook and Affino adapter route `POST /api/{tableId}/operations/execute`.
- Copy/export, cut, clear/delete, paste, fill, and range move over unloaded selections may delegate through that hook when the active row model snapshot is `kind: "server"`.
- Summary over unloaded selections remains planned contract work.
- Frontend code must keep unloaded or stale selection operations `blocked` unless the server-backed row model exposes the dedicated operation capability.

Delegated selection operations should reuse the existing consistency vocabulary:

- `operationId` for idempotency
- `baseRevision` for stale-write checks
- `projectionHash` or equivalent projection identity
- `revision` and `datasetVersion` in mutation responses
- scoped `invalidation`

### Unified Selection Operation

Server-backed copy/export, cut, clear/delete, paste/import, fill, and range move share one operation route:

`POST /api/{tableId}/operations/execute`

Request shape:

```json
{
  "kind": "copy",
  "operationId": "operation-123",
  "baseRevision": "18",
  "projectionHash": "projection-abc",
  "selection": {
    "ranges": [
      { "startRow": 20, "endRow": 120, "startColumn": 1, "endColumn": 4 }
    ],
    "activeRangeIndex": 0
  },
  "sourceRange": { "startRow": 20, "endRow": 120, "startColumn": 1, "endColumn": 4 },
  "targetRange": null,
  "columns": ["name", "status", "region", "value"],
  "payload": { "format": "tsv" },
  "mode": null,
  "expectedCounts": { "rows": 101, "cells": 404 },
  "projection": {
    "sortModel": [],
    "filterModel": null,
    "groupBy": null,
    "groupExpansion": { "expandedByDefault": false, "toggledGroupKeys": [] },
    "treeData": null,
    "pivot": null,
    "pagination": null
  }
}
```

Response shape:

```json
{
  "operationId": "operation-123",
  "status": "committed",
  "payload": {
    "format": "tsv",
    "text": "Account 20\tActive\tEMEA\t970"
  },
  "acceptedCells": 404,
  "affectedRows": 100,
  "affectedCells": 400,
  "revision": "18",
  "datasetVersion": 18,
  "warnings": []
}
```

Operation-specific fields:

- `copy` and `cut` send `selection`, `sourceRange`/`sourceRanges`, `columns`, and a `payload.format`.
- `paste` sends `targetRange`/`targetRanges`, `columns`, `payload.cells` or `payload.text`, and `mode`.
- `clear` and `delete` send `selection`, `targetRange`/`targetRanges`, `columns`, and `expectedCounts`.
- `fill` sends `sourceRange`, `targetRange`, source/target columns, source row ids when materialized, `mode: "copy"`, and optional boundary consistency tokens. Series fill remains unsupported until the backend implements it explicitly.
- `range-move` sends `sourceRange`, `targetRange`, source/target columns, `mode: "move"`, and `expectedCounts`.

Clipboard mutation responses may use `status: "partial"` with `rejectedCells` when validation rejects only part of the request. They should use `status: "rejected"` and avoid mutation when `baseRevision` is stale, `projectionHash` does not match, target ranges include unsupported group rows, or authorization is lost.

Cut and clear/delete should follow the same mutation response shape as paste/import. Cut requires source copy/export and source clear to be committed as one idempotent operation. If the backend cannot make that atomic, it should reject instead of clearing source cells after a failed export.

## History Stack

Normal undo/redo uses stack history.

`POST /api/history/undo`

`POST /api/history/redo`

`POST /api/history/status`

Request body:

```json
{
  "workspaceId": "workspace-a",
  "tableId": "server_demo",
  "userId": "user-a",
  "sessionId": "session-a"
}
```

Required scope:

- `workspace_id`
- `table_id`
- `user_id` and/or `session_id`

Server-backed grids should route normal undo/redo through this stack instead of client snapshot history. The stack owner is the backend datasource scope, so undo/redo can replay persisted operations for rows that are not currently materialized in the viewport.

Current server stack history covers edit/fill cell events recorded by the server demo backend. Structural row operations, column operations, selection state, formula-edit state, grouping/tree/pivot state, and workbook-level operations are unsupported unless a host backend implements and documents an explicit capability.

Cell-event stack replay is conflict-checked. Undo expects the current cell value to match the operation's recorded after-value; redo expects it to match the recorded before-value. If another user/session changed that cell, the response contains a rejected cell with reason `history-conflict`, no row overwrite is performed, and the operation remains on its current stack side.

Undo/redo must be treated as mutations:

- they update persisted row state
- they advance `revision` / `datasetVersion`
- they invalidate the affected client cache scope
- they update stack status for the same workspace/table/user/session scope

### Response

Stack undo/redo return the same mutation shape, plus `action` on the stack route:

```json
{
  "operationId": "edit-123",
  "action": "undo",
  "committed": [
    {
      "rowId": "srv-000010",
      "columnId": "name",
      "revision": "2025-05-05T12:05:00Z"
    }
  ],
  "committedRowIds": ["srv-000010"],
  "rejected": [],
  "revision": "19",
  "datasetVersion": 19,
  "affectedRows": 1,
  "affectedCells": 1,
  "canUndo": true,
  "canRedo": false,
  "latestUndoOperationId": "edit-123",
  "latestRedoOperationId": null,
  "invalidation": {
    "type": "cell",
    "cells": [{ "rowId": "srv-000010", "columnId": "name" }],
    "rows": [],
    "range": null
  }
}
```

## Legacy Operation Replay

`POST /api/server-demo/operations/{operation_id}/undo`

`POST /api/server-demo/operations/{operation_id}/redo`

These routes remain available for low-level diagnostics/manual replay.

Do not use these routes as the normal toolbar or keyboard undo/redo path. Operation-id replay can target a specific operation outside the user's current stack position, while stack undo/redo preserves redo-branch invalidation and current scope order.

If the operation is unknown, the backend returns `404 operation-not-found`.

## History Status

`POST /api/history/status`

### Response

```json
{
  "workspace_id": "workspace-a",
  "table_id": "server_demo",
  "user_id": "user-a",
  "session_id": "session-a",
  "canUndo": true,
  "canRedo": false,
  "latestUndoOperationId": "edit-123",
  "latestRedoOperationId": null,
  "datasetVersion": 19
}
```

## Change Feed

`GET /api/changes?sinceVersion=...`

### Response

```json
{
  "datasetVersion": 19,
  "changes": [
    {
      "type": "cell",
      "operationId": "edit-123",
      "user_id": "user-a",
      "session_id": "session-a",
      "invalidation": {
        "type": "cell",
        "cells": [{ "rowId": "srv-000010", "columnId": "name" }],
        "rows": [],
        "range": null
      }
    }
  ]
}
```

Behavior:

- `sinceVersion == current` returns an empty `changes` array.
- `sinceVersion > current` returns `400 invalid-since-version`.
- `sinceVersion < current` returns matching changes when the gap is complete.
- if the window is incomplete or the gap is too large, the backend may return a dataset invalidation fallback.

Client live-update lifecycle:

- `@affino/datagrid-server-client` exposes a transport-neutral live-update boundary.
- Polling remains the default implementation through `createPollingLiveUpdateTransport`.
- `startLiveUpdates` / `stopLiveUpdates` are the neutral client lifecycle calls; `startChangeFeedPolling` / `stopChangeFeedPolling` remain compatibility aliases.
- A future websocket/SSE transport must emit the same mapped row snapshots, invalidations, dataset-version updates, invalid-since-version recovery, and diagnostics path as polling.

## Retry And Backoff

The server datasource client applies bounded retry/backoff only to idempotent reads:

- viewport `pull`
- column histogram reads
- manual `getChangesSinceVersion`
- change-feed polling

Retryable failures are:

- transport failures
- `408`
- `425`
- `429`
- `5xx`

Non-retryable failures include:

- aborts
- validation errors
- auth/permission errors
- stale revision conflicts
- projection or boundary mismatches

Mutation retries remain disabled by default. Do not retry edits, fill commits, undo, or redo unless the backend operation-id contract guarantees duplicate suppression and deterministic replay.

## Offline And Reconnect Policy

Current policy: offline mutation replay is unsupported.

Supported reconnect behavior is read/live recovery only:

- keep the mounted row model and cached visible rows while connectivity is interrupted
- abort in-flight reads when the page/app lifecycle requires it
- on reconnect, issue a fresh pull for the active viewport
- resume live updates from the last seen `datasetVersion`
- recover with dataset invalidation when the change window is incomplete or the cursor is invalid

Unsupported until a separate API is approved:

- durable local mutation queue
- automatic retry of edits, fill commits, undo, or redo
- replay after browser reload or device restart
- cross-tab pending mutation coordination
- conflict-free merge after stale revision

Required API shape before offline replay can be implemented:

- durable `operationId` for every mutation
- backend duplicate-operation detection for each operation id, enforced at the storage boundary where the backend owns durable history
- deterministic response for duplicate operations
- persisted mutation payload, projection state, `baseRevision`, workspace/table/user/session scope, and dependency tokens
- explicit conflict policy for stale revision, projection mismatch, boundary mismatch, authorization loss, deleted rows, and unsupported fill modes

Until those requirements exist, host apps must treat mutation failure while offline as a failed commit, preserve or rollback local optimistic UI according to the row-model result, refresh from the server on reconnect, and ask the user to retry manually.

## Error Response

```json
{
  "code": "stale-revision",
  "message": "Fill commit revision is stale"
}
```

Common error codes:

- `stale-revision`
- `projection-mismatch`
- `boundary-mismatch`
- `operation-not-found`
- `row-not-found`
- `duplicate-operation-id`
- `unsupported-fill-mode`
- `invalid-since-version`

## Workspace Header

`X-Workspace-Id` is not part of the JSON body, but it is part of the protocol contract because it changes revision scope and row visibility.

Current behavior:

- header missing means legacy default scope
- header present means workspace-scoped row visibility and revision scope
- normal undo/redo scope additionally uses `table_id`, `user_id`, and/or `session_id`

## Current Limitations

- server-side series fill is not implemented yet
- server-side grouping, tree projection, and pivot projection are not implemented in the current FastAPI demo pull path
- stack history is the normal undo/redo path
- full off-viewport materialization may be bounded
- polling/change feed is available as the current fallback path
- concrete websocket/SSE transport is not implemented yet; the client transport boundary exists
- offline mutation replay is not implemented; reconnect is read/live recovery only
- operation-id undo/redo remains available as low-level diagnostics/manual replay
- change feed may return dataset invalidation fallback when the event window is incomplete or the gap is too large
- the workspace scope is header-driven, not auth-driven
