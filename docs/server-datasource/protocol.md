# Protocol

This document defines the HTTP contract used by the server-backed datasource reference implementation.

## Conventions

- All endpoints are `POST` except `health`.
- Requests and responses are JSON.
- Errors are returned as JSON with at least `code` and `message`.
- `range.endRow` is the exclusive end of the requested window.
- `operationId` is optional on writes, but recommended if you want deterministic undo/redo and history tracking.
- `revision` is a monotonic workspace-scoped string.

## Pull

`POST /api/server-demo/pull`

### Request

```json
{
  "range": { "startRow": 0, "endRow": 50 },
  "sortModel": [
    { "colId": "value", "sort": "desc" }
  ],
  "filterModel": {
    "status": { "type": "equals", "filter": "Active" }
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

`revision` can be used by the frontend as a cache cursor or change token.

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

If every edit is rejected, the response still returns `200`, but `committed` and `committedRowIds` are empty and `operationId` may be `null`.

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

`boundaryKind` is one of:

- `data-end`
- `gap`
- `cache-boundary`
- `projection-end`
- `unresolved`

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

If the request is stale or inconsistent, the server returns `409` with one of these codes:

- `stale-revision`
- `projection-mismatch`
- `boundary-mismatch`

If the fill is a no-op, `operationId` may be `null`, `affectedRowCount` and `affectedCellCount` are `0`, and `warnings` contains `server fill no-op`.

Server-side series fill is not implemented yet. The reference backend rejects `mode: "series"` with `400 unsupported-fill-mode`.

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
  "revision": "20",
  "invalidation": {
    "kind": "range",
    "range": { "start": 10, "end": 10 },
    "reason": "server-demo-edit"
  }
}
```

## Error Response

Example stale revision response:

```json
{
  "code": "stale-revision",
  "message": "Edit commit revision is stale"
}
```

The frontend adapter turns these HTTP errors into a typed `ServerDemoHttpError` with `status`, `code`, and `details`.
