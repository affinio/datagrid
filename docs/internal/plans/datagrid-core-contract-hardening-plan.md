# DataGrid Core contract hardening plan

Status: complete. This plan tracks confirmed public-contract gaps from the Core API audit. It separates documentation/test work for existing behavior from proposed public API changes. Public APIs require explicit review; approved proposals are recorded in their slice.

## Working rules

- Close one slice at a time and keep each slice reviewable.
- Verify behavior against implementation before documenting it as a guarantee.
- Add focused contract tests when behavior is clarified or changed.
- For public API changes, write the contract proposal first and wait for approval before implementation.
- For each accepted Core contract, audit the Vue adapter/app and Laravel package; expose and use it where that layer owns the corresponding workflow, otherwise document why it is not applicable.
- Do not build an export API until consistent reads and data coverage are defined.

## Slices

### 1. Transaction batch execution and failure semantics — P0

- [x] Verify current behavior: `apply()` resolves after queueing inside a pending batch; `commitBatch()` executes queued transactions; `rollbackBatch()` discards them without running rollback commands.
- [x] Document completion points, one-history-step behavior, commit failure handling, compensation limits, and cancellation after queueing.
- [x] Contract coverage exists for queue-before-commit behavior, execution order, one-step undo/redo, rollback-before-commit, successful compensation after a failed commit, and pending-batch state after failure.
- [x] Add approved `DataGridTransactionBatchCommitError` with immutable details and continue best-effort compensation after individual compensation failures.

### 2. Capability errors and command result consistency — P1

- [x] Inventory the known row/column insert, histogram, and viewport result-policy exceptions against implementation.
- [x] Correct method reference claims that conflated missing capabilities with missing targets.
- [x] Document the existing per-method distinctions and add contract coverage for capability errors, missing column targets/empty inserts, unsupported histogram reads, and permissive/strict viewport commands.
- [x] Propose a consistent result policy for future methods without silently changing existing signatures.

### 3. Consistent read view and snapshot stability — P0

- [x] Audit the current read path: row-model snapshots are rebuilt on each call, column snapshots are cached, row data is returned by reference, and rows/columns/computed metadata are read through independent namespaces without a shared revision.
- [x] Specify revisions included in a read view: row-model/projection, column/schema, computed registration, and selection (null while no shared selection revision exists).
- [x] Define snapshot immutability, row object ownership, lifetime/release, source reset, and dispose behavior.
- [x] Implement approved `api.read.captureView({ include, cloneRow? })` and expose its types through Core, Vue, and Laravel facades.
- [x] Add coverage reporting for current projection: complete/partial/unknown, row revision, dataset version, loaded count, and missing intervals.
- [x] Add tests for immutable captures, client complete coverage, datasource partial coverage, and independent column snapshot revision/identity.
- [x] Document React external-store caching as adapter responsibility; Core does not add a React dependency.

Approved and implemented contract:

- Add one synchronous `api.read.captureView({ include })` operation rather than making consumers coordinate independent namespace reads.
- Capture row/projection, column/schema, computed metadata, and requested selection snapshots together and report each available revision. The result is a detached read bundle; it does not pin or block the live grid.
- Structural snapshot containers and arrays are immutable. Row objects remain source-owned references unless the caller supplies a clone function; the API must not claim deep immutability by default.
- Captured projected rows preserve projection order and explicitly identify coverage. Unsupported requested parts are reported, not silently omitted.
- A captured view remains structurally stable until released/discarded, but data object immutability depends on ownership or cloning. `release()` is unnecessary in v1 unless inspection shows the models retain resources.
- Column snapshots have a stable revision. Row and computed registration revisions use row-model revision. A server query identity remains unavailable unless the datasource supplies `datasetVersion`.

Accepted boundaries: a single shared selection revision is not currently exposed. Structural read capture is synchronous but does not pin row objects unless `cloneRow` is supplied. `captureView()` reports the selection revision as unavailable rather than claiming cross-subsystem immutability beyond the synchronous structural snapshot.

### 4. Read coverage and datasource completeness — P0

- [x] Define `rows.resolveById()` outcomes for loaded, filtered-out, collapsed, unloaded, missing, and unsupported records while retaining the existing `getById()` signature.
- [x] Define capture coverage scope as current displayed projection; source, filtered-set, and page scopes remain separate future read options.
- [x] Add approved `DataGridReadCoverage` to `captureView`; query revision uses row-model revision, dataset version comes from row snapshot, and unsupported interval discovery reports unknown.
- [x] Cover complete client and partial datasource results; add unknown-model coverage test.

### 5. Cell selection under projection changes and all-selection scope — P0

- [x] Choose positional cell-range semantics; ranges become stale when row projection or visible-column order changes.
- [x] Include projection and column-order revisions in cell snapshots; expose current/stale/untracked status and suppress stale range reads.
- [x] Bind all-selection to current-projection row revision and dataset version; expose scope status and suppress stale/unscoped membership and data reads.
- [x] Document `getSelectedRows()` as explicit IDs only and empty in `mode: "all"`; no alias is needed because the existing method already documents this behavior.
- [x] Add Core contract coverage for sort/projection changes, order changes, width-only changes, all-mode exclusions and stale scope. Vue stamps revisions and syncs stale selection after row changes.

