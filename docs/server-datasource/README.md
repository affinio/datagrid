# Server-Backed Data Source

This documentation describes the server-backed DataGrid integration used by the sandbox demo and the reusable backend grid engine in `backend/app/grid`.

## What It Is

A server-backed datasource moves the DataGrid read and write boundary to the backend. The grid still uses the normal `DataGridDataSource<T>` contract, but pulls rows, histograms, edits, fill operations, and history actions over HTTP instead of from local in-memory state.

The current reference implementation is:

- frontend HTTP adapter: [`packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts`](../../packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts)
- frontend fill wrapper: [`packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts`](../../packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts)
- backend router: [`backend/app/features/server_demo/router.py`](../../backend/app/features/server_demo/router.py)
- backend repository: [`backend/app/features/server_demo/repository.py`](../../backend/app/features/server_demo/repository.py)
- reusable backend services: [`backend/app/grid`](../../backend/app/grid)

## When To Use It

Use a server-backed datasource when you need:

- large datasets that should not be materialized in the browser
- backend-owned filtering, sorting, and histogram generation
- persisted edits with optimistic revision checks
- fill operations with server-side consistency enforcement
- undo/redo backed by operation history
- a path to integrate the grid with your own domain model

It is a good fit for apps where the backend already owns the canonical table state and the grid should act as a client view over that state.

## Architecture

The current implementation is split into four layers:

1. `DataGrid` in the app layer requests rows, histograms, and mutations through `DataGridDataSource<T>`.
2. The frontend HTTP adapter maps those calls to backend endpoints.
3. The FastAPI router hands requests to a repository object that implements the server grid adapter protocol.
4. Reusable services under `backend/app/grid` do the actual projection, consistency, edit, fill, history, revision, and invalidation work.

The reference backend uses a simple workspace-scoped revision service and an operation-history table. The same pattern can be reused for other tables, not just the demo dataset.

## Supported Features

The reference backend currently supports:

- viewport pulls
- server-side sort and filter
- column histograms
- edit commit
- fill boundary resolution
- fill commit
- undo
- redo
- monotonic revision tracking
- workspace-scoped revisions through `X-Workspace-Id`
- projection consistency metadata through `projectionHash`
- fill boundary validation through `boundaryToken`
- stale revision rejection for edits and fill commits
- range invalidation responses for changes

## Known Limitations

The current implementation is intentionally narrow:

- server-side series fill is not implemented yet
- full off-viewport materialization is still bounded
- `workspace_id` currently comes from the `X-Workspace-Id` header, not from auth/session context
- history is operation-id based, not stack-based
- generic persistence tables are not fully separated from `server_demo` yet
- value histograms are not implemented in the demo
- fill still assumes a bounded projected window rather than unlimited server-side expansion

## Start Here

- [Quick start](./quick-start.md)
- [Protocol](./protocol.md)
- [Backend reference](./backend-fastapi.md)
- [Frontend adapter](./frontend-adapter.md)
- [Consistency model](./consistency.md)
- [Implementation checklist](./checklist.md)
