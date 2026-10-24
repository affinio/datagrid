# Incremental computation and projection correctness audit

Date: 2026-10-24. Initial status: read-only audit identifying eight confirmed correctness defects. Remediation status: **all eight fixes are implemented and validated**, with the validation record below.

Scope: `datagrid-core`, its in-process formula/compute integration, the formula engine evaluator, and orchestration's pivot/base-column composition. No DOM or Laravel inspection or tests. No Vue inspection was needed to confirm these Core defects. No product implementations or public APIs were changed.

**Answer to the audit question: no.** Equal completed source/configuration states can produce different effective values, aggregates, projection order, membership, or pivot layout. Fresh construction also shares three incorrect behaviors with the incremental path: cold cross-row reads, computed grouping keys, and computed pivot measures.

## Baseline and provenance

- Initial HEAD: `72d6a0d71d717c631ea092299160fd28274c54c9`.
- Initial working tree was dirty, including Core consistency/exception-safety fixes, orchestration/Vue changes, the two previous audit reports, and unrelated DOM work. Exact initial status and tracked diff were saved before diagnostics in `/tmp/affino-incremental-audit/{status-before.txt,baseline.patch}`. Results apply to that effective source tree, not a clean checkout of the initial commit.
- Read the [consistency audit](./datagrid-consistency-audit-2026-10.md) and [exception-safety audit](./datagrid-exception-safety-audit-2026-10.md), including their implementation follow-ups. Effective-row lookup, atomic schema replacement, pivot/base-schema reconciliation, compute exception cache cleanup, mutation recovery, and failed registration cleanup are present. Existing recovery tests passed. These earlier findings are not reported again as new defects.
- HEAD changed externally during this audit to `2c7593faca621f0ed503a62a4f7f0e6383d14171` (`fix(datagrid): harden failure recovery and teardown`). This audit did not create a commit. New blob hashes from the initial dirty diff were checked against current Core/formula/orchestration source contents: those modified audited source files did not change content during the audit.
- A later external commit moved HEAD to `4a129c674b8b04ff1ff26a21929b38bfbaa9e487` (`feat(datagrid-dom): add framework-independent adapter`). That excluded adapter was not inspected; audited Core findings were confirmed before this packaging commit.
- That first external commit also captured an intermediate version of the newly created temporary diagnostic spec. Its final version was archived under `/tmp/affino-incremental-audit/`, then the temporary spec was removed from `src/models/__tests__` so these deliberately failing diagnostics do not enter ordinary test discovery. Consequently Git shows deletion of that diagnostic relative to the newer HEAD; this is temporary-test cleanup, not deletion of a pre-existing baseline product test.

## Method and completion semantics

A separate plain array of source records and separate configuration object are maintained by the diagnostic driver. Branch A receives public row-model/API mutations. Branch B is constructed afresh from cloned driver records and current definitions/settings after each completed step. B never reads A's projected data, overlay, calculation snapshot, row cache, or generated columns.

Source values are read from `getRowById()`, not `getSourceRows().data`: the latter intentionally materializes computed overlays. Effective values are read separately from `getEffectiveRowById()`. Source order is retained because positional formula references depend on it. Local arithmetic oracles use `v*q`, `v+10`, their converging sum, and a dependent multiplication; filter/sort oracles use ordinary array predicates/comparisons; group sum/min and small pivot/range totals use plain arithmetic.

Ordinary directed patches explicitly request `recomputeSort`, `recomputeFilter`, and `recomputeGroup`. For API edits, `policy.setProjectionMode()` is called explicitly. Mutable/excel-like modes are tested with both auto-reapply settings. A deferred branch is compared only after `view.reapply()`. Immutable mode is tested as mutation rejection with unchanged state, not as a mutation-capable mode. Structural mutations and query setters are compared after their synchronous completed return. `rows.batch()`, `batchMutations()`, sequential edits, and structural batches have separate controls.

