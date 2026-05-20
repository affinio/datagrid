# Formula Engine Enterprise Implementation Plan

This plan converts `docs/audits/FORMULA_ENGINE_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The existing formula architecture remains the baseline: `datagrid-formula-engine` owns parsing, compilation, function definitions, and graph helpers; `datagrid-core` owns row-model and spreadsheet/workbook formula execution; `datagrid-worker` mirrors worker-owned row-model formula state; Vue/app packages own user-facing editing, diagnostics, and virtualization behavior.

Current execution state:

- Plan created on 2026-05-20.
- Formula enterprise slices 1-9, 11-12 are implemented with focused runtime/docs/tests/gates as of 2026-05-20.
- Slice 10 remains a browser E2E gate follow-up because no Formula-specific Playwright scenario was added in this code slice.
- Slice 13 is documented as an approval-ready contract proposal; public async/volatile/server formula APIs are intentionally not implemented yet.
- The target is to raise Formula readiness from the audited `7.5/10` toward `9/10` without replacing the existing parser/compiler/runtime boundaries.
- Async formulas, automatic volatile invalidation, and server-backed formula execution require explicit public contracts before implementation.
- Formula editing boundary work in the Editing track is already closed; this plan focuses on formula runtime, workbook correctness, server/async/volatile semantics, diagnostics, performance gates, and UI validation.
- Do not change formula syntax, public function definition APIs, or server datasource protocols until the relevant slice includes an approved contract.

## Slice 1: Formula Surface Contract

- Status: Completed.
- Objective: document supported formula surfaces and limitations separately for row-model formulas, spreadsheet/workbook formulas, enterprise formula packs, worker-owned row models, and server-backed grids.
- Affected packages/files:
  - `docs/datagrid-formula-engine-guide.md`
  - `docs/datagrid-formula-engine-community-vs-enterprise.md`
  - `docs/audits/FORMULA_ENGINE_ENTERPRISE_AUDIT.md`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: no runtime behavior change; users get a clear contract for supported syntax, row-model guarantees, workbook guarantees, unsupported async formulas, explicit-recompute volatile behavior, and unsupported server-backed formula evaluation.
- Tests to add/update:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): define enterprise formula contract`

## Slice 2: Unsupported Async And Volatile Invariants

- Status: Completed.
- Objective: make unsupported async formulas and automatic volatile invalidation deterministic and test-covered instead of relying only on documentation.
- Affected packages/files:
  - `packages/datagrid-formula-engine/src/syntax/types.ts`
  - `packages/datagrid-formula-engine/src/runtime/compile.ts`
  - `packages/datagrid-formula-engine/src/syntax/functionGroups/dateFunctions.ts`
  - Formula engine and core formula tests
- Expected behavior change: promise-returning formula functions are rejected or surfaced as clear unsupported errors; volatile functions such as `TODAY()` remain explicit-recompute only until a scheduler contract is approved.
- Tests to add/update:
  - Async function registration/evaluation fails with a stable error.
  - Volatile date/time functions do not imply automatic timer invalidation.
  - Explicit recompute still updates volatile values.
- Validation command: `pnpm exec vitest run packages/datagrid-formula-engine/src/__tests__ packages/datagrid-core/src/models/__tests__/formulaEngine.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(formula): lock async and volatile boundaries`

## Slice 3: Formula Table Revision Contract

- Status: Completed.
- Objective: harden formula table invalidation by requiring immutable source updates or explicit revision changes for external table sources.
- Affected packages/files:
  - `packages/datagrid-core/src/models/compute/*`
  - `packages/datagrid-core/src/spreadsheet/*`
  - `docs/datagrid-formula-engine-guide.md`
  - Row-model and workbook formula table tests
