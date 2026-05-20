# Formula Engine Enterprise Audit

## Executive summary

The DataGrid formula stack is already a strong client-side formula runtime. The row-model path has deterministic parsing, dependency-token compilation, execution-plan snapshots, cycle detection, incremental dirty propagation, batch/columnar execution paths, worker-owned execution integration, and benchmark gates. The spreadsheet workbook path also has useful sheet-local formula dependency tracking, cross-sheet references, reference rewriting, derived-sheet materialization, workbook-level dependency scheduling, diagnostics, and snapshot-based undo/redo integration.

It is not yet enterprise spreadsheet grade in the Excel or Google Sheets sense. The main gaps are explicit product boundaries rather than obvious implementation defects: async formulas are unsupported, volatile formulas such as `TODAY()` have no automatic invalidation policy, server-backed formulas have no defined contract, and workbook formulas do not use one global cell-level dependency graph across sheets. The current architecture should be extended in place, not replaced.

Current enterprise readiness score: **7.5/10**.

Target score: **9/10** after async/volatile/server-backed contracts, global workbook invalidation hardening, large-DAG gates, and UI/runtime continuity tests are in place.

Implementation update, 2026-05-20:

- Unsupported async formula functions now fail deterministically in the synchronous runtime instead of being normalized as ordinary values.
- Volatile date helpers remain explicit-recompute only and are covered as an invariant.
- Formula-table invalidation is documented and tested as identity/revision based for row-model and workbook surfaces.
- Worker formula parity, enterprise wrapper composition, workbook sync telemetry, and formula benchmark gate wiring have targeted regression coverage.
- Async formulas, automatic volatile scheduling, server-backed formula protocols, and browser E2E formula virtualization remain contract/proposal work, not shipped behavior.

## Current architecture summary

- Formula language and compile API live in `packages/datagrid-formula-engine`.
- Row-model formulas are integrated in `packages/datagrid-core/src/models/formula` and `packages/datagrid-core/src/models/compute`.
- Spreadsheet formulas live in `packages/datagrid-core/src/spreadsheet` and reuse the same formula parser/compiler, but have their own sheet/workbook scheduler.
- Worker-owned compute integration lives in `packages/datagrid-worker` and mirrors formula registration, execution plans, and diagnostics.
- Enterprise package boundaries are additive. `packages/datagrid-formula-engine-enterprise/src/index.ts` re-exports the community formula engine, exposes formula packs, and defines runtime config flags such as `computeMode` and `formulaColumnCacheMaxColumns`.
- The Vue enterprise wrapper wires formula runtime, formula packs, diagnostics, and performance presets through `packages/datagrid-vue-app-enterprise`.

The row-model formula runtime is graph-first: formulas compile to nodes, `createDataGridFormulaExecutionPlan` builds topological levels and strongly connected components, then dirty propagation executes only affected row/node pairs when patches or context invalidations occur.

The spreadsheet runtime is sheet/workbook-first: each sheet tracks formula cells and same-sheet dependents, while the workbook tracks sheet/view/table dependencies and runs affected sheets/components in dependency order with pass-based convergence for multi-sheet or cyclic components.

## Files reviewed

