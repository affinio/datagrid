# Consistency

This page explains the consistency contract in implementation terms.

## Monotonic Revision

`revision` is a monotonic counter for a table scope.

Use it for:

- cache cursors
- stale-write checks
- change detection after pull
- history sequencing

The backend should bump the revision only when the mutation actually changes persisted row state.

## Workspace-Scoped Revision

If the backend is multi-tenant, scope revision by workspace.

Current behavior:

- `X-Workspace-Id` selects the workspace scope
- missing header means legacy default scope
- a given table can have independent revision counters in different workspaces
- `datasetVersion` is the externally visible version token for the scoped dataset

Practical rule:

- do not reuse the global revision counter across workspaces
- do not let a workspace read another workspace's revision row

## Enterprise Consistency Profile

The implementation remains backward-compatible with clients that omit some tokens, but enterprise integrations should require the full consistency profile:

- every pull response includes `revision` and `datasetVersion`
- every edit commit sends `baseRevision`
- every fill boundary response returns `projectionHash` and `boundaryToken`
- every fill commit sends `baseRevision`, `projectionHash`, and `boundaryToken`
- every mutation response includes a new `revision`, `datasetVersion`, and either row snapshots or scoped invalidation
- normal undo/redo uses stack scope rather than operation-id replay routes
- change-feed consumers track `datasetVersion` and recover through dataset invalidation when replay is incomplete

Do not promote tokenless writes to production enterprise usage. If a backend accepts omitted tokens for compatibility, the integration should still send them whenever it has a prior pull, boundary, or mutation response.

## `baseRevision` For Edits

`baseRevision` is the optimistic concurrency check for edit commits.

Required behavior:

- if `baseRevision` is present and does not match the current revision, reject with `409 stale-revision`
- if it is omitted, the backend may accept the commit without that specific check

Use it on the frontend when you have a revision token from the last successful pull or write.

## `projectionHash` For Fill

`projectionHash` binds fill commit to the projection that was active when the fill boundary was resolved.

It protects against changes in:

- sort model
- filter model
- group-by state
- group expansion
- tree data
- pivot state
- pagination snapshot

If the hash changes, the backend should reject with `409 projection-mismatch`.

## `boundaryToken` For Fill

`boundaryToken` protects the exact boundary payload.

It should be built from:

- revision
- projection hash
- start row index
- resolved end row index
- resolved end row id

If the boundary token changes, the backend should reject with `409 boundary-mismatch`.

## `X-Workspace-Id`

This header is the current workspace selector.

Current behavior:

- missing header reads the legacy `NULL` workspace
- present header scopes reads and writes to that workspace
- revision, pull, histogram, edits, fill, undo, and redo should all agree on the same workspace scope

Do not derive workspace from the row payload.

## Stale / Mismatch Responses

Use these codes consistently:

- `stale-revision`
- `projection-mismatch`
- `boundary-mismatch`

Frontend behavior should be deterministic:

- stale revision means refresh and retry from a new revision
- projection mismatch means the fill snapshot changed
- boundary mismatch means the user no longer has the same fill boundary

## What The Frontend Must Preserve Between Boundary And Commit

When the user resolves a fill boundary and later commits the fill, the frontend must keep the following fields unchanged unless the user explicitly changes the selection:

- `baseRevision`
- `projectionHash`
- `boundaryToken`
- `sourceRange`
- `targetRange`
- `sourceRowIds`
- `targetRowIds`
- `fillColumns`
- `referenceColumns`
- `mode`
- `projection`

If any of those values drift, the commit should be treated as a new operation rather than a continuation of the old one.

## History Scope

Stack-based undo/redo is resolved by:

- workspace_id
- table_id
- user_id and/or session_id

At least one of `user_id` or `session_id` is required.

Normal UX should use:

- `POST /api/history/undo`
- `POST /api/history/redo`
- `POST /api/history/status`

The frontend should not need to know the latest `operationId` for normal undo/redo.
The legacy `/api/server-demo/operations/{operation_id}/undo|redo` routes remain available for low-level diagnostics/manual replay.

