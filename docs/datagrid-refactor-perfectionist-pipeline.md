# DataGrid Perfectionist Refactor Pipeline

Goal: reduce architectural entropy in DataGrid core by splitting oversized files into cohesive runtime modules with explicit ownership boundaries.

## Current baseline

- Large files still exist (`clientRowModel.ts`, `pivotRuntime.ts`, `treeProjectionRuntime.ts`, pull/server-backed row models).
- Responsibility overlap exists across orchestration, normalization, cache snapshots, and projection identity preservation.

## Phase 1: Shared low-level primitives

- [x] Extract pivot projection sorting/identity helpers from client row model into a dedicated module.
  - File: `packages/datagrid-core/src/models/clientRowPivotProjectionUtils.ts`
- [x] Extract pull/server-backed serialization and model compare helpers into shared module.
  - File: `packages/datagrid-core/src/models/pullRowModelSerialization.ts`
- [x] Rewire `dataSourceBackedRowModel.ts` to shared pull serialization helpers.
- [x] Rewire `serverBackedRowModel.ts` to shared pull serialization helpers.

## Phase 2: Runtime decomposition (next)

- [x] Split `clientRowModel.ts` into orchestration + stage handlers.
- [x] Move stage handler implementation blocks into dedicated modules:
  - [x] `clientRowProjectionBasicStages.ts` (`filter`, `sort`, `paginate`, `visible`)
  - [x] `clientRowProjectionPivotStage.ts` (`pivot`)
  - [x] `clientRowProjectionGroupStage.ts` (`group`)
  - [x] `clientRowProjectionAggregateStage.ts` (`aggregate`)
- [~] Keep only high-level orchestration and API wiring in `clientRowModel.ts`.
  - [x] Extract pivot cell drilldown resolver runtime from row model.
    - File: `packages/datagrid-core/src/models/clientRowPivotDrilldownRuntime.ts`
  - [x] Extract group/pivot/tree expansion state resolver + apply runtime.
    - File: `packages/datagrid-core/src/models/clientRowExpansionRuntime.ts`
  - [x] Extract patchRows update/apply/projection-plan runtime.
    - File: `packages/datagrid-core/src/models/clientRowPatchRuntime.ts`
  - [x] Extract patchRows orchestration coordinator runtime (`patchRows` API method delegation).
    - File: `packages/datagrid-core/src/models/clientRowPatchCoordinatorRuntime.ts`
  - [x] Extract row-state mutator runtime (`set*Model`, pagination, viewport, group expansion commands).
    - File: `packages/datagrid-core/src/models/clientRowStateMutationsRuntime.ts`
  - [x] Extract snapshot + projection diagnostics runtime.
    - File: `packages/datagrid-core/src/models/clientRowSnapshotRuntime.ts`
  - [x] Extract source-row mutation runtime (`setRows`, `reorderRows`).
    - File: `packages/datagrid-core/src/models/clientRowRowsMutationsRuntime.ts`
  - [x] Extract projection stage-handlers runtime (`run*Stage`, `finalizeProjectionRecompute`, handlers assembly).
    - File: `packages/datagrid-core/src/models/clientRowProjectionHandlersRuntime.ts`
  - [x] Move pivot patch dependency collectors (axis/value fields) into patch analyzer.
    - File: `packages/datagrid-core/src/models/rowPatchAnalyzer.ts`

## Phase 2.1: Core API decomposition

- [x] Extract cell refresh batching/registry from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiCellRefresh.ts`
- [x] Extract pivot layout/interop import-export helpers from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiPivotLayout.ts`
- [x] Extract selection summary calculation from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiSelectionSummary.ts`
- [x] Extract namespace assembly (`flat -> namespaced`) from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiNamespaces.ts`
- [x] Extract row-domain method factory from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiRowsMethods.ts`
- [x] Extract view-domain method factory from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiViewMethods.ts`
- [x] Extract transaction-domain method factory from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiTransactionMethods.ts`
- [x] Extract selection-domain method factory from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiSelectionMethods.ts`
- [x] Extract pivot-domain method factory from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiPivotMethods.ts`
- [x] Extract columns-domain method factory from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiColumnsMethods.ts`
- [x] Extract API dependency resolution and option contracts from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiDependencies.ts`
- [x] Extract runtime capability resolver/caching from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiCapabilitiesRuntime.ts`
- [x] Extract public API contract/types from `core/gridApi.ts`.
  - File: `packages/datagrid-core/src/core/gridApiContracts.ts`
- [~] Keep `core/gridApi.ts` as orchestration façade over capabilities and helper modules.

## Phase 2.2: Viewport controller decomposition

- [x] Extract column projection snapshot application from `viewport/dataGridViewportController.ts`.
  - File: `packages/datagrid-core/src/viewport/dataGridViewportColumnProjection.ts`
- [x] Extract imperative emit/signature guards from viewport controller.
  - File: `packages/datagrid-core/src/viewport/dataGridViewportImperative.ts`
- [ ] Extract auto row-height ingest/estimate state-machine from viewport controller.
- [~] Keep `dataGridViewportController.ts` as orchestration shell for scheduling + integration only.

## Phase 2.3: Public API surface modularization

- [x] Add namespaced API aliases for high-churn domains:
  - `api.pivot.*`
  - `api.selection.*`
  - `api.transaction.*`
- [x] Add namespaced API aliases for core runtime domains:
  - `api.rows.*`
  - `api.columns.*`
  - `api.view.*`
- [x] Remove flat methods from `DataGridApi` surface after namespace migration.
- [x] Keep flat usage gate with zero baseline:
  - `scripts/check-datagrid-flat-api-usage.mjs`
  - `docs/quality/datagrid-flat-api-baseline.json`
- [x] Harden GridApi namespace runtime contract:
  - lazy capability cache in `createDataGridApi(...)`
  - `api.capabilities` readonly flags for UI feature gating
  - explicit namespace-only API wiring (no flat spread on returned `DataGridApi`)

## Phase 3: Pull/Server model parity cleanup

- [ ] Extract shared snapshot builder for pull/server-backed row models.
- [ ] Extract shared group expansion/pagination state mutators.
- [ ] Extract shared viewport cache invalidation helpers.
- [ ] Preserve explicit differences only (push events, datasource pull queue, source warmup semantics).

## Phase 4: File-size and ownership gates

- [ ] Add architecture gate for max file size and forbidden responsibility overlap.
- [ ] Add static check for duplicate helper bodies across row model modules.
- [ ] Add CI check ensuring new utility modules are reused instead of reintroduced duplicates.

## Acceptance criteria

- `clientRowModel.ts` reduced to orchestration shell with stage dispatch and minimal policy wiring.
- No duplicated serialization/compare helpers between pull/server-backed models.
- Pivot/tree projection identity logic fully isolated from orchestrator-level code.
- Architecture checks fail when duplication or oversized ownership violations are reintroduced.
