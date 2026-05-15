# DataGrid Delivery Pipeline (toward Formula Engine)

Date baseline: 2026-03-06

Goal: finish current architecture and feature tracks with explicit checkpoints, then enter formula-engine implementation with low regression risk.

## Projection Stage Naming Contract

- Stage id is `visible` (final projection materialization stage in row-model pipeline).
- `viewport` is not a projection stage; it is UI/runtime windowing over already projected rows.
- All stage-graph contracts (`projectionStages`, analyzer tests, orchestration diagnostics) must keep this distinction explicit.

## Track 0: Stabilization (must stay green)

- [ ] `@affino/datagrid-core` type-check + unit tests pass.
- [ ] `@affino/datagrid-vue` type-check passes.
- [ ] `@affino/datagrid-sandbox` type-check passes.
- [ ] No API contract regressions in `gridApi.contract.spec.ts`.

## Track 1: Projection Engine Hardening (reactive graph path)

Status:
- Completed:
  - `compute` stage is formalized in projection stages and invalidation reasons.
  - Stage-aware cache policy is present (`projectionPolicy`).
  - `compute` stage executor can request `sourceById` refresh in the same recompute cycle.
- In progress:
  - Keep patch planner semantics compatible while expanding `compute` stage usage.

Pipeline:
1. [x] Extract `client projection stage registry` (id, dependsOn, execute).
2. [x] Make graph builder consume registry (single source of truth).
3. [x] Make projection engine dispatch consume registry (remove duplicated stage maps).
4. [x] Keep patch planner semantics compatible (compute stage is registered, patch invalidation remains disabled by default).
5. [x] Add diagnostics parity checks for stale stages / invalidation roots.

## Track 2: Vue App Wrapper and Feature Surface

Status:
- Completed:
  - High-level `<DataGrid />` wrapper implemented with feature install + event bridge.
  - Keyboard logic moved from UI to `keyboard` feature event flow (`grid.emit("keydown", ...)`).
  - Context split implemented (`engine/view`) + `useFeature()` helper.
  - Base panels/menu wired (`groupPanel`, `pivotPanel`, `filterBuilderUI`, `columnMenu`).
- In progress:
  - TS stabilization across `datagrid-vue` and sandbox.

Pipeline:
1. [ ] Close remaining TS declaration/export issues.
2. [ ] Re-run component contract tests for wrapper surfaces.
3. [ ] Confirm all requested feature flags resolve through dependency resolver.
4. [ ] Add integration checks for menu/panel actions affecting core state.

## Track 3: Missing Feature Set (post-hardening)

Priority set before formula-engine:
1. [ ] Sorting comparator policy (custom/locale/natural).
2. [ ] Quick/global filter model.
3. [ ] Real Excel export pipeline (`.xlsx`, not TSV mime shim).
4. [ ] Selection overlay default renderer in app wrapper.

Deferred after formula-engine kickoff:
- Column groups runtime.
- Row pinning (top/bottom frozen rows).
- Group footers/totals rows.

## Track 4: Formula-Engine Readiness Gates

Entry criteria:
1. [x] Stage registry is the single source for projection stage topology.
2. [x] `compute` stage has explicit executor contract (not placeholder).
3. [x] Invalidation reasons map deterministically to stage roots.
4. [x] Worker compute path can execute recompute plans from stage ids.
5. [x] Snapshot diagnostics expose enough data for recompute tracing.

Exit from readiness:
- Formula engine can be introduced as compute node(s) without changing orchestration API.

## Current Slice (active)

Active slice:
1. Stage registry extraction and wiring (no behavior change). Done.
2. Tests update for registry-driven stage graph + compute refresh propagation. Done.
3. Formula-engine foundation (field formulas compiler + client/API wiring). Done.
4. Worker-owned row-model parity for formulas (`registerFormulaField` protocol + update payload). Done.
5. Formula runtime diagnostics in projection snapshot (`projection.formula`). Done.
6. Formula execution plan (DAG levels + dirty propagation by value) integrated into client recompute path. Done.
7. Diagnostics explain API (`diagnostics.getFormulaExplain`) with execution-plan snapshot. Done.
8. Runtime formula function registry (`rows.register/unregisterFormulaFunction`) with safe rollback. Done.
9. Worker-owned formula explain parity (`formulaExecutionPlan` mirrored over row-model protocol). Done.
10. Patch coordinator invalidation reasons now explicitly include `computedChanged` when computed/formula patch propagation mutates values. Done.
11. Projection snapshot explain now includes `projection.computeStage` (`rowsTouched`, `fieldsTouched`, `evaluations`, `skippedByObjectIs`, `dirtyRows`, `dirtyNodes`). Done.
12. Formula evaluator call hot-path no longer uses per-call `args.map(...)`; switched to tight indexed loop for function args materialization. Done.
13. Compute runtime supports lazy patch-map capture (`captureRowPatchMaps`), enabled only for `patchRows` path to avoid unnecessary `Map` allocations on full recompute/refresh flows. Done.
14. Formula AST evaluator now binds identifier -> dependency token at compile-time; runtime eval no longer does per-identifier map lookups. Done.
15. Formula execution plan now precomputes downstream closures for `affectedByFields`/`affectedByComputed` (no per-call BFS traversal). Done.
16. Added formula parity contract suite (`formulaParity.spec.ts`) with initial/full-recompute and patch bursts `1/10/100/1000` against manual compute baseline. Done.
17. Added formula benchmark baseline freeze tooling (`scripts/freeze-datagrid-formula-baseline.mjs` + package scripts). Done.
18. Added internal compute-stage source column cache (`field -> values[]`) with mutation invalidation hooks (`setRows/reorder` full clear, `patchRows` row-scoped invalidation before formula recompute). Done.
19. Added adaptive column-cache invalidation: large patch sets auto-fallback to full cache clear to avoid `fields x rows` deletion cost. Done.
20. Added diagnostics-mode dual-run verification for column cache parity (`__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__`) + contract test coverage. Done.
21. Added snapshot/row-output stability test ensuring column-cache verification mode does not change public row-model outputs. Done.
22. Compute runtime executes levelized formula graph over cached column readers/writers with value-change propagation and preserved diagnostics counters. Done.
23. Added internal compute strategy switch (`row` vs `column-cache`) with heuristic selection and strategy surfaced in compute diagnostics snapshots. Done.
24. Added immediate runtime fallback to row reads on column-cache parity mismatch (with cache reset + strategy downgrade reflected in diagnostics). Done.
25. Worker-owned row-model backpressure/coalescing for rapid `patch-rows` bursts now merges queued patch payloads by `rowId`, tracks protocol diagnostics counters (`commandsCoalesced`, `patchUpdatesMergedAway`, queue peak), and forces immediate flush for large patch bursts. Done.
26. Worker-owned row-model protocol now carries versioned update payload schema (`schemaVersion`) with mirror-side mismatch diagnostics for compute parity tracking. Done.
27. Compute runtime now supports threshold policy for patch execution plans (`workerPatchDispatchThreshold`): small patch recompute requests run locally, large ones dispatch through worker transport. Done.
28. Compute worker protocol request payload now serializes execution batch plans (`batchPlan`) for stage/execution recomputes with schema envelope + legacy payload compatibility resolver. Done.
29. Formula benchmark baseline lock artifact committed (`docs/perf/datagrid-formula-engine-baseline.json`) with deterministic freeze/check workflow scripts. Done.

