# Affino DataGrid computational-cost audit

Date: 2026-10-24. Scope: Core, orchestration, Vue rendering and viewport. Original status: **measurement only**. A later remediation follow-up is recorded at the end of this report; the timings and counters below remain the pre-remediation baseline.

The largest confirmed costs are repeated projection diagnostics during snapshot reads, full rollback-state copies for local patches, unconditional Vue row-selection reconciliation, ineffective patch coalescing in model-level batches, and repeated per-cell export preparation. Virtual DOM size stays bounded in the exercised shapes; a short scroll handler does not imply a cheap frame.

## Baseline, build and correctness prerequisites

- HEAD: `4a129c674b8b04ff1ff26a21929b38bfbaa9e487`. This is a **dirty effective-tree measurement**, not a clean-commit or released-version baseline. The preceding incremental correctness fixes are uncommitted, alongside pre-existing theme/sandbox edits and removal of an audit-only diagnostic spec. Exact initial status/diff: `/tmp/affino-cost-audit/{status.txt,baseline.patch}`. No Core/orchestration/Vue product sources were changed in this audit.
- External commits advanced HEAD during the audit to `3fae800f21ab01a3d99d570b6fca1f7b9889d323` (including `01f68b3a829a6ac8c311b7d562ce906b51747efe`, which committed the existing Core fixes). An intermediate version of the new cost runner was also committed externally. Per-file hashes and comparison against the initial dirty diff confirm that the measured Core/orchestration/Vue product contents did not drift; the current runner retains the final validated instrumentation. This audit did not create those commits.
- Product source fingerprint: `893ae0f08b663862892b31804d17e89e9fd5c9ec690f652e4750d5c77f19a530`; per-file hashes are in `product-source-manifest.json` in the same artifact directory.
- Read the consistency, exception-safety and incremental computation/projection audits and their remediation sections. The eight incremental defects are fixed in the effective tree. The pivot value-delta fast path is intentionally bypassed by that fix; its full rebuild cost is recorded as an existing tradeoff, not a newly discovered correctness defect.
- Fresh Core production emission: `pnpm --filter @affino/datagrid-core run build`, passed. Cost runner imports emitted JS from `dist`, with no source aliases. Correctness prerequisites: **30 tests passed** across incremental-equivalence, projection guardrails and failure-recovery suites. This is a focused gate, not a new complete mathematical audit.
- Vue: Vite **7.3.2** minified production consumer bundle, sourcemaps retained, Vue **3.4.38**, `import.meta.env.PROD === true` asserted. It uses current workspace sources through existing aliases; this is not a tarball/startup/official-package-footprint measurement. No dev-server/HMR or Vue dev-mode timings are mixed into the results.
- Node **v24.21.0**, pnpm **10.30.3**, Linux aarch64 VM. Guest reports 10 Apple CPU cores, maximum 2 GHz, 8,004 MiB RAM; CPU quota and memory cgroup limits are `max`. About 2.4 GiB swap was occupied at baseline. Actual host CPU model/frequency and scheduling are not controlled.
- Chromium **145.0.7632.0**, headless, 1200 × 800, DPR 1, no CPU throttling. Grid parent: 1100 × 480, fill layout, fixed 31px row policy, row/column virtualization enabled, overscan 8/2. Worker/network/remote datasource paths are excluded.

## Method and counter boundaries

**102 Core shape/action cases**, each 5 warm-ups + 30 timed samples and a separate observed-work pass. Sizes: 1k, 5k, 20k source rows. Short chain: 3 nodes; fan-out: 32 independent dependents; dense graph: 16 nodes / 136 dependency edges. Grouping uses 3 levels; high-cardinality grouping uses one key per source row. Path-tree depth is 8. Pivot uses 4 column buckets with low or source-row cardinality on its row axis.

**87 production Vue cases**, each 5 initial/warm-up actions + 30 timed samples, plus a fresh-fixture counter pass. Shapes: 1k/5k/20k × 12 columns, and 1k × 64/256 columns. Another **5 scroll-idle cases × 30 samples** observe the documented 120ms idle phase separately. The 87 main browser cases reported zero page errors; the 5 idle controls completed without a driver failure. Core timing runs and browser timing runs were not run concurrently.

