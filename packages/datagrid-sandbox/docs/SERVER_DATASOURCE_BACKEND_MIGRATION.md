# Server Datasource Backend Migration Checklist

## 1. Goal

Replace the sandbox's fake in-memory server simulation with a real FastAPI + PostgreSQL backend while preserving the existing `DataGridDataSource` shape on the frontend.

The first implementation should keep the Vue demo behavior intact from the grid's point of view:
- `pull()`
- `getColumnHistogram()`
- `commitEdits()`
- `resolveFillBoundary()`
- `commitFillOperation()`
- `undoFillOperation()`
- `redoFillOperation()`
- invalidation / push notifications where needed

The frontend should eventually become a thin HTTP adapter around the same datasource contract. The backend should own projection, filtering, sorting, histogram computation, edit persistence, fill execution, and fill history.

## 2. Current Fake Architecture

The current demo lives in `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue` and defines a local fake datasource inside the component.

Current characteristics:
- Synthetic rows are generated in memory from a deterministic row factory.
- Frontend state tracks overrides for committed edits and fill operations.
- `pull()` filters, sorts, groups, and aggregates in the browser.
- `getColumnHistogram()` is computed from the same in-memory row set.
- `commitEdits()` mutates local override maps.
- `resolveFillBoundary()` scans projected rows locally and reports diagnostics.
- `commitFillOperation()`, `undoFillOperation()`, and `redoFillOperation()` operate on local fill operation records.
- Sorting and filtering are implemented in the component, not on a backend.
- Region aggregation is projected locally.
- Fill handle diagnostics and history diagnostics are derived from local state.
- The datasource is passed to `createDataSourceBackedRowModel()` as if it were remote, but it is still a fake server.

Current row shape:
- `id`
- `index`
- `name`
- `segment`
- `status`
- `region`
- `value`
- `updatedAt`

Important constraint:
- Do not change this component yet. The migration should start by preserving this row shape and datasource contract.

## 3. Target Architecture

Target shape:

1. Vue sandbox keeps `createDataSourceBackedRowModel()` and the existing datasource contract.
2. A thin HTTP adapter in the frontend translates datasource requests into backend requests.
3. FastAPI owns the read and write logic.
4. PostgreSQL stores canonical row data plus operation history.
5. The backend performs:
   - projection
   - filtering
   - sorting
   - grouping / aggregation
   - histogram generation
   - edit commits
   - fill resolution
   - fill commits
   - undo / redo
6. The frontend keeps the same diagnostics surface for the demo, but the values come from HTTP responses instead of local simulation.

Recommended layering:
- `sandbox UI` -> `datasource adapter` -> `FastAPI endpoints` -> `service layer` -> `PostgreSQL`

The first real implementation should not introduce a new frontend data model. It should only swap the transport and move logic server-side.

## Reusable Backend Companion Layer

The FastAPI + PostgreSQL backend should be implemented as a reusable reference backend layer for Affino DataGrid, not as a sandbox-only endpoint. The sandbox demo is the first consumer, but the code should be structured so the same backend primitives can support other apps with the same grid contract.

The boundary should look like this:
- generic backend modules define the datasource protocol, query construction, filtering, histogram logic, edit application, fill handling, aggregation, and invalidation
- demo-specific modules define the row model, registry entries, seed data, and HTTP router wiring for the sandbox dataset

### Proposed reusable modules

- `dto.py`: shared request / response DTOs that mirror the frontend `DataGridDataSource` contract
- `column_registry.py`: column metadata, type information, and column capability lookup
- `query_builder.py`: projection and SQL assembly for viewport pulls, sort models, and pagination
- `filters.py`: filter model translation and predicate generation
- `histograms.py`: column histogram calculation under the active projection
- `edits.py`: optimistic edit application, conflict handling, and revision updates
- `fill_operations.py`: fill boundary resolution, fill execution, and undo / redo state management
- `aggregation.py`: reusable aggregation projection helpers such as group-by and summary logic
- `invalidation.py`: invalidation payload construction and cache refresh hints

These modules should be generic where possible:
- they should not hard-code the sandbox row schema
- they should not embed sandbox UI diagnostics
- they should not depend on the sandbox route structure
- they should accept injected column metadata, table names, and row adapters

### Demo-specific modules

- `server_demo/models.py`: sandbox row model and any demo-only typed records
- `server_demo/registry.py`: demo column registry and row-to-column mapping
- `server_demo/router.py`: FastAPI router that exposes the sandbox endpoints
- `server_demo/seed.py`: deterministic demo seed data for the first 100k rows

These modules should stay demo-specific:
- the synthetic dataset shape
- the deterministic seed generation logic
- the sandbox endpoint path names
- any demo-only diagnostics or test fixtures

### Generic vs demo-specific split