Docs:

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/datagrid-formula-engine-guide.md`
- `docs/datagrid-formula-engine-community-vs-enterprise.md`
- `docs/perf/benchmarks-formula-engine.md`
- `docs/perf/datagrid-performance-gates.md`

Formula engine package:

- `packages/datagrid-formula-engine/src/graph/executionPlan.ts`
- `packages/datagrid-formula-engine/src/runtime/compile.ts`
- `packages/datagrid-formula-engine/src/runtime/types.ts`
- `packages/datagrid-formula-engine/src/syntax/parser.ts`
- `packages/datagrid-formula-engine/src/syntax/tokenizer.ts`
- `packages/datagrid-formula-engine/src/syntax/types.ts`
- `packages/datagrid-formula-engine/src/syntax/functions.ts`
- `packages/datagrid-formula-engine/src/syntax/functionGroups/dateFunctions.ts`
- `packages/datagrid-formula-engine/src/syntax/functionHelpers.ts`
- `packages/datagrid-formula-engine/src/__tests__/evaluatorParity.spec.ts`

Core row-model formula runtime:

- `packages/datagrid-core/src/models/formula/formulaEngine.ts`
- `packages/datagrid-core/src/models/formula/formulaExecutionPlan.ts`
- `packages/datagrid-core/src/models/compute/clientRowComputedRegistryRuntime.ts`
- `packages/datagrid-core/src/models/compute/clientRowComputedRegistryExecutionPlanRuntime.ts`
- `packages/datagrid-core/src/models/compute/clientRowComputedRegistryFormulaCompilationRuntime.ts`
- `packages/datagrid-core/src/models/compute/clientRowComputedExecutionRuntime.ts`
- `packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts`
- `packages/datagrid-core/src/models/compute/clientRowComputedExecutionDirtyPropagationRuntime.ts`
- `packages/datagrid-core/src/models/__tests__/formulaEngine.spec.ts`
- `packages/datagrid-core/src/models/__tests__/formulaExecutionPlan.spec.ts`
- `packages/datagrid-core/src/models/__tests__/clientRowModel.spec.ts`

Spreadsheet/workbook runtime:

- `packages/datagrid-core/src/spreadsheet/sheetModel.ts`
- `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
- `packages/datagrid-core/src/spreadsheet/derivedSheetRuntime.ts`
- `packages/datagrid-core/src/spreadsheet/derivedSheetModel.ts`
- `packages/datagrid-core/src/spreadsheet/viewPipeline.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/sheetModel.spec.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/workbookModel.spec.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/formulaEditorModel.spec.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/formulaReferenceDecorations.spec.ts`

Vue, worker, enterprise, and benchmarks:

- `packages/datagrid-spreadsheet-vue-app/src/DataGridSpreadsheetWorkbookApp.vue`
- `packages/datagrid-spreadsheet-vue-app/src/useDataGridSpreadsheetWorkbookHistory.ts`
- `packages/datagrid-worker/src/workerOwnedRowModel.ts`
- `packages/datagrid-worker/src/__tests__/workerOwnedRowModel.spec.ts`
- `packages/datagrid-worker/src/__tests__/workerParity.spec.ts`
- `packages/datagrid-formula-engine-enterprise/src/index.ts`
- `packages/datagrid-formula-engine-enterprise/src/formulaPacks.ts`
- `packages/datagrid-vue-app-enterprise/src/DataGrid.ts`
- `packages/datagrid-vue-app-enterprise/src/dataGridFormulaRuntime.ts`
- `packages/datagrid-vue-app-enterprise/src/dataGridPerformance.ts`
- `packages/datagrid-vue-app-enterprise/src/__tests__/DataGrid.contract.spec.ts`
- `scripts/bench-datagrid-formula-engine.mjs`
- `scripts/bench-datagrid-formula-engine-worker.mjs`
- `scripts/bench-datagrid-formula-parser.mjs`
- `scripts/bench-datagrid-formula-relations.mjs`
- `scripts/bench-datagrid-formula-backends.mjs`
- `scripts/bench-datagrid-workbook-sync.mjs`
- `scripts/bench-datagrid-spreadsheet-sheet.mjs`
- `scripts/bench-datagrid-spreadsheet-workbook.mjs`

## Strengths

