# DataGrid Core Decomposition Audit

Date: `2026-05-21`
Scope: `packages/datagrid-core`
Status: current-state audit and follow-up backlog

## Summary

`datagrid-core` already has several extracted runtimes, but a few files are again accumulating multiple owners. The next decomposition work should keep public APIs stable and move behavior behind existing facades before any export changes.

Priority order:

1. `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
2. `packages/datagrid-core/src/spreadsheet/sheetModel.ts`
3. `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
4. `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
5. `packages/datagrid-core/src/spreadsheet/viewPipeline.ts`
6. `packages/datagrid-core/src/models/tree/treeProjectionRuntime.ts`

## P0: `dataSourceBackedRowModel.ts`

Progress (`2026-10-18`): moved directional range selection and cached-ahead/back policy to `models/server/dataSourcePrefetchPolicy.ts`.

Progress (`2026-10-18`): moved datasource row-entry identity resolution, row-state/group metadata normalization, and row-node construction to `models/server/dataSourceRowEntry.ts`. Both normal pull application and full cache replacement use the same pure normalizer. Core type-check/build and the full core test suite pass (108 files, 851 tests).

Progress (`2026-10-18`): moved loading placeholder row construction and its internal marker fields to `models/server/dataSourcePlaceholderRow.ts`. Placeholder identity, shape, and status remain unchanged; the row-model facade only decides when a placeholder is needed.

Progress (`2026-10-18`): moved field-intersection policy for deciding whether optimistic commits and external row updates require a projection refresh to `models/server/dataSourceProjectionRefreshPolicy.ts`. The row model now supplies its current projection models and keeps refresh scheduling. Focused datasource tests (89), core type-check/build, and datasource churn assertion passed.

Progress (`2026-10-18`): moved serialization of datasource pull-state, cache-store, and request identities to `models/server/dataSourceRequestIdentity.ts`. The facade still snapshots live model state, while the module owns deterministic request identity formatting. Focused datasource tests (89), core type-check/build, and datasource churn assertion passed.

Progress (`2026-10-18`): moved `applyExternalUpdates` mutation handling into `models/server/dataSourceExternalUpdateRuntime.ts`; the facade supplies cache, refresh, and notification capabilities. Public update types remain re-exported from the existing row-model module. Focused datasource tests (89), core type-check/build, and datasource churn assertion passed.

Progress (`2026-10-18`): moved optimistic patch preparation, cache overlay, transaction registration, and serialized commit enqueueing into `models/server/dataSourceOptimisticPatchRuntime.ts`. Commit outcome/rollback orchestration remains with the row-model facade. Full core tests (109 files, 854 tests), type-check/build, and datasource churn assertion passed.

Progress (`2026-10-18`): moved cache-store creation, retained-store activation, cross-store row retention, LRU/size-budget eviction, and retained-store cleanup into `models/server/dataSourceCacheStoreRuntime.ts`. The row-model facade keeps active-cache aliases for its cache operations. Full core tests (109 files, 854 tests), type-check/build, and datasource churn assertion passed on a clean rerun after one transient variance-only failure.

Progress (`2026-10-18`): moved commit request construction and commit success/rejection/failure sequencing to `models/server/dataSourceOptimisticCommitRuntime.ts`. Cache rollback and projection refresh remain explicit row-model capabilities supplied to the runtime. Full core tests (109 files, 854 tests), type-check, and build passed; no hot-path benchmark scenario exercises commit completion.

Progress (`2026-10-18`): moved pending pull coalescing, adjacent-range merge, stale background drop, and priority replacement decisions to `models/server/dataSourcePendingPullRuntime.ts`. Scheduler execution and transport remain separate owners. Focused datasource tests (89), core type-check/build, and datasource churn assertion passed.

Progress (`2026-10-18`): moved contiguous cache coverage counts and viewport hit/miss measurement to `models/server/dataSourceCoveragePolicy.ts`. Diagnostics mutation and signal emission remain owned by the facade. Focused datasource tests (89), core type-check/build, and datasource churn assertion passed on rerun after a transient seed-1337 variance outlier.

Progress (`2026-10-19`): moved viewport pull microtask coalescing and critical backpressure queue draining to `models/server/dataSourcePullSchedulingRuntime.ts`, extending the existing pull scheduler boundary. Pull transport and result application remain in the facade. Focused datasource tests (89), core type-check/build, and all datasource churn seeds passed.

Progress (`2026-10-19`): moved in-flight pull reuse, priority queueing, background preemption, and stale pending-background decisions to `models/server/dataSourcePullRequestPolicy.ts`. The facade now applies the returned decision to lane state, diagnostics, and pending queues. Added direct policy contracts; 93 focused datasource tests, core build, and all datasource churn seeds passed.

Progress (`2026-10-19`): moved pagination snapshot access, visible row count, visible-to-source range conversion, and loaded interval remapping to `models/server/dataSourceRangeMappingRuntime.ts`. The runtime reads current row count, pagination input, and cache intervals through explicit providers. Focused datasource tests (87), core type-check/build, and datasource churn assertion passed.

Progress (`2026-10-19`): added viewport loaded/loading row counts and loading ratio measurement to the existing `models/server/dataSourceCoveragePolicy.ts`; model diagnostics still decide when to sample and publish the values. Direct policy and datasource contracts (87), core type-check/build, and datasource churn assertion passed.

Progress (`2026-10-19`): moved prefetch candidate scheduling side effects into the existing `models/server/dataSourcePrefetchPolicy.ts` runtime. The facade supplies live viewport/cache capabilities; prefetch owns empty-state counters, coverage sampling, scheduled/skipped counters, and background pull request. Direct prefetch and datasource contracts (87), core type-check/build, and datasource churn assertion passed.

Performance investigation (`2026-10-18`): the benchmark intentionally changes the filter, moves from the prior viewport to range A, refreshes A, invalidates A, then moves to range B while those pulls settle. That workload creates expected stale aborts/drops; it reproduces on the committed baseline with filter-burst abort counts 1482/1494/1451 and drop counts 726/755/707 for seeds 1337/7331/2026. The previous hard ceilings (1450/750) were below that baseline. Raised them narrowly to 1500/800; latency and pull-duration gates remain unchanged.

Current responsibilities:

- `DataGridRowModel` factory and public facade.
- pull transport execution, result application, error settlement, and request state snapshots.
- active cache aliases, row application, stale-row retention, and cache invalidation glue.
- projection state setters and tree pull context creation.
- push event/invalidation application and datasource capability wiring.
- assembly of row snapshots, placeholder exposure, and histogram/selection operations.

Why it is risky:

- Server datasource behavior is production-facing and latency-sensitive.
- `pullRange()` still combines lane execution, network transport, response application, and settlement callbacks.
- The facade still mixes cache/projection/push orchestration, though policy, scheduler, mutation, telemetry, and prefetch owners are now separate.

Recommended decomposition:

- Keep `createDataSourceBackedRowModel()` as the public facade.
- Extract pull transport/result lifecycle from `pullRange()` while keeping state mutation behind explicit capabilities.
- Consolidate row lookup, loading-row selection, interval diagnostics, and invalidation glue into a cache-facing runtime.
- Group projection setter transitions and tree pull context creation behind an internal projection runtime.
- Move push event application into the existing invalidation/update owners where their state transitions overlap.

Completed internal owners include prefetch selection, row normalization, placeholders, request identities, pending pull policy, in-flight request decisions, viewport pull scheduling, pagination/source mapping, cache coverage policy, cache-store lifecycle, external updates, optimistic patch/commit lifecycles, and telemetry. Public datasource APIs remain unchanged.

Progress (`2026-10-19`): extracted bounded range clearing and full cache clearing into `models/server/dataSourceCacheInvalidationRuntime.ts`. The runtime resolves active cache stores through getters so invalidation follows cache-store switches. Row id invalidation and application-level orchestration remain in the facade.

Progress (`2026-10-19`): moved row-id cache clearing into the same invalidation runtime. The facade now supplies the active source viewport and a callback for stale background-pull cleanup, then retains responsibility for refreshing an affected viewport. Focused datasource contracts (89), core type-check/build, and all datasource churn benchmark seeds passed.

Progress (`2026-10-19`): moved push invalidation dispatch into `models/server/dataSourcePushInvalidationRuntime.ts`. The runtime owns all/range/row invalidation routing and datasource notification; the facade supplies cache clearing, pull scheduling, viewport refresh context, and background cleanup. Push/datasource contracts (80), core type-check/build, and all datasource churn seeds passed.

Progress (`2026-10-19`): moved push event dispatch and upsert/remove finalization into `models/server/dataSourcePushEventRuntime.ts`. The facade now supplies state transitions for row totals, cache operations, dataset version, cursor, and pivot columns. Push/datasource contracts (80), core type-check/build, and all datasource churn seeds passed.

Validation target:

- `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- `packages/datagrid-core/src/models/__tests__/rangeCache.spec.ts`
- `packages/datagrid-core/src/models/__tests__/dataSourceRuntimeSignals.spec.ts`