- Timed data are plain deterministic records. Property/row-kind accessors, allocation wrappers, geometry wrappers, component lifecycle counters and `dgPerfTrace` are enabled only in separate count passes. Counters have overhead; their elapsed times are not used as latency results.
- Core row-field reads observe normalized model data; patched fields are left writable/plain. Row-kind probes observe accessible source/projected nodes. Computed overlays or replacement nodes can bypass those probes: **zero means unobserved, not proof of zero traversal**. Exact loops are corroborated by code and profiles.
- Large array counters observe `map/filter/slice/Array.from` results of length ≥128. They do not cover literals, every `new Array`, or engine-internal arrays. Copied Map entries and typed-array bytes are separate measurements. Allocation profiles use a 16KiB sampling interval and include objects collected by minor/major GC; their totals are sampled estimates, not RSS or leak measurements.
- Core stage timers cover projection-stage execution. Incremental compute can run before that timer boundary; formula evaluations are counted separately. Stage means and total medians are not additive budgets.
- Vue work runs in **MessageChannel tasks**, so inspector-evaluation work is not mistaken for application task cost. Preparation (mount, cancel previous editor, clipboard setup, reset prior projection) is outside measured actions. Call/settled/nextTick and two-frame observations are recorded separately.
- CDP `TaskDuration` reports main-thread task CPU during the observation window, including framework, GC, layout and protocol coordination. `ScriptDuration` does not fully describe Vue microtask work. Neither is a strictly exclusive per-subsystem budget. Scroll may do most work after `nextTick`; use task CPU, traces and the separate idle control.
- DOM counters report all created elements/text nodes, while identity comparison reports retained grid-cell nodes. Vue `beforeUpdate` counts are **component updates across the tree**, not that many full-grid render passes. Geometry probes cover bounding rects and client/offset/scroll dimensions; they are not a complete count of style queries.
- Fresh-model derived-cache controls have 10 samples per size/action, with no p95 reported. Warm steady-state samples have 30 and use nearest-rank p95. Browser first-action samples are retained separately; they are not cold startup. No logging occurs in measured sections; GC is not forced during timing.

## Confirmed excess work and cost risks

### C01 — P1 performance: snapshot diagnostics scan the entire grouped projection on read

Confidence: high. `getSnapshot()` builds diagnostics; `buildProjectionMemoryDiagnostics()` calls `countGroupBuckets()`, which visits every node even for flat projections with no groups. Cell-selection freshness and viewport readers call this repeatedly.

Evidence: Core single-cell selection and viewport update each observed **20,000 row.kind reads** at 20k rows and zero actual projection recomputes. In real Vue, one selection observed **1,462,566** row-kind reads; one fresh vertical window shift observed **8,163,719**, while reading only **96** projected row slots. Selection one/all have essentially equal scan cost. The largest sampled product stacks in the vertical-shift profile map to snapshot construction.

