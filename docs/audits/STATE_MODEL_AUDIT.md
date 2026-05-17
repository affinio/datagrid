# DataGrid State Model Audit

Date: `2026-05-17`
Scope: `DataGridApi.state`, row/column snapshots, app saved views, declarative persistence, diagnostics snapshots, viewport state, and column order semantics.

## 1. Executive Summary

The current architecture already has a real distinction between:

- runtime/model snapshots: `rowModel.getSnapshot()`, `columnModel.getSnapshot()`, viewport/runtime snapshots
- persisted state API: `api.state.get/set/migrate`
- diagnostics API: `api.diagnostics.getAll()` and `api.diagnostics.getFormulaExplain()`

However, the persisted `DataGridUnifiedState` currently embeds `rows.snapshot` wholesale. For client row models this snapshot includes projection diagnostics (`projection.pipeline`, `projection.memory`, invalidation metadata, stale stages, performance timing, formula/compute diagnostics). That means runtime/debug fields are exported, emitted through `update:state`, migrated by shallow version clone, and written by app `statePersistence`. Most of those fields are ignored during `api.state.set(...)`, so this is mostly snapshot bloat and public API coupling rather than an immediate restore correctness bug.

Current architecture is acceptable as a V1 model-centric transport, because docs explicitly call `api.state` model-centric and restore logic uses only semantic row state. It is not ideal for enterprise persisted layout state. The next cleanup should separate:

- persisted layout/query state
- runtime row-model snapshot
- diagnostics snapshot

No broad state rewrite should happen in this audit slice.

## 2. Current Snapshot Architecture

### Row model snapshot

`DataGridRowModelSnapshot` in `packages/datagrid-core/src/models/rowModel.ts` is a runtime/model snapshot. It includes:

- semantic query state: `sortModel`, `filterModel`, `groupBy`, `groupExpansion`, `pivotModel`, `pivotColumns`, `pagination`
- runtime state: `revision`, `datasetVersion`, `rowCount`, `loading`, `initialLoading`, `refreshing`, `warming`, `error`, `viewportRange`
- diagnostics/debug state: `treeDataDiagnostics`, `projection`

For client row models, `packages/datagrid-core/src/models/snapshot/clientRowSnapshotRuntime.ts` always includes `projection: getProjectionDiagnostics()`.

`projection` is built by `packages/datagrid-core/src/models/state/clientRowRuntimeStateStore.ts` and includes:

- `version`, `cycleVersion`, `recomputeVersion`
- `staleStages`
- `lastInvalidationReasons`
- `lastInvalidatedStages`
- `lastRecomputeHadActual`
- `lastRecomputedStages`
- `lastBlockedStages`
- `performance.stageTimes`
- `pipeline.rowCounts`
- `memory`
- formula/compute diagnostics when available

### Column model snapshot

`DataGridColumnModelSnapshot` in `packages/datagrid-core/src/models/columnModel.ts` includes:

- `order`: canonical/global base order
- `zoneOrder`: projected order inside `pinnedLeft`, `center`, `pinnedRight`
- `visibleColumns`, `pinnedLeftColumns`, `centerColumns`, `pinnedRightColumns`
- `visibility`, `pin`, `width` through per-column state

The docs in `docs/datagrid-model-contracts.md` already describe `order` as stable base/global order and `zoneOrder` as projected layout order.

### Diagnostics snapshot

`packages/datagrid-core/src/core/gridApiDiagnosticsMethods.ts` builds `api.diagnostics.getAll()` separately. It reads `rowModel.getSnapshot()` and exposes a diagnostics-oriented view:

- `rowModel.kind`
- `rowModel.revision`
- `rowModel.rowCount`
- `rowModel.loading`
- `rowModel.warming`
- `rowModel.projection`
- `rowModel.treeData`
- `compute`
- `derivedCache`
- `backpressure`

This confirms a diagnostics namespace exists, but diagnostics currently shares source fields with row-model snapshot.

## 3. Current Persisted-State Architecture

`DataGridUnifiedState` in `packages/datagrid-core/src/core/gridApiContracts.ts` is the public state shape:

