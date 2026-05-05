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

Practical rule:

- do not reuse the global revision counter across workspaces
- do not let a workspace read another workspace's revision row

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

## Current Limitations

- server-side series fill is not implemented yet
- history is operation-id based, not stack-based
- full off-viewport materialization may be bounded
- the workspace scope is header-driven, not auth-driven
- the host app must still enforce authorization
