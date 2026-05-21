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

Current responsibilities:

- `DataGridRowModel` facade.
- datasource pull execution and source-range conversion.
- pull scheduler coordination.
- range/row cache reads and invalidation.
- viewport loading rows and sparse diagnostics.
- velocity-aware overscan and prefetch selection.
- backpressure pause/resume/flush behavior.
- push invalidation and external row updates.
- optimistic patch transaction lifecycle.
- telemetry and placeholder exposure diagnostics.
- datasource column histogram normalization.

Why it is risky:

- Server datasource behavior is production-facing and latency-sensitive.
- Cache, transport, invalidation, optimistic mutation, and diagnostics now change in one file.
- The file imports extracted server helpers, but still owns orchestration policy around all of them.

Recommended decomposition:

- Keep `createDataSourceBackedRowModel()` as the public facade.
- Extract `dataSourceBackedRowModelCacheFacade` for row lookup, loading rows, interval diagnostics, and cache invalidation glue.
- Extract `dataSourceBackedRowModelPullRuntime` for `pullRange`, pull coalescing, pending viewport pulls, and scheduler interaction.
- Extract `dataSourceBackedRowModelPrefetchRuntime` for trigger/window/direction decisions.
- Extract `dataSourceBackedRowModelMutationRuntime` for optimistic `patchRows()` and `applyExternalUpdates()`.
- Extract `dataSourceBackedRowModelProjectionRuntime` for sort/filter/group/pivot/pagination state changes and tree pull context creation.

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
- Extracted cell helpers, sparse cell storage, formula table key helpers, mutation snapshot cloning, column/reference lookup, and style normalization/equality/merge into focused spreadsheet runtime modules.
- Left formula dependency/evaluation and row/column structural rewrite policy inside the facade for now because those paths are tightly coupled to current closure state and should move only with a behavior-touching slice.

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
- dependency graph construction.
- strongly connected component scheduling.
- formula table sync passes.
- sheet subscription and sync invalidation.
- snapshot/export state.

Legacy removal:

- `createClientWorkbookModel` and related `ClientWorkbookModel` / `DataGridWorkbook*` exports were removed after an explicit breaking-change approval.
- The old row-model workbook runtime at `packages/datagrid-core/src/models/clientWorkbookModel.ts` was removed.
- The old benchmark at `scripts/bench-datagrid-workbook-sync.mjs` was removed.
- `createDataGridSpreadsheetWorkbookModel` is the canonical workbook path.

Risk:

- `workbookModel.ts` remains the current spreadsheet workbook runtime and still owns graph/sync scheduling inline.
- Future workbook decomposition should extract shared graph/scheduler helpers from this runtime instead of reintroducing a row-model workbook API.

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

Validation target:

- `packages/datagrid-core/src/spreadsheet/__tests__/viewPipeline.spec.ts`
- spreadsheet workbook tests that cover derived sheets.

## P2: `treeProjectionRuntime.ts`

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
