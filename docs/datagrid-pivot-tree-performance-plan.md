# DataGrid Pivot and Tree Performance Plan

## Goal

Bring `pivotRuntime` and `treeProjectionRuntime` to the same maturity level as the formula engine:
- deterministic runtime semantics
- benchmark-driven optimization
- low fixed overhead on patch paths
- stable full rebuild performance on large workloads
- clear separation between correctness work and performance work

## Current Assessment

### Pivot

Current strengths:
- Has its own runtime: `packages/datagrid-core/src/models/pivotRuntime.ts`
- Has incremental value-only patch path via `applyValueOnlyPatch()`
- Already reuses `aggregationEngine`
- Already has workload benchmark coverage:
  - `scripts/bench-datagrid-pivot-workload.mjs`

Current perf risks:
- Runtime still builds many row-entry / column-bucket structures during rebuild
- Incremental path is value-only and narrow by design; broader structural patch cost is still likely rebuild-heavy
- There is no explicit execution policy for:
  - rebuild vs partial patch
  - narrow vs wide pivot column sets
  - high-cardinality pivot columns
- Runtime is still mostly row-oriented, not column- or group-oriented

### Tree Data

Current strengths:
- Has dedicated runtime: `packages/datagrid-core/src/models/treeProjectionRuntime.ts`
- Supports both `path` and `parent` modes
- Has subtree-toggle fast paths
- Has cache patch-by-identity hooks
- Has workload benchmark coverage:
  - `scripts/bench-datagrid-tree-workload.mjs`
  - `scripts/bench-datagrid-tree-workload-matrix.mjs`

Current perf risks:
- Cache build paths are still heavy for large trees
- Parent/path cache construction is still fundamentally full-build oriented
- There is still significant graph/materialization work during full refreshes
- Incremental structure patching appears stronger than full rebuild, but likely still has avoidable fixed overhead on large models

## Main Gaps vs Formula Engine Maturity

Formula engine already has:
- explicit optimization roadmap
- compile/runtime split
- diagnostics and benchmark discipline
- staged execution work

Pivot and tree still need the same maturity in these areas:
- explicit runtime strategy model
- dedicated perf targets per workload shape
- narrower incremental invalidation contracts
- lower-allocation data structures for large models
- systematic benchmark gates in CI/quality flow

## Performance Roadmap

### Phase P1. Benchmark Baseline and Perf Contracts

- [ ] Lock pivot baseline from `scripts/bench-datagrid-pivot-workload.mjs`
- [ ] Lock tree baseline from `scripts/bench-datagrid-tree-workload.mjs`
- [ ] Define per-scenario budgets for:
  - rebuild p95
  - patch p95
  - p99 tail
  - variance (cv%)
  - heap delta
- [ ] Add markdown/json artifact comparison workflow similar to formula-engine
- [ ] Record current bottleneck scenarios in docs/perf notes

Definition of done:
- pivot/tree perf is discussed in terms of reproducible workloads, not anecdotes

### Phase P2. Snapshot-Aware Read Consistency

- [x] Tree runtime reads effective row data via snapshot-aware resolver
- [x] Pivot runtime reads axis fields via injected `readRowField`
- [ ] Audit remaining tree/pivot callers that still assume raw `row.data` is the source of truth
- [ ] Eliminate hidden rematerialization caused by stale row-data assumptions

Primary files:
- `packages/datagrid-core/src/models/treeProjectionRuntime.ts`
- `packages/datagrid-core/src/models/pivotRuntime.ts`
- `packages/datagrid-core/src/models/clientRowModel.ts`

Definition of done:
- tree/pivot runtime semantics are fully aligned with snapshot overlay model

### Phase P3. Tree Runtime Data-Structure Optimization

- [ ] Profile `buildTreePathProjectionCache()` for large path trees
- [ ] Profile `buildTreeParentProjectionCache()` for large parent trees
- [ ] Replace high-churn `Map/Set` hot structures where dense indexed storage is possible
- [ ] Reduce repeated branch traversal / key reconstruction in cache build paths
- [ ] Add explicit fast-path separation for:
  - full cache build
  - identity-only row patch
  - subtree expansion toggle
- [ ] Review `branchPathByLeafRowId`, `groupIndexByRowId`, descendant buffers for reuse opportunities

Primary files:
- `packages/datagrid-core/src/models/treeProjectionRuntime.ts`

Expected impact:
- lower `large full p95`
- lower tree rebuild heap delta
- better subtree toggle tail latency