- The formula package boundary is clean. The community package owns parsing, compilation, value coercion, function registry, and execution-plan helpers. The enterprise package is additive and does not require a parallel formula engine.
- Parser and tokenizer are deterministic and covered by tests for spans, syntax errors, bracketed paths, quoted field names, row-aware references, Smartsheet-style references, sheet-qualified references, and rectangular ranges.
- Row-model dependency graphs are explicit. `createDataGridFormulaExecutionPlan` builds deterministic order, levels, field/computed dependency indexes, field-path ancestor matching, graph snapshots, and SCC-based cycle groups.
- Cycle behavior is clear in the row-model runtime. `formulaCyclePolicy: "error"` is the default, and `"iterative"` is opt-in with max iteration and epsilon controls.
- Incremental recomputation is real, not cosmetic. `clientRowComputedExecutionRuntime.ts` accepts changed rows, changed fields, and changed context keys; dirty propagation then enqueues row/node pairs rather than full-table work for normal patches.
- Batch and columnar execution paths exist and are observable. Compile/runtime code supports row, batch, fused columnar, vector columnar, columnar JIT, and AST fallback modes, while diagnostics expose effective runtime modes.
- Worker-owned compute is integrated with formula registration and recomputation. Worker tests cover formula registration through worker protocol and worker/main-thread parity.
- Spreadsheet workbook formulas support cross-sheet references, sheet rename rewrites, row/column structural rewrites, derived sheets, view dependencies, missing dependency diagnostics, and cyclic view diagnostics.
- Undo/redo is integrated at workbook state level. `useDataGridSpreadsheetWorkbookHistory.ts` captures and restores workbook snapshots through `useDataGridIntentHistory`.
- Formula benchmarks and gates exist for parser, formula engine, worker comparison, backend comparison, dependency graph, sheet, and workbook sync workloads.

## Findings by severity

### Blocker

1. **Async formulas are unsupported.**
   - Evidence: `DataGridFormulaFunctionDefinition.compute` in `packages/datagrid-formula-engine/src/syntax/types.ts` returns `unknown` synchronously, and `compile.ts` normalizes/evaluates values synchronously.
   - Impact: promise-returning functions have no pending state, cancellation model, dependency invalidation, retry semantics, or user-facing loading/error state.
   - Required: explicit async formula contract before advertising server functions, LLM functions, remote lookups, or delayed enterprise formula packs.

2. **Automatic volatile formula invalidation is unsupported.**
   - Evidence: `TODAY()` in `dateFunctions.ts` reads `new Date()` during compute, but function definitions have `contextKeys` and `resolveContextKeys`, not a first-class `volatile` flag or scheduler policy.
   - Impact: `TODAY()` changes only when a recompute happens for some other reason. This is correct for the current deterministic model but below spreadsheet-class expectations.
   - Required: volatile-function metadata, clock/context invalidation policy, tests, and telemetry.

3. **Server-backed formula semantics are not defined.**
   - Evidence: reviewed data-source protocol files expose async row pulls/edits/fill, while formula runtime is client/model-owned and formula tables are context sources.
   - Impact: there is no contract for server-evaluated formulas, server-side dependency invalidation, revision ordering, async formula failure, or lazy formula ranges over unloaded rows.
   - Required: server-backed formula protocol or a documented unsupported boundary.

### High

1. **Workbook formulas are not scheduled by one global cell-level DAG.**
   - Evidence: `sheetModel.ts` tracks same-sheet formula dependents, while `workbookModel.ts` schedules sheet/view/table dependencies and runs component passes.
   - Impact: the design handles current cross-sheet cases, but it is not as precise as a global cell graph for large workbooks with many cross-sheet cell references.
   - Required: either a global workbook dependency index or an explicit scale/complexity limit with tests.

2. **Cross-sheet direct references have known stability limits.**
   - Evidence: workbook tests cover diagnostics for direct refs into unstable join and pivot view sheets, and `workbookModel.ts` records direct reference dependency aliases.
   - Impact: formula correctness depends on avoiding address-based references into unstable derived views.
   - Required: stronger UX/documentation, blocked edits or warnings for unstable direct references, and e2e coverage.

3. **Spreadsheet and row-model formula schedulers are separate.**
   - Evidence: row-model formulas use execution plans and dirty row/node propagation; spreadsheet formulas use recursive per-sheet evaluation with local dependents and workbook sync passes.
   - Impact: both paths are valid, but enterprise behavior must document which guarantees apply to DataGrid row models versus workbook sheets.
   - Required: shared invariant docs and parallel tests for equivalent formula scenarios where both surfaces are supported.