Generic backend layer responsibilities:
- parse and validate datasource DTOs
- build query plans from pull, filter, sort, histogram, and aggregation requests
- translate grid operations into backend mutations
- produce invalidation metadata
- return backend revision tokens consistently

Demo-specific backend responsibilities:
- define the sandbox row schema and seed dataset
- register the sandbox columns
- expose the sandbox router under the demo API prefix
- bootstrap the PostgreSQL seed data for the first demo version

The intent is to keep the reusable backend layer suitable for future Affino DataGrid integrations, while allowing the sandbox demo to move first without forcing a public API redesign later.

## 4. Frontend DataGridDataSource Contract

The backend adapter should preserve the current `DataGridDataSource<ServerDemoRow>` contract from the sandbox component.

Required methods and responsibilities:
- `pull(request)`: returns rows for the requested viewport plus total count and any server-pivot columns.
- `getColumnHistogram(request)`: returns histogram entries for a column under the current projection.
- `commitEdits(request)`: persists cell edits and returns committed / rejected row ids.
- `resolveFillBoundary(request)`: resolves a fill boundary for the current projection.
- `commitFillOperation(request)`: applies a fill operation and returns the affected range metadata, invalidation, and undo / redo tokens.
- `undoFillOperation(request)`: reverts a prior fill operation.
- `redoFillOperation(request)`: reapplies a prior fill operation.
- `subscribe(listener)`: should remain available for push-style invalidations if the backend later emits them.
- `invalidate(invalidation)`: should remain supported for cache invalidation plumbing, even if the first backend version uses polling or explicit refresh.

Contract expectations to preserve:
- Request payloads still include sort, filter, group, pivot, and pagination context.
- Row identity still comes from `row.id`.
- The grid should still support server-side style sorting and filtering.
- Aggregation by region should remain possible in the backend projection layer.
- Fill handle diagnostics and history diagnostics should still be observable through the existing sandbox UI.

## 5. Proposed FastAPI Endpoints

Keep the HTTP API close to the datasource contract so the adapter stays thin.

Suggested endpoints:

### Reads
- `POST /api/server-datasource/pull`
- `POST /api/server-datasource/histogram`
- `POST /api/server-datasource/fill-boundary`

### Writes
- `POST /api/server-datasource/edits`
- `POST /api/server-datasource/fill/commit`
- `POST /api/server-datasource/fill/{operation_id}/undo`
- `POST /api/server-datasource/fill/{operation_id}/redo`

### Optional support endpoints
- `GET /api/server-datasource/health`
- `GET /api/server-datasource/meta`

Endpoint behavior:
- Accept JSON request bodies that mirror the datasource request shapes.
- Return JSON responses that map directly to datasource results.
- Include a backend revision or version token in write responses so the frontend can invalidate cached rows after mutations.
- Treat abort semantics as best-effort request cancellation on the client side.

## 6. PostgreSQL Table Model for the First Demo Version

Start with a narrow schema that supports the current demo and avoids premature normalization.

### `server_demo_rows`
Canonical row storage.

Columns:
- `id` text primary key
- `row_index` integer not null unique
- `name` text not null
- `segment` text not null
- `status` text not null
- `region` text not null
- `value` integer not null
- `updated_at` timestamptz not null
- `revision` bigint not null default 1
- `created_at` timestamptz not null default now()
- `modified_at` timestamptz not null default now()

Notes:
- Keep `row_index` stable for the demo because the current frontend relies on deterministic row ids.
- `revision` is a simple optimistic concurrency hook for edits and fill operations.

### `server_demo_row_events`
Append-only mutation history for edits and fill changes.

Columns:
- `event_id` uuid primary key
- `operation_id` text not null
- `event_type` text not null, constrained to `edit`, `fill`, `undo`, `redo`
- `row_id` text not null
- `column_key` text null
- `before_value` jsonb null
- `after_value` jsonb null
- `applied` boolean not null default true
- `created_at` timestamptz not null default now()
- `revision` bigint not null

Notes:
- This table is the first-pass undo/redo source of truth.
- Keep it simple even if the eventual system wants more normalization.

### `server_demo_fill_operations`
Fill operation headers and projection context snapshots.

Columns:
- `operation_id` text primary key
- `source_range` jsonb not null
- `target_range` jsonb not null
- `mode` text not null, constrained to `copy` or `series`
- `projection` jsonb not null
- `fill_columns` jsonb not null
- `reference_columns` jsonb not null
- `status` text not null, constrained to `applied`, `undone`, `redone`, `rejected`
- `undo_token` text null
- `redo_token` text null
- `revision` bigint not null
- `created_at` timestamptz not null default now()
- `modified_at` timestamptz not null default now()

Notes:
- Store enough context to replay the operation without re-deriving the original grid state.
- Keep projection snapshots explicit so undo and redo remain deterministic.

### Optional seed table
- A small seed table or migration script can populate the first 100k deterministic rows for the demo.
- Keep the seed deterministic so screenshots and diagnostics remain stable across runs.

