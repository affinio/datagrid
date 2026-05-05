# Backend FastAPI Reference

This page uses the current `server_demo` implementation as the reference backend.

## Main Pieces

- router: [`backend/app/features/server_demo/router.py`](../../backend/app/features/server_demo/router.py)
- schemas: [`backend/app/features/server_demo/schemas.py`](../../backend/app/features/server_demo/schemas.py)
- repository: [`backend/app/features/server_demo/repository.py`](../../backend/app/features/server_demo/repository.py)
- adapter protocol: [`backend/app/features/server_demo/adapter.py`](../../backend/app/features/server_demo/adapter.py)
- reusable grid services: [`backend/app/grid`](../../backend/app/grid)

## Router

`router.py` defines the HTTP surface for the demo:

- `GET /health`
- `POST /pull`
- `POST /histogram`
- `POST /edits`
- `POST /fill-boundary`
- `POST /fill/commit`
- `POST /operations/{operation_id}/undo`
- `POST /operations/{operation_id}/redo`

The router also resolves the workspace scope from `X-Workspace-Id`:

```py
workspace_id: str | None = Header(default=None, alias="X-Workspace-Id")
```

That header is passed into the repository and then into the revision service. It is the current workspace separator for revision state. It is not an auth/session abstraction yet.

## Schemas

The request and response models live in [`backend/app/features/server_demo/schemas.py`](../../backend/app/features/server_demo/schemas.py).

Important groups:

- `ServerDemoPullRequest` and `ServerDemoPullResponse`
- `ServerDemoHistogramRequest` and `ServerDemoHistogramResponse`
- `ServerDemoCommitEditsRequest` and `ServerDemoCommitEditsResponse`
- `ServerDemoFillBoundaryRequest` and `ServerDemoFillBoundaryResponse`
- `ServerDemoFillCommitRequest` and `ServerDemoFillCommitResponse`

These models are the source of truth for field names. The frontend adapter mirrors them closely, so keep them stable unless you want to change the transport contract.

## Repository / Adapter

`ServerDemoRepository` is the concrete implementation of the `ServerGridDataAdapter` protocol.

Responsibilities:

- translate HTTP requests into grid-service calls
- convert ORM rows into response schemas
- compute revision / projection metadata
- map service-level invalidation into API responses
- enforce fill consistency errors before mutation

The repository wires these services:

- `ServerDemoProjectionService`
- `ServerDemoEditService`
- `ServerDemoFillService`
- `ServerDemoHistoryService`
- `GridRevisionService`
- `GridInvalidationService`

This is where the reference backend stays thin. The reusable behavior lives in `backend/app/grid`.

## `backend/app/grid` Services

These are the reusable building blocks:

- `revision.py`
- `edits.py`
- `fill.py`
- `history.py`
- `projection.py`
- `consistency.py`
- `invalidation.py`

What they do:

- `GridRevisionService` maintains monotonic revision rows, optionally scoped by workspace.
- `GridEditServiceBase` handles validation, stale-revision checks, cell event creation, and revision bumps for edit commits.
- `GridFillServiceBase` resolves fill boundaries, applies copy fills, records fill operations, and bumps revision.
- `GridHistoryServiceBase` replays undo and redo from stored operation history.
- `GridProjectionService` handles filtering, sorting, row queries, and histograms.
- `consistency.py` hashes projections and boundary payloads.
- `invalidation.py` converts changed row indexes into range invalidation hints.

## How To Implement Another Table

Use the same pattern, but swap the table-specific pieces.

1. Define a `GridTableDefinition` for the new table.
2. Create the ORM model for the table rows.
3. Create a column registry that marks each column as editable, sortable, filterable, or histogram-enabled.
4. Subclass the reusable grid services if you need table-specific coercion or restrictions.
5. Implement a repository class that:
   - maps ORM rows into response schemas
   - instantiates the services with the new table definition
   - applies your workspace or tenant scoping rules
6. Add a FastAPI router that exposes the same endpoint names.
7. Wire the router into the app under a prefix that your frontend adapter knows.

The current demo still keeps demo-specific persistence and generic grid services in the same codebase area. That is acceptable for the reference implementation, but it is one of the explicit limitations listed in the main README.

## Workspace Header

`X-Workspace-Id` is the current scoping mechanism for revision rows.

Behavior:

- if the header is present, the backend uses that value to scope the revision counter
- if the header is missing, the backend uses the legacy shared scope
- the header affects revision, stale-revision checks, and the revision bumps produced by undo/redo

This means two different workspace ids can mutate the same logical table without sharing the same revision counter.

## Practical Implementation Notes

- keep the router thin
- keep request/response field names aligned with the schema layer
- do consistency checks before writing rows
- use operation ids for history, not a positional stack cursor
- return `409` for stale or mismatched fill commits
- return a range invalidation when the change affects row indexes

## Related Files

- [`backend/app/features/server_demo/columns.py`](../../backend/app/features/server_demo/columns.py)
- [`backend/app/features/server_demo/table.py`](../../backend/app/features/server_demo/table.py)
- [`backend/app/features/server_demo/revision.py`](../../backend/app/features/server_demo/revision.py)
- [`backend/app/features/server_demo/edits.py`](../../backend/app/features/server_demo/edits.py)
- [`backend/app/features/server_demo/fill.py`](../../backend/app/features/server_demo/fill.py)
- [`backend/app/features/server_demo/history.py`](../../backend/app/features/server_demo/history.py)