4. **Formula table invalidation relies on source identity/revision discipline.**
   - Evidence: row-model `setFormulaTable`/`removeFormulaTable` and spreadsheet `patchFormulaTables` mark context keys dirty; workbook exports table sources by revision.
   - Impact: external hosts that mutate a table source in place without changing source identity or pushing a patch can produce stale formula results.
   - Required: require immutable table-source updates or add an explicit table revision contract.

5. **Large-DAG memory caps are incomplete.**
   - Evidence: row-model source column cache has a tested max-entry option and LRU diagnostics, but compile artifact maps and spreadsheet formula analysis/template caches are Map-based without an audited size cap.
   - Impact: normal use is bounded by registered formulas and sheet formulas, but formula churn or generated formulas can grow memory.
   - Required: cache budgets, diagnostics, and eviction/clear policy for high-churn formula workloads.

### Medium

1. **Excel A1 compatibility is intentionally incomplete.**
   - Evidence: docs state A1-style references and colon A1 ranges are not part of the engine contract. Parser tests cover canonical and Smartsheet-style references instead.
   - Impact: interoperability is good for DataGrid/Smartsheet-like formulas, not Excel formula compatibility.
   - Required: document as unsupported unless A1 support becomes a product goal.

2. **Row-aware references force row execution mode.**
   - Evidence: tests assert row-aware formulas set `batchExecutionMode` to `"row"`.
   - Impact: correctness is preserved, but row-aware moving-window formulas can become hot on large datasets.
   - Required: benchmark row-aware formulas separately and consider specialized kernels only if needed.

3. **Pass-based workbook sync can multiply work.**
   - Evidence: `workbookModel.ts` runs multi-sheet/cyclic components up to `formulaTableSyncMaxPasses`, defaulting from sheet count.
   - Impact: complex cross-sheet formula/table cycles can create long synchronous work.
   - Required: convergence telemetry, pass count gates, and progressive scheduling for very large workbooks.

4. **Virtualization integration is model-safe but UI-continuity risk remains.**
   - Evidence: formula computation is model-level and not tied to visible rows, while `DataGridSpreadsheetWorkbookApp.vue` renders through `DataGridTableStageLoose`.
   - Impact: formulas should not become stale because rows unmount, but formula editor/reference overlays need e2e coverage under scroll/remount/pinned panes.
   - Required: Playwright coverage for editing formulas while virtual rows/cells remount.

5. **Diagnostics can become expensive if row-level cause capture is overused.**
   - Evidence: dirty propagation can capture row recompute causes, and formula explain surfaces graph/row recompute details.
   - Impact: this is valuable for debugging, but large formula workloads need diagnostics sampling or budgets.
   - Required: document production defaults and add perf gates with diagnostics enabled.

### Low

1. **Graph snapshot edges mix graph-node and source-token domains.**
   - Evidence: `snapshotDataGridFormulaGraph` emits field/meta edges where `from` is a dependency token value rather than a computed node id.
   - Impact: correct if consumers inspect `domain`, but visualization tooling can misread field/meta edges.
   - Required: document edge domains or add explicit source-node typing.

2. **Enterprise formula runtime package is currently mostly configuration and packs.**
   - Evidence: `datagrid-formula-engine-enterprise/src/index.ts` marks worker execution, advanced tiers, profiler, and policies as planned additive layers.
   - Impact: the boundary is healthy, but enterprise claims should align with what is actually shipped.
   - Required: keep packaging docs in sync with implemented runtime features.

## Correctness guarantees and risks

- Dependency graph: strong for row-model formulas; partial for workbook formulas because the global scheduler is sheet/component-level rather than per-cell across sheets.
- Incremental recomputation: strong for row-model patches and context invalidation; strong for same-sheet spreadsheet cell edits; less precise for cross-sheet workbook references.
- Cycle detection: strong for row-model execution plans; spreadsheet sheet cycles return formula errors through recursive `visiting` detection; iterative spreadsheet cell cycles are unsupported.
- Formula parsing: deterministic and well tested for the supported grammar; Excel A1 grammar is unsupported.
- Reference resolution: strong for DataGrid paths, Smartsheet-style row selectors, same-sheet references, sheet-qualified references, and workbook rewrite tests; direct references to unstable derived sheets remain a known risk.
- Cross-sheet references: supported through workbook sheet resolution and sync; not yet a global cell DAG.
- Async formulas: unsupported.
- Volatile formulas: partially supported only through recomputation side effects or explicit host invalidation.
- Recalculation invalidation: good for row-model fields/context keys and same-sheet dependents; host discipline is required for formula tables.
- Undo/redo: workbook state snapshot restore exists; enterprise confidence needs tests around cross-sheet formulas, formula tables, derived views, and history replay.

