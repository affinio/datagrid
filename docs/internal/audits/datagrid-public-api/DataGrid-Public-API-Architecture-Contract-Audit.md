# DataGrid Public API — Architecture & Contract Audit

Audit date: 2026-09-29. Scope: @affino/datagrid-core public DataGridApi, row models, projection/compute, transactions, state, capabilities, Vue consumption, tests, and public documentation.

Evidence labels: Verified = implementation/tests; Inferred = architectural interpretation; Unverified = insufficient repository evidence.

## A. Executive summary

The API has coherent primary boundaries. DataGridApi is a stable facade over row-model, column-model, lifecycle, and optional service capabilities. api.rows intentionally includes logical row-model operations beyond CRUD: sorting, filtering, grouping, aggregation, pivot state, computed fields, formulas, patches, edits, and external updates.

No evidence supports introducing projection or formulas namespaces. The existing DataGridRowModel contract already owns these operations, so extraction would mostly rename the facade and create aliases or breaking moves.

Verified risks:

1. rows.expandAllGroups and view.expandAllGroups are aliases to the same implementation.
2. Direct row mutations do not enter transaction history.
3. rows.batch batches event delivery, not row-model recomputation.
4. lifecycle.whenIdle tracks guarded API operations only.
5. state.set applies sequentially and is not rollback-atomic.
6. insertDataAt is ambiguous: reads are projected-indexed, client insertion is source-indexed.
7. Unsupported operations inconsistently throw, return false/null/[], or no-op.
8. There is no public row-ID lookup, row deletion, or computed/formula field removal API.

Core is Vue-independent for deterministic model/API operations. Optional DOM-aware viewport infrastructure exists, but adapter-dependent view operations are no-ops or fallback-backed without a viewport service.

## B. Namespace responsibility matrix

| Namespace | Responsibility | Assessment |
| --- | --- | --- |
| lifecycle | Lifecycle state, exclusive queue, isBusy, whenIdle, runExclusive | Valid; completion scope is limited |
| rows | Projected reads, source mutation, projection state, grouping, aggregation, formulas, patches | Coherent row-model boundary |
| data | Datasource backpressure | Distinct from row mutation |
| columns | Column definitions and layout | Coherent |
| view | Viewport, row heights, refresh, cell invalidation | Coherent except group aliases |
| selection | Cell/range selection and summaries | Coherent |
| rowSelection | Focused/selected row IDs | Coherent and independent |
| transaction | Generic commands, batch, undo/redo | Coherent but separate from direct row mutation |
| pivot | Pivot model, layout, drilldown | Coherent |
| compute | Compute mode and diagnostics | Coherent |
| diagnostics/meta | Diagnostics and compatibility/runtime metadata | Coherent |
| policy | Projection/edit policy | Coherent |
| state | Unified persistence and migration | Coherent, partially atomic |
| events | Typed event delivery | Coherent, uneven wrapper coverage |
| plugins | Public plugin lifecycle | Coherent |

Evidence: packages/datagrid-core/src/models/rowModel.ts:449-499; packages/datagrid-core/src/core/gridApiRowsMethods.ts:186-232,314-375; packages/datagrid-core/src/core/gridApiNamespaces.ts:164-352; docs/datagrid-architecture.md; docs/api-stability.md.

## C. Answers to audit questions

### Namespace architecture

Projection, aggregation, and formula operations are under rows because they are methods of the row-model contract and mutate/read logical row state. This is verified by rowModel.ts and gridApiRowsMethods.ts. The grouping is intentional and internally consistent. A separate public namespace is not necessary and would add indirection or breaking moves.

rows/data, rows/pivot, rows/compute, rows/transaction, view/rows, meta/diagnostics, and policy/compute have overlapping dependencies but distinct ownership.

### Group expansion

Verified: rows.expandAllGroups and view.expandAllGroups, and corresponding collapse methods, use the same methodSet function and ultimately call rowModel.expandAllGroups/collapseAllGroups. They produce identical state, invalidation, recomputation, events, and capability behavior. rows is the canonical owner; view is a compatibility/convenience alias.

Evidence: gridApiNamespaces.ts:290-314; gridApi.ts:345-357; gridApiRowsMethods.ts:222-226. Existing coverage: gridApi.contract.spec.ts:341-378.

### Mutation contracts

setData replaces source rows and recomputes the client projection. replaceData currently aliases or delegates to the same replacement path. append/prepend rebuild source order and use the full set path. Insert operations mutate source order, return false for empty input or missing before/after target, and throw when unsupported.

