# Server Selection Operations

This document defines the server-backed selection operation contract for future implementation slices. It does not add runtime endpoints by itself.

Current implemented behavior:

- Local copy/cut blocks selected ranges that include unloaded or placeholder rows.
- Clipboard, clear/delete, and local range-move paths block stale virtual selections before local materialized work.
- Local clear/delete/fill/range-move paths are materialized-row oriented unless a dedicated server path already exists.
- Server fill has boundary and commit plumbing.
- Row selection supports explicit selected rows and `all` with exclusions.
- Virtual cell selection carries loaded coverage, missing intervals, projection identity, stale state, and operation decisions.
- Local/smoke performance gates cover selection summary planning, virtual coverage, clipboard planning, overlay planning, and additive rendered-cell lookup. Delegated server operation latency gates remain future work until those handlers exist.

## Operation Modes

| Mode | Meaning |
| --- | --- |
| `materialized` | All required rows are loaded and local app logic may read or mutate values. |
| `server` | The operation must be delegated to a backend using row ranges, column keys, projection context, revision tokens, and operation idempotency. |
| `blocked` | The operation must not run locally because rows are unloaded, placeholders, stale, grouped, or otherwise unsafe. |
| `virtual` | Navigation-only behavior that does not need materialized values. |

## Decision Matrix

| Operation | Loaded data rows | Unloaded or placeholder rows | Grouped/tree rows | Stale projection |
| --- | --- | --- | --- | --- |
| Navigate / active cell | `virtual` or `materialized`; no value read required | `virtual`; focus may fall back until mounted | Allowed on flattened rows unless the target is not navigable | Allowed only after the app accepts the current projection identity |
| Copy | `materialized` local copy | `server` export/copy when available; otherwise `blocked` | `blocked` for group summary rows unless backend defines export semantics | `blocked`; refresh or reselect first |
| Cut | `materialized` local copy + clear | `server` when backend supports both copy/export and clear; otherwise `blocked` | `blocked` for group rows | `blocked` |
| Clear / delete selected cells | `materialized` local mutation | `server` clear/delete when available; otherwise `blocked` | `blocked` for group rows | `blocked` |
| Paste | `materialized` local mutation into loaded editable targets | `server` paste/import when available; otherwise `blocked` | `blocked` for group rows | `blocked` |
| Fill | `materialized` local fill or existing server fill path | `server` fill when boundary and commit contracts are available; otherwise `blocked` | `blocked` for group rows | `blocked` with `projection-mismatch` semantics |
| Range move | `materialized` local move | `server` range move when available; otherwise `blocked` | `blocked` for group rows | `blocked` |
| Summary / aggregate label | loaded/local summary only | `server` summary when available; otherwise label must state loaded/partial scope | group rows require backend-defined aggregation semantics | `blocked` or stale label |
| Row selection: explicit ids | Local selected ids | Valid when selected ids are known | Group row ids are selectable only as rows | Reconcile or stale-mark after projection change |
| Row selection: all rows | `all` mode with exclusions | `all` mode with exclusions; do not enumerate unloaded rows | Backend must define whether group rows expand to children | Re-evaluate against current projection |

## Request Contract For Delegated Operations

Future server-delegated cell operations should carry:

- `operationId` for idempotency.
- `baseRevision` for stale-write checks.
- `projectionHash` or equivalent projection identity.
- `selection` as one or more normalized ranges using row indexes and column indexes/keys.
- `rowIds` for loaded anchor/source/target rows when known.
- `columns` as stable column keys, not display labels.
- `projection` context: sort, filter, group, group expansion, tree, pivot, and pagination state.
- `mode` when behavior has variants, such as fill `copy` versus `series` or paste `values`.
- `workspaceId`, `tableId`, and user/session scope through the existing server datasource conventions.

Responses should return:

- `operationId`.
- `revision` and `datasetVersion`.
- affected row/cell counts.
- `invalidation` scoped to rows, ranges, cells, or dataset.
- `warnings` for downgraded behavior.
- history state when the operation participates in undo/redo.

## Consistency Rules

- Stale projection identity blocks local materialized operations.
- If `baseRevision` is present and stale, the backend should reject with `stale-revision`.
- If the projection context does not match, the backend should reject with `projection-mismatch`.
- Delegated operations must be idempotent for the same `operationId`.
- A delegated mutation must either fully commit its reported affected scope or return a rejected/partial result that the frontend can display without guessing.
- Backend operations over unloaded rows must never require the frontend to enumerate all row ids in the selected range.

## Current Gaps

- Server-delegated copy/export, cut, clear/delete, paste, range move, and summary are contract-level only.
- Clipboard, clear/delete, and local range move only apply virtual operation decisions as a safety guard; they do not execute delegated server operations yet.
- Server fill exists, but series fill is not implemented.
- Selection summaries remain loaded/local unless a server summary operation is added.
- Group row operation semantics are blocked unless a backend explicitly defines group-to-children or group-summary behavior.
- Performance gates currently cover local planning and safety checks; end-to-end backend latency budgets should be added with the delegated operation handlers.