## Performance and scalability risks

- Large DAGs: row-model execution plans and dirty propagation are designed for scale, and benchmark gates cover small/medium/large formula scenarios. Enterprise readiness still needs CI gates for million-row and high-formula-count edge cases if those are product targets.
- Recompute scheduling: row-model formula recomputation is optimized; spreadsheet workbook recomputation is synchronous and can block the UI on large workbooks.
- Incremental recomputation: row-model recompute is efficient for changed fields/rows; spreadsheet structural formula changes can rebuild/evaluate broad formula sets.
- Memory growth: source column cache has a cap; compile artifacts, spreadsheet formula analysis caches, and table lookup indexes need explicit high-churn tests.
- Batching: batch, fused, vector, and JIT paths are present, but row-aware/runtime-context formulas can fall back to row mode.
- Worker offload: worker-owned row model reduces main-thread pressure for formula-heavy row models. Spreadsheet workbook recompute is not proven worker-offloaded from reviewed files.
- Benchmarks: formula-engine, parser, relations, backend, worker, sheet, and workbook benchmarks exist; the next gap is enforcing enterprise target envelopes consistently in CI and tracking regressions in baseline docs.

## Server-backed formula risks

- Server-backed formula evaluation is unsupported in the reviewed architecture.
- Formula tables can model external table data, but they do not define lazy server windows, unloaded row references, revision ordering, or server-side DAG invalidation.
- Async `pull`/edit protocols in data sources do not extend to formula recomputation semantics.
- Placeholder rows and unloaded ranges are not formula-aware by contract.

Required enterprise work:

- Define whether formulas are client-only, server-only, or hybrid per column/sheet.
- Add revisioned formula results and invalidation messages.
- Add pending/error states for async/server formulas.
- Define behavior for formulas over unloaded rows and stale table snapshots.

## Virtualization interaction risks

- The core formula result model is not tied to the virtual DOM, which is the right direction.
- Row-model formulas compute against model rows and overlays, so virtualized unmount/remount should not affect formula values.
- Spreadsheet formula editor/reference decorations need explicit e2e coverage while rows and columns remount.
- Formula diagnostics and editor overlays must stay anchored after scroll, resize, and pinned-pane splits.

## Undo/redo integration risks

- Workbook history captures and restores exported workbook state.
- Formula row-model docs mention calculation snapshots/undo/redo for computed overlays, but enterprise validation needs targeted tests for formula edits, formula table updates, cross-sheet rewrites, and derived-sheet recomputation after undo/redo.
- Server-backed formula undo is undefined until server-backed formula semantics exist.

## Enterprise readiness score

Current score: **7.5/10**.

Target score: **9/10**.

What blocks target score:

- Async formula contract and scheduling.
- Volatile formula invalidation policy.
- Server-backed formula semantics.
- Global workbook invalidation precision or explicit workbook scale limits.
- CI-enforced large-DAG, large-workbook, memory, and worker parity gates.
- E2E coverage for formula editing/reference overlays under virtualization.

## Recommended tests

Unit tests:

- Async formula registration rejects with a clear error until async support is implemented.
- Volatile functions expose metadata or are documented/tested as explicit-recompute only.
- Formula table sources require immutable update/revision semantics.
- Cross-sheet direct references recompute correctly after source row/column mutations and fail clearly for unsupported derived-view references.
- Spreadsheet formula cycles return stable typed errors; row-model iterative cycles continue to converge within configured epsilon.
- Compile artifact and analysis caches clear or cap under high formula churn.

