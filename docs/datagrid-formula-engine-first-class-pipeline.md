# DataGrid Formula Engine — First-Class Pipeline

Goal: move the current engine from strong grid-native runtime to first-class formula platform.

Progression is intentionally ordered from cheapest/highest-leverage work to deeper semantic/runtime work.

## Phase 1 — Language Surface Foundations

- [x] Block 1. Function Catalog Wave 1
  - Add core scalar functions for text/math/aggregation ergonomics.
  - Cover AST + JIT parity with tests.
  - Update user-facing guide.
- [x] Block 2. Function Catalog Wave 2
  - Add date/time and richer numeric helpers.
  - Add more spreadsheet-style utility functions.
- [x] Block 3. Null / Blank / Missing Contract
  - Freeze explicit semantics for `null`, empty string, undefined/missing and zero.
  - Expand tests and docs around coercion boundaries.

## Phase 2 — Reliability and Diagnostics

- [x] Block 4. Typed Formula Error Values
  - Add structured formula error values and propagation semantics.
  - Preserve grid-safe fallback mode.
- [x] Block 5. Rich Diagnostic Spans
  - Track source ranges on AST nodes.
  - Return precise compile/runtime diagnostics for editor UX.
- [x] Block 6. Explain / Introspection APIs
  - Add per-formula explain tree, dependency trace and dirty-cause visibility.

## Phase 3 — Runtime Completeness

- [x] Block 7. Meta Dependency Runtime
  - Make `meta:*` dependencies first-class and documented.
- [x] Block 8. CSP-Safe Compiler Path
  - Add no-`new Function` execution mode.
- [x] Block 9. Volatile / Contextual Recalc
  - Add controlled recalc model for volatile functions and context-driven invalidation.
  - Implement explicit `contextKeys` metadata on formula functions plus targeted `recomputeFormulaContext(...)` invalidation.

## Phase 4 — Spreadsheet-Class Semantics

- [x] Block 10. Reference Model Expansion
  - Add richer field/path/reference semantics.
  - Support bracketed path access, numeric index segments, and quoted field segments for literal dots/spaces.
- [x] Block 11. Arrays / Ranges / Lookup Surface
  - Introduce range-aware and lookup-oriented formulas.
  - Add first-class array values with `ARRAY(...)` / `RANGE(...)` and lookup helpers `INDEX`, `MATCH`, `XLOOKUP`, `IN`, `CHOOSE`.
- [x] Block 12. Circular / Iterative Calculation
  - Add opt-in cycle handling for advanced models.
  - Preserve default cycle rejection with `formulaCyclePolicy: "error"` semantics.
  - Support iterative SCC execution with `formulaCyclePolicy: "iterative"` plus `formulaIterativeCalculation.{ maxIterations, epsilon }` convergence controls.
  - Expose cycle-group and convergence metadata in execution-plan and compute-stage diagnostics.

## Phase 5 — Execution Engine Maturity

- [ ] Block 13. Compile Reuse and Expression Identity
  - Add compiled expression cache (`formula string -> compiled artifact`).
  - Add normalized AST hash for structurally equivalent formulas.
  - Expose cache hit/miss metrics in diagnostics.
- [ ] Block 14. Access Specialization
  - Replace generic string-token hot path with `tokenIndex -> accessor` specialization.
  - Precompile nested path readers and common scalar slot readers.
  - Make JIT/batch evaluators consume accessor tables instead of raw token strings.
- [ ] Block 15. Formal Expression DAG Runtime
  - Promote current dependency planning/runtime into an explicit `FormulaGraph`.
  - Keep stable topological levels as a first-class execution artifact.
  - Add explain/debug visibility for node-level and row-level recompute causes.
- [ ] Block 16. Fused Batch Execution
  - Compile arithmetic/comparison chains into tighter batched loops.
  - Avoid generic node dispatch inside hot recompute paths where graph shape is stable.
  - Keep deterministic fallback for unsupported/branch-heavy subgraphs.
- [ ] Block 16.1. Batch-Major Level Execution
  - Switch hot execution order from `level -> node -> rows batch` toward `level -> rows batch -> node`.
  - Keep temporary row-batch state hot across multiple nodes inside the same level.
  - Use this as the default runtime shape for fused batch execution and future vector kernels.
- [ ] Block 16.2. Dependency-Signature Group Execution
  - Group same-level nodes by normalized dependency signature before execution.
  - Preload shared dependency columns/readers once per batch and reuse them across grouped nodes.
  - Use shared-input scheduling to reduce repeated column reads and token resolution for formulas with overlapping inputs.
- [ ] Block 17. True Vector Kernels
  - Add column-pointer/vector-kernel execution for numeric-heavy workloads.
  - Support masked fallback for branchy operators/functions (`IF`, `IFS`, `COALESCE`).
  - Make worker-oriented vector execution possible without changing formula contracts.

## Phase 5 Priority Order

1. [ ] `F1` Compile Reuse and Expression Identity
2. [ ] `F2` Access Specialization
3. [ ] `F3` Formal Expression DAG Runtime
4. [ ] `F4` Fused Batch Execution
5. [ ] `F4.1` Batch-Major Level Execution
6. [ ] `F4.2` Dependency-Signature Group Execution
7. [ ] `F5` True Vector Kernels

## Phase 5 Definition of Done

- [ ] Repeated formulas compile once and reuse the same compiled artifact.
- [ ] Hot execution path avoids string-token lookups.
- [ ] Recompute is explicitly node-scoped and row-scoped.
- [ ] Arithmetic dependency chains can execute as fused batches.
- [ ] Runtime can execute hot levels in batch-major order (`level -> batch -> node`) where eligible.
- [ ] Same-level nodes with overlapping dependency signatures can reuse preloaded inputs within a batch.
- [ ] Numeric-heavy workloads can opt into vector-kernel execution.
- [ ] Diagnostics explain recompute causes, cache behavior, and runtime mode selection.

## Phase 6 — Calculation Snapshot Runtime

- [ ] Block 18. Immutable Base Rows + Computed Snapshot Overlay
  - Keep source/base rows immutable during formula recompute.
  - Materialize computed values into snapshot-backed column storage instead of patching row objects directly.
  - Read path must resolve `source field` vs `computed snapshot field` deterministically.
- [ ] Block 19. Snapshot-Aware Runtime Integration
  - Replace direct `setSourceRows(nextRows)` compute mutation flow with atomic calculation snapshot swap where eligible.
  - Make worker-owned recompute able to publish a new calculation snapshot instead of row-object patches.
  - Keep fallback path available for legacy row-materialized execution.
- [ ] Block 20. Snapshot-Aware Undo / Debug / Collaboration
  - Support undo/redo via snapshot stack semantics rather than full row-object cloning.
  - Enable time-travel/debug inspection for pre/post compute snapshots.
  - Define collaboration hooks for reconciling source edits vs local computed snapshot state.

## Phase 6 Priority Order

1. [ ] `S1` Immutable Base Rows + Computed Snapshot Overlay
2. [ ] `S2` Snapshot-Aware Runtime Integration
3. [ ] `S3` Snapshot-Aware Undo / Debug / Collaboration

## Phase 6 Definition of Done

- [ ] Formula recompute can complete without mutating base/source rows directly.
- [ ] Computed values can live in snapshot-backed column storage.
- [ ] Read path supports source + computed overlay deterministically.
- [ ] Worker/main-thread runtime can atomically swap calculation snapshots.
- [ ] Undo/debug flows can reference calculation snapshots without cloning full row objects.

## Implementation Notes

- Each block should land with tests.
- Keep public contracts deterministic.
- Prefer feature flags or additive contracts over breaking behavior.