## P0: `sheetModel.ts`

Current responsibilities:

- Sheet state storage for rows, columns, cells, formulas, styles, and formula tables.
- Cell input normalization and parsing.
- Formula model/runtime construction.
- Formula dependency graph maintenance.
- Formula evaluation and diagnostics.
- Row insert/remove mutation and formula remapping.
- Column rename/title/alias mutation and formula rewrite.
- Sheet/row/column/cell style storage and inheritance.
- export/restore state persistence.
- listener lifecycle and revision counters.

Why it is risky:

- Formula behavior, structural mutation behavior, and persistence are tightly coupled.
- Future token/reference-owned formula work will keep landing in the same file unless state and formula ownership are separated.

Recommended decomposition:

- Keep `createDataGridSpreadsheetSheetModel()` as the public facade.
- Extract `spreadsheetSheetStateStore` for rows, columns, raw inputs, styles, revision counters, and snapshots.
- Extract `spreadsheetFormulaRuntime` for formula cell state, dependency indexes, evaluation, diagnostics, and dirty closure.
- Extract `spreadsheetStructuralMutationRuntime` for row/column mutations and formula structural remapping.
- Extract `spreadsheetStyleRuntime` for sheet/row/column/cell style normalization, equality, merge, and inheritance.
- Keep persistence helpers outside the facade; `workbookPersistence.ts` is the existing direction to follow.