For a mismatch, the captured A result is cloned before any recovery attempt. A then receives one `recomputeComputedFields()` and one `refresh('reapply')`; B remains independent. Some focused probes also capture the intermediate recompute-only result. Repeated retries until agreement are not counted as recovery.

Semantic comparison covers source/effective values by stable ID, projection sequence and structure, expansion, group aggregates, pagination, and ordered pivot descriptors. Generated pivot column keys are replaced with `(columnPath tuple, valueField, aggregation, aggregationId)` keys; synthetic row identity is based on axis tuples or the canonical encoded group path, with incidental payload IDs removed. Source record IDs remain significant. Revisions, counters, timings and object references are excluded. Runtime formula error values are compared with their logical cell values; an isolated DIV_ZERO transition probe also compares error code, rowId, field and formulaName against independent construction; spreadsheet comparisons include raw input, effective display value, and error kind/code per logical cell. Last-pass formula diagnostic counters are not treated as a canonical persistent cell-error store.

The new directed/generative arithmetic uses small integers and exact comparisons; no tolerance hides a mismatch. Existing floating-point formula parity tests additionally use their declared `toBeCloseTo(..., 8)` checks. Deep comparison preserves missing/undefined values and non-finite numbers; JSON logs serialize undefined array entries as null, so the report explicitly spells out `undefined` where relevant.

## Findings, ordered by fix urgency

All eight findings are **P1, high confidence**, with deterministic public-operation reproductions. None requires a new public API, coordinator, package boundary, or adapter workaround.

### I01 — cross-row reads use the current record when a target cache entry is cold

**Invariant:** a reference to row j must read row j, independently of cache warmth/evaluation order; references beyond the data boundary must not invent a record.