Owners: [snapshot diagnostics](../../../packages/datagrid-core/src/models/state/clientRowRuntimeStateStore.ts#L112), [diagnostic construction on every read](../../../packages/datagrid-core/src/models/state/clientRowRuntimeStateStore.ts#L201), [snapshot bridge](../../../packages/datagrid-core/src/models/snapshot/clientRowSnapshotRuntime.ts#L93), [selection freshness](../../../packages/datagrid-core/src/core/gridApiSelectionMethods.ts#L40).

Why excess: counting existing group kinds does not change with every selection, geometry or unchanged-projection read. Minimum proposal: maintain/cache the group count at the owning projection boundary and avoid rebuilding diagnostic structures for internal revision-only reads. Preserve revision freshness and required notifications.

### C02 — P2 performance: every patch copies the complete rollback baseline, including no-ops

Confidence: high. Before determining whether a patch changes anything, the coordinator copies the full source-node array and the row-version Map. At 20k rows, a one-field patch and an identical-value write each copy **20k source-array slots + 20k Map entries**. The no-op emits no model event and performs no projection recompute, yet still pays these copies.

Measured independent patch median/p95: **0.800 / 0.998 ms** at 20k; no-op control **1.375 / 1.653 ms** in a separate run. Do not interpret the latter as a reliable claim that no-op is slower: counters establish the shared work, and wall timings are noisy. Allocation sampling for 80 independent edits estimates approximately **373 MB allocated**, principally Map iterator/entry/set work and slices; this is transient churn, not retained memory.

Owner: [patch rollback baseline](../../../packages/datagrid-core/src/models/mutation/clientRowPatchCoordinatorRuntime.ts#L119). The changed-row application itself uses the existing ID index.

Why excess: rollback needs the previous touched entries, not an eagerly copied unrelated dataset. Minimum proposal: detect effective no-ops before full backup and use a touched-row/version journal or equivalent existing-owner staging. Retain the exception-safety tests; removing rollback protection is not an optimization.

### C03 — P2 performance: Vue reconciles record selection across all rows even when it is empty

Confidence: high, browser-confirmed. `handleCellChange()` always invokes reconciliation. The composed selection capability exists even with the checkbox UI disabled. Reconciliation builds an allowed-ID array by visiting every projected row before discovering there is no selection/focus to reconcile.

At 20k rows, a flat edit observed **20,138 getRow calls**; 20 awaited edits observed **401,449**. Captured caller stacks map the middle-of-dataset read to `useDataGridAppRowSelection.ts:105` via `DataGrid.ts:1504`.

Owners: [cell-change bridge](../../../packages/datagrid-vue/src/app-layer/DataGrid.ts#L1503), [unconditional allowed-ID scan](../../../packages/datagrid-vue/src/app/useDataGridAppRowSelection.ts#L96).

Why excess: an empty explicit record selection with no focused row has no IDs to remove. Minimum proposal: a verified empty-state fast return; for nonempty selections, reconcile only on relevant identity/membership changes with the current documented filtered-selection policy. Do not silently change selection retention semantics.

### C04 — P2 scope/performance gap: model batch did not coalesce the patch path — fixed

Confidence: high. Before the fix, with active sorting, 20 `patchRows()` calls inside `model.batchMutations()` caused **20 recompute cycles and 20 model notifications** at 20k rows. After the fix, the same measured path performs **one recompute and one notification** (median 6.195 ms / p95 7.826 ms); the equivalent single-call 20-row patch performs one recompute/notification (median 3.033 ms / p95 4.916 ms). Counters establish the work reduction; timings are environment-specific.

`batchMutations()` now defers compatible patch projection work and merges its requested stages. Reads that expose the projection (snapshot, row count/access/range, histogram, pivot drilldown, or row projection resolution) flush pending work inside the callback, preserving read-after-write semantics. A change in patch recompute policy closes the current segment. Structural operations also close the pending patch segment before their own final projection. The API docs describe these boundaries.

Owners: [batch commit and read barrier](../../../packages/datagrid-core/src/models/mutation/clientRowRowsMutationsRuntime.ts), [deferred patch projection](../../../packages/datagrid-core/src/models/mutation/clientRowPatchCoordinatorRuntime.ts), [projection read barriers](../../../packages/datagrid-core/src/models/clientRowModel.ts). The new focused Core contract tests verify compatible coalescing and observable reads inside a batch.

### C05 — P2 allocation: targeted formula execution allocates dataset-sized scratch space

Confidence: high. Three-node native formula edits evaluate **3 cells**, fan-out evaluates **32**, dense graph **16**, independently of N. That part is properly incremental. But the one-row pass still allocates approximately **15 × N bytes of observed typed arrays**, N-sized ordinary workspace arrays, and an additional N-slot output slice. At N=20k, the short chain allocated **300,000 typed-array bytes** plus **40k observed array-result slots** including the rollback copy.

Owners: [executor workspaces](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts#L88), [source output slice](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts#L847), [dirty row marks](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionDirtyPropagationRuntime.ts).

Minimum proposal: reuse model-owned bounded buffers/epochs or touched-index storage, with growth and teardown at the existing execution owner. Preserve failed-pass cache cleanup and cross-row dirty propagation. This is an allocation issue; there is no evidence of all-row formula evaluation in these cases.

### C06 — P2 export: avoidable per-cell locale normalization plus synchronous main-thread preparation — partially fixed

Confidence: high. Values-only export still executes `column.key.toLocaleLowerCase("en-US")` and formula-map lookup inside the inner cell loop even when no formula translation is requested. A separate prototype counter observed **240,012 locale-lowercase calls for 240,000 cells**, and **256,256 for 256,000 cells**. The largest sampled export frame is the inner callback at lines 396–397.

Production preparation for 20k × 12 took about **238 ms median / 297 ms p95 main-thread task CPU**; 1k × 256 took about **263 ms synchronous preparation** before cooperative yielding was added. Only preparation is measured: the progress callback deliberately stops at `preparing`, before worker creation, ZIP/XML writing or download. Every exported value is still resolved; no DOM/VNode serialization is used.

Owners: [per-cell formula lookup](../../../packages/datagrid-vue/src/app-layer/exportDataGridXlsx.ts#L393), [synchronous preparation before worker](../../../packages/datagrid-vue/src/app-layer/exportDataGridXlsx.ts#L484).

Formula metadata is now resolved once per exported column and skipped in values-only mode. Large main-thread preparation now yields after bounded cell chunks, reports intermediate `preparing` progress, and checks cancellation at each yield while retaining the captured-view consistency contract. This improves responsiveness but does not reduce total preparation work; no post-change long-run timing claim is made here. Visiting N×C output cells is necessary. Do not bypass custom export/value/type/style semantics.

### C07 — P3 allocation: immutable read capture creates a clone context per row state

Confidence: high for allocation location; any replacement must preserve the read-view contract. Capturing 20k rows takes **6.135 / 7.809 ms**; explicit row cloning takes **19.280 / 22.736 ms**. The no-clone mode still builds immutable node/state wrappers. `cloneFreezeStructure(node.state)` creates a fresh default WeakMap for each state; profile estimates for 80 captures place hundreds of MB in clone structures, descriptors and WeakMaps.

Owners: [clone context](../../../packages/datagrid-core/src/core/gridApiReadMethods.ts#L76), [per-row clone call](../../../packages/datagrid-core/src/core/gridApiReadMethods.ts#L147).

A full immutable view necessarily visits N nodes and creates output wrappers. Minimum proposal: reuse one capture-local clone context or an equally safe fixed-state clone plan. Keep the documented source-reference behavior of the default mode and explicit `cloneRow` isolation.

### Additional measured observations

- Pinning produced **15 synchronous Layout events inside JavaScript across 8 toggles**, about **0.652 ms total**, max **0.067 ms**. The header scroll offset is now copied from the already captured body viewport offset, removing the header `scrollLeft` read after a width write. Other measured header pane width reads remain; this small boundary was not shown to be a broad bottleneck.
- Reorder emitted two column events in the consumer fixture, with no row projection recompute. The extra transition may reflect derived zone/schema coordination; redundancy has not been established. Do not suppress it based on count alone.
- No unbounded listener/render feedback loop was observed in the bounded runs. Cell nodes remain reused on ordinary edits, selection and paste. This is not a long-duration leak or state-transition audit.
- Existing `scripts/bench-datagrid-incremental-row-mutations.mjs` **does not start**: it imports `createAdvancedClientRowModel` from the stable dist root, which no longer exports it. The import failure was reproduced with a 1k/one-sample invocation. This is a benchmark-maintenance gap, not a product speed finding. No historical baseline from that script is used here.

## Core action matrix

Milliseconds, **median / p95**, 30 samples per cell. These include Core facade bookkeeping and minimal observer callbacks, not Vue or browser work. `paste100` is a **100-row × 2-field patch planning/application proxy**, not native clipboard UI; real Vue paste is measured separately. `modelBatch20` is flat; the sorted variants explicitly exercise projection work.

| Action | 1,000 rows | 5,000 rows | 20,000 rows |
| --- | ---: | ---: | ---: |
| independent | 0.062 / 0.383 | 0.220 / 0.243 | 0.800 / 0.998 |
| noop | 0.069 / 0.390 | 0.334 / 0.454 | 1.375 / 1.651 |
| chain3 | 0.178 / 0.272 | 0.282 / 0.422 | 1.027 / 2.504 |
| formulaChain3 | 0.144 / 0.230 | 0.272 / 0.370 | 1.189 / 1.680 |
| fanout32 | 0.304 / 0.923 | 0.442 / 9.596 | 1.243 / 1.995 |
| dense16 | 0.263 / 0.316 | 0.444 / 0.529 | 1.107 / 2.540 |
| sort | 0.193 / 0.281 | 0.934 / 6.039 | 3.477 / 5.483 |
| filter | 0.234 / 1.061 | 0.944 / 1.352 | 3.803 / 5.167 |
| group3 | 0.725 / 1.189 | 3.601 / 5.286 | 17.159 / 24.714 |
| groupHigh | 0.621 / 0.998 | 3.110 / 4.426 | 15.166 / 19.795 |
| aggregateEdit | 0.590 / 2.340 | 2.874 / 3.930 | 11.575 / 15.632 |
| treeDepth8Edit | 2.121 / 3.387 | 14.580 / 16.060 | 64.577 / 96.853 |
| treeDeltaEdit | 0.315 / 0.737 | 2.299 / 2.999 | 10.885 / 13.131 |
| pivot | 0.679 / 0.935 | 3.035 / 3.582 | 12.200 / 13.476 |
| pivotHigh | 1.588 / 5.191 | 6.246 / 10.684 | 31.470 / 36.479 |
| pivotValueEdit | 0.864 / 2.433 | 3.495 / 4.126 | 13.498 / 14.685 |
| append4 | 0.131 / 0.206 | 0.878 / 1.529 | 3.953 / 6.147 |
| remove4 | 0.181 / 0.308 | 1.374 / 2.066 | 5.915 / 8.862 |
| selectionOne | 0.013 / 0.027 | 0.026 / 0.028 | 0.069 / 0.073 |
| selectionAll | 0.011 / 0.035 | 0.026 / 0.033 | 0.069 / 0.080 |
| summaryAll | 1.139 / 1.627 | 8.110 / 12.682 | 19.642 / 46.818 |
| resize | 0.003 / 0.005 | 0.002 / 0.003 | 0.002 / 0.003 |
| reorder | 0.004 / 0.006 | 0.003 / 0.003 | 0.003 / 0.010 |
| pin | 0.005 / 0.024 | 0.004 / 0.009 | 0.003 / 0.030 |
| viewport | 0.006 / 0.016 | 0.018 / 0.023 | 0.062 / 0.069 |
| paste100 | 0.218 / 0.441 | 0.355 / 0.390 | 0.961 / 1.146 |
| sequential20 | 0.739 / 1.060 | 3.765 / 4.489 | 16.970 / 18.152 |
| modelBatch20 | 0.721 / 1.722 | 3.797 / 4.468 | 17.810 / 21.129 |
| facadeBatch20 | 0.821 / 1.888 | 3.728 / 4.432 | 16.881 / 19.021 |
| sortedSequential20 | 5.550 / 6.109 | 23.728 / 25.580 | 104.898 / 117.499 |
| sortedModelBatch20 | 5.562 / 6.055 | 23.979 / 30.874 | 110.263 / 138.962 |
| sortedPatch20 | 0.277 / 0.398 | 1.229 / 2.787 | 5.222 / 7.492 |
| captureView | 0.310 / 0.405 | 1.505 / 1.992 | 6.135 / 7.809 |
| captureClone | 0.844 / 0.890 | 4.246 / 4.893 | 19.280 / 22.736 |

Cold/cache controls: a first sort on fresh models observes N sort-value misses. The warmed direction-change and stable-reapply probes observe **N hits / zero misses**; an unrelated edit under active sort observes zero sort lookups and zero projection recompute cycles. Fresh-model timing samples and all per-step cache deltas are in the JSON artifact. Do not call a repeated invalidating operation a cache hit without these counters.

## Production Vue action matrix

Milliseconds. Call and Vue-flush columns are medians; task CPU is **median / p95** through the two-frame observation window. Layout is median CDP layout CPU. Counts are separate **first-action** observed passes and therefore need not match warmed DOM churn or warmed timings exactly. Scroll's deferred work can occur after Vue flush; its small call time is not frame latency.

| Action, 20k × 12 | Call | Vue flush | Main-thread task CPU | Layout | Component updates | Elements created / cell nodes retained |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| edit | 3.900 | 10.000 | 17.045 / 17.778 | 0.055 | 31 | 0 / 264 |
| selectOne | 0.200 | 8.400 | 9.498 / 11.055 | 0.107 | 20 | 5 / 264 |
| selectAll | 0.200 | 8.500 | 10.155 / 11.332 | 0.000 | 20 | 6 / 264 |
| resize | 0.200 | 7.800 | 9.974 / 22.882 | 0.273 | 22 | 38 / 264 |
| reorder | 0.200 | 8.400 | 10.949 / 13.266 | 0.547 | 22 | 84 / 192 |
| pin | 0.100 | 17.500 | 24.008 / 25.345 | 0.447 | 25 | 56 / 240 |
| editor | 0.100 | 7.600 | 8.976 / 10.993 | 0.048 | 14 | 1 / 264 |
| scrollY | 0.100 | 0.100 | 2.915 / 41.407 | 0.000 | 0 | 0 / 264 |
| scrollYShift | 0.100 | 0.100 | 42.290 / 43.706 | 1.271 | 18 | 212 / 264 |
| scrollX | 0.200 | 0.200 | 3.228 / 5.894 | 0.000 | 0 | 0 / 264 |
| scrollXShift | 0.100 | 0.100 | 1.989 / 2.656 | 0.000 | 17 | 86 / 264 |
| paste | 0.100 | 16.700 | 25.543 / 31.602 | 0.267 | 52 | 2 / 264 |
| sequential20 | 3.500 | 185.300 | 192.540 / 222.407 | 0.187 | 297 | 0 / 264 |
| batch20 | 21.100 | 27.300 | 34.290 / 35.418 | 0.157 | 34 | 0 / 264 |
| capture | 7.500 | 7.500 | 8.085 / 9.366 | 0.000 | 0 | 0 / 264 |
| exportPrepare | 238.000 | 238.000 | 240.748 / 297.116 | 0.000 | 0 | 0 / 264 |
| sort | 8.000 | 15.300 | 24.713 / 33.933 | 0.580 | 31 | 0 / 264 |
| filter | 5.700 | 18.300 | 25.320 / 33.236 | 0.534 | 36 | 0 / 264 |
| group | 15.600 | 40.800 | 90.658 / 95.687 | 0.770 | 73 | 37 / 253 |
| pivot | 10.500 | 26.000 | 30.515 / 43.421 | 0.393 | 36 | 122 / 22 |
| aggregateEdit | 13.800 | 22.500 | 33.862 / 39.961 | 0.072 | 33 | 0 / 253 |
| append4 | 7.500 | 28.200 | 35.126 / 44.330 | 0.038 | 36 | 0 / 264 |
| remove4 | 9.500 | 30.300 | 38.674 / 47.981 | 0.536 | 36 | 0 / 264 |

Wide-column controls (medians, same 1k rows):

| Columns, 1k rows | Selection one task CPU | Reorder task CPU | Pin task CPU | Export preparation call | Initial cell nodes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 12 | 6.375 | 8.602 | 11.898 | 14.900 | 264 |
| 64 | 6.287 | 9.080 | 11.293 | 63.500 | 264 |
| 256 | 6.654 | 10.141 | 12.486 | 263.000 | 264 |


A fresh X window crossing can allocate more cells than a warmed crossing inside the retained horizontal window. Both first-action and repeated samples are preserved. Do not combine a cold counter pass with a warm median as if they were the same event.

## Scroll completion through idle

The continuous/two-frame matrix deliberately observes active scrolling. The additional isolated control waits via animation frames until the real `grid-stage--scrolling` state clears, then allows two render frames. Both horizontal precise-window idle and stage idle use the existing **120ms** policy. The elapsed column contains that intentional wait; it is **not 160ms of CPU**.

| Shape / action | CPU through idle, median / p95 | Elapsed through idle, median | Observed row.kind reads |
| --- | ---: | ---: | ---: |
| 1000 × 12 / scrollYShift | 22.427 / 33.763 | 162.900 | 425,720 |
| 5000 × 12 / scrollYShift | 32.002 / 42.063 | 163.400 | 2,113,720 |
| 20000 × 12 / scrollYShift | 46.461 / 49.255 | 164.500 | 8,443,720 |
| 1000 × 64 / scrollXShift | 28.046 / 36.827 | 163.800 | 571,853 |
| 1000 × 256 / scrollXShift | 28.209 / 41.050 | 164.000 | 571,853 |

The larger difference between active retained-X timings and isolated-X timings is real deferred work, not evidence that the scroll event itself is expensive. No fixed `sleep()` determines the completion boundary.

## Six-phase ownership breakdown

The phases nest: synchronous event subscribers may do reconciliation before an API call returns, and render work may run in later microtasks/rAF. The table names observed owners/work; it does not invent exclusive timings by subtracting noisy measurements.

| Action | 1 Mutation | 2 Compute | 3 Projection/materialization | 4 Events | 5 Adapter reconciliation | 6 DOM/layout/paint |
| --- | --- | --- | --- | --- | --- | --- |
| Independent edit | k target lookup; N rollback copy | 0 | 0 actual flat projection cycles | 1 model/facade row event | Empty record-selection scan N; snapshot amplification | Existing cells retained; 0 elements created in count pass |
| Short/wide/dense dependencies | Same backup | 3 / 32 / 16 evaluations, targeted rows | Computed overlay + N workspace/slice | 1 row event | Formula-specific Vue scenario not separately timed | Formula-specific DOM cost unmeasured |
| Sort | Query state update | No formulas in fixture | Cache N hits on warmed pass; sort/visible stages | Row + projection events | Projection identities and render window update | Virtual cell shells retained; content/layout update |
| Filter | Query state update | No formulas | Predicate visits N; downstream projection once | Row + projection events | Membership/window reconciliation | Bounded cells, repaint/layout |
| Group / aggregate edit | Query or local value mutation | 0 formula evaluations | Group key/aggregate work; explicit reapply stage counts recorded | Row + projection; group can add viewport event | Hierarchy/group render state changes | Virtual group/cell materialization |
| Tree edit | Local value + backup | 0 | Depth-8 reapply rebuild versus working delta control; distinct policies | 1 event; reapply has one recompute | Tree-specific Vue case not timed | Tree-specific browser cost unmeasured |
| Pivot / pivot edit | Query/value mutation | 0 | Axes/measure scan + output cells; current full fallback | Row/projection + derived column event | Generated schema reconciliation | Bounded pivot DOM |
| Append/remove 4 | Ordered array, duplicate/version/index work | 0 | Flat structural fast path; not a full projection cycle | 1 row event | Whole-ID reconciliation and snapshot reads | Visible slots reused; necessary index/text updates |
| Selection one/all | Metadata only | 0 | No cell enumeration or projection; diagnostic N scan remains | 1 selection event | Selection styles/status and controlled-state reads | Few overlay elements; all original cell nodes retained |
| Explicit summary | No source change | Aggregate selected values | 5k/25k/50k processed cells; cap at 50k | No row event | Headless summary only | No DOM measured |
| Resize/reorder/pin | Column state/order | 0 | No row projection | 1 column event; reorder observed 2 | Header/pane/column windows; many snapshot reads | Bounded nodes; small forced layouts in pin |
| Editor open | Local session state | 0 | No source projection | No row event | Editor/selection rendering | One input created; focus/style/layout |
| Scroll X/Y | Scroll offsets/viewport only | 0 | Retained/window-shift paths; no data recompute | No data-change event required | rAF and idle work; diagnostic scans on materialization | Compositor movement plus bounded window churn |
| Real paste 10×4 | Parse/validate + grouped row patch | 0 | Flat path, not full compute | 1 row event | Selection/clipboard/history feedback and N reconciliation | Cells retained; clipboard await separately observed |
| Sequential/batch | Repeated backups versus existing consolidated patch | Per model policy | Sorted patch calls still 20 cycles inside model batch | Facade batching coalesces; model work remains | Vue batching avoids 20 separate flushes | Cell nodes stay retained |
| captureView | Read only | 0 | N immutable node/state wrappers | 0 | No Vue updates | 0 |
| Export preparation | Captured read view | Values resolved, no formula translation in fixture | N×C worksheet cells; avoidable key normalization | Progress callback only | Main-thread synchronous preparation | No grid DOM update; writer/download excluded |

## What is necessary, and what is not established

- Sorting/filtering/group/pivot query changes must inspect relevant inputs and publish a new logical projection. High-cardinality output and deep tree structure genuinely require more nodes/aggregate work. The measured full pass is not by itself a defect.
- Explicit group/tree reapply is distinct from the already-supported incremental aggregate delta policy. The latter is checked separately; results are not compared before a documented completion point.
- Metadata selection does not expand N×C cells. Its existing unnecessary N dependency comes from snapshot diagnostics. Explicit summary intentionally reads selected values and respects the **50k-cell budget**.
- Initial DOM was about 264 cells for all tested column counts; ordinary edit/selection/paste retained those cell nodes. Fresh window shifts grew the bounded pool (e.g. 363 for a Y jump, 624 for wide X), rather than rendering all N×C cells.
- Existing sort-value caching works in warmed controls. There is no evidence of all-row formula evaluation for local independent dependencies, quadratic projection complexity, a runaway render feedback loop, or a large paint bottleneck in this dataset.

## Artifacts and reproduction

Persistent compact results: [JSON](./202610/datagrid-computational-cost-results.json). Raw samples, 13 CPU profiles, 4 sampled allocation profiles and 9 timeline traces: `/tmp/affino-cost-audit/`. Representative files: `independent.cpuprofile`, `formulaChain3.heapprofile`, `captureView.heapprofile`, `browser-20000x12-scrollYShift.{cpuprofile,trace.json}`, `browser-20000x12-exportPrepare.{cpuprofile,trace.json}`, `browser-20000x12-pin.trace.json`. Source maps and build logs are retained there. Raw files are local generated artifacts; scripts below regenerate them.

Local profile links: [patch CPU](/tmp/affino-cost-audit/independent.cpuprofile), [patch allocation sampling](/tmp/affino-cost-audit/independent.heapprofile), [Vue vertical-window CPU](/tmp/affino-cost-audit/browser-20000x12-scrollYShift.cpuprofile), [Vue vertical-window timeline](/tmp/affino-cost-audit/browser-20000x12-scrollYShift.trace.json), [export preparation CPU](/tmp/affino-cost-audit/browser-20000x12-exportPrepare.cpuprofile), [pin layout timeline](/tmp/affino-cost-audit/browser-20000x12-pin.trace.json).

Reproduce from this effective source tree, after installing the repository's locked development dependencies and Chromium:

```sh
export COST_OUTPUT=/tmp/affino-cost-audit-rerun
export COST_BROWSER_DIST="$COST_OUTPUT/browser-dist"
mkdir -p "$COST_OUTPUT/source-maps"
git rev-parse HEAD > "$COST_OUTPUT/commit.txt"
git status --short > "$COST_OUTPUT/status.txt"
git diff > "$COST_OUTPUT/baseline.patch"
pnpm --filter @affino/datagrid-core run build
node scripts/audits/datagrid-cost-core.mjs
node scripts/audits/datagrid-cost-cache.mjs
pnpm exec vite build --config scripts/audits/datagrid-cost-browser/vite.config.mts
cp "$COST_BROWSER_DIST"/assets/*.map "$COST_OUTPUT/source-maps/"
pnpm exec vite preview --config scripts/audits/datagrid-cost-browser/vite.config.mts
```

In a second terminal with the same `COST_OUTPUT` / `COST_BROWSER_DIST`:

```sh
node scripts/audits/datagrid-cost-browser.mjs
node scripts/audits/datagrid-cost-scroll-idle.mjs
node scripts/audits/datagrid-cost-summarize.mjs
```

`COST_SIZES`, `COST_SAMPLES`, `COST_ACTIONS` narrow Core work; `COST_BROWSER_SAMPLES`, `COST_BROWSER_ACTIONS`, `COST_BASE_URL` narrow browser work. Use a fresh output directory for a clean rerun. Existing local controls were run in separate subdirectories and combined in the stored summary. Counters, profiling and timings are distinct passes; do not compare an instrumented pass duration with plain timing.

## Limits and safe local optimization order

Shared VM, GC, clock resolution and unknown host scheduling limit absolute timing claims. There are 30 samples, no dedicated-device SLA calibration or p99 claim. No remote/worker compute, browser formula UI, deep-tree browser rendering, huge cross-row dependencies, pathological callbacks, 1m-row datasets, touch hardware, sustained leak test or worker XLSX serialization benchmark. Layout/paint CPU is measured by Chromium; GPU raster/presentation completion and hardware FPS are not measured. No jsdom result is presented as browser evidence.

1. Cache diagnostic group counts / reduce internal snapshot construction, preserving revision semantics.
2. Keep rollback correctness while eliminating full backups for no-op and local patches; then remove the verified empty-selection scan.
3. Reconcile the existing model-batch patch scope, with one multi-row patch as the safe current caller path. Do not suppress required model/facade events globally.
4. Reuse compute scratch storage under the existing model lifecycle and exception-safety boundary.
5. Hoist export column work and schedule preparation in bounded units; preserve the captured data snapshot and callbacks.
6. Reduce capture-local clone-context churn; address the small pin layout boundary only after the larger JS costs.
7. Repair the stale import in the existing incremental benchmark and establish targeted count-based regression budgets after reviewing these baselines.

The original optimization order above describes the pre-remediation state and is superseded by the follow-up below for the items completed there.

## Remediation follow-up

The following targeted changes were made after collecting the baseline. The original measurement data above and in the JSON artifact are unchanged.

- **C01:** group-bucket counts are cached by grouped-projection array identity, avoiding another full kind scan on repeated snapshots of the same projection.
- **C02:** patch rollback now journals only source rows and row versions that can be touched by the patch. It keeps in-place source-array behavior and exception recovery while avoiding full dataset and Map copies on local and no-op patches.
- **C03:** Vue row-selection reconciliation returns immediately when its canonical selection snapshot is empty.
- **C05:** compute dirty propagation and executor row marks, visit epochs, batch positions, and working-row storage are sparse `Set`/`Map` structures. Short dependency chains no longer allocate row-count-sized scratch arrays.
- **C06:** formula metadata is resolved once per exported column and is not looked up in values-only mode.
- **C07:** one clone context is shared for the duration of a captured read view instead of constructing a `WeakMap` for each row state.
- The stale mutation benchmark now imports the model from the supported `advanced` build entry and completes a 1k/one-sample smoke run.
- **C04 now coalesces compatible patch work** inside `batchMutations()`. Projection-dependent reads and recompute-policy changes flush a segment, preserving observable sequencing. At 20k rows, a 20-patch sorted batch measured 1 recompute/1 event at 6.195 ms median / 7.826 ms p95; this is a focused runner, not a release guarantee.

Post-change Core checks used the same runner after a fresh build, 20k rows, 5 warmups and 30 samples. The formula chain median/p95 changed from **1.189/1.680 ms to 0.144/0.308 ms**; dense 16-node changed from **1.107/2.540 ms to 0.293/0.387 ms**. Observed dataset-sized typed-array allocation for targeted compute decreased from **300,000 bytes to zero**. Large-array result slots decreased from **40,000 to 20,000**; the remaining 20k slot copy is the copy-on-write output needed when computed rows change. For local patches, post-change observed copy counters were zero large-array slots and zero copied Map entries. These are focused samples from the same shared VM, not release guarantees.

After the final changes, Core and Vue type-checks passed; the focused Core suites passed (248 tests across client row model, API contract, and failure recovery); focused Vue export/header tests passed (22 tests); Core and Vue production builds passed. The 20k-row batch comparison ran 5 warmups and 30 samples per case. The header read-after-write was removed; the remaining measured layout work is small and no broader layout bottleneck was established.