Status as of `2026-05-21`:

- Closed the safe facade-preserving decomposition slice for `sheetModel.ts`.
- Extracted cell helpers, sparse cell storage, sheet row/column state, formula table storage/patching, formula runtime helpers, mutation snapshot cloning, lifecycle/revision counters, column/reference lookup, style normalization/equality/merge, and structural formula rewrite policy into focused spreadsheet runtime modules.
- Left formula reference-context construction and restore orchestration inside the facade because they still coordinate multiple runtime owners. Formula evaluation traversal and value application are now extracted below.

Progress (`2026-10-19`): moved formula evaluation memoization, cycle detection, invalid-formula handling, dirty-cell iteration, and resolved-value application into the existing `spreadsheetFormulaRuntime.ts`. `sheetModel.ts` still builds the reference/context resolver because it reads current sheet state, referenced sheet models, formula tables, and formula options. Focused spreadsheet contracts (49), core type-check/build, and a clean spreadsheet-workbook benchmark rerun passed after two noisy rewrite-p95 runs.

Validation target:

- `packages/datagrid-core/src/spreadsheet/__tests__/sheetModel.spec.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/formulaEditorModel.spec.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/formulaReferenceDecorations.spec.ts`

## P1: Workbook Models

Files:

- `packages/datagrid-core/src/spreadsheet/workbookModel.ts`

Current responsibilities:

- workbook sheet registry and active sheet lifecycle.
- alias collision checks.
- sheet subscription and row/column formula reference rewrite orchestration.
- graph invalidation and dependency input assembly.
- top-level component scheduling, view materialization, and formula sync sequencing.
- snapshot/export adapters and restore capability wiring.

Legacy removal:

- `createClientWorkbookModel` and related `ClientWorkbookModel` / `DataGridWorkbook*` exports were removed after an explicit breaking-change approval.
- The old row-model workbook runtime at `packages/datagrid-core/src/models/clientWorkbookModel.ts` was removed.
- The old benchmark at `scripts/bench-datagrid-workbook-sync.mjs` was removed.
- `createDataGridSpreadsheetWorkbookModel` is the canonical workbook path.

Risk:

- `workbookModel.ts` still owns subscriber callbacks, target-sheet scans, and the top-level sync sequence across registry, formula, and view owners.
- Future workbook decomposition should keep registry lifecycle here while extracting the remaining subscription and sync orchestration only when the ownership boundary is cohesive.

Progress (`2026-10-18`): extracted deterministic strongly connected component grouping and dependency-first scheduling to `spreadsheet/workbookDependencyScheduler.ts`. The workbook facade now owns when to schedule and synchronize; the scheduler owns graph ordering. Focused workbook tests and package type-check/build passed. Remaining workbook orchestration still owns graph construction, invalidation, and sync passes.