For server-backed DataGrid instances, this stack is the history owner. Client snapshot history is for local row models and must not be used as the durability or replay mechanism for unloaded server rows. A server-backed undo/redo action should be resolved by scope, not by the currently rendered viewport.

Current server stack history is operation-backed for server edit/fill cell events. It is not a general operation log for row insertion/deletion, column changes, selection state, formula-edit state, grouping/tree/pivot state, or workbook-level mutations unless the host backend adds those capabilities.

## Fill Idempotency

A fill commit with the same:

- boundaryToken
- projectionHash
- baseRevision

must produce the same result or be rejected.

The backend must not apply the same fill twice if it was already committed.

## Redo Branch Invalidation

When a new operation is committed after one or more undo actions, the redo branch for the same history scope must be discarded.

Example:

A → B → undo B → commit C

Result:

- undo stack: A, C
- redo stack: empty
- B must not be redoable

## Undo And Redo As Mutations

Undo and redo operations are state-changing mutations.

They must:

- update persisted row state
- bump the table `revision`
- update history state
- follow the same scope and consistency rules as edit and fill commits

Undo/redo must produce the same observable effects as applying or reverting the original operation.

Undo and redo are not read retries. The client must not automatically retry them after transport failure unless the backend provides duplicate-operation suppression and deterministic duplicate responses for that mutation class.

## Client Snapshot History Boundary

Client snapshot history is in-memory and session-local:

- it is lost on reload
- it is not serialized as an operation log
- it cannot recover pending mutations after reconnect
- it can restore only the row snapshots captured in the current app session

Client snapshot history can overwrite unrelated fields on the same row if they changed after the snapshot was captured. Server-backed or collaborative integrations should prefer server stack history with revision, dataset-version, operation-id, and explicit scope handling.

## Commit Response History State

Mutation responses should return history state when possible:

- operationId
- canUndo
- canRedo
- latestUndoOperationId
- latestRedoOperationId
- affectedRows / affectedCells

This avoids an immediate `/history/status` probe after every successful commit.
Returned history state must correspond to the same scope as the committed operation.
If history state cannot be determined reliably, the backend should omit it rather than return incorrect values.

## Cell, Range, Row, And Dataset Invalidation

Mutations should describe the smallest affected scope possible:

- cell invalidation
- range invalidation
- row invalidation
- dataset invalidation

Prefer precise invalidation over full refresh.

Invalidation should be:

- minimal (only affected cells/rows/ranges)
- deterministic
- reproducible from the operation

Avoid:

- full dataset invalidation unless strictly necessary

Current mapping:

- edit -> cell invalidation
- fill -> range invalidation
- undo / redo -> invalidation for the original operation
- fallback -> dataset invalidation

Frontend handling:

- cell invalidation maps to row invalidation at the client cache boundary
- row invalidation refetches the active viewport only when affected rows are visible
- visible range invalidation keeps currently rendered rows visible while the refresh is pending
- dataset invalidation keeps the active viewport visible and schedules a refresh; non-visible cached rows may be dropped
- malformed range invalidation falls back to dataset invalidation during change-feed mapping

## Revision And History Relationship

Each committed operation that changes persisted state must:

- bump the table `revision`
- be recorded in history with the same effective revision ordering

Practical rule:

- history must reflect the same ordering as revision increments
- undo/redo operations must not violate revision monotonicity
- replayed operations should restore state consistent with the revision they represent

## Scope Consistency

All mutation and history operations must use the same scope fields:

- workspace_id
- table_id
- user_id and/or session_id

These fields must be:

- persisted with each operation
- used for history resolution (undo/redo/status)
- consistent across edit, fill, and history APIs

If scope diverges between:

- operation metadata
- affected rows
- history queries

the backend must still be able to resolve and replay the operation safely.

Prefer fallback resolution over hard failure when scope mismatch is detected.

## Dataset Version

`datasetVersion` is the externally visible version token of the table state.

It is typically derived from `revision`.

It must be:

- returned by pull and mutation responses
- used by the frontend for cache validation
- monotonic within the same workspace + table scope

Practical rule:

- if the datasetVersion changes, the frontend must assume that some part of the dataset has changed
- datasetVersion should be included in mutation responses when available