patch updates existing rows by row ID. Sort/filter/group recomputation is opt-in through patch options and defaults to preserving the current projection. applyEdits uses the patch capability with edit-oriented reapply policy. applyExternalUpdates is a distinct datasource/cache path and is tested not to call commitEdits. transaction.apply runs caller-defined commands and is the only generic API history path.

Direct row operations do not participate in transaction undo/redo. Sync failures throw; async datasource/transaction failures reject. API error events are guaranteed for operations routed through gridApi.ts runGuardedSync/runGuardedAsync, not for every direct rows/view/columns/pivot method.

### Row lookup

No public getById exists. Client internals maintain row-ID indexes, but server-backed models may have unloaded rows. A local-only lookup is plausible; the repository does not establish whether it should return a row node or data.

### Projection reads

getSnapshot exposes sortModel, filterModel, groupBy, pivotModel, groupExpansion, pagination, and projection diagnostics. Aggregation and pagination also have explicit getters. The read API is sufficient but split between snapshot and getters.

### Deletion

No public row deletion method or removeRows capability exists. Current alternatives are full replacement, datasource-specific operations, or application-defined transaction commands. Whether omission is intentional is unverified.

### Formula lifecycle

Registration is additive. Duplicate names and target ownership conflicts throw. Formula functions and formula tables can be removed, but formula/computed fields cannot be removed through the public facade. Column replacement does not visibly clean up field registrations. Dependency cleanup policy is undocumented.

### Layout persistence

state.get exports row projection state, aggregation, columns, selection, row selection, transaction snapshot, and optional viewport position. state.set supports applyColumns, applySelection, applyViewport, and applyViewportPosition. It does not independently suppress row-state application. pivot.exportLayout/importLayout provides a narrower pivot layout boundary. Pure layout-only export is limited but partial import exists.

### Return values and lifecycle

Insertion booleans indicate insertion success, not capability. false means empty input or missing target; unsupported methods throw. view.refresh and rows.applyEdits are void or Promise because client and datasource implementations differ. Promise.resolve can normalize them.

whenIdle only tracks guarded operations. It is not a universal barrier for all row-model, datasource, projection, event, adapter, or browser work.

### Capabilities

Capability resolution is centralized, lazy, cached, and intended to remain stable for the API lifetime. Core mutation, selection, transaction, compute, histogram, and viewport-position flags are generally authoritative. Unsupported behavior differs by operation: throw, empty result, null, false, or no-op.

### State and transactions

state.set does not restore transaction history. Strict mode rejects transaction payload restoration; non-strict mode leaves existing history untouched. State application is sequential. Backpressure is paused/resumed when supported, but earlier mutations are not rolled back if a later operation fails. Migration accepts version 1 only. Event order is deterministic through gridApiEventsRuntime.ts.

### Headless architecture

packages/datagrid-core/package.json has no Vue dependency. pureCoreBoundary.contract.spec.ts scans deterministic core files for Vue imports, DOM globals/types, and time-based side effects. Core row/projection/formula/state/transaction operations run without Vue. scrollTo*, measureRowHeight, and similar methods require optional viewport services for meaningful behavior. Vue owns DOM materialization, scroll sampling, focus, overlays, and editors.

### Stability

The repository defines Stable, Advanced, and Internal import tiers in docs/api-stability.md. It does not classify individual DataGridApi namespaces into application, integration, and runtime tiers. The root core facade is stable; view/lifecycle operations are public semantic contracts, not DOM APIs.

## D. Mutation semantics matrix

| Method | Target/timing | History | Projection | Failure |
| --- | --- | --- | --- | --- |
| setData | Source replacement; sync client path | No | Full recompute | Throws capability/model/duplicate-ID errors |
| replaceData | Same current client path | No | Full recompute | Same as setData |
| append/prepend | Source rebuild; sync client path | No | Full recompute | Unsupported/model errors throw |
| insertDataAt | Source index; sync | No | Recompute on success | false for empty input; throws unsupported |
| insertDataBefore/After | Source row ID; sync | No | Recompute on success | false for missing target/empty input |
| patch | Source rows by row ID; sync client path | No | Computed updates; sort/filter/group flags default false | Throws capability/abort/model errors |
| applyEdits | Patch/edit pipeline; sync or async | No generic history | Optional reapply policy | Throw or reject |
| applyExternalUpdates | External datasource/cache path; sync or async | No generic history | Cache/index update path | Throw/reject; missing cache may be ignored |
| transaction.apply | Caller commands; async | Yes | Depends on executor | Rejects and compensates |
| view.refresh/reapply | Row-model refresh; sync or async | No | Manual/reapply refresh | Direct errors throw/reject |