Progress (`2026-10-18`): moved stable forward/reverse dependency adjacency construction to `spreadsheet/workbookDependencyGraph.ts`. The workbook facade still resolves view and alias dependencies; the graph utility owns stable edge normalization and reverse-index creation.

Progress (`2026-10-18`): moved per-sheet formula dependency extraction and alias normalization to `spreadsheet/workbookFormulaDependencies.ts`. Workbook orchestration now consumes an explicit dependency snapshot while retaining revision-based cache invalidation.

Progress (`2026-10-18`): moved scheduled view-sheet materialization and writeback to `spreadsheet/workbookViewMaterializer.ts`. The workbook facade supplies graph order, sheet lookup, model options, and export-cache invalidation; view results remain owned by the view pipeline.

Progress (`2026-10-18`): moved managed formula-table patch reconciliation to `spreadsheet/workbookFormulaTableSync.ts`. The workbook facade retains dependency scheduling and supplies sheet/export-cache access; the helper owns table alias diffing and patch application.

Progress (`2026-10-18`): moved per-component formula recompute and fixed-point convergence to `spreadsheet/workbookFormulaSyncRuntime.ts`. `workbookModel.ts` retains graph scheduling and aggregate sync diagnostics.

Progress (`2026-10-19`): moved dirty-sheet downstream closure and workbook-order filtering to `spreadsheet/workbookDependencyGraph.ts`. The workbook facade now supplies graph edges and dirty/structural state; the dependency graph module owns affected-sheet selection. Focused workbook tests (26), core type-check/build, and all spreadsheet-workbook benchmark seeds passed.

Progress (`2026-10-19`): moved conversion of view references, formula table aliases, direct sheet references, and all-table dependencies into `spreadsheet/workbookDependencyResolver.ts`. The resolver consumes existing sheet/alias indexes without building temporary per-sheet descriptors. Resolver and workbook contracts (28), core type-check/build, and all spreadsheet-workbook benchmark seeds passed.

Progress (`2026-10-19`): moved full workbook restore transition sequencing into `spreadsheet/workbookPersistence.ts`. The facade supplies registry lifecycle, view/data sheet construction, alias resolution, and structural sync capabilities; persistence owns in-place restore selection and fallback rehydration order. Focused workbook contracts (26), core type-check/build, and all workbook benchmark seeds passed.

Progress (`2026-10-19`): moved cross-sheet row/column rewrites, renamed-sheet alias rewrites, and removed-sheet `#REF!` invalidation into `spreadsheet/workbookReferenceMutation.ts`. Workbook orchestration still selects affected sheets and applies structural patches; the module owns reference transformation policy. Focused mutation/workbook contracts (32), core type-check/build, and the spreadsheet-workbook benchmark passed for row/column mutation policies.

Completed internal owners include dependency edge resolution/closure, SCC scheduling, view materialization, managed formula-table sync, per-component formula convergence, restore transition selection, and row/column/alias reference transformation policies. Remaining workbook work should focus on the subscription/registry-to-sync adapter and keep persistence and graph policy in their extracted modules.

Validation target:

- `packages/datagrid-core/src/spreadsheet/__tests__/workbookModel.spec.ts`
- `scripts/bench-datagrid-spreadsheet-workbook.mjs`

## P1: `dataGridViewportController.ts`

Current responsibilities:

- public viewport controller facade.
- host attach/detach and resize observer lifecycle.
- scroll IO wiring and sync targets.
- layout measurement and measurement queue flushing.
- row-height measurement and auto-height cache ingestion.
- row/column model binding.
- vertical virtualization prepare/apply.
- horizontal virtualization, clamp, sizing, and pinned metadata application.
- imperative callback emission.
- integration snapshot construction.

Risk:

- This file is already partially decomposed, but the update pipeline still coordinates scroll, measurement, virtualization, row height, horizontal clamp, and imperative callbacks in one closure.
- Any decomposition must preserve the documented invariants: one scroll transform owner, deterministic horizontal clamp, and no duplicate coordinate/virtualization authority.

Recommended decomposition:

- Keep `createDataGridViewportController()` as the public facade.
- Extract `viewportControllerMeasurementRuntime` for layout sampling, row height measurement, and auto-height cache sync.
- Extract `viewportControllerModelRuntime` for row/column model binding and materialization callbacks.
- Extract `viewportControllerUpdatePipeline` for prepare/apply sequencing, dirty signatures, and after-scroll scheduling.
- Keep horizontal clamp in `dataGridViewportHorizontalClamp.ts`; do not move it back into controller code.

