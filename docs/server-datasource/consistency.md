# Consistency

The server-backed datasource uses four related consistency values. They solve different problems and should not be conflated.

## Revision

`revision` is the monotonic workspace-scoped counter used for table state.

Where it appears:

- pull response
- edit commit response
- fill boundary response
- fill commit response
- undo / redo response

What it does:

- gives the frontend a lightweight change token
- supports stale-write rejection for edits
- supports stale-write rejection for fill commits when `baseRevision` is supplied
- scopes undo/redo history to a workspace

In the current backend, the revision service stores one row per table and workspace scope.

## Base Revision

`baseRevision` is a client-supplied optimistic concurrency check.

Behavior:

- edit commits reject with `409 stale-revision` when `baseRevision` is present and does not match the current revision
- fill commits reject with `409 stale-revision` when `baseRevision` is present and does not match the current revision
- if `baseRevision` is omitted, the backend does not perform that specific stale check

This keeps the protocol flexible for clients that do not yet track revision state, while still allowing a strict mode for clients that do.

## Projection Hash

`projectionHash` is a canonical hash of the fill projection snapshot.

It exists because fill is not just a row-id problem. The fill boundary depends on the projection context that was active when the boundary was resolved:

- sort model
- filter model
- group-by state
- group expansion
- tree data
- pivot state
- pagination snapshot

If the projection changes between boundary resolution and fill commit, the fill result may no longer be valid. The backend uses `projectionHash` to detect that mismatch.

## Boundary Token

`boundaryToken` is a hash of the boundary payload plus the revision and projection hash.

It exists so the backend can verify that the target fill range still matches what the frontend saw when the boundary was resolved.

The backend builds it from:

- revision
- projection hash
- fill start row index
- resolved boundary end row index
- resolved boundary end row id

If any of those change, the token changes.

## How Rejection Works

The reference backend rejects stale or mismatched fill commits in this order:

1. stale `baseRevision`
2. mismatched `projectionHash`
3. mismatched `boundaryToken`

That ordering matters because stale revision is the broadest and cheapest conflict to check first.

For edits, the conflict path is simpler:

- if `baseRevision` is stale, the entire commit is rejected
- if individual cell values are invalid, those edits are rejected at the row/cell level
- if `previousValue` does not match the current row value, that edit is rejected

## Workspace-Scoped Revision

The revision service accepts an optional `workspace_id`.

With a workspace id:

- the backend stores revision state separately for that workspace
- the same table can have independent revision counters for different workspaces
- undo/redo is also scoped to that workspace's revision state

Without a workspace id:

- the backend behaves like the legacy shared scope

This is currently controlled by the `X-Workspace-Id` header.

## Current Limitations

- server-side series fill is not implemented yet
- fill still operates on a bounded projected window
- the backend does not yet materialize arbitrary off-viewport rows for fill
- the workspace scope is header-driven, not auth-driven
- operation history is keyed by operation id, not by a stack cursor

## Practical Rule

If the frontend is about to commit a fill, it should send all three values when available:

- `baseRevision`
- `projectionHash`
- `boundaryToken`

That gives the backend the strongest possible consistency check without changing the row payload itself.