- `version`
- `rows.snapshot`
- `rows.aggregationModel`
- `columns.order`
- `columns.zoneOrder`
- `columns.visibility`
- `columns.widths`
- `columns.pins`
- `view.viewportPosition` when requested
- `selection`
- `rowSelection`
- `transaction`

`api.state.get(...)` in `packages/datagrid-core/src/core/gridApiStateMethods.ts` stores:

- `rows.snapshot: cloneSerializable(rowModel.getSnapshot())`
- `rows.aggregationModel`
- column layout state derived from `columnModel.getSnapshot()`
- selection and row selection snapshots
- transaction snapshot
- optional semantic viewport position only when `includeViewportPosition` is true

`api.state.set(...)` restores only selected semantic fields:

- from `rows.snapshot`: sort, filter, groupBy, pivot, aggregation, groupExpansion, pagination, viewportRange
- from `columns`: order, visibility, widths, pins, zoneOrder
- from `selection` and `rowSelection`: selection snapshots
- from `view.viewportPosition`: semantic viewport position when allowed
- `transaction` restore is explicitly unsupported in strict mode

It does not restore `projection`, projection memory stats, performance timing, stale-stage details, or most runtime loading/debug fields.

`api.state.migrate(...)` currently validates only `version === 1` and then clones the object. It does not prune diagnostics/runtime fields.

## 4. Runtime vs Persisted vs Telemetry Separation Analysis

### What is runtime-only

- `rowModel.getSnapshot()` as a whole is runtime/model state.
- `revision`, `datasetVersion`, `loading`, `initialLoading`, `refreshing`, `warming`, `error`, `rowCount`, and `viewportRange` are runtime fields.
- `viewportRange` is a model demand/window field. It is intentionally used by restore today, but it is not the same as semantic user layout.

### What is persisted today

- `api.state.get()` persists `rows.snapshot` wholesale.
- App controlled state emits `api.state.get()` through `update:state` in `packages/datagrid-vue-app/src/useDataGridAppControlledState.ts`.
- Declarative `statePersistence` writes `api.state.get(options.getOptions)` directly to storage in `packages/datagrid-vue-app/src/DataGrid.ts`.
- Saved views store `DataGridUnifiedState` plus `viewMode` in `packages/datagrid-vue-app/src/config/dataGridSavedView.ts`; only `transaction` is sanitized to `null`.

### What is diagnostics/telemetry only

- `api.diagnostics.getAll()` is explicitly documented as inspector/profiling/support diagnostics in `docs/datagrid-state-events-compute-diagnostics.md`.
- `derivedCache` and `backpressure` are only exposed through diagnostics, not through `api.state.get()`.
- Projection diagnostics are diagnostics by nature, but they also appear inside `rows.snapshot`, and therefore leak into persisted state.

### Current answer: runtime-only, debug-only, persisted, or mixed?

Current `DataGridUnifiedState` is mixed. It is a model-centric persisted/exported state object that embeds a runtime row-model snapshot containing both semantic query state and diagnostics/runtime internals.

## 5. Exact Files Reviewed

- `docs/datagrid-state-events-compute-diagnostics.md`
- `docs/datagrid-grid-api.md`
- `docs/datagrid-feature-catalog.md`
- `docs/datagrid-model-contracts.md`
- `packages/datagrid-core/src/core/gridApiContracts.ts`
- `packages/datagrid-core/src/core/gridApiStateMethods.ts`
- `packages/datagrid-core/src/core/gridApiDiagnosticsMethods.ts`
- `packages/datagrid-core/src/core/gridApiColumnsMethods.ts`
- `packages/datagrid-core/src/core/__tests__/gridApi.contract.spec.ts`
- `packages/datagrid-core/src/models/rowModel.ts`
- `packages/datagrid-core/src/models/clientRowModel.ts`
- `packages/datagrid-core/src/models/snapshot/clientRowSnapshotRuntime.ts`
- `packages/datagrid-core/src/models/state/clientRowRuntimeStateStore.ts`
- `packages/datagrid-core/src/models/columnModel.ts`
- `packages/datagrid-core/src/models/__tests__/columnModel.spec.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts`
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
- `packages/datagrid-vue-app/src/DataGrid.ts`
- `packages/datagrid-vue-app/src/useDataGridAppControlledState.ts`
- `packages/datagrid-vue-app/src/config/dataGridSavedView.ts`
- `packages/datagrid-vue-app/src/config/dataGridStatePersistence.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`