Component tests:

- Spreadsheet formula editor keeps references, diagnostics, and displayed results stable across workbook undo/redo.
- Enterprise wrapper applies `formulaRuntime`, `formulaPacks`, and `performance: "formulaHeavy"` without changing community formula behavior.
- Diagnostics panels show graph/runtime modes without triggering broad recompute.

Playwright/e2e tests:

- Edit a formula in a virtualized sheet, scroll it out/in, then commit/cancel and verify display value and focus.
- Cross-sheet formula reference decoration remains anchored after scroll, resize, and sheet switch.
- Formula table update recomputes dependent visible and non-visible cells.
- Undo/redo a formula edit after virtualization remount and verify dependent cells.

Performance/benchmark tests:

- Row-model dense formula DAG: graph build time, affected expansion time, full recompute, patch recompute, memory delta.
- Row-aware formulas: moving-window and absolute-row selectors at 10k, 100k, and 1M rows.
- Workbook sync: many sheets, cross-sheet references, derived views, formula table dependencies, and cyclic components.
- Formula diagnostics enabled versus disabled overhead.
- Worker-owned versus main-thread formula recompute parity and speedup.

## Recommended telemetry

- Formula compile time and cache hit/miss/size.
- Execution-plan build time, node count, edge count, level count, and iterative group count.
- Dirty propagation time, dirty row count, dirty node count, and row/node pair count.
- Full recompute versus incremental recompute time.
- Runtime mode per formula node and fallback counts from columnar/batch to row.
- Formula table context invalidation count and source revision/identity changes.
- Workbook sync pass count, converged flag, affected sheet count, and per-sheet recompute time.
- Spreadsheet formula cell count, invalid formula count, cycle error count, and cross-sheet reference count.
- Memory usage for compile artifacts, column cache, table lookup indexes, and formula analysis caches.
- Main-thread long tasks during formula recompute.

## Prioritized roadmap

### Phase 1: invariant hardening

- Document supported formula surfaces separately: row-model formulas, spreadsheet formulas, enterprise formula runtime, and formula packs.
- Add invariant tests for unsupported async formulas and unsupported automatic volatility.
- Add table-source immutability/revision tests.
- Add workbook cross-sheet invalidation tests that distinguish same-sheet, direct external refs, and formula table dependencies.

### Phase 2: large-DAG and cache hardening

- Add cache size telemetry for compile artifacts and spreadsheet analysis/template caches.
- Add high-churn formula registration/removal tests.
- Enforce formula-engine benchmark baselines in the same quality-gate path used by other DataGrid benchmarks.
- Add row-aware formula benchmarks.

### Phase 3: workbook scheduler hardening

- Decide whether to add a global workbook cell dependency index or explicitly document workbook scale limits.
- Add telemetry for workbook sync pass count and component convergence.
- Add progressive/yielded scheduling if workbook recompute can exceed frame budgets.
- Strengthen diagnostics for direct refs into unstable derived views.

### Phase 4: async, volatile, and server-backed contracts

- Add function metadata for `async`, `volatile`, and invalidation domains.
- Define pending/error/cancel behavior for async formulas.
- Define server formula result revisions and invalidation protocol.
- Define unloaded range behavior for server-backed formulas and formula tables.

### Phase 5: UI and enterprise validation

- Add formula editor/reference e2e tests under row and column virtualization.
- Add undo/redo tests across formula edits, cross-sheet rewrites, and table updates.
- Add enterprise wrapper tests that combine formula packs, worker runtime, diagnostics, and performance presets.
- Publish documented limitations and supported scale targets.

## Migration notes

- Do not replace the existing formula engine. Extend the current parser/compiler/execution-plan/runtime boundaries.
- Keep async and volatile support opt-in until semantics are stable.
- Treat server-backed formulas as unsupported until a revisioned protocol exists.
- Avoid changing public formula syntax without migration tooling and compatibility tests.
- Keep row-model and spreadsheet formula guarantees explicit; they share parser/compiler infrastructure but do not share the same scheduler.
