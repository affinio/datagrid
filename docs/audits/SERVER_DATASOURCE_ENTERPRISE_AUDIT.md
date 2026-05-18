# Server Datasource Enterprise Audit

## Executive Summary

The server datasource architecture is production-shaped and should remain the foundation. The strongest path is the documented golden path:

- `createDataSourceBackedRowModel` in `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
- `createAffinoDatasource` in `packages/datagrid-server-adapters/src/index.ts`
- the FastAPI/Postgres `server_demo` implementation under `backend/app/features/server_demo/`

Current readiness is **8/10** for enterprise server-backed DataGrid usage. The design already has clear viewport pulls, stable row identity requirements, placeholders, stale-while-refresh behavior, optimistic edit reconciliation, revision/dataset-version contracts, scoped history, and a polling change feed. Contract hardening is complete and idempotent read retry/backoff is implemented in `@affino/datagrid-server-client`. The main blockers to a 9/10 target are the remaining runtime hardening gaps: offline semantics, websocket/live update transport, runtime enforcement or validation for enterprise consistency tokens, formal server grouping/tree/pivot contracts, and latency/placeholder performance gates.

Do not introduce a parallel datasource stack. Tighten the current protocol, row model, HTTP adapter, backend services, and tests in small slices.

## Current Architecture Summary

`DataGridDataSource` in `packages/datagrid-core/src/models/server/dataSourceProtocol.ts` is the core contract. It defines viewport `pull`, optional histograms, edit commits, fill boundary and commit APIs, datasource push events, invalidation, and backpressure diagnostics.

`createDataSourceBackedRowModel` owns the client-side sparse row model. It:

- converts DataGrid viewport, sort, filter, group, pivot, aggregation, and pagination state into datasource pull requests
- keeps a sparse row cache and chunked `rangeCache`
- returns deterministic loading placeholder rows for missing indexes
- preserves cached rows during sort/filter/group refreshes
- supports critical and background pull lanes
- coalesces, aborts, and defers pull requests under backpressure
- applies server row snapshots and invalidations from mutation or push events
- overlays optimistic inline edits and rolls them back on failed or rejected commits

`@affino/datagrid-server-client` owns low-level HTTP transport, dataset version tracking, row snapshot normalization, invalidation mapping, and polling change-feed dispatch.

`@affino/datagrid-server-adapters` is the app-facing Affino HTTP datasource. It maps DataGrid protocol requests to the current `/api/server-demo/*`, `/api/history/*`, and `/api/changes` endpoints, applies mutation side effects, updates history status, and exposes change-feed diagnostics.

The FastAPI `server_demo` backend owns persistence, projection, revision, edit/fill mutation services, operation history, change events, and workspace/table/user/session scoping.

## Exact Files Reviewed

Docs:

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/server-datasource/README.md`
- `docs/server-datasource/integration-docs-map.md`
- `docs/server-datasource/protocol.md`
- `docs/server-datasource/consistency.md`
- `docs/server-datasource/ux-contract.md`
- `docs/server-datasource/frontend-adapter.md`
- `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- `docs/HISTORY_ENTERPRISE_AUDIT.md`

Core/DataGrid:

- `packages/datagrid-core/src/models/server/dataSourceProtocol.ts`
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
- `packages/datagrid-core/src/models/server/rangeCache.ts`
- `packages/datagrid-core/src/models/server/velocityOverscan.ts`
- `packages/datagrid-core/src/models/server/serverRowModel.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts`
- `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- `packages/datagrid-core/src/models/__tests__/rangeCache.spec.ts`
- `packages/datagrid-core/src/models/__tests__/serverBackedRowModel.spec.ts`

Client/adapters/sandbox:

- `packages/datagrid-server-client/src/client.ts`
- `packages/datagrid-server-client/src/http.ts`
- `packages/datagrid-server-client/src/changeFeedPoller.ts`
- `packages/datagrid-server-client/src/changeFeedMapping.ts`
- `packages/datagrid-server-client/src/invalidation.ts`
- `packages/datagrid-server-client/src/rowSnapshot.ts`
- `packages/datagrid-server-client/src/changeFeedPoller.spec.ts`
- `packages/datagrid-server-adapters/src/index.ts`
- `packages/datagrid-server-adapters/src/index.spec.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoChangeFeedPolling.spec.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.spec.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoHistoryState.spec.ts`

Backend:

- `backend/app/features/server_demo/repository.py`
- `backend/app/features/server_demo/router.py`
- `backend/app/features/server_demo/changes_router.py`
- `backend/app/features/server_demo/history_router.py`
- `backend/app/features/server_demo/schemas.py`
- `backend/app/features/server_demo/projection.py`
- `backend/app/features/server_demo/edits.py`
- `backend/app/features/server_demo/fill.py`
- `backend/app/features/server_demo/history.py`
- `backend/app/features/server_demo/models.py`
- `backend/app/features/server_demo/serialization.py`
- `backend/app/features/server_demo/workspace.py`
- `backend/packages/affino_grid_backend/affino_grid_backend/core/revision.py`
- `backend/packages/affino_grid_backend/affino_grid_backend/core/consistency.py`
- `backend/packages/affino_grid_backend/affino_grid_backend/core/projection.py`
- `backend/packages/affino_grid_backend/affino_grid_backend/edits/base.py`
- `backend/packages/affino_grid_backend/affino_grid_backend/fill/base.py`
- `backend/packages/affino_grid_backend/affino_grid_backend/history/base.py`
- `backend/tests/test_server_demo_read.py`
- `backend/tests/test_server_demo_edits.py`
- `backend/tests/test_server_demo_changes.py`
- `backend/tests/test_server_demo_history_stack.py`
- `backend/scripts/bench_server_demo_grid.py`

## Strengths

- **Clear package ownership.** Core owns the datasource row model and protocol; the server client owns transport; the adapter owns Affino endpoint mapping; backend owns persistence and consistency.
- **Viewport-driven loading is real.** `createDataSourceBackedRowModel` sends `range`, `priority`, `reason`, `sortModel`, `filterModel`, `groupBy`, `groupExpansion`, `treeData`, `pivot`, and `pagination` to `dataSource.pull`.
- **Placeholder semantics are explicit.** Missing rows are represented by deterministic loading row ids using `__affino_datagrid_data_source_loading__:<sourceIndex>` and row status from `rangeCache`.
- **Stale-while-refresh behavior exists.** Sort, filter, and group changes use `replaceCacheOnSuccess`, preserving visible cached rows and marking partial retained rows stale until the viewport is reloaded.
- **Backpressure is structured.** The datasource row model has critical/background lanes, request coalescing, aborts, pending queues, prefetch diagnostics, and `pauseBackpressure` / `resumeBackpressure` / `flushBackpressure`.
- **Invalidation is narrow when possible.** Core supports all/range/rows invalidation. The backend emits cell/range/dataset invalidation and the client maps these into datasource invalidations.
- **Optimistic edit support is already present.** `patchRows` overlays cached rows immediately, queues `commitEdits`, applies returned row snapshots/invalidation, and rolls back rejected or failed commits.
- **Revision and dataset-version contracts are documented and implemented.** Pull and mutations return `revision` / `datasetVersion`; stale edit/fill commits return `409 stale-revision`; fill can validate `projectionHash` and `boundaryToken`.
- **Server history integration is stronger than demo-level.** Stack undo/redo uses workspace/table/user/session scope and mutation responses can return row snapshots.
- **Change feed exists.** `GET /api/changes?sinceVersion=...` is implemented with gap fallback to dataset invalidation, and the client has a non-overlapping poller with diagnostics.
- **Backend limits protect scale-sensitive operations.** Pull rows, filtered count, histogram source rows, edit batch size, fill target rows, source rows, fill columns, and fill cells have configured limits.
- **Good focused coverage exists.** Tests cover loading placeholders, stale visible rows, failed pulls and retry by viewport request, optimistic edits, invalidation, change feed ordering/gap fallback, stale revision, fill consistency tokens, and scoped history.

## Findings By Severity

### Blocker

1. **No websocket/live-update transport is implemented.**
   - Evidence: `docs/server-datasource/protocol.md` and `docs/server-datasource/consistency.md` define polling change feed as the current path. `packages/datagrid-server-client/src/client.ts` exposes `startChangeFeedPolling` / `stopChangeFeedPolling`; no reviewed WebSocket transport exists.
   - Impact: enterprise realtime/collaborative use cases cannot rely on low-latency push, connection lifecycle state, or reconnect replay.
   - Required: add a datasource live-update transport abstraction that can use polling now and websocket/server-sent events later, with reconnect and version-gap recovery.

2. **Offline/reconnect behavior is unsupported.**
   - Evidence: reviewed datasource/client/backend code has abort handling, polling stop/start, stale-version fallback, and mutation rollback, but no offline mutation queue, reconnect handshake, durable local pending operations, or replay/idempotency contract for disconnected clients.
   - Impact: enterprise deployments with intermittent connectivity cannot guarantee edit/fill/history recovery.
   - Required: explicitly document unsupported offline mode now, then add reconnect contract and idempotent mutation replay if offline support is in scope.

### High

1. **Retry/backoff exists for idempotent reads; mutation retry remains intentionally unsupported.**
   - Evidence: `@affino/datagrid-server-client` retries low-level pull, histogram, manual change-feed reads, and change-feed polling for transport failures plus `408`, `425`, `429`, and `5xx` responses. Aborts, validation/auth/conflict errors, stale revisions, projection mismatch, and boundary mismatch are non-retryable.
   - Impact: transient read failures can recover without manual viewport movement; mutations still require explicit operation-id idempotency before retry.
   - Required: keep mutation retry disabled until duplicate-operation behavior is guaranteed, and add placeholder/pull latency gates in the next slices.

2. **Enterprise consistency tokens are documented as required but remain optional at runtime.**
   - Evidence: protocol marks `baseRevision`, `projectionHash`, and `boundaryToken` as optional/recommended. Backend enforces them only when present.
   - Impact: integrations can accidentally accept stale edit/fill commits and still appear protocol-compliant.
   - Required: add runtime enterprise mode or integration validation where `baseRevision` is required for edits/fill and fill commits require `projectionHash` + `boundaryToken`.

3. **Server grouping/tree/pivot contracts are partially defined but not fully implemented in the demo backend.**
   - Evidence: core datasource requests include `groupBy`, `treeData`, `pivot`, and aggregation context. Backend `ServerDemoPullRequest` accepts only `range`, `sortModel`, and `filterModel`; fill projection schemas carry group/tree/pivot only for consistency hashing.
   - Impact: grouped/tree/pivot server-backed behavior is supported by the frontend contract but unsupported by the current FastAPI demo pull projection.
   - Required: either implement server grouping/tree/pivot projection or explicitly mark those server-demo features unsupported outside consistency hashing.

4. **Placeholder exposure and blank-viewport resilience are not gated by latency budgets.**
   - Evidence: unit tests verify placeholder rows and stale visible rows, but there is no reviewed perf gate for placeholder exposure time, critical pull latency, blank viewport detection, or cache hit rate.
   - Impact: correctness can pass while enterprise UX degrades under realistic latency.
   - Required: add telemetry and CI/manual perf gates for visible placeholder duration and blank viewport detection.

5. **Simple `createServerBackedRowModel` remains a weaker alternate path.**
   - Evidence: `serverBackedRowModel.ts` wraps block-based `ServerRowModel`; the stronger docs and UX contract point to `createDataSourceBackedRowModel`.
   - Impact: consumers can choose the less complete path for enterprise server-backed grids and miss datasource invalidation/history/push semantics.
   - Required: document `createDataSourceBackedRowModel` as the enterprise path and keep `createServerBackedRowModel` scoped to low-level/block-model use.

### Medium

1. **Change-feed gap fallback is safe but broad.**
   - Evidence: backend `change_feed` returns dataset invalidation when the gap exceeds `grid_max_change_feed_gap` or stored events are incomplete.
   - Impact: safe recovery may cause broad viewport refreshes and visible stale/placeholder churn.
   - Required: add diagnostics for gap fallback rate and test UX continuity after dataset invalidation.

2. **Mutation response invalidation is narrower in backend than core protocol can express.**
   - Evidence: backend emits cell/range/row/dataset, while core datasource invalidation supports all/range/rows. Cell invalidation maps through client-side normalization to rows/range/all behavior.
   - Impact: cell-level precision may be lost before row model reconciliation.
   - Required: decide whether core should support cell invalidation or document row-level invalidation as the client cache boundary.

3. **Row identity is enforced in core but not fully specified for advanced projections.**
   - Evidence: `normalizeRowEntry` rejects missing ids and requires deterministic group row ids. Protocol requires stable row ids and indexes. Backend rows use `id` and `index`.
   - Impact: integrations with grouped/tree/pivot rows may create unstable ids unless docs give exact row-id rules.
   - Required: add row identity invariants for leaf, group, tree, aggregate, and placeholder rows.

4. **Latency handling exists but is mostly reactive.**
   - Evidence: placeholders, stale row retention, background prefetch, critical/background lanes, and error rows are implemented; no SLA telemetry is attached to pull latency or placeholder exposure.
   - Impact: behavior is functionally correct but difficult to tune or enforce.
   - Required: expose pull timing, placeholder exposure, retry count, and cache coverage metrics.

5. **Backend safeguards can become UX failures without client-facing policy.**
   - Evidence: backend returns `pull-range-too-large`, `filter-count-too-large`, fill limits, and histogram limits.
   - Impact: limits protect the service but need user-facing recovery paths.
   - Required: document client handling for each limit error and add tests for non-destructive failure states.

### Low

1. **Legacy operation-specific undo/redo endpoints remain.**
   - Evidence: protocol documents stack undo/redo as normal UX and legacy operation-id routes for diagnostics/manual replay.
   - Impact: low if app code uses stack history; confusing if integrations pick operation-id APIs for normal UX.
   - Required: keep legacy routes marked diagnostic.

2. **Series fill remains unsupported in current server behavior.**
   - Evidence: protocol and existing audits identify server-side series fill as a limitation; fill mode exists in types.
   - Impact: spreadsheet parity gap, not a broken current behavior.
   - Required: mark as unsupported until implemented.

## Correctness Risks

- Optional enterprise consistency fields can allow stale writes in integrations that omit `baseRevision`, `projectionHash`, or `boundaryToken`.
- Server grouping/tree/pivot request fields can imply capability that the backend pull endpoint does not currently provide.
- Cell invalidation may be widened to rows/ranges, increasing refresh scope.
- Dataset invalidation from change-feed gaps is correct but can disrupt selection/focus/edit continuity if not covered by integration tests.
- Placeholder rows have stable ids, but selection/edit logic must continue treating them as non-data rows.
- Stale retained rows during partial cache replacement are correct for visual continuity, but tests should cover selection/focus identity after the stale row is replaced.

## Performance Risks

- Pull latency is not measured at the datasource row model boundary.
- Placeholder exposure time is not measured.
- Retry storms are possible if a future retry layer is added without backoff and request coalescing awareness.
- Broad dataset invalidation can refresh more rows than necessary after change-feed gaps.
- Large filtered counts can be expensive; backend has `grid_max_filter_count_rows`, but client UX for count-limit failures is not formalized.
- Wide server-backed projections with pivot columns are type-supported, but the demo backend does not provide enterprise validation for 1k/10k-column cases.

## Server-Backed Virtualization Risks

- The strong path is `createDataSourceBackedRowModel`; using lower-level `createServerBackedRowModel` for enterprise server-backed grids risks weaker invalidation and mutation behavior.
- Cache replacement keeps visible rows, but placeholder exposure under high latency is not budgeted.
- Critical/background lanes are useful, but their telemetry is internal diagnostics rather than a visible perf gate.
- Server invalidation can force broad reloads when row snapshots are missing.

## Cache Invalidation And Partial Refresh

Current state:

- Core supports invalidating all, ranges, and row ids.
- Mutations apply returned row snapshots first, then invalidation.
- Push events can upsert, remove, or invalidate.
- Sort/filter/group refreshes preserve visible cache until success.
- Backend emits cell, range, row, or dataset invalidation and includes row snapshots when configured and small enough.

Risks:

- The core row model cannot directly represent cell-level invalidation.
- Dataset invalidation is the fallback for incomplete change-feed windows or unsupported invalidation shape.
- There is no enterprise matrix proving each invalidation type preserves visible rows, selection, focus, and edit state.

## Optimistic Updates

Current state:

- Inline edits can optimistically update cached rows through `patchRows`.
- Commits are queued.
- Failed commits roll back cached rows.
- Rejected rows roll back and surface an error.
- Returned rows/invalidation reconcile the cache.

Risks:

- Optimistic support is focused on edits. Fill/history mostly rely on server response snapshots and invalidations.
- There is no offline optimistic queue.
- Retrying mutations safely requires operation idempotency and backend duplicate-operation behavior to be specified for every mutation type.

## Latency, Retries, And Error Recovery

Current state:

- Pulls are abortable.
- Non-abort pull errors mark missing viewport rows as error placeholders.
- Viewport re-request can retry a failed range.
- Change-feed polling reports errors and continues on the next timer.
- Invalid `sinceVersion` resets the change-feed cursor.

Gaps:

- No exponential backoff.
- No retry budget.
- No circuit breaker.
- No user-visible retry state contract.
- No offline queue or reconnect replay.
- No distinction between retryable and non-retryable HTTP errors in datasource policy.

## Sorting, Filtering, Grouping, And Pivoting

Current state:

- Server pull supports sorting and filtering in the backend demo.
- Backend read tests cover range pulls, text/value/quick/advanced filters, stable empty revisions, sort/filter totals, and max range/count failures.
- Core datasource requests carry grouping, tree, pivot, aggregation, group expansion, and pagination context.
- Fill consistency hashing includes group/tree/pivot/pagination projection state.

Unsupported or partial:

- The current FastAPI demo pull schema does not accept group/tree/pivot pull context.
- Server-side grouping/tree projection and pivot projection are unsupported in the reviewed backend path.
- Pivot columns can be returned by the core datasource contract, but the demo backend does not validate enterprise pivot behavior.

## Consistency Guarantees

Current state:

- Revisions are monotonic per scoped table.
- `datasetVersion` is derived from revision and returned by pull/mutation/history responses.
- Workspace scope is propagated through `X-Workspace-Id` and request bodies.
- History scope uses workspace, table, user, and session.
- Edit commits can reject stale `baseRevision`.
- Fill commits can reject stale revision, projection mismatch, and boundary mismatch.
- Redo branch invalidation is covered by backend history tests.
- Change-feed gap fallback returns dataset invalidation.

Risks:

- Enterprise consistency fields remain optional for compatibility.
- Scope selection is header/body driven rather than auth-bound.
- Live update conflict semantics are polling-only today.

## Stale Row Retention

Current state:

- `replaceCacheWithRows` preserves rows in the current source viewport that were not replaced by the successful response.
- Preserved rows are marked stale and the current viewport is scheduled for reload when needed.
- Tests cover old rows staying visible during pending sort/filter/group refresh and partial sort replacement.

Risk:

- Stale-row retention is well designed for visual continuity, but enterprise readiness needs focus/selection/edit continuity tests across stale replacement.

## Websocket / Live Updates

Current state:

- Polling change feed is implemented and tested.
- No websocket, SSE, or durable live-update transport was found in reviewed code.

Required enterprise work:

- Define `DataGridDataSource` live transport semantics independent of the transport implementation.
- Track connection state, reconnect attempts, last applied dataset version, and gap fallback.
- Preserve current cache while reconnecting.
- Recover through dataset invalidation only when event replay is impossible.

## Offline / Reconnect Behavior

Current state:

- Unsupported.

Required enterprise work if offline is in scope:

- durable local mutation queue
- operation idempotency for edits/fill/history
- conflict policy for stale revisions after reconnect
- replay ordering
- user-visible pending/conflict states
- tests for reload during pending mutations

## Enterprise Readiness Score

Current score: **8/10**

Target score: **9/10**

What blocks the target:

- no websocket/live-update transport
- no offline/reconnect contract
- mutation retry remains intentionally unsupported until operation-id idempotency is guaranteed
- consistency tokens are documented as required for enterprise integrations but still optional at runtime
- server grouping/tree/pivot projection is unsupported in the current backend demo path
- placeholder exposure, blank viewport detection, and pull latency are not perf-gated
- integration tests do not yet cover selection/focus/edit continuity through server invalidation and cache replacement

## Recommended Roadmap

### Phase 1: Contract Hardening

- Mark `createDataSourceBackedRowModel` + `createAffinoDatasource` as the enterprise server datasource path. Status: completed in the server datasource UX contract.
- Add an enterprise contract section requiring stable row ids, stable projection indexes, `datasetVersion`, `baseRevision`, and fill `projectionHash` / `boundaryToken`. Status: completed in protocol, consistency, and UX docs.
- Explicitly mark offline, websocket, server grouping/tree/pivot, and series fill as unsupported until implemented. Status: completed in protocol, consistency, and UX docs.

### Phase 2: Retry And Failure Semantics

- Add retry/backoff policy for idempotent pulls and change-feed polling. Status: completed in `@affino/datagrid-server-client`.
- Classify HTTP errors as retryable, conflict, validation, auth, or fatal. Status: completed for read retry policy.
- Keep mutation retries disabled by default unless operation ids are durable and idempotent. Status: preserved.
- Add user-visible error/retry state expectations. Status: change-feed diagnostics include retry attempt, retry delay, and consecutive failures; placeholder exposure telemetry remains planned.

### Phase 3: Cache And Placeholder Hardening

- Add placeholder exposure telemetry.
- Add blank viewport detection.
- Add cache hit/miss and stale row retention diagnostics.
- Add tests for row snapshots, range invalidation, row invalidation, and dataset invalidation with active viewport rows.

### Phase 4: Server Projection Expansion

- Decide whether server grouping/tree/pivot are in scope for the demo backend.
- If yes, extend pull schemas and projection service.
- If no, document unsupported behavior clearly in server datasource docs and adapter examples.

### Phase 5: Live Updates

- Introduce a live-update transport abstraction.
- Keep polling as the default fallback.
- Add websocket/SSE implementation later behind the same version-gap semantics.
- Test reconnect, invalid since version, missing event windows, and cache continuity.

### Phase 6: Enterprise Continuity Validation

- Add component/e2e tests for selection, focus, active edit, keyboard navigation, and clipboard behavior across server invalidation and cache replacement.
- Add latency and large-dataset benchmarks.
- Add CI or manual perf gates for placeholder exposure and scroll frame budget.

## Recommended Tests

Unit tests:

- datasource pull retry/backoff policy for retryable errors
- no mutation retry without idempotency
- row id invariants for leaf/group/tree rows
- cache invalidation mapping from cell/range/row/dataset to core invalidations
- placeholder exposure state transitions: loading -> error -> retry -> loaded
- stale retained rows replaced after partial cache refresh
- change-feed invalid since version resets and recovers through dataset invalidation

Component tests:

- sort/filter refresh keeps visible rows until success
- failed pull keeps loaded rows and shows error placeholders only for missing rows
- row snapshots from edit/fill/history update visible cells without full refresh
- dataset invalidation preserves focus/selection where possible
- history undo/redo applies row snapshots before falling back to refresh

Playwright/e2e tests:

- 100k-row server-backed fast scroll with artificial latency: no blank viewport
- sort/filter while scrolled away from top: stale rows remain visible, then reconcile
- network 500 on pull, then retry: viewport recovers without remount
- change-feed gap fallback while editing: grid stays mounted and recovers
- stale edit revision conflict: optimistic edit rolls back predictably
- fill boundary mismatch: commit fails without corrupting selection or data

Backend tests:

- pull with deterministic sort tie-breakers
- stale `baseRevision` required in enterprise mode
- duplicate mutation operation id behavior
- retry/idempotency behavior for fills if mutation retry is enabled
- change-feed event window with missing stored events
- workspace/table/user/session isolation for change feed and history
- max pull/filter/fill/histogram limit error payloads

Performance/benchmark tests:

- pull latency distribution
- placeholder exposure time under 100 ms / 250 ms / 1 s latency
- cache hit/miss under fast scroll
- change-feed gap recovery cost
- 10k / 100k / 1M row viewport pulls
- 100 / 1k / 10k column metadata/pivot-column stress where supported

## Recommended Telemetry

- datasource pull duration by reason and priority
- requested range size and returned row count
- cache hit/miss count
- current rendered placeholder count
- placeholder exposure duration
- stale retained row count
- blank viewport detection count
- invalidation kind and affected scope
- datasetVersion before/after pull or mutation
- retry count and last retry reason
- change-feed polling pending/error state
- change-feed gap fallback count
- live transport connection state when implemented
- optimistic mutation queue length
- rollback count
- server error code distribution

## Prioritized Implementation Slices

1. **Document enterprise datasource contract**
   - Files: `docs/server-datasource/protocol.md`, `docs/server-datasource/consistency.md`, `docs/server-datasource/ux-contract.md`
   - Outcome: required enterprise fields and unsupported features are explicit.
   - Status: completed. See `docs/plans/SERVER_DATASOURCE_ENTERPRISE_PLAN.md`.

2. **Add retry/backoff for idempotent reads**
   - Files: `packages/datagrid-server-client/src/http.ts`, `packages/datagrid-server-client/src/client.ts`, `packages/datagrid-server-client/src/changeFeedPoller.ts`
   - Outcome: transient pull/poll failures recover without manual viewport movement.
   - Status: completed. See `docs/plans/SERVER_DATASOURCE_ENTERPRISE_PLAN.md`.

3. **Add placeholder and blank-viewport telemetry**
   - Files: `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`, performance docs/tests
   - Outcome: latency UX becomes observable and gateable.

4. **Harden invalidation matrix**
   - Files: `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`, `packages/datagrid-server-client/src/changeFeedMapping.ts`, backend tests
   - Outcome: all invalidation kinds have explicit row model behavior and tests.

5. **Clarify or implement server grouping/tree/pivot**
   - Files: backend schemas/projection/repository, adapter mapping, docs
   - Outcome: current unsupported server-demo behavior is either implemented or impossible to misread.

6. **Add live-update transport abstraction**
   - Files: `packages/datagrid-server-client`, `packages/datagrid-server-adapters`, docs
   - Outcome: polling and websocket/SSE can share version-gap recovery semantics.

7. **Define offline/reconnect policy**
   - Files: docs first; client/backend only after API approval
   - Outcome: offline is either explicitly unsupported or implemented through durable idempotent operations.

## Risks And Migration Notes

- Requiring `baseRevision`, `projectionHash`, or `boundaryToken` by default would be a public protocol tightening. Introduce it as enterprise mode or a documented integration requirement before enforcing globally.
- Adding retries must not retry non-idempotent mutations unless the backend operation-id contract guarantees duplicate suppression.
- Websocket/SSE should not bypass `DataGridDataSourcePushEvent`; it should feed the existing push/invalidation path.
- Server grouping/tree/pivot support will change backend response shape and row identity requirements. Define row id rules before implementation.
- Keep the current datasource-backed row model alive across host app refreshes. Remounting the grid or replacing the row model remains an app-level anti-pattern.