## 6. Current Risks

### Architectural issue

`DataGridUnifiedState.rows.snapshot` uses a runtime row-model snapshot as persisted transport. This couples persisted state compatibility to runtime diagnostics fields.

### Debug verbosity

Client projection diagnostics can be large and noisy. Persisting `projection.pipeline`, `projection.memory`, invalidation reasons, and performance timing increases stored payload size without restore value.

### Public API concern

Because `DataGridUnifiedState` is public, fields inside `rows.snapshot.projection` become observable and may be treated as stable persisted API even though they are diagnostics.

### Serialization instability

`cloneSerializable` falls back to JSON cloning. Runtime fields such as `Error` inside `rows.snapshot.error` are not reliable persisted data. Current restore logic mostly ignores them, but the payload still transmits them.

### Migration fragility

`migrateUnifiedState(...)` only checks the version and clones. If runtime diagnostics fields change shape, saved state may still parse but consumers comparing full JSON payloads can see churn.

### Version churn

Adding diagnostics to row-model snapshots can become a persisted-state shape change because `api.state.get()` exports the whole row snapshot.

## 7. Whether Current Architecture Is Acceptable

Functionally acceptable now: yes.

Reasons:

- Restore logic uses semantic fields and ignores most runtime/debug fields.
- `api.diagnostics` is already a separate namespace.
- Existing docs label V1 state as model-centric snapshot transport.
- Tests cover state restore, viewport position opt-in, column `zoneOrder` restore, saved views, and declarative storage persistence.

Enterprise-grade persisted layout model: not yet.

The architecture needs an explicit boundary so future runtime/debug fields do not automatically become persisted/user-layout fields.

## 8. Recommended Boundaries

### Runtime snapshot

Owned by row/column/runtime services. Safe for runtime reads, event payloads, debug panels, and deterministic internal tests.

Allowed fields:

- model kind, row counts, revisions, loading/error states
- viewport demand ranges
- projection diagnostics
- cache/debug details
- performance/memory counters

### Persisted layout state

Owned by `api.state` and saved-view/persistence APIs. Should include only semantic user-restorable state.

Recommended fields:

- version
- row query model: sort, filter, groupBy, groupExpansion, pivot, pagination, aggregation
- column layout: base order, projected zone order, visibility, widths, pins
- selection/rowSelection, if product semantics require persistence
- optional semantic viewport position
- app view mode for app saved views

Not recommended:

- projection diagnostics
- invalidation reasons
- performance timing
- memory counters
- loading/refreshing flags
- runtime error objects
- derived-cache/backpressure counters

### Diagnostics snapshot

Owned by `api.diagnostics`. Safe for support panels, profiling, test assertions, and devtools. Should not be persisted as layout unless a user explicitly exports a diagnostics bundle.

## 9. Recommended Terminology

- runtime snapshot: current model/runtime state, including ephemeral counters and diagnostics.
- persisted layout state: semantic, versioned user-restorable grid state.
- diagnostics snapshot: runtime-health and support/debug payload, not layout state.

## 10. zoneOrder Evaluation

`columns.zoneOrder` is architecturally justified.

Evidence:

- `docs/datagrid-model-contracts.md` defines `order` as stable base/global order and `zoneOrder` as projected layout order.
- `packages/datagrid-core/src/models/columnModel.ts` keeps `order` stable when pinning changes and tracks zone-local order separately.
- `packages/datagrid-core/src/models/__tests__/columnModel.spec.ts` verifies pinning does not mutate base order and that pinned zones can be reordered independently.
- `packages/datagrid-core/src/core/__tests__/gridApi.contract.spec.ts` verifies `api.state.get/set` restores `zoneOrder`.