- Input: `[{id:'a',v:1},{id:'b',v:2},{id:'c',v:3}]`; formula `prev = COALESCE(v[-1], 0)`.
- Operations: construct model; read all effective `prev` values. Also run a full recompute and reapply.
- A and fresh B: `[0,2,3]`; independent oracle: `[0,1,2]`. Full recompute/reapply remains `[0,2,3]` in the focused probe.
- A window probe also reads beyond the final row: with `base=v*2`, source 1/2/3, `SUM(base[-1:1])` gives `[6,12,16]`; oracle is `[6,12,10]`. The last synthetic value comes from reading the current node at an out-of-range target.
- Cause: the token reader passes the current row node with a different target index at [token resolver:211](../../../packages/datagrid-core/src/models/compute/clientRowComputedRegistryTokenResolverRuntime.ts#L211). On a cache miss, [executor:124](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts#L124) evaluates that supplied node and stores its value under the target index. It does not resolve/bounds-check the target node against the source baseline. Cache-parity fallback repeats that wrong-node read.
- Direction: resolve the actual target source/working row inside the column read owner and define out-of-range reads consistently before caching.
- Missing regression: cold native relative reads, forward/backward windows, upper boundaries, absolute reads, and cache parity enabled/disabled against a simple array oracle. Include different definition/evaluation orders. This is a shared algorithm error, not merely an incremental-path defect.

### I02 — invalidation propagates a changed value to the same row only

**Invariant:** dirty propagation must invert each dependency's row domain, including relative/window/absolute consumers.

- Input: `[{id:'a',v:1},{id:'b',v:2}]`; `base=v*2`, `prev=COALESCE(base[-1],0)`. Initial `prev=[0,2]` is correct, so this repro does not depend on I01.
- Operation: patch a.v to 8 with all recompute flags true.
- A: base `[16,4]`, prev `[0,2]`; fresh B/oracle: prev `[0,16]`.
- First explicit full recompute/reapply repairs this focused case to `[0,16]`.
- Absolute control: `ref=[base]1` with smartsheet one-based syntax gives A `[16,2,2]` after patching the first of three rows, versus B/oracle `[16,16,16]`; full recompute repairs it.
- Cause: source dirty roots are seeded only at the patched row in [computed execution:317](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionRuntime.ts#L317), and changed computed values enqueue every dependent at that same row in [executor:416](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts#L416). The executable propagation does not transform row indexes using relative/window/absolute dependency domains.
- Direction: make dirty row targets honor the existing reference domains in both source-root seeding and computed-to-computed propagation. Keep field-level graph ownership in Core's compute integration.
- Missing regression: two-row repro; range boundary edits; absolute fan-out; converging cross-row chains; targeted context recompute with cross-row dependents. Check filter/sort membership driven by those dependents.

### I03 — replacing an ID without changing an overlay array's length loses materialization metadata

**Invariant:** an overlay's stored values and per-row presence metadata must agree after structural replacement, even if the same number of records remains.

- Input: `[{id:'a',v:1},{id:'b',v:2}]`; `d=v*2`.
- Operation: `setRows([{id:'x',v:5},{id:'b',v:2}])`.
- A effective/projected d: `[undefined,4]`; fresh B/oracle: `[10,4]`. Source records themselves are correct.
- One full recompute plus reapply does **not** repair it. A one-record replacement, where no old row remains, passes; retaining the second row is essential to the reduced repro.
- Cause: [overlay prune:238](../../../packages/datagrid-core/src/models/materialization/clientRowComputedSnapshotRuntime.ts#L238) clears counts and constructs a hole for the new ID, but only replaces the value array when length or positions change. Same-length, same-position survivors leave the old value array behind while counts describe the new sparse array. Later equal-value shortcuts at [overlay apply:213](../../../packages/datagrid-core/src/models/materialization/clientRowComputedSnapshotRuntime.ts#L213) do not rebuild missing counts; [materializeRow:389](../../../packages/datagrid-core/src/models/materialization/clientRowComputedSnapshotRuntime.ts#L389) skips the whole row without its count.
- Direction: commit a consistently rebuilt overlay/presence state for identity removals/replacements, and compare against the committed overlay consistently on retry.
- Missing regression: replace first/interior IDs while preserving length and a trailing survivor; check source/effective/projected/resolver reads and the first explicit recompute. Exercise `replaceRows` and API `setData`/`replaceData` through the same owner.

### I04 — a completed pivot edit leaves a delta that is replayed by a later structural mutation

**Invariant:** a pivot delta must apply exactly once to its matching projection generation; insert/remove must use the current record set.

- Input: a=(X,2024,v=1), b=(Y,2025,v=2); pivot rows g, columns year, SUM(v), no formula fields.
- Operations: patch a.v=8 with all recompute flags true; remove b.
- A: X/2024 becomes **15**, Y and its 2025 column remain with value 2. B/oracle: only X/2024=8 and the 2024 column remain. Pagination also counts obsolete pivot rows.
- First explicit reapply repairs the focused repro.
- Cause: [patch projection:279](../../../packages/datagrid-core/src/models/mutation/clientRowPatchRuntime.ts#L279) recomputes before returning its prepared delta; [coordinator:193](../../../packages/datagrid-core/src/models/mutation/clientRowPatchCoordinatorRuntime.ts#L193) stores that delta **after** recompute has already consumed the edit through a full projection. The next structural pass finds it in [pivot stage:46](../../../packages/datagrid-core/src/models/projection/clientRowProjectionPivotStage.ts#L46) and patches the already-updated projection instead of rebuilding for removal/insertion. 15 is 8+(8−1).
- Direction: publish a prepared delta before its owning execution, consume/clear it in that execution, and invalidate pending deltas across structural changes. Do not retain a completed request as a future request.
- Missing regression: patch→remove/insert, axis edit→remove, batch→insert, and a failed projection followed by the first successful structural mutation. Verify values, row tuples, generated column tuples and counts together.

### I05 — reapply-enabled tree edits leave cached aggregates stale

**Invariant:** changing an aggregate input must update the tree's aggregate state even when tree topology, filter and sort are unchanged.

- Input: root a.v=0, child b.v=2; parent tree with `dependencyFields:['parent']`, expanded by default; SUM(v); no formula fields.
- Operation: patch b.v=9 with `recomputeGroup:true` and the other recompute flags true.
- A: child displays 9 but root aggregate remains 2. Fresh B/oracle: root aggregate 9. A full computed recompute/reapply still leaves 2.
- Confirmed in both parent and path trees in the broader matrix. This is not a claim that all tree aggregate updates fail: the existing delta path with reapply disabled is a distinct path.
- Cause: tree invalidation at [patch analyzer:332](../../../packages/datagrid-core/src/models/mutation/rowPatchAnalyzer.ts#L332) excludes `affectsAggregation`. [patch runtime:227](../../../packages/datagrid-core/src/models/mutation/clientRowPatchRuntime.ts#L227) disables the incremental aggregate delta when group recomputation is requested. Identity-cache patching replaces payloads/marks dirty branches but does not recalculate aggregate state. The tree cache key at [tree runtime:94](../../../packages/datagrid-core/src/models/tree/treeProjectionRuntime.ts#L94) omits row/aggregate revisions; aggregate stage explicitly returns the cached tree group projection at [aggregate stage:95](../../../packages/datagrid-core/src/models/projection/clientRowProjectionAggregateStage.ts#L95).
- Direction: on this path either update the existing tree aggregate contribution owner or invalidate/rebuild tree aggregate state before publishing the group projection. Preserve the working delta path.
- Missing regression: parent/path trees, recomputeGroup true/false followed by reapply, source/computed aggregate inputs, and SUM/AVG/MIN on ancestor chains.

### I06 — grouping reads source payloads instead of computed keys

**Invariant:** grouping after compute must use the same effective field values as the completed compute/filter/sort pipeline.

- Input: a.v=1, b.v=2; `d=v*2`; group by d, expanded.
- A and fresh B group values: `['']`, one group. Oracle: `['2','4']`, two groups.
- Full recompute/reapply does not repair it. The differential branch comparison alone passed this erroneous common behavior.
- Cause: [group stage:259](../../../packages/datagrid-core/src/models/projection/clientRowProjectionGroupStage.ts#L259) passes the raw `readRowField` helper to grouping rather than the model's existing effective `readProjectionRowField`, which correctly serves filter/sort and the ordinary aggregation engine.
- Direction: route grouping through the existing effective-value owner; retain group-value cache invalidation by changed keys/definitions.
- Missing regression: initial computed grouping, edits crossing groups, nested grouping and formula definition replacement, checked against arithmetic-derived group paths.

### I07 — pivot measure aggregation bypasses the effective-value reader

**Invariant:** a pivot SUM of a computed measure must aggregate its effective numeric values.

- Input: a=(X,2024,v=1), b=(X,2024,v=2); `d=v*2`; pivot g/year/SUM(d).
- A and fresh B: 0; independent oracle: 2+4=6. Full recompute/reapply still gives 0.
- Cause: the Core bootstrap passes `readProjectionRowField` to pivot runtime, and axis resolvers use it. However, the pivot aggregation engine at [pivot runtime:157](../../../packages/datagrid-core/src/models/pivot/pivotRuntime.ts#L157) forwards only the aggregation registry, omitting `readRowField`, so measure readers see raw payloads without d.
- Direction: pass the existing effective reader to the pivot aggregation engine, preserving the intentional source/effective distinction and previous-value semantics of deltas.
- Missing regression: computed measures under SUM/AVG/MIN, totals, measure edits, grouping+filter+pivot, and initial versus incremental construction against a plain tuple-keyed reduction.

### I08 — disabling pivot reuses a pivot-specific intermediate projection

**Invariant:** leaving pivot must restore all currently accepted sort/group semantics before publishing the ordinary projection.

- Minimal input: a=(X,2024,v=1), b=(Y,2025,v=2), no formulas.
- Operations: enable pivot g/year/SUM(v); set sort v descending; disable pivot.
- A row IDs: `[a,b]`; fresh B/oracle with pivot off and that sort: `[b,a]`. First reapply repairs it.
- A second directed repro starts with nested grouping+aggregation, enables pivot, edits under pivot, then disables pivot. A returns four leaves with no group nodes; B returns the correct ten-row grouped projection. Thus pagination/group totals can also disagree.
- Cause: [setPivotModel:291](../../../packages/datagrid-core/src/models/mutation/clientRowStateMutationsRuntime.ts#L291) restarts at pivot although toggling pivot changes group-stage behavior. [group stage:234](../../../packages/datagrid-core/src/models/projection/clientRowProjectionGroupStage.ts#L234) uses filtered ungrouped input while pivot is active; [pivot stage:28](../../../packages/datagrid-core/src/models/projection/clientRowProjectionPivotStage.ts#L28) later returns that retained intermediate when pivot is cleared without rebuilding the earlier stage.
- Direction: invalidate/recompute from the earliest stage whose semantics change with pivot mode, including the restore path after an exception. Do not restore stale adapter snapshots.
- Missing regression: three-operation sort repro; grouped roundtrip with edits or sort changes under pivot; pagination/expansion; axis/measure changes followed by pivot off. Existing orchestration base-schema reconciliation remains a separate, passing fix.

## Scenario matrix: what was actually executed

The directed Cartesian matrix is **13 configurations × 15 operations = 195 tests**. Configurations: flat, computed sort, computed filter, two-level grouping+aggregation, combined formula/filter/sort/group/aggregation, pivot, pagination, native cross-row formulas, parent tree, source sort, source filter, computed grouping, path tree. Every configuration has the same operation set: single cell; multiple fields; multiple rows; same-value write; unrelated field; append; prepend; insert; remove; replaceRows; setRows with a replaced ID; remove/readd ID; dependent patch batch; reorder; parent field patch. Parent-field patches outside trees deliberately serve as unrelated-field controls.

| Requested area | Executed evidence | Result / limit |
| --- | --- | --- |
| Single/multiple cells, unrelated/no-op writes | 195-test matrix and generated steps | Local arithmetic passes; cross-row and tree exceptions above |
| Append/prepend/insert/remove/replace/setData semantics | Public model matrix; existing API mutation contracts | Same-length ID replacement fails I03; API aliases covered by existing contracts rather than a new full cross-product |
| Remove/readd ID and reorder | All 13 configurations | No separate mismatch in these directed cases; later pivot structure after an edit fails I04 |
| A→B→C, branching/convergence | b1=v*q, b2=v+10, c1=b1+b2, d1=c1*2; existing parity suite | Local values match independent arithmetic |
| Relative/absolute/window dependencies | Native and smartsheet probes; structural matrix | I01/I02; absolute fan-out separately confirmed |
| Context/function/table changes | RATE replacement; full keyed context recompute; TABLE replacement | A/B agreement; existing targeted-context contracts also pass |
| Null/missing/type change | null, undefined, numeric string, boolean, number | A/B agreement for COALESCE/multiply chain |
| Register/remove fields/functions | Runtime registration/removal, source-shadowing formula, existing validation cases | No new mismatch in valid directed cases |
| value→formula→value and runtime error→success→error | Separate spreadsheet model; Core CHECK callback throwing for negatives | Compared against independent raw-input rebuild; no mismatch |
| Sort/filter source/computed and edited membership/order | Matrix, independent array oracle, API policies | Passes for local formulas; computed dependency errors can feed bad inputs downstream |
| Grouping/aggregation/key edits | Two levels; source and computed inputs; independent sum/min | Source grouping and ordinary computed aggregates pass; computed keys I06 |
| Tree reparent/expansion | Parent/path matrix; collapse/expand compared with independently operated B | Reparent/expansion controls pass; reapply-enabled aggregate edits I05 |
| Pivot axes/measures/on/off/totals | Matrix; explicit axis/measure transitions; source grand totals; arithmetic measure oracle | I04/I07/I08; source total control passed |
| Schema change before pivot roundtrip | Real orchestration public columns.setAll then pivot on/change/off | A/B column/row agreement; prior base-column fix retained |
| Pagination after row count changes | 15 operations in paginated mode; config changes | Directed checks pass. An initial invalid-page generator was corrected to respect canonical clamping, not filed as a bug |
| Batching | Model patch batch, mixed structural batch, API event batch + explicit reapply, sequential equivalents | Focused local controls agree; affected tree/pivot paths retain their findings |
| Host updates vs user edits | patchRows(full flags) versus API applyEdits(reapply:true) | Same completed state; client model has no datasource external-update capability |
| Undo/Redo | Real Core transaction service executing row patches under combined projection | Apply/Undo/Redo each agree with independently rebuilt B |
| Calculation-only snapshots | Existing tests and explicit control | Intentionally restore computed overlay without changing source; excluded from the equal-source fresh-rebuild invariant until recompute |
| Recovery | Escaping computed callback, comparator, filter reader, aggregation finalize; first successful retry | Retry agrees with fresh model; prior exception-safety fixes retained |
| Cell resolver | Live source/computed/display through a field alias and formatter after edit | A/B parity; computed value also checked against arithmetic |
| Separate workbook | Cross-sheet direct + TABLE references; edits, insert/rewrite, rename; separate sheet range/removal cases | Fresh workbook/sheet built from independently edited raw inputs; arithmetic totals pass |

## Generative execution and reduction

PRNG: unsigned 32-bit LCG `state = (1664525 * state + 1013904223) mod 2^32`, using `Math.imul`; no clock/random callbacks or sleeps.

- Data sequences: seeds **1337, 7331, 2026, 42, 1701**, each in flat, combined, pivot, cross-row and parent-tree modes: **25 runs**, up to 80 operations each.
- Configuration sequences: seeds **81, 512, 9001**, up to 60 operations each: **3 runs**. They change sort/filter/group/aggregation/pivot/pagination and source values. Generated page requests use page 0 so A and B do not differ merely because an earlier out-of-range page was canonically clamped.
- **1,265 operations checked**, including the first mismatching step; **15 runs completed**, **13 stopped at the first discrepancy**. No later steps after a discrepancy are counted as checked.
- Driver records/configuration are cloned into each B. Insert payloads are cloned when recorded so later edits cannot silently rewrite the replay log.
- Valid-operation deletion reduction was run to a fixed point. Replays with absent target IDs/duplicate inserted IDs are rejected as invalid reduction candidates. Reduced sequences are 1-deletion-minimal for the recorded operation payloads, not a proof of globally smallest values/configuration.

| Seed | Flat | Combined | Pivot | Cross-row | Parent tree |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1337 | 80 pass | 80 pass | mismatch at 6 | mismatch at 5 | 80 pass |
| 7331 | 80 pass | 80 pass | mismatch at 3 | mismatch at 2 | mismatch at 2 |
| 2026 | 80 pass | 80 pass | mismatch at 11 | mismatch at 4 | mismatch at 4 |
| 42 | 80 pass | 80 pass | mismatch at 6 | mismatch at 4 | 80 pass |
| 1701 | 80 pass | 80 pass | mismatch at 4 | mismatch at 6 | 80 pass |

Configuration runs: seed 81 mismatches at operation 48; 512 and 9001 complete 60 each. Its reduced sequence is enable pivot → change sort → disable pivot (I08).

Other reduced examples: 7331 pivot becomes patch b.v=24 → remove c (I04); 42 pivot becomes change c's year → remove c (I04); 7331 tree becomes one patch b.v=24 (I05); every reduced cross-row sequence is a single patch or two dependent patches inside one batch (I01/I02). Source edits and definitions for exact two-row reductions are given under each finding above.

## Executed checks and artifacts

Temporary spec is explicitly headed **DIAGNOSTIC ONLY**. Final diagnostic run: **269 tests, 222 passed, 47 failed**; failures represent the eight findings above, not 47 independent defects. Reducer tests and tests that assert an observed intentional behavior are diagnostic tooling; their passing status is not evidence of product correctness.

Existing contract runs, separately from diagnostics:

- Core: **193 passed in 5 files** — failureRecovery, formulaParity, clientRowModel, workbookModel, workbookReferenceMutation.
- Core additional: **172 passed in 5 files** — gridApi, transactionService, sheetModel, formulaEngine, projectionGuardrails.
- Orchestration runtime service: **10 passed in 1 file**.
- Formula engine evaluator parity: **2 passed in 1 file**, with a temporary Node-environment Vitest config. The package has no test:unit script; an initial script invocation did not run tests and is not counted.
- Total existing tests actually passed: **377**. This is focused validation, not a full package/monorepo test claim.
- Core, orchestration and formula-engine package type-checks **passed** after temporary-test cleanup. Core's type-check script also invoked and passed the existing `datagrid-plugins` and `projection-engine` dependency builds. No direct Core/orchestration/formula-engine package builds, tarball consumers, browser checks or benchmarks were run.
- One additional isolated diagnostic **passed**, comparing runtime error code and logical row/field/formula target with fresh construction for DIV_ZERO → valid → DIV_ZERO. This is separate from the main 269-test run. Total temporary diagnostics executed in the final versions: 270 cases, 223 passing assertions and 47 failing healthy-outcome cases.

Artifacts: `/tmp/affino-incremental-audit/` contains the final spec, initial/final commits, initial status/diff, raw logs, final Vitest JSON, mismatch snapshots, probes, completed sequence logs, `reduced.json`, and `reduced-config.json`. They are temporary local artifacts, not a published reproducibility bundle.

The archived diagnostic is an audit artifact, not a CI suite. Its reducer assertion expects the old mismatches to exist; the final remediation run used a temporary copy with that assertion changed to require zero divergences, then removed the copy. To reproduce that final run, restore the archived spec and make the same one-line assertion adjustment before running it.

## Limits, allowed differences and unverified risks

- A/B agreement without an independent arithmetic/structure oracle only establishes path equivalence. It does not establish mathematical correctness. I01/I06/I07 explicitly demonstrate that limitation.
- No exhaustive function library, iterative cycle convergence, complex numeric accumulation order, locale/date policy, async remote compute protocol, worker-owned row model or datasource history audit. The checked in-process compute transport's dispatch result is synchronous; no unsupported async completion semantics were invented. No sleep-based async tests were used.
- Workbook and grid references were tested under their separate APIs. Coverage does not extend to every workbook join/derived view, sheet deletion, column rename, cycle, or Excel formula rewrite mode. Existing workbook tests provide additional protection but are not a new differential oracle for those features.
- Full persistent per-cell runtime error inventory across untouched rows was not independently reconstructed; Core diagnostics describe the last pass. Checked runtime-error transitions and sheet error kind/code comparisons do not establish exhaustive error-store equivalence.
- Arbitrary side-effecting user callbacks are outside the pure equivalence claims. Exceptions were deliberately injected in a separate recovery fixture. No claims are made about compensating irreversible callback effects.
- Immutable policy rejection, clamped pagination, intentional calculation-snapshot restore, and unreapplied edits are allowed contract differences; they were not filed as defects.
- New targeted-context plus cross-row propagation, definition changes during a failed projection, custom aggregation merge/remove, sparse pivot storage, all aggregate operators, and several combined expansion/pivot cases remain unverified beyond existing tests. They are regression targets, not additional confirmed findings.
- No excessive-invalidation performance finding is made: this audit did not measure extra work counters or benchmark latency.
- Orchestration schema roundtrip passed. No adapter workaround is warranted for the confirmed Core failures.

## Original local correction order (completed below)

Before claiming compute/projection correctness for release:

1. Fix I03's overlay value/presence coherence and add the non-repairable two-row regression.
2. Fix I01's row-target reads/bounds, then I02's row-domain invalidation. Re-run both independent oracles and the generated sequences; warming a wrong cache is not an acceptable fix.
3. Fix I06/I07 by wiring existing effective-value readers into group keys and pivot measures. Check independent totals, not just A/B equality.
4. Fix I04's delta lifetime/execution ordering and I08's earliest-stage invalidation. Keep these separable from reader fixes.
5. Fix I05's reapply-enabled tree aggregate owner/cache path while preserving its working incremental delta mode.
6. Promote the minimal healthy-outcome cases into normal focused regression tests, then rerun the seed matrix and first-success recovery checks.

Defer broad refactors, additional package splitting, new coordinators and optimization work. Extend the unverified matrix in a separate audit slice after the confirmed invariants are repaired. No change to orchestration publication or Vue package migration boundaries follows from these findings.

## Remediation follow-up (2026-10-24)

The eight findings above were repaired in Core without public API changes:

| Finding | Correction | Permanent regression |
| --- | --- | --- |
| I01 | Cold row-domain reads resolve the actual target source row and return `undefined` outside its bounds. | Cold backward/forward/window references and both boundaries. |
| I02 | Dirty propagation maps changed source/computed rows back through relative, range, absolute, and absolute-range dependency domains. | Relative, window, computed-chain, and absolute fan-out patch comparison. |
| I03 | Overlay pruning now rebuilds value arrays when source identity changes even if positions and lengths remain stable. | Same-length replacement with retained rows, including explicit recompute. |
| I04 | Row patch projection clears pending pivot deltas and rebuilds the invalidated pivot from current inputs; a completed pass cannot leave a delta for a later mutation. | Patch followed by removal, including generated pivot edit/insert/remove sequences. |
| I05 | When callers explicitly request group recomputation for a tree aggregate input edit, Core invalidates the tree cache and schedules the owning group stage. The existing incremental aggregate-delta path remains intact when group recomputation is not requested. | Recompute-enabled tree aggregate regression plus existing incremental parent-aggregation contract. |
| I06 | Group keys use the effective projection field reader. | Grouping by a computed field. |
| I07 | Pivot aggregation forwards the effective field reader into its aggregation engine. | SUM over a computed pivot measure. |
| I08 | Pivot mode changes rebuild from the group stage so current sort/group semantics are restored. | Sort roundtrip and grouped roundtrip with edits made while pivot is active. |

**Validation actually run after remediation:** Core type-check passed; Core production build passed; full Core unit suite passed (**951 tests in 122 files**); the isolated DIV_ZERO → valid → DIV_ZERO recovery comparison passed; permanent incremental-equivalence suite passed (**9 tests**). The archived deterministic differential harness passed (**269 tests**) and checked **2,180 generated operations** across the same fixed seeds: all 28 runs completed with no divergence. Together with the permanent suite, the run had 278 passing tests. The temporary diagnostic spec was removed from normal test discovery afterward.

The pivot value-only patch fast path is currently bypassed for row-patch projection because its delta was being published after the owning projection cycle and replayed later. Correctness is restored by rebuilding the invalidated pivot. This may do more work for value-only pivot edits; no performance counters or benchmark were run, and optimizing that path is a separate task requiring an apply-once generation contract and equivalent differential coverage.

The original limits section still describes capabilities not covered by the audit matrix. Those are unverified risks, not additional confirmed defects. This remediation does not expand workbook, async/worker, remote datasource, or custom callback contracts.