- Expected behavior change: formula table updates become deterministic under host-provided revision/identity changes; in-place mutation without revision is documented and tested as unsupported.
- Tests to add/update:
  - Row-model formula table dependencies recompute on source replacement/revision change.
  - Spreadsheet/workbook formula table dependencies recompute on table patch.
  - In-place source mutation without revision does not silently claim supported behavior.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/models/__tests__/formulaEngine.spec.ts packages/datagrid-core/src/spreadsheet/__tests__/workbookModel.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-core): harden formula table invalidation`

## Slice 4: Row-Model Formula Worker Parity

- Status: Completed.
- Objective: keep row-model formula registration, execution plans, cycles, diagnostics, and recompute results equivalent between main-thread and worker-owned row models.
- Affected packages/files:
  - `packages/datagrid-worker/src/workerOwnedRowModel.ts`
  - `packages/datagrid-worker/src/__tests__/workerOwnedRowModel.spec.ts`
  - `packages/datagrid-worker/src/__tests__/workerParity.spec.ts`
  - `packages/datagrid-core/src/models/compute/*`
- Expected behavior change: no intended behavior change; worker-owned formulas gain stronger parity coverage and diagnostics regression protection.
- Tests to add/update:
  - Formula field registration parity.
  - Execution-plan snapshot parity.
  - Cycle policy parity.
  - Incremental patch recompute parity.
- Validation command: `pnpm --filter @affino/datagrid-worker exec vitest run --config vitest.config.ts src/__tests__/workerOwnedRowModel.spec.ts src/__tests__/workerParity.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid-worker): cover formula parity`

## Slice 5: Large DAG And Row-Aware Formula Gates

- Status: Completed.
- Objective: enforce enterprise budgets for dense formula DAGs, row-aware formulas, incremental recompute, and memory delta.
- Affected packages/files:
  - `scripts/bench-datagrid-formula-engine.mjs`
  - `scripts/bench-datagrid-formula-relations.mjs`
  - `scripts/bench-datagrid-formula-engine-worker.mjs`
  - `scripts/check-datagrid-perf-contracts.mjs`
  - `package.json`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: no runtime behavior change; formula benchmark assert scripts fail on graph build, dirty propagation, full recompute, patch recompute, row-aware formula, worker parity, and memory regressions.
- Tests to add/update:
  - 10k/100k/1M row-aware formula benchmark profiles where feasible.
  - Dense DAG build/recompute budgets.
  - Worker-owned versus main-thread formula recompute budgets.
- Validation command: `pnpm run quality:perf:datagrid`
- Risk level: Medium
- Suggested commit message: `test(formula): gate large dag workloads`

## Slice 6: Formula Cache And Churn Hardening

- Status: Completed.
- Objective: prevent unbounded memory growth under formula registration/removal churn and repeated spreadsheet formula analysis.
- Affected packages/files:
  - `packages/datagrid-formula-engine/src/runtime/*`
  - `packages/datagrid-core/src/models/compute/*`
  - `packages/datagrid-core/src/spreadsheet/*`
  - Formula and spreadsheet benchmark scripts
- Expected behavior change: compile artifacts, source column cache diagnostics, workbook formula analysis/template caches, and table lookup indexes expose bounded size or clear policies.
- Tests to add/update:
  - High-churn formula register/remove tests.
  - Cache size diagnostics tests.
  - Memory budget benchmark coverage.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/models/__tests__/formulaEngine.spec.ts packages/datagrid-core/src/spreadsheet/__tests__ && pnpm run bench:datagrid:formula-engine:assert`
- Risk level: High
- Suggested commit message: `perf(formula): bound formula cache churn`

## Slice 7: Workbook Cross-Sheet Invalidation

- Status: Completed.
- Objective: harden workbook formula correctness across same-sheet refs, direct cross-sheet refs, table dependencies, derived sheets, row/column structural changes, and sheet rename rewrites.
- Affected packages/files:
  - `packages/datagrid-core/src/spreadsheet/sheetModel.ts`
  - `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
  - `packages/datagrid-core/src/spreadsheet/derivedSheetRuntime.ts`
  - `packages/datagrid-core/src/spreadsheet/__tests__/workbookModel.spec.ts`
  - `docs/datagrid-formula-engine-guide.md`
- Expected behavior change: cross-sheet workbook formula invalidation becomes more explicit and test-covered; unsupported direct references into unstable derived views surface clear diagnostics.
- Tests to add/update:
  - Cross-sheet direct reference recompute after source row/column edits.
  - Formula table update recomputes visible and non-visible dependent cells.
  - Derived-view unstable direct refs produce stable diagnostics.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/spreadsheet/__tests__/workbookModel.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-core): harden workbook formula invalidation`

## Slice 8: Workbook Scheduler Telemetry And Scale Policy

- Status: Completed.
- Objective: decide whether workbook formulas need a global cell-level dependency index now or a documented scale policy plus telemetry-backed limits.
- Affected packages/files:
  - `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
  - `scripts/bench-datagrid-spreadsheet-workbook.mjs`
  - `scripts/bench-datagrid-workbook-sync.mjs`
  - `docs/datagrid-formula-engine-guide.md`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: workbook sync exposes pass count, convergence status, affected sheet/component count, and per-sheet recompute timing; large workbook support limits are documented unless a global DAG implementation is approved.
- Tests to add/update:
  - Sync pass count and convergence diagnostics tests.
  - Workbook benchmark gates for many sheets, cross-sheet refs, derived views, and cyclic components.
- Validation command: `pnpm run bench:datagrid:spreadsheet-workbook:assert`
- Risk level: High
- Suggested commit message: `perf(datagrid-core): add workbook formula telemetry`

## Slice 9: Formula Diagnostics Cost Controls

- Status: Completed.
- Objective: keep graph/runtime diagnostics useful without turning large formula workloads into broad recompute or memory pressure paths.
- Affected packages/files:
  - `packages/datagrid-core/src/models/compute/*`
  - `packages/datagrid-formula-engine/src/graph/*`
  - `packages/datagrid-vue-app-enterprise/src/dataGridFormulaRuntime.ts`
  - Formula benchmark scripts
- Expected behavior change: diagnostics have production-safe defaults, bounded row-level cause capture, and measurable enabled-versus-disabled overhead.
- Tests to add/update:
  - Diagnostics enabled/disabled overhead benchmarks.
  - Row-level cause capture budget tests.
  - Graph snapshot edge-domain coverage.
- Validation command: `pnpm run bench:datagrid:formula-engine:assert`
- Risk level: Medium
- Suggested commit message: `perf(formula): bound diagnostics overhead`

## Slice 10: Formula UI Virtualization E2E

- Status: Follow-up.
- Objective: prove spreadsheet formula editing, reference decorations, diagnostics, focus, and displayed results survive row/column virtualization, pinned panes, resize, and sheet switches.
- Affected packages/files:
  - `packages/datagrid-spreadsheet-vue-app/src/DataGridSpreadsheetWorkbookApp.vue`
  - `packages/datagrid-core/src/spreadsheet/formulaEditorModel.ts`
  - `e2e/*`
  - `docs/audits/FORMULA_ENGINE_ENTERPRISE_AUDIT.md`
- Expected behavior change: no intended formula engine change; UI continuity for formula editing and reference overlays becomes a release-level validation gate.
- Tests to add/update:
  - Edit formula, scroll out/in, commit/cancel, verify value and focus.
  - Cross-sheet reference decoration remains anchored after scroll/resize/sheet switch.
  - Formula table update recomputes offscreen and visible dependents.
- Validation command: focused Playwright formula workbook scenarios plus package type-check.
- Risk level: High
- Suggested commit message: `test(spreadsheet): cover formula virtualization`

## Slice 11: Formula History Replay

- Status: Completed.
- Objective: validate undo/redo across formula edits, formula table updates, cross-sheet rewrites, derived-sheet recomputation, and virtualization remount.
- Affected packages/files:
  - `packages/datagrid-spreadsheet-vue-app/src/useDataGridSpreadsheetWorkbookHistory.ts`
  - `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
  - Spreadsheet/workbook tests
  - E2E formula workbook scenarios
- Expected behavior change: workbook history replay keeps formula results, diagnostics, references, and derived views consistent after undo/redo.
- Tests to add/update:
  - Undo/redo formula edit after virtual remount.
  - Undo/redo sheet rename/reference rewrite.
  - Undo/redo formula table update and derived view recompute.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/spreadsheet/__tests__/workbookModel.spec.ts packages/datagrid-core/src/spreadsheet/__tests__/formulaEditorModel.spec.ts`
- Risk level: High
- Suggested commit message: `test(spreadsheet): validate formula history replay`

## Slice 12: Enterprise Formula Wrapper Coverage

- Status: Completed.
- Objective: verify enterprise formula packs, runtime config, worker runtime, diagnostics, and `formulaHeavy` performance presets compose without changing community formula semantics.
- Affected packages/files:
  - `packages/datagrid-formula-engine-enterprise/src/index.ts`
  - `packages/datagrid-formula-engine-enterprise/src/formulaPacks.ts`
  - `packages/datagrid-vue-app-enterprise/src/DataGrid.ts`
  - `packages/datagrid-vue-app-enterprise/src/dataGridFormulaRuntime.ts`
  - `packages/datagrid-vue-app-enterprise/src/__tests__/DataGrid.contract.spec.ts`
- Expected behavior change: enterprise wrapper behavior becomes contract-covered; community formula engine output remains unchanged under enterprise packs/config.
- Tests to add/update:
  - Formula pack registration and conflict behavior.
  - Worker runtime config wiring.
  - Formula-heavy performance preset wiring.
  - Diagnostics display does not trigger broad recompute.
- Validation command: `pnpm --filter @affino/datagrid-vue-app-enterprise exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid-enterprise): cover formula runtime wiring`

## Slice 13: Async, Volatile, And Server Formula Contract Proposal

- Status: Proposal completed; implementation pending API/protocol approval.
- Objective: propose the public contracts needed for async formulas, automatic volatile invalidation, and server-backed formula evaluation before implementation.
- Affected packages/files:
  - `docs/datagrid-formula-engine-guide.md`
  - `docs/server-datasource/*`
  - `docs/datagrid-data-source-protocol.md`
  - `docs/audits/FORMULA_ENGINE_ENTERPRISE_AUDIT.md`
- Expected behavior change: no runtime behavior change; this slice produces an approval-ready API/protocol proposal.
- Tests to add/update:
  - None until the proposal is approved.
- Validation command: docs validation.
- Risk level: High
- Suggested commit message: `docs(formula): propose async volatile server contracts`

## Recommended Execution Order

1. Slice 1: Formula Surface Contract
2. Slice 2: Unsupported Async And Volatile Invariants
3. Slice 3: Formula Table Revision Contract
4. Slice 4: Row-Model Formula Worker Parity
5. Slice 5: Large DAG And Row-Aware Formula Gates
6. Slice 6: Formula Cache And Churn Hardening
7. Slice 7: Workbook Cross-Sheet Invalidation
8. Slice 8: Workbook Scheduler Telemetry And Scale Policy
9. Slice 9: Formula Diagnostics Cost Controls
10. Slice 10: Formula UI Virtualization E2E
11. Slice 11: Formula History Replay
12. Slice 12: Enterprise Formula Wrapper Coverage
13. Slice 13: Async, Volatile, And Server Formula Contract Proposal

## Execution Notes

- Keep row-model and spreadsheet guarantees explicit; they share parser/compiler infrastructure but do not share one scheduler today.
- Treat async formulas, volatile automatic invalidation, and server-backed formulas as unsupported until the contract proposal is approved.
- Prefer tests and benchmark gates before optimizing formula runtime internals.
- Do not weaken deterministic parser/compiler behavior for Excel compatibility unless A1 syntax becomes an approved product goal.
- Keep worker-owned formula behavior parity-focused: the worker path should improve main-thread pressure without changing formula results.
- When a slice changes runtime behavior, update this plan and `docs/audits/FORMULA_ENGINE_ENTERPRISE_AUDIT.md` with status, validation, risks, and remaining work.
