# Server Datasource Enterprise Implementation Plan

This plan converts `docs/audits/SERVER_DATASOURCE_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The architecture remains the current golden path: `createDataSourceBackedRowModel`, `createAffinoDatasource`, `@affino/datagrid-server-client`, and the FastAPI `server_demo` backend. Do not introduce a parallel datasource stack.

Current execution state:

- Slice 1 is completed and should be treated as the enterprise datasource contract baseline.
- Slice 2 is completed and should be treated as the idempotent read retry/backoff baseline.
- Slice 3 is completed and should be treated as the datasource latency telemetry baseline.
- Slice 4 is completed and should be treated as the invalidation matrix baseline.
- Slice 5 is completed and should be treated as the server-demo projection capability baseline.
- Slice 6 is the next implementation slice.
- Rendering and virtualization enterprise tracks are closed as of 2026-05-18. Server datasource work should reuse their browser-frame and placeholder diagnostics where useful instead of creating duplicate performance tracks.

## Slice 1: Enterprise Datasource Contract

- Status: Completed. The server datasource docs now distinguish the backward-compatible HTTP protocol from the stricter enterprise integration profile, require stable row ids/indexes and consistency tokens for enterprise integrations, and explicitly mark offline, websocket/SSE, server grouping/tree/pivot projection, and server-side series fill as unsupported in the current implementation.
- Objective: make the golden path, required enterprise fields, row identity invariants, and unsupported features explicit before runtime hardening.
- Affected packages/files:
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/consistency.md`
  - `docs/server-datasource/ux-contract.md`
  - `docs/audits/SERVER_DATASOURCE_ENTERPRISE_AUDIT.md`
- Expected behavior change: no runtime behavior change; integrations have a clearer enterprise contract without tightening public protocol compatibility.
- Tests added/covered:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): define enterprise datasource contract`

## Slice 2: Retry And Backoff For Idempotent Reads

- Status: Completed. `@affino/datagrid-server-client` now applies bounded retry/backoff to low-level `pull`, histogram, manual change-feed reads, and change-feed polling. Retry is limited to transport failures and retryable read HTTP statuses (`408`, `425`, `429`, `5xx`); aborts, validation/conflict/auth errors, and mutation paths remain non-retried.
- Objective: add configurable retry/backoff for idempotent pull requests and change-feed polling without retrying non-idempotent mutations by default.
- Affected packages/files:
  - `packages/datagrid-server-client/src/http.ts`
  - `packages/datagrid-server-client/src/client.ts`
  - `packages/datagrid-server-client/src/changeFeedPoller.ts`
  - `packages/datagrid-server-client/src/changeFeedPoller.spec.ts`
  - `packages/datagrid-server-client/src/client.spec.ts`
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/consistency.md`
- Expected behavior change: transient 5xx/network failures on reads can recover within a bounded retry budget; mutations remain single-attempt unless a future idempotency contract enables retry.
- Tests added/covered:
  - Pull retries retryable failures and stops at the configured budget.
  - Pull does not retry aborts, validation conflicts, stale revisions, or auth failures.
  - Change-feed polling backs off after retryable failures and recovers without overlapping polls.
  - Manual change-feed reads retry retryable failures and preserve dataset-version progression.
- Validation command: `pnpm exec vitest run packages/datagrid-server-client/src/client.spec.ts packages/datagrid-server-client/src/changeFeedPoller.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid-server-client): retry idempotent datasource reads`

## Slice 3: Placeholder And Blank Viewport Telemetry

- Status: Completed. `createDataSourceBackedRowModel` now reports placeholder exposure, viewport data availability, viewport cache hit/miss ratio, blank viewport events, and pull duration diagnostics. The server datasource sandbox exposes these fields as browser-readable attributes, and the enterprise browser-frame harness includes them in datasource placeholder artifacts.
- Objective: expose placeholder exposure, blank viewport, cache coverage, and pull timing diagnostics for server-backed virtualization.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: latency UX is observable at the row-model boundary and in browser benchmark artifacts without changing the datasource protocol.
- Tests to add/update:
  - Loading placeholder exposure transitions from loading to loaded.
  - Blank viewport and cache coverage diagnostics update before and after delayed pulls.
  - Pull duration diagnostics are recorded for completed pulls.
  - Browser artifact includes placeholder exposure, cache coverage, blank viewport, viewport availability, and pull duration summaries.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- Risk level: Medium
- Suggested commit message: `feat(datagrid-core): trace datasource placeholder exposure`

## Slice 4: Invalidation Matrix Hardening