Assessment:

- It represents projected visual layout correctly.
- It prevents pin/unpin from mutating canonical base order.
- It improves pin/unpin consistency by allowing pinned-zone ordering to remain stable.
- It improves saved layout restoration because pinned-left, center, and pinned-right order can be restored independently.
- It is not unnecessary duplication. It is derived/projection state that has user-layout semantics.

Risk:

- Because it is named like a runtime projection, consumers may confuse it with `columns.order`.
- Persisted docs should explicitly call it `projectedColumnOrder` or document `zoneOrder` as persisted projected layout order.

## 11. order vs Projected Order Evaluation

`columns.order` is correctly acting as canonical/global base order.

Projected visual order is:

1. `zoneOrder.pinnedLeft`
2. `zoneOrder.center`
3. `zoneOrder.pinnedRight`

`visibleColumns` materializes that projected order after visibility filtering.

Current conflation risk is mostly external/API-facing:

- Consumers may read `columns.order` and expect it to match visual order under pinning.
- Consumers may persist only `order` and lose pinned-zone ordering.
- App code correctly includes `zoneOrder` when building column state in `useDataGridAppControlledState.ts`.

No reviewed core code showed `order` being mutated by pin/unpin. Tests explicitly guard against that.

## 12. Suggested Cleanup/Refactor Opportunities

Do not remove fields immediately. Recommended small slices:

1. Add a persisted-state builder that maps row snapshot to a semantic rows-state object.
2. Add a `DataGridPersistedStateV2` or `DataGridLayoutState` type instead of reusing full `DataGridRowModelSnapshot`.
3. Keep V1 migration compatibility by accepting old `rows.snapshot` and pruning ignored diagnostics during migration.
4. Add `api.state.get({ includeRuntimeSnapshot: true })` only if integrators still need full runtime snapshots.
5. Keep `api.diagnostics.getAll()` as the home for projection memory/performance/invalidation state.
6. Update docs to warn that `rows.snapshot.projection` in V1 is legacy/runtime diagnostic data and is not restored.
7. Add a storage-size regression check for persisted state with large projection diagnostics.

## 13. Migration Risk Assessment

Risk level: medium.

Why:

- Existing consumers may persist `DataGridUnifiedState` and compare or replay the full object.
- Removing `rows.snapshot.projection` from V1 would be a public shape change.
- `api.state.set(...)` already ignores most diagnostics, so restore behavior can remain compatible if migration accepts old fields.
- Saved views currently sanitize only `transaction`, so persisted snapshots may already contain projection diagnostics in user storage.

Recommended migration path:

- Keep V1 accepted.
- Introduce a cleaner persisted shape as additive V2 or as a new API.
- Add `state.migrate(...)` pruning only when target version changes.
- Keep `zoneOrder` in persisted state.

## 14. Recommended Tests

- Unit: `api.state.get()` does not include diagnostics in a future persisted-state V2 builder.
- Unit: V1 state containing `rows.snapshot.projection` migrates/restores sort/filter/group/pagination/columns/selection correctly.
- Unit: diagnostics changes do not change persisted-layout output.
- Unit: `transaction` remains sanitized from app saved views.
- Unit: `view.viewportPosition` remains opt-in for core `api.state.get()` and matches app `statePersistence` defaults.
- Unit: `zoneOrder` restores pinned-left/center/pinned-right order without mutating `columns.order`.
- Component: declarative `statePersistence` stores the intended persisted shape and restores before `ready`.
- Component: `update:state` payload does not churn when only projection diagnostics change, once a clean persisted-state output exists.
- Migration: V1 full row snapshot migrates to a pruned persisted layout state.

## 15. Whether Action Is Needed Now or Later

Action is needed, but not as an emergency refactor.

Now:

- Document the boundary and risk.
- Avoid adding more diagnostics to `DataGridUnifiedState` directly.
- Keep `zoneOrder`.

Later:

- Introduce a clean persisted layout/query state shape.
- Add migration/pruning from V1 model-centric state.
- Move projection diagnostics visibility fully behind diagnostics/devtools APIs.