### 6. Cell value resolution and editing-session boundary — P1

- [x] Map existing `buildDataGridCellRenderModel()`, computed overlay, formula, hierarchy/presentation-column, filter, and edit paths.
- [x] Add approved `api.cells.resolveValue()` with separate source, accessor/computed, formatted/display values and explicit write-target hints.
- [x] Keep editor draft/session lifecycle in adapter/orchestration; Core owns parsing/validation helpers and row mutation, not DOM or drafts.
- [x] Define Vue's conflict policy: compare the opening cell value at commit and keep the editor open when an external update changed it; other adapters own their own policy.
- [x] Use the resolver in Vue inline editing, selection aggregation, and XLSX export; preserve explicit selection/export overrides. Laravel exposes the framework-independent types and usage contract.
- [x] Add focused tests for resolver distinctions and Vue stale-edit rejection. Formula/materialized values are resolved from the row model/accessor; registrations remain in compute metadata.

### 7. State restore report and event outcomes — P1

- [x] Define structured restore outcomes for applied/skipped sections, failure location, rollback completion, and possible partial state through `DataGridStateRestoreError`.
- [x] Define preflight validation through `state.validate()`; unsupported transaction state is reported as skipped in permissive mode and rejected before mutation in strict mode.
- [x] Classify current events as synchronous invalidation/change notifications; they do not promise durable operation IDs or before/after revisions except where existing payloads provide context.
- [x] Specify listener exceptions (propagate and stop current dispatch), queued FIFO reentrant emission (delivery ordering only), import end-event behavior, and source-owned edit payloads.
- [x] Add focused tests for success reports, failure section/rollback status, import end after failure, event FIFO, and listener exceptions.
- [x] Vue restore preview uses Core validation/report; Core, Vue, and Laravel facades export the contract.

### 8. Column schema replacement guarantees — P1

- [x] Document and test `setAll()` replacement/reset semantics for retained keys; dependent subsystem references are not implicitly reconciled.
- [x] Document and test duplicate keys, partial order input, zone-order restrictions, global-vs-zone order, unpin placement, and width constraints.
- [x] Document ownership of authored base columns versus pivot-generated columns.
- [x] Keep replacement explicit: callers migrate dependent row/selection/formula references; no second reconciliation API is justified by current behavior.

### 9. Datasource `flush()` barrier — P1

- [x] Define `flush()` as draining the in-flight and queued critical pulls until the critical queue is observed empty; later requests are outside that barrier.
- [x] Document paused behavior, absorbed datasource pull failures, disposal completion, and that the barrier does not imply a framework render.
- [x] Add deterministic coverage that flush resumes a paused model, drains critical work, then restores paused state.
- [x] Keep opportunistic background prefetch outside the barrier.

### 10. Stable row-height identity — P1

- [x] Separate user-authored row height by stable row identity from virtualizer measurements by projection index.
- [x] Define identity behavior: ID overrides survive sort/filter/group/tree/pivot projection changes and remain until explicitly cleared, including after temporary removal; index measurements remain positional.
- [x] Define `getEffectiveRowHeight()` as the viewport's shared effective estimate/base, not a row-specific variable height; fixed mode uses an ID override as the row height and auto mode uses it as a floor.
- [x] Implement approved `setRowHeightOverrideById()` / `getRowHeightOverrideById()` and use them for Vue manual resizing/autosize; retain index methods for measurements.
- [x] Add Core and Vue contract coverage and document the methods in Core, Vue, and Laravel.

### 11. Formula registration and compute lifecycle — P2

- [x] Document and verify cycle/unknown-dependency validation, duplicate field rejection, and planned ordering of initial definition sets.
- [x] Document and test formula-function replacement/recompilation and rollback when removal leaves an unknown function.
- [x] Distinguish registration/configuration errors from per-cell runtime errors and asynchronous compute status.
- [x] Keep the existing `rows`/compute namespaces; no additional formulas namespace is needed.

### 12. Export API — P2, depends on slices 3 and 4

- [x] Document current Vue XLSX export support: complete current projection, visible/all authored columns, expanded tree/group rows and available aggregates; collapsed descendants are omitted, pivot and incomplete data are refused.
- [x] Require `read.captureView()` and complete coverage for export; use Core cell resolution for leaf computed/accessor values and keep explicit export callbacks authoritative.
- [x] Allow `cells.resolveValue()` to use captured row/column inputs exclusively; XLSX export snapshots aggregation settings, prepares and detaches the complete worksheet matrix before worker serialization, and does not require callers to clone source rows.
- [x] Keep file serialization in `datagrid-vue`/`export-xlsx`; Core provides framework-independent read/value/coverage primitives and does not need a parallel export namespace.

## Completion summary

All slices are implemented and documented. Read coverage is projection-scoped; row data remains source-owned unless cloned. Snapshot-bound cell resolution reads only captured row/column inputs, and built-in XLSX export materializes detached cell values before asynchronous worker serialization without requiring caller cloning. Selection stale behavior is visible through explicit status methods, and the ready-made Vue adapter clears stale state on row updates. Structured row resolution distinguishes missing, filtered, collapsed, unloaded, and unsupported IDs. Vue uses the shared value resolver, restore reports, and stable row-height identity contracts; Laravel exposes the framework-independent types and methods.