## 7. DTO / Request / Response Contracts

The backend DTOs should match the existing datasource shape as closely as possible.

### Pull
Request:
- `range`
- `priority`
- `reason`
- `sortModel`
- `filterModel`
- `groupBy`
- `groupExpansion`
- `treeData`
- `pivot`
- `pagination`

Response:
- `rows`
- `total`
- `cursor` if pagination needs it
- `pivotColumns` if pivoting is active
- `revision` or `snapshotToken`

### Histogram
Request:
- `columnId`
- `options`
- current projection context

Response:
- histogram entries
- optional `revision`

### Commit edits
Request:
- `edits`
- optional `revision`

Response:
- `committed`
- `rejected`
- `revision`
- optional invalidation payload

### Resolve fill boundary
Request:
- `direction`
- `baseRange`
- `fillColumns`
- `referenceColumns`
- `projection`
- `startRowIndex`
- `startColumnIndex`
- `limit`

Response:
- `endRowIndex`
- `endRowId`
- `boundaryKind`
- `scannedRowCount`
- `truncated`

### Commit fill operation
Request:
- `operationId`
- `revision`
- `projection`
- `sourceRange`
- `targetRange`
- `fillColumns`
- `referenceColumns`
- `mode`
- `sourceRowIds`
- `targetRowIds`
- `metadata`

Response:
- `operationId`
- `revision`
- `affectedRowCount`
- `affectedCellCount`
- `invalidation`
- `undoToken`
- `redoToken`
- `warnings`

### Undo / redo fill
Request:
- `operationId`
- `revision`
- `projection` for undo, if needed

Response:
- `operationId`
- `revision`
- `invalidation`
- `warnings`

DTO guidance:
- Use explicit JSON schemas, not ad hoc loosely typed blobs.
- Keep the request and response fields close to the current TypeScript interfaces to avoid a frontend contract rewrite.
- Treat `AbortSignal` as a client-side transport concern, not a backend DTO field.

## 8. Migration Slices

Keep the migration incremental. Do not try to land the full stack rewrite in one pass.

### Slice 1: Contract freeze
- Document the current datasource contract.
- Freeze the row shape for the first backend version.
- Identify the minimum fields needed for pull, histogram, edits, and fill history.

### Slice 2: Backend read path
- Stand up FastAPI.
- Add PostgreSQL connectivity.
- Seed `server_demo_rows`.
- Implement `pull()` with filtering, sorting, paging, and region aggregation.
- Implement `getColumnHistogram()`.
- Keep the frontend fake datasource in place for now.

### Slice 3: Edit and fill writes
- Implement `commitEdits()`.
- Implement `resolveFillBoundary()`.
- Implement `commitFillOperation()`.
- Record operation history in PostgreSQL.

### Slice 4: Undo / redo
- Implement `undoFillOperation()` and `redoFillOperation()`.
- Reconstruct affected rows from the operation log.
- Return invalidation metadata so the frontend can refresh the right viewport.

### Slice 5: Frontend transport adapter
- Replace the in-component fake datasource logic with an HTTP adapter.
- Keep the same `DataGridDataSource` interface.
- Preserve current diagnostics labels as much as possible.

### Slice 6: Push / invalidation polish
- Add backend-originated invalidation if needed.
- Wire `subscribe()` only if the backend has a real event channel.
- Keep polling out of the first cut unless it is necessary.

## 9. Definition of Done

This migration is done when:
- The sandbox grid uses a real FastAPI + PostgreSQL backend for the server datasource demo.
- The frontend still consumes the existing `DataGridDataSource` contract.
- The backend owns projection, filtering, sorting, histogram, edits, fill operations, and undo / redo.
- The current demo still supports region aggregation, fill boundary diagnostics, and history diagnostics.
- The frontend Vue component remains thin and transport-focused.
- The first backend version is deterministic and reproducible from seed data.
- The implementation has validation coverage for the backend endpoint behavior and the datasource adapter behavior.

## 10. Risks and Non-Goals

### Risks
- The current demo compresses several behaviors into one component, so the backend split can easily become too broad if it is not sliced carefully.
- Fill operations and undo / redo are stateful and can drift from the current fake behavior if the projection snapshot is underspecified.
- Histogram and projection semantics can become inconsistent if filtering and grouping are implemented in different layers.
- Push invalidation may need a transport decision later; do not overbuild it in the first pass.
- Optimistic concurrency for edits and fills will matter once more than one client is active.

### Non-goals
- Do not rewrite `VueServerDataSourceGridCard.vue` in this migration.
- Do not change the public frontend datasource contract yet.
- Do not introduce a new grid data model for the demo.
- Do not generalize the backend beyond the sandbox demo on the first pass.
- Do not optimize for multi-tenant or distributed editing in the first implementation.
- Do not add unrelated schema normalization before the first backend version works end to end.