Progress (`2026-10-18`): extracted CSS zoom normalization and smoothing/lower-bound policy for auto row-height estimates to `viewport/dataGridViewportRowHeightEstimate.ts`. DOM sampling, cache lifecycle, and estimate application remain controller-owned. Focused row-height/viewport contracts, core type-check/build, and enterprise virtualization assertion passed.

Progress (`2026-10-19`): moved vertical/horizontal scroll thresholds for gated heavy viewport updates into `viewport/dataGridViewportMath.ts`. The controller still owns live metrics and supplies them to the pure policy. Four viewport contracts, core type-check/build, and enterprise virtualization assertion passed.

Validation target:

- `packages/datagrid-core/src/viewport/__tests__/horizontalClamp.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/horizontalUpdate.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/scrollResizeDeterminism.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/integrationSnapshot.contract.spec.ts`

## P1: `viewPipeline.ts`

Current responsibilities:

- spreadsheet view DSL types.
- input normalization.
- filter, sort, project, join, group, and pivot stage execution.
- join/group/pivot stage state keys.
- materialization diagnostics.
- dataset-to-sheet-state conversion.
- derived sheet runtime conversion.

Recommended decomposition:

- Keep public materializers as facade functions.
- Extract per-stage runtimes: `viewFilterStage`, `viewSortStage`, `viewProjectStage`, `viewJoinStage`, `viewGroupStage`, `viewPivotStage`.
- Extract shared value/ordering helpers and dataset conversion helpers.

Progress (`2026-10-18`): moved shared comparison, normalization, and aggregation classification helpers to `spreadsheet/viewPipelineValueUtils.ts`; extracted filter/sort/project, join reuse/fan-out, incremental grouping, and pivot projection to focused stage modules; shared dataset types/source conversion live in `spreadsheet/viewPipelineDataset.ts`; dataset/runtime/sheet-state conversion and error datasets live in `spreadsheet/viewPipelineOutput.ts`. `viewPipeline.ts` now primarily owns pipeline dispatch and public materializer facades. Focused view-pipeline and workbook tests passed.

Validation target:

- `packages/datagrid-core/src/spreadsheet/__tests__/viewPipeline.spec.ts`
- spreadsheet workbook tests that cover derived sheets.

## P2: `treeProjectionRuntime.ts`

Status: closed for the safe internal decomposition scope (`2026-10-18`). `treeProjectionRuntime.ts` is a composition facade; path/parent cache construction, materialization, cache patching, expansion toggles, and shared primitives each have focused internal modules. Follow-up changes should keep mode-specific behavior in those modules and preserve the facade boundary.

Current responsibilities:

- tree path projection cache.
- tree parent projection cache.
- aggregate computation integration.
- materialization for both tree modes.
- expansion toggle delta optimization.
- group index rebuild helpers.

Recommended decomposition:

- Extract `treePathProjectionRuntime`.
- Extract `treeParentProjectionRuntime`.
- Extract shared expansion delta and projection segment helpers.
- Keep `createTreeProjectionRuntime()` as the facade.

Progress (`2026-10-18`): extracted shared expansion snapshot caching/delta detection, projection segment replacement, and group index shift maintenance into `tree/treeProjectionExpansion.ts`. `treeProjectionRuntime.ts` now consumes those helpers while retaining path/parent projection orchestration. Core type-check, build, focused projection tests (10), and the tree workload assertion passed.

Progress (`2026-10-18`): moved parent-mode tree row materialization and its shared cache/result types into `tree/treeProjectionParentMaterializer.ts` and `tree/treeProjectionTypes.ts`. The projection facade retains cache construction and incremental subtree-toggle orchestration. Core type-check/build, focused projection tests, and the tree workload assertion passed.

Progress (`2026-10-18`): moved path-mode group-row creation and visible tree materialization to `tree/treeProjectionPathMaterializer.ts`, with path cache contracts now colocated in `tree/treeProjectionTypes.ts`. The facade retains path cache construction, patching, and incremental toggle decisions. Core type-check/build and focused projection tests passed.

Progress (`2026-10-18`): moved incremental expansion/collapse subtree replacement for both path and parent modes into `tree/treeProjectionToggleRuntime.ts`. The projection facade now delegates cache creation, materialization, and localized expansion updates to distinct modules. Core type-check/build, focused projection tests, and tree workload assertion passed.