- Status: Completed. Dataset invalidation now keeps active viewport rows visible while scheduling refresh, and the server client has explicit normalization coverage for cell, row, range, and dataset invalidation payloads.
- Objective: make cell, row, range, and dataset invalidation behavior explicit and covered across client mapping, row model reconciliation, and backend change feed responses.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-server-client/src/changeFeedMapping.ts`
  - `packages/datagrid-server-client/src/invalidation.ts`
  - `backend/tests/test_server_demo_changes.py`
  - `docs/server-datasource/consistency.md`
- Expected behavior change: all supported invalidation kinds have deterministic cache effects and tests; dataset invalidation no longer blanks the mounted viewport before the refresh response arrives.
- Tests to add/update:
  - Cell invalidation maps to the smallest supported row-model refresh scope.
  - Row invalidation normalizes string and numeric row ids.
  - Range and dataset invalidation normalize deterministically.
  - Dataset invalidation preserves mounted row model state while scheduling refresh.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts packages/datagrid-server-client/src/invalidation.spec.ts packages/datagrid-server-client/src/changeFeedMapping.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid): harden server datasource invalidation`

## Slice 5: Server Projection Capability Contract

- Status: Completed. The FastAPI `server_demo` pull path now accepts the frontend projection field names but returns a deterministic `400 unsupported-server-projection` for non-empty `groupBy`, `groupExpansion`, `treeData`, or `pivot` payloads. Docs now state that range/sort/filter are the only implemented server-demo pull projections.
- Objective: decide and encode whether server grouping/tree/pivot are implemented in the demo backend or explicitly unsupported outside projection hashing.
- Affected packages/files:
  - `backend/app/features/server_demo/schemas.py`
  - `backend/app/features/server_demo/projection.py`
  - `backend/tests/test_server_demo_read.py`
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/backend-fastapi.md`
- Expected behavior change: integrations cannot misread accepted frontend query fields as implemented server-demo grouped/tree/pivot projections; unsupported projection requests fail with an explicit capability error.
- Tests to add/update:
  - Unsupported projection fields produce deterministic capability errors.
- Validation command: `cd backend && uv run pytest tests/test_server_demo_read.py`
- Risk level: Medium
- Suggested commit message: `docs(datagrid): clarify server projection capabilities`

## Slice 6: Live Update Transport Abstraction

- Status: Planned.
- Objective: introduce a transport-neutral live-update lifecycle so polling and future websocket/SSE transports share cursor, reconnect, and gap recovery semantics.
- Affected packages/files:
  - `packages/datagrid-server-client/src/changeFeedPoller.ts`
  - `packages/datagrid-server-client/src/client.ts`
  - `packages/datagrid-server-adapters/src/index.ts`
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/consistency.md`
- Expected behavior change: polling remains the default; future push transports have a defined adapter boundary.
- Tests to add/update:
  - Start/stop lifecycle.
  - Reconnect after transient transport failure.
  - Invalid cursor and event-window gaps recover through dataset invalidation.
- Validation command: targeted server-client and adapter tests.
- Risk level: High
- Suggested commit message: `feat(datagrid-server-client): define live update transport`

## Slice 7: Offline And Reconnect Policy

- Status: Planned docs-first slice.
- Objective: either keep offline explicitly unsupported or propose the public operation-id/idempotency contract required for durable offline replay.
- Affected packages/files:
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/consistency.md`
  - `docs/server-datasource/ux-contract.md`
- Expected behavior change: no runtime behavior change until an API shape is approved.
- Tests to add/update:
  - Docs validation only unless the API is approved.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low for docs, High for implementation.
- Suggested commit message: `docs(datagrid): define datasource offline policy`

## Recommended Execution Order

1. Slice 1: Enterprise Datasource Contract (completed)
2. Slice 2: Retry And Backoff For Idempotent Reads (completed)
3. Slice 3: Placeholder And Blank Viewport Telemetry (completed)
4. Slice 4: Invalidation Matrix Hardening (completed)
5. Slice 5: Server Projection Capability Contract (completed)
6. Slice 6: Live Update Transport Abstraction (next)
7. Slice 7: Offline And Reconnect Policy

## Execution Notes

- Preserve public protocol compatibility unless a slice explicitly proposes a public API change and receives approval.
- Keep mutation retries disabled unless operation idempotency and duplicate-operation behavior are guaranteed.
- Keep polling as the current live-update implementation until a transport abstraction is in place.
- Treat `revision`, `datasetVersion`, `operationId`, history scope, and workspace scope as consistency boundaries.
- Document unsupported server-demo projection features as unsupported rather than implying enterprise coverage.
