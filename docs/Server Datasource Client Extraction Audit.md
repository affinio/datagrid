# Server Datasource Client Extraction Audit

  ## Executive Summary

  Recommend a new packages/datagrid-server-client package. The demo adapter is currently doing three jobs at once: demo-domain request shaping, generic HTTP/client
  mechanics, and change-feed/history lifecycle management. Only the demo-domain layer should stay in sandbox. The reusable layer should own transport, dataset-
  version normalization, invalidation normalization, row snapshot handling, and polling. datagrid-core should remain the contract boundary, and datagrid-vue should
  stay a consumer/re-export surface, not the transport owner.

  ## Current Responsibilities In The Demo Adapter

  - HTTP transport lives in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:265: resolveEndpoint, postJson, getJson,
    parseErrorResponse, toAbortError, isFetchTransportFailure, and isFetchAbortLikeError.
  - Endpoint routing is hard-coded to the demo backend paths in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1473,
    including /api/server-demo/*, /api/history/*, and /api/changes.
  - Filter mapping is in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:443 and packages/datagrid-sandbox/src/
    serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:407; it is tied to region, segment, status, and value semantics from packages/datagrid-sandbox/src/
    serverDatasourceDemo/types.ts:21.
  - Fill mapping is in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:895, packages/datagrid-sandbox/src/serverDatasourceDemo/
    serverDemoDatasourceHttpAdapter.ts:907, and packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:933.
  - History mapping is in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1091, packages/datagrid-sandbox/src/
    serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1123, packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1149,
    packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1172, and packages/datagrid-sandbox/src/serverDatasourceDemo/
    serverDemoDatasourceHttpAdapter.ts:1200.
  - Change-feed polling and lifecycle state are in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1294, packages/datagrid-
    sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1339, packages/datagrid-sandbox/src/serverDatasourceDemo/
    serverDemoDatasourceHttpAdapter.ts:1397, packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1441, and packages/datagrid-
    sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1456.
  - Invalidation normalization is in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:720, packages/datagrid-sandbox/src/
    serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:787, and packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1209.
  - Row snapshot normalization is in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:825 and packages/datagrid-sandbox/src/
    serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1429.
  - The fill wrapper in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts:27 is mostly composition and history refresh
    wiring.
  - The demo domain types in packages/datagrid-sandbox/src/serverDatasourceDemo/types.ts:17 and packages/datagrid-sandbox/src/serverDatasourceDemo/types.ts:46 are
    still the source of truth for row shape, enum values, diagnostics, and fill/edit records.
  - Core datasource contracts already define the reusable request/response boundary in packages/datagrid-core/src/models/server/dataSourceProtocol.ts:63, packages/
    datagrid-core/src/models/server/dataSourceProtocol.ts:95, packages/datagrid-core/src/models/server/dataSourceProtocol.ts:131, and packages/datagrid-core/src/
    models/server/dataSourceProtocol.ts:220.
  - datagrid-vue already re-exports the datasource contracts in packages/datagrid-vue/src/public.ts:158, so it does not need to own the HTTP client layer to make
    those types available.

  ## Keep In Server Demo

  - SERVER_DEMO_ROW_COUNT, SERVER_DEMO_PAGE_SIZE, SERVER_DEMO_LATENCY_MS, SERVER_DEMO_SEGMENTS, SERVER_DEMO_STATUSES, and SERVER_DEMO_REGIONS in packages/datagrid-
    sandbox/src/serverDatasourceDemo/types.ts:17 should stay sandbox-only because they encode demo data and filter vocabularies.
  - ServerDemoRow, ServerDemoMutationInvalidation, ServerDemoFillChange, ServerDemoFillOperationRecord, ServerDemoMutableState, and the diagnostics interfaces in
    packages/datagrid-sandbox/src/serverDatasourceDemo/types.ts:46 are demo-domain state, not reusable infrastructure.
  - normalizeServerDemoValueCellInput in packages/datagrid-sandbox/src/serverDatasourceDemo/types.ts:27 should stay sandbox-only because it encodes the demo’s
    editable value semantics.
  - flattenFilterModel, createValuePredicateFilter, createBackendFilterForPredicate, and the enum canonicalization logic in packages/datagrid-sandbox/src/
    serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:299 through packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:550
    should stay in sandbox because they are tied to the demo backend filter grammar and the region/segment/status column model.
  - normalizeCommitEditRequestBody and normalizeFillCommitRequestBody in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:933
    and packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:998 should stay sandbox-owned because they embed demo history scope and
    workspace/table/user/session request fields.
  - applyServerDemoMutationInvalidation in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts:1209 should stay sandbox-owned
    because it is specifically wired to the server-demo row model patch/invalidate behavior.
  - serverDemoDatasourceHttpFillDataSource.ts should remain sandbox orchestration code because it composes the demo HTTP adapter with fallback row model behavior and
    history refresh hooks.
  - serverDemoChangeFeedPolling.ts config helpers and the *ChangeFeed*.spec.ts files should remain sandbox-local because they validate demo behavior, not reusable
    client behavior.
  - Diagnostics strings and callbacks should stay in sandbox because they are demo observability, not transport infrastructure.

  ## Extract To Reusable Layer

  - resolveEndpoint, postJson, getJson, parseErrorResponse, toAbortError, isFetchTransportFailure, and isFetchAbortLikeError should move to packages/datagrid-server-
    client/src/http/*; keep them private/internal. Dependencies are fetch, Response, DOMException, and abort signaling. Risk is browser-only semantics drifting if
    these helpers are exposed too early.
  - normalizeDatasetVersion should move to packages/datagrid-server-client/src/normalize.ts; make it public. Dependencies are none. Risk is low.
  - normalizeDataGridInvalidation should become normalizeDatasourceInvalidation in packages/datagrid-server-client/src/invalidation.ts; make it public. Dependencies
    are the DataGridDataSourceInvalidation contract from packages/datagrid-core/src/models/server/dataSourceProtocol.ts:220. Risk is type leakage if the new API
    mirrors demo-specific invalidation shapes instead of core shapes.
  - normalizeChangeFeedRows should move to packages/datagrid-server-client/src/rowSnapshot.ts; keep it internal unless a second consumer appears. Dependencies are
    row-entry shape assumptions and row-id/index extraction. Risk is hard-coding the current demo row shape.
  - loadChangeFeedSinceVersion, pollChangeFeed, startChangeFeedPolling, stopChangeFeedPolling, and the diagnostics state should move into a reusable
    createChangeFeedPoller implementation in packages/datagrid-server-client/src/changeFeedPoller.ts; make the poller public. Dependencies are timers, abort
    controllers, version cursors, and diagnostics callbacks. Risk is race conditions around version cursors and page lifecycle teardown.
  - toUniqueRowCommits, toRejectedRows, toServerDemoHistoryState, postServerOperation, postServerFillHistoryOperation, postServerHistoryStackOperation, and
    postServerHistoryStatusOperation are only partially reusable. Extract the HTTP executor and result unwrapping only if a second backend shares the same history
    contract; otherwise keep the request-body mappers in sandbox and let the reusable client accept injected serializers.
  - normalizeFillBoundaryRequestBody, normalizeFillCommitRequestBody, and normalizeCommitEditRequestBody should not be made public as-is. If they move at all, they
    should become internal request mappers behind a generic client factory, because the current versions are coupled to demo scope and payload names.

  ## Recommended Package/Location

  Choose the new package: packages/datagrid-server-client.

  Why:

  - The code is transport/client infrastructure, not core grid runtime, so packages/datagrid-core is the wrong owner.
  - packages/datagrid-vue is already a broad framework-facing package; putting fetch, polling, and lifecycle code there would blur the boundary between rendering/
    runtime and server integration.
  - A dedicated package can depend on @affino/datagrid-core and remain framework-agnostic, which makes it reusable for sandbox, Vue, and any future app layer.
  - It also gives the team a clean place to keep HTTP and polling helpers without coupling them to the demo app.

  If the team refuses a new package, packages/datagrid-vue/src/datasource/serverClient is the fallback, but it is not the better boundary.

  ## Proposed Public API

  Keep this minimal:

  export interface ServerDatasourceEndpointMap {
    pull: string
    histogram: string
    commitEdits: string
    resolveFillBoundary: string
    commitFillOperation: string
    undoFillOperation: string
    redoFillOperation: string
    undoOperation: string
    redoOperation: string
    historyStatus: string
    changesSinceVersion: (sinceVersion: number) => string
  }

  export interface ServerDatasourceChangeFeedDiagnostics {
    currentDatasetVersion: number | null
    lastSeenVersion: number | null
    polling: boolean
    pending: boolean
    appliedChanges: number
    intervalMs: number | null
  }

  export function normalizeDatasetVersion(value: unknown): number | null

  export function normalizeDatasourceInvalidation(
    value: unknown,
  ): import("@affino/datagrid-core").DataGridDataSourceInvalidation | null

  export function createChangeFeedPoller(options: {
    fetchImpl?: typeof fetch
    getSinceVersion: () => number | null
    loadSinceVersion: (sinceVersion: number, signal?: AbortSignal) => Promise<unknown>
    onResponse: (response: unknown, requestSinceVersion: number) => void
    onError?: (error: unknown) => void
    onDiagnostics?: (diagnostics: ServerDatasourceChangeFeedDiagnostics) => void
    intervalMs?: number
  }): {
    start(): void
    stop(): void
    diagnostics(): ServerDatasourceChangeFeedDiagnostics
  }

  export function createServerDatasourceHttpClient<TRow>(options: {
    fetchImpl?: typeof fetch
    baseUrl?: string
    endpoints: ServerDatasourceEndpointMap
    normalizeDatasetVersion?: typeof normalizeDatasetVersion
    normalizeInvalidation?: typeof normalizeDatasourceInvalidation
    onChangeFeedDiagnostics?: (diagnostics: ServerDatasourceChangeFeedDiagnostics) => void
  }): {
    pull(...): Promise<import("@affino/datagrid-core").DataGridDataSourcePullResult<TRow>>
    getColumnHistogram(...): Promise<import("@affino/datagrid-vue").DataGridColumnHistogram>
    commitEdits(...): Promise<unknown>
    resolveFillBoundary): Promise<unknown>
    commitFillOperation(...): Promise<unknown>
    undoFillOperation getHistory  getChangesVersion(... Promise<unknown>
  }

  Keep the serializer hooks and DTO-specific adapters private unless another consumer proves they need to be public.

  ## Private / Internal In The Reusable Layer

  - Fetch and JSON helpers, abort detection, and response parsing should stay internal.
  - Page-lifecycle teardown flags and timer generation counters should stay internal to the poller.
  - Request-body serializers for demo scope, fill, and edit payloads should stay internal or stay in sandbox as injected callbacks.
  - Demo filter canonicalization, enum normalization, and row-field-specific mapping should stay in sandbox.
  - Diagnostics formatting for the demo UI should stay in sandbox; only the stable diagnostics shape should be public.

  ## Migration Plan

  1. Extract pure helpers first. Changed files should be new packages/datagrid-server-client/src/http/*, src/normalize.ts, and src/invalidation.ts, plus import
     updates in packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts. Acceptance criteria: no behavior change in request/response
     shapes, and existing demo adapter tests still pass. Validation: pnpm --dir packages/datagrid-sandbox exec vitest run src/serverDatasourceDemo/
     serverDemoDatasourceHttpAdapter.spec.ts and pnpm --dir packages/datagrid-sandbox run type-check.
  2. Extract the change-feed poller next. Changed files should be a new src/changeFeedPoller.ts, adapter wiring updates, and a focused poller test file in the new
     package. Acceptance criteria: polling starts, stops, aborts, and resets the cursor exactly as before. Validation: pnpm --dir packages/datagrid-sandbox exec
     vitest run src/serverDatasourceDemo/serverDemoChangeFeedPolling.spec.ts src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.spec.ts.
  3. Extract row-snapshot and invalidation adapters after that. Changed files should be new helpers in packages/datagrid-server-client/src/rowSnapshot.ts and src/
     invalidation.ts, plus adapter call-site updates. Acceptance criteria: applyRowSnapshots and invalidation push events still behave identically for row, range,
     cell, and dataset changes. Validation: pnpm --dir packages/datagrid-sandbox exec vitest run src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.spec.ts.
  4. Refactor the sandbox adapter and fill wrapper to consume the new client. Changed files should be serverDemoDatasourceHttpAdapter.ts,
     serverDemoDatasourceHttpFillDataSource.ts, and any local type aliases that become redundant. Acceptance criteria: no demo-specific request/response regressions,
     and the fill wrapper still refreshes history status and applies snapshots correctly. Validation: pnpm --dir packages/datagrid-sandbox exec vitest run src/
     serverDatasourceDemo/serverDemoDatasourceHttpAdapter.spec.ts src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.spec.ts.
  5. Add package-level tests and docs. Changed files should be the new package’s test files and a short README or inline docs if the package is intended for reuse.
     Acceptance criteria: the new package has direct coverage for dataset version normalization, invalidation normalization, and poller lifecycle behavior.
     Validation: pnpm --dir packages/datagrid-server-client run type-check and the relevant vitest command for that package if you add one.

  ## Risks

  - Accidental behavior change in the demo adapter, especially around advanced filters and the backend filter grammar.
  - Type leakage from sandbox into a reusable package if ServerDemoRow-shaped DTOs are exported instead of generic contracts.
  - Over-generalizing too early, especially for history scope and fill/edit request bodies.
  - Wrong package boundary if transport logic lands in datagrid-core or framework-specific code lands in datagrid-vue.
  - Breaking public exports if the new package surface is too broad on the first pass.
  - Duplicated invalidation contracts if both the sandbox and reusable layer keep parallel normalization rules.

  ## Final Recommendation

  Start with a new packages/datagrid-server-client package and extract only the pure helpers plus invalidation normalization first. That is the lowest-risk slice and
  gives you a clean boundary before touching the polling state machine or the demo adapter’s request mappers.