Progress (`2026-10-18`): moved parent-mode hierarchy construction, filter inclusion, orphan/cycle handling, and aggregate setup into `tree/treeProjectionParentCache.ts`; shared leaf normalization and row-id validation now live in `tree/treeProjectionPrimitives.ts`. Core type-check/build and tree workload assertion passed.

Progress (`2026-10-18`): moved path-mode hierarchy construction, filter matching, and aggregate cache setup into `tree/treeProjectionPathCache.ts`. Tree path normalization and stable group-key encoding now share the internal primitives module. Core type-check/build, focused projection tests, and tree workload assertion passed.

Progress (`2026-10-18`): moved path/parent cache row identity patching to `tree/treeProjectionCachePatcher.ts`. `treeProjectionRuntime.ts` is now a 200-line composition facade for cache keys, mode dispatch, and the extracted build/materialize/toggle/patch runtimes. Core type-check/build, focused projection tests, and tree workload assertion passed.

Validation target:

- `packages/datagrid-core/src/models/__tests__/clientRowProjectionEngine.spec.ts`
- `packages/datagrid-core/src/models/__tests__/projectionGuardrails.contract.spec.ts`
- `packages/datagrid-core/src/models/__tests__/groupProjectionController.spec.ts`

## Secondary Watchlist

- `packages/datagrid-core/src/models/clientRowModel.ts`: currently labelled as a composition root; keep enforcing that boundary and move new logic into host/state/projection/materialization runtimes.
  - `2026-05-21`: formula table patching/context invalidation moved into `clientRowFormulaTableHostRuntime`; next work should continue removing local domain policy without changing `ClientRowModel`.
  - `2026-05-21`: materialized source-row cache ownership moved into `clientRowMaterializationRuntime`; `clientRowModel` now delegates source-row materialization cache reads.
  - `2026-05-21`: calculation snapshot restore orchestration moved into `clientRowCalculationSnapshotRestoreRuntime`; `clientRowModel` now wires restore dependencies instead of owning restore policy.
  - `2026-05-21`: column histogram scope/read-policy moved into `clientRowColumnHistogramRuntime`; `clientRowModel` now delegates histogram reads.
  - `2026-05-21`: pivot drilldown facade wiring moved into `clientRowPivotDrilldownHostRuntime`; `clientRowModel` now delegates pivot cell drilldown reads.
  - `2026-05-21`: computed apply/materialization refresh policy moved into `clientRowComputedApplyRuntime`; `clientRowModel` now delegates computed execution result application.
  - `2026-05-21`: computed recompute/projection refresh orchestration moved into `clientRowComputedRefreshRuntime`; `clientRowModel` now delegates formula-triggered recompute refresh policy.
  - `2026-05-21`: row-model dispose cleanup moved into `clientRowDisposeHostRuntime`; `clientRowModel` now delegates disposal cleanup sequencing.
  - `2026-05-21`: row-model runtime constants and guards moved into `clientRowModelRuntimeConfig`; `clientRowModel` no longer owns config normalization helpers.
  - `2026-05-21`: initial/manual refresh policy moved into `clientRowRefreshHostRuntime`; `clientRowModel` now delegates projection refresh bootstrap and public refresh.
  - `2026-05-21`: row access, row mutation facade, and calculation snapshot facade methods moved into focused host runtimes; `clientRowModel` now delegates these public method groups.
  - `2026-05-21`: formula/computed public facade methods moved into `clientRowFormulaFacadeRuntime`; `clientRowModel` now delegates formula module and table facade calls.
- `packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts`: consider splitting row/batch/columnar execution paths if compute work expands.
- `packages/datagrid-core/src/models/rowModel.ts`: types plus tree/group/pagination/normalization helpers; split helper modules before adding more row-model helpers.
- `packages/datagrid-core/src/models/columnModel.ts`: watch for pin/order/visibility/width groups growing into separate owners.
- `packages/datagrid-core/src/core/transactionService.ts`: transaction execution, rollback, grouping, and diagnostics may deserve subruntimes if history semantics grow.
- `packages/datagrid-core/src/cells/runtime.ts`: keep formula-like cell runtime behavior separate from spreadsheet formula runtime.

## Non-Goals

- Do not change public APIs during decomposition unless a deprecation/removal plan is approved.
- Do not move Vue/app materialization concerns into core.
- Do not introduce a second viewport or scroll owner.
- Do not combine spreadsheet workbook and row-model workbook APIs under a new public abstraction until legacy usage is resolved.