## Unsupported Current Modes

The current server datasource implementation does not provide these enterprise behaviors yet:

- websocket or server-sent-events live transport
- offline mutation queue or durable reconnect replay
- server-side grouping/tree/pivot projection in the FastAPI demo pull path
- server-side series fill

Integrations must treat these as unsupported unless they implement and test an explicit backend capability. The existing polling change feed is the supported live-update fallback, and dataset invalidation is the supported recovery path for incomplete event replay.

## Change Feed

`GET /api/changes?sinceVersion=...` is the current polling/change-feed path.

Behavior:

- `sinceVersion == current` returns an empty `changes` array
- `sinceVersion > current` returns `400 invalid-since-version`
- `sinceVersion < current` returns matching changes when the window is complete
- if the change window is incomplete or the gap is too large, the backend may return a dataset-level invalidation fallback

The frontend can use this as the fallback path when websocket transport is unavailable.

`@affino/datagrid-server-client` exposes a transport-neutral live-update lifecycle:

- `createPollingLiveUpdateTransport()` wraps the current polling implementation.
- `createServerDatasourceHttpClient()` accepts `liveUpdateTransportFactory` for future websocket/SSE transports.
- `startLiveUpdates()` / `stopLiveUpdates()` are the transport-neutral lifecycle calls.
- existing `startChangeFeedPolling()` / `stopChangeFeedPolling()` calls remain polling-compatible aliases.
- every transport must preserve the same `datasetVersion`, `lastSeenVersion`, invalid-since-version reset, row snapshot, invalidation, and diagnostics semantics.

## Read Retry Policy

The client may retry idempotent reads with bounded backoff:

- pull requests
- histogram reads
- change-feed reads

Retries must preserve the original request body, range, filter/sort model, and `sinceVersion`. A retry does not imply a new projection or a mutation replay.

Retryable failures are transport failures and transient HTTP statuses (`408`, `425`, `429`, `5xx`). Stale revision, projection mismatch, boundary mismatch, validation, auth, and abort failures are not retryable.

Mutations are consistency boundaries. Edits, fill commits, undo, and redo must not be retried automatically unless the backend provides durable operation-id idempotency and duplicate-operation suppression for that mutation type.

## Offline And Reconnect Consistency

Offline mutation replay is not part of the current enterprise contract.

Reconnect is limited to read/live-update recovery:

- preserve the current cache while disconnected or while a reconnect pull is pending
- resume polling or a custom live-update transport from the last seen `datasetVersion`
- use dataset invalidation when the event window is incomplete, the cursor is invalid, or the backend cannot prove continuity
- run a fresh viewport pull after reconnect before accepting the visible projection as current

The client must not persist and replay mutations after connectivity loss unless a host app implements an explicit durable operation contract. That contract must include:

- stable operation id allocation before the mutation leaves the client
- duplicate-operation suppression on the backend
- deterministic duplicate responses
- persisted request body, `baseRevision`, projection hash, boundary token, and history scope
- conflict handling for stale revision, projection mismatch, deleted rows, permission loss, and unsupported operations

Without that contract, retries stop at idempotent reads. Failed edits, fill commits, undo, and redo remain failed mutations; the user must retry after the datasource refreshes from the server.

## Deterministic Replay

History operations must be replayable deterministically.

Given:

- the same operation payload
- the same scope
- a compatible dataset state

The backend should produce the same resulting state.

If exact replay is not possible due to:

- partial materialization
- scope divergence
- missing rows

the backend must:

- attempt a best-effort replay
- prefer consistency over strict failure
- avoid partial or corrupted state

## Current Limitations

- server-side series fill is not implemented yet
- the workspace scope is still demo/env/header driven unless the host app binds it to auth
- the host app must still enforce authorization
- concrete websocket/SSE transport is not implemented yet; the client transport boundary exists
- offline mutation replay is not implemented; reconnect is read/live recovery only
- operation-id undo/redo remains available as low-level diagnostics/manual replay
- full off-viewport materialization may be bounded
- change feed may return dataset invalidation fallback when the event window is incomplete or the gap is too large
