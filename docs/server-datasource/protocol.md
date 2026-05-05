# Protocol

This document defines the HTTP contract used by the current server-backed datasource implementation.

The examples below match the current `server_demo` shape. If your table uses different domain fields, keep the transport structure and swap only the row payload.

## Conventions

- All endpoints are `POST` except `health`.
- Requests and responses are JSON.
- Errors are JSON with at least `code` and `message`.
- `range.endRow` is exclusive.
- `revision` is a monotonic string.
- `baseRevision` is optional, but recommended for edits and fill commits.
- `projectionHash` and `boundaryToken` are optional on fill commit, but strongly recommended.
- `X-Workspace-Id` is the current workspace scope header.

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
  "revision": "17"
}
```

Required fields:

- `range.startRow`
- `range.endRow`

Recommended fields:

- `sortModel`
- `filterModel`

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
  "invalidation": {
    "kind": "range",
    "range": { "start": 10, "end": 10 },
    "reason": "server-demo-edits"
  }
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
  "invalidation": {
    "kind": "range",
    "range": { "start": 21, "end": 21 },
    "reason": "server-demo-fill"
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

## Undo / Redo

`POST /api/server-demo/operations/{operation_id}/undo`

`POST /api/server-demo/operations/{operation_id}/redo`

### Response

Undo and redo return the same shape as edit commit responses:

```json
{
  "operationId": "edit-123",
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
  "invalidation": {
    "kind": "range",
    "range": { "start": 10, "end": 10 },
    "reason": "server-demo-edits"
  }
}
```

If the operation is unknown, the backend returns `404 operation-not-found`.

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

## Workspace Header

`X-Workspace-Id` is not part of the JSON body, but it is part of the protocol contract because it changes revision scope and row visibility.

Current behavior:

- header missing means legacy default scope
- header present means workspace-scoped row visibility and revision scope

## Current Limitations

- server-side series fill is not implemented yet
- history is operation-id based, not stack-based
- full off-viewport materialization may be bounded
- the workspace scope is header-driven, not auth-driven
