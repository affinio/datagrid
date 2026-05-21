# Server Selection Operations

This document defines the server-backed selection operation contract used by server datasource integrations.

Current implemented behavior:

- Server-backed copy/cut delegates unloaded or placeholder ranges to `DataGridDataSource.executeOperation` when the active row model snapshot is `kind: "server"`; otherwise it blocks.
- Server-backed paste delegates unloaded or placeholder targets to `DataGridDataSource.executeOperation` when available; otherwise it blocks.
- Clipboard, clear/delete, and local range-move paths block stale virtual selections before local materialized work.
- Clear/delete, fill, and range-move delegate unloaded server-backed ranges through `executeOperation`; materialized ranges continue to use local or legacy fill paths.
- Server fill has boundary and commit plumbing. Unloaded target fill can use unified `executeOperation`; series fill remains explicitly unsupported and is downgraded/blocked until backend support is added.
- Row selection supports explicit selected rows and `all` with exclusions.
- Virtual cell selection carries loaded coverage, missing intervals, projection identity, stale state, and operation decisions.
- Local/smoke performance gates cover selection summary planning, virtual coverage, clipboard planning, overlay planning, additive rendered-cell lookup, and focused delegated-operation contracts. End-to-end backend latency budgets remain future work.

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

Server-delegated cell operations carry:

- `operationId` for idempotency.
- `baseRevision` for stale-write checks.
- `projectionHash` or equivalent projection identity.
- `selection` as one or more normalized ranges using row indexes and column indexes/keys.
- `rowIds` for loaded anchor/source/target rows when known.
- `columns` as stable column keys, not display labels.
- `projection` context: sort, filter, group, group expansion, tree, pivot, and pagination state.
- `mode` when behavior has variants, such as fill `copy` versus `series` or paste `values`.
- `workspaceId`, `tableId`, and user/session scope through the existing server datasource conventions. Affino adapters send this through the `POST /api/{tableId}/operations/execute` body.

Responses should return:

- `operationId`.
- `revision` and `datasetVersion`.
- affected row/cell counts.
- `invalidation` scoped to rows, ranges, cells, or dataset.
- `warnings` for downgraded behavior.
- history state when the operation participates in undo/redo.

## Clipboard Delegation Contract

Server clipboard delegation reuses the request and response conventions above instead of adding a clipboard-specific consistency model.

Clipboard copy/export requests should carry:

- `operationId`.
- `baseRevision`.
- `projectionHash` or equivalent projection identity.
- `selection` as one or more normalized row/column ranges.
- `columns` as stable column keys.
- `format`: `tsv`, `csv`, or `internal-json` when a backend supports more than plain text.
- `includeHeaders` when the host supports header export.
- `projection` context for sort, filter, group/tree/pivot, expansion, and pagination.

Clipboard mutation requests for cut, clear/delete, paste/import, and row move should carry:

- `operationId`.
- `baseRevision`.
- `projectionHash` or equivalent projection identity.
- source and/or target normalized ranges.
- `columns` as stable column keys.
- `payload` for paste/import operations, including format and text or structured cells.
- `mode`, such as `values`, `copy`, or `clear`.
- `expectedCounts` when the frontend can provide target row/cell counts.

Responses should distinguish:

- `status`: `committed`, `partial`, `rejected`, or `blocked`.
- `payload` for copy/export responses.
- `acceptedCells`, `rejectedCells`, `blockedCells`, `skippedCells`, and `materializedRows`.
- `rejections` with stable row/column coordinates and reasons.
- `revision`, `datasetVersion`, invalidation scope, and server history state for mutations.

If the backend cannot prove projection or revision consistency, it must reject with `projection-mismatch` or `stale-revision` instead of applying a best-effort local interpretation.

## Consistency Rules

- Stale projection identity blocks local materialized operations.
- If `baseRevision` is present and stale, the backend should reject with `stale-revision`.
- If the projection context does not match, the backend should reject with `projection-mismatch`.
- Delegated operations must be idempotent for the same `operationId`.
- A delegated mutation must either fully commit its reported affected scope or return a rejected/partial result that the frontend can display without guessing.
- Backend operations over unloaded rows must never require the frontend to enumerate all row ids in the selected range.

## Current Gaps

- Server summary is contract-level only.
- Server-delegated copy/export, cut, clear/delete, paste, fill, and range move require a backend `executeOperation` implementation; without it the frontend still blocks unloaded ranges.
- Series fill is not implemented.
- Selection summaries remain loaded/local unless a server summary operation is added.
- Group row operation semantics are blocked unless a backend explicitly defines group-to-children or group-summary behavior.
- Performance gates currently cover local planning and safety checks; end-to-end backend latency budgets should be added for real backend handlers.