## Track 5: Formula Performance Phase (Frozen, start on explicit command)

Status:
- Frozen: implementation is paused until explicit `"start"` command.
- Scope: internal runtime perf only, no public API breakage.

Hard constraints:
1. Keep `DataGridRowModel`/Grid API surface backward-compatible.
2. Keep deterministic results parity with current row runtime.
3. Keep fallback path available (`row` runtime remains valid).

### Phase A: Guardrails and Parity Baseline

Goal: lock correctness before deeper runtime changes.

Checklist:
1. [x] Add golden parity tests for formulas (`row` runtime as reference).
2. [x] Add stress scenarios for patch sizes `1/10/100/1000`.
3. [x] Freeze benchmark baselines in artifacts for compare runs.
4. [x] Define fail-fast gates for correctness before perf assertions.

Exit criteria:
- All parity tests green.
- Benchmark baseline committed and reproducible.

### Phase B: Columnar Shadow Storage (internal)

Goal: add optional internal column store without changing external row contracts.

Checklist:
1. [x] Introduce internal `column cache` (field -> typed/boxed vector).
2. [x] Build invalidation rules for row patches -> dirty column segments.
3. [x] Keep row snapshot generation unchanged from API perspective.
4. [x] Add dual-run verification (`row` vs `columnar` equality on diagnostics builds).

Exit criteria:
- Column cache updates are incremental and deterministic.
- API snapshots remain unchanged.

### Phase C: Formula Kernel Runtime

Goal: execute formulas by topological level with compiled kernels over row batches.

Checklist:
1. [x] Compile AST evaluators to prebound kernel functions.
2. [x] Execute `level -> node -> dirty rows` using column readers/writers.
3. [x] Keep value-change propagation (`Object.is`) semantics.
4. [x] Preserve current diagnostics (`evaluations`, `dirtyRows`, `dirtyNodes`).

Exit criteria:
- Kernel path passes parity suite.
- Full recompute throughput improves vs Track 5 baseline.

### Phase D: Runtime Strategy and Safe Rollout

Goal: add strategy switch with safe fallback.

Checklist:
1. [x] Internal strategy: `row` | `columnar-kernel`.
2. [x] Auto-switch heuristics by row/formula count and patch size.
3. [x] Immediate fallback on runtime invariant mismatch.
4. [x] Add strategy visibility in diagnostics snapshot.

Exit criteria:
- Strategy switch is deterministic and reversible at runtime.
- No contract regressions in integration tests.

### Phase E: Worker-Batched Compute

Goal: improve UI responsiveness and large-batch throughput.

Checklist:
1. [x] Batch plan serialization for compute levels.
2. [x] Threshold policy (small patches stay local; large batches go worker).
3. [x] Versioned worker protocol for compute diagnostics parity.
4. [x] Backpressure policy for rapid patch bursts.

Exit criteria:
- Large patch scenarios show better frame stability.
- Small patch latency not regressed beyond guardrail.

### Phase F: SIMD/WASM (optional optimization track)

Goal: numeric-heavy kernel acceleration without semantic drift.

Checklist:
1. [ ] Prototype WASM SIMD kernels for arithmetic operators.
2. [ ] Keep exact runtime policies (division by zero, coercion rules).
3. [ ] Verify deterministic equality vs JS kernel path.
4. [ ] Gate by capability detection and explicit opt-in.

Exit criteria:
- Numeric scenarios exceed JS kernel throughput.
- Fallback path remains default-safe.

## Resume Command

When ready to resume this phase, use:

- `"start Track 5"`

Execution order on resume:
1. Phase A
2. Phase B
3. Phase C
4. Phase D
5. Phase E
6. Phase F (optional)
