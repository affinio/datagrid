# DataGrid Delivery Pipeline (toward Formula Engine)

Date baseline: 2026-03-06

Goal: finish current architecture and feature tracks with explicit checkpoints, then enter formula-engine implementation with low regression risk.

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