Events come primarily from row/column model subscriptions and explicit transaction/state paths. Direct methods are not uniformly lifecycle/error wrapped.

## E. Verified inconsistencies

### API-001 — whenIdle is not universal

Severity: P1. Evidence: gridApi.ts:218-238 and 345-389. Consequence: callers may observe idle while unguarded public work is active. Classification: contract gap or intentional limited scope.

### API-002 — rows.batch is event-only

Severity: P1. Evidence: gridApiRowsMethods.ts:419-421 and gridApi.ts:381-383. Consequence: row recomputation is not necessarily coalesced. Classification: documentation/contract mismatch.

### API-003 — state import is not rollback-atomic

Severity: P1. Evidence: gridApiStateMethods.ts:268-387. Consequence: partial state can remain after failure. Classification: documented limitation requiring tests.

### API-004 — direct mutations bypass history

Severity: P1. Evidence: rows methods call row-model capabilities directly; transactionService executes caller commands only. Consequence: applyEdits is not automatically undoable. Classification: design tradeoff requiring explicit documentation.

### API-005 — insertion index ambiguity

Severity: P1. Evidence: public reads are projected-indexed in docs/reference/datagrid-grid-api-methods.md:76-79, while client insertion uses getSourceRows in clientRowRowsMutationsRuntime.ts:78-84. Consequence: insertion can differ from visible order. Classification: documentation gap.

### API-006 — unsupported behavior varies

Severity: P2. Evidence: throw, false, null, empty array, and no-op are all used. Consequence: per-method knowledge is required. Classification: design tradeoff/documentation gap.

### API-007 — no formula/computed-field removal

Severity: P2. Evidence: registration APIs exist, unregister field APIs do not. Consequence: dynamic schema hosts cannot cleanly remove fields. Classification: API completeness gap.

### API-008 — mutation origins and aliases are underdocumented

Severity: P2. Evidence: distinct patch/edit/external pipelines exist, but public docs do not fully explain their completion/history/reapply semantics. Classification: documentation gap.

## F. Existing strengths

- Namespace construction is explicit and stable.
- Row/projection/formula ownership matches DataGridRowModel.
- Capability resolution is centralized.
- Projection invalidation reasons are explicit.
- Transaction service has rollback payloads, compensation, batch history, and undo/redo tests.
- State migration is versioned and strict/non-strict.
- Event ordering is deterministic and reentrant-safe.
- Viewport targets are semantic rather than DOM-specific.
- Core has no Vue dependency.
- Stable/Advanced/Internal import policy exists.
- Focused API contract and purity tests already exist.

## G. Recommended changes

1. Document the complete mutation matrix, index spaces, group aliases, lifecycle scope, batching semantics, and transaction participation.
2. Add failure-injection tests for state import before changing atomicity behavior.
3. Resolve insertDataAt terminology as source-indexed without changing behavior.
4. Add local row-ID lookup and deletion only after defining row-model capabilities and selection/formula effects.
5. Add formula/computed removal only with an explicit dependency policy.
6. Preserve current namespace boundaries.
7. Do not broaden lifecycle guards across hot paths without performance/reentrancy evidence.
8. Do not introduce a second persistence framework.

## H. Suggested implementation order

1. Contract documentation and tests.
2. State consistency tests and policy decision.
3. Batching/lifecycle contract clarification.
4. Row-ID lookup and deletion.
5. Formula/computed lifecycle.
6. Benchmarks and justified optimization.
7. Final stability and export review.

## I. Open questions

- Is rows.batch intentionally event-only?
- Should direct applyEdits ever enter generic history?
- Should state import reject or clear existing history?
- Is insertDataAt intentionally source-indexed?
- Is dynamic formula removal a supported requirement?
- Should unsupported viewport methods remain no-op by default?
- Should stability labels be per namespace or only per package entrypoint?

## Validation evidence

Focused validation passed:

- gridApi.contract.spec.ts
- pureCoreBoundary.contract.spec.ts
- 64 tests passed across 2 files.

No production code, tests, public types, or existing documentation were changed by the audit.