### Phase P4. Tree Incremental Invalidation Tightening

- [ ] Narrow tree invalidation to true structural dependency fields only
- [ ] Separate structural row patch from value-only row patch in tree runtime
- [ ] Avoid unnecessary path/parent recomputation when changed fields do not affect hierarchy
- [ ] Preserve and reuse aggregate state where subtree structure is stable
- [ ] Add dedicated benchmarks for:
  - value-only patch on stable tree
  - structural patch on shallow tree
  - structural patch on deep tree

Primary files:
- `packages/datagrid-core/src/models/rowPatchAnalyzer.ts`
- `packages/datagrid-core/src/models/clientRowModel.ts`
- `packages/datagrid-core/src/models/treeProjectionRuntime.ts`

Definition of done:
- tree patch cost scales with affected structure, not total tree size

### Phase P5. Pivot Runtime Structure Optimization

- [ ] Profile `buildPivotProjectionRows()` by:
  - row count
  - pivot column cardinality
  - row-axis depth
  - value column count
- [ ] Reduce allocation churn in `rowEntries`, `columnMetaByKey`, and bucket/state maps
- [ ] Reuse normalized/runtime column metadata across compatible pivot models
- [ ] Split rebuild path into cheaper subpaths where only value aggregates change
- [ ] Avoid repeated path-key/string rebuilding where cached identity is sufficient

Primary files:
- `packages/datagrid-core/src/models/pivotRuntime.ts`

Expected impact:
- lower pivot rebuild p95
- lower heap on wide/high-cardinality pivots
- smaller p99 spikes during model changes

### Phase P6. Pivot Incremental Patch Expansion

- [ ] Formalize pivot patch strategy tiers:
  - value-only patch
  - dimension-stable patch
  - structural reapply
- [ ] Expand incremental path beyond current narrow `applyValueOnlyPatch()` contract where safe
- [ ] Track touched row-entry keys / column keys with lower allocation cost
- [ ] Avoid rebuilding unaffected row-entry aggregates when only a subset of value columns changed
- [ ] Add workload matrix for:
  - frozen patch (`recomputeGroup=false`)
  - reapply patch (`recomputeGroup=true`)
  - high-cardinality pivot dimensions

Primary files:
- `packages/datagrid-core/src/models/pivotRuntime.ts`
- `packages/datagrid-core/src/models/clientRowProjectionPivotStage.ts`
- `packages/datagrid-core/src/models/clientRowModel.ts`

Definition of done:
- pivot incremental work scales with affected pivot entry subset whenever structure is stable

### Phase P7. Tree/Pivot Memory Discipline

- [ ] Add heap-focused reporting to tree/pivot workload reports if not already surfaced clearly enough
- [ ] Identify long-lived caches vs transient allocations
- [ ] Convert hot bookkeeping structures to typed buffers/indexed arrays where density is high
- [ ] Remove duplicated row/materialized representations where cache-local views are enough
- [ ] Define acceptable memory multipliers vs flat row baseline

Definition of done:
- tree/pivot runtime has explicit memory budgets, not just latency budgets

### Phase P8. CI and Quality Gates

- [ ] Add pivot workload gate to quality/perf flow
- [ ] Add tree workload gate to quality/perf flow
- [ ] Upload pivot/tree perf artifacts in CI the same way as formula-engine artifacts
- [ ] Fail quality gates on sustained regressions, not one-off manual checks

## Priority Order

1. `P1` Benchmark baseline and contracts
2. `P2` Snapshot-aware read consistency
3. `P3` Tree runtime data-structure optimization
4. `P4` Tree incremental invalidation tightening
5. `P5` Pivot runtime structure optimization
6. `P6` Pivot incremental patch expansion
7. `P7` Memory discipline
8. `P8` CI perf gates

## Practical Recommendation

If the goal is fastest product payoff:

1. Finish `P2`
2. Do `P3 + P4` first
3. Then do `P5 + P6`

Reason:
- tree runtime is more tightly coupled to projection full-path cost
- pivot runtime already has a narrower incremental patch path and separate workload bench
- tree optimizations are more likely to reduce general `group/full` latency sooner

## Definition of Done

We can say pivot/tree reached formula-engine maturity when:

- [ ] dedicated workload benches exist and are used regularly
- [ ] rebuild and patch paths have stable p95/p99 budgets
- [ ] runtime uses snapshot-aware reads consistently
- [ ] large workload memory usage is explicitly budgeted
- [ ] incremental invalidation is narrow and explainable
- [ ] CI catches regressions automatically
