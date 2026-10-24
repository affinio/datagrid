# DataGrid exception safety and failure recovery audit

Date: 2026-10-24. Status: implementation follow-up; all confirmed findings below are fixed in the current working tree and have regression coverage.

Scope: datagrid-core, datagrid-orchestration, and datagrid-vue, including their current uncommitted consistency fixes. DOM and Laravel are excluded at the user's request. Product sources were not changed for this audit.

At audit time, the answer to the central question was **not always**: several failed operations left source data, computed caches, projection, history, or lifecycle state disagreeing. The implementation follow-up below closes those confirmed findings without adding universal atomicity or replacing the architecture.

## Previous audit baseline

The [consistency audit](./datagrid-consistency-audit-2026-10.md) was checked first. Its fixes remain present. Selected current regression suites passed: 127 Core tests, 10 orchestration tests, and 72 Vue tests. Additional temporary diagnostics explicitly reconfirmed atomic invalid column replacement, awaited async edit rejection, and prevention of post-dispose transaction commands/history resurrection.

| Previous finding IDs | Current assessment |
| --- | --- |
| 1, 5, 8, 9, 10, 11, 12, 14, 16, 17 | Existing fixes retained; related Core contract suites pass. F09 below concerns failure during delivery, whereas previous #9 concerned normal reentrant delivery. |
| 2 | Effective-row lookup is present. F01 below is corruption upstream of the resolver after a compute exception, not the previous missing lookup. |
| 3, 6, 7, 15 | Vue write targets, pivot/base schema reconciliation, activation identity re-resolution, and stale clipboard guards remain present. Related source paths and focused contracts were checked. |
| 4, 13 | DOM-specific findings excluded from this audit. |

No previously fixed issue is presented here as an unfixed original finding.

## Confirmed findings, ordered by severity

### F01 — P1: a failed compute pass poisons the cache used by the next successful pass

Confidence: high; deterministic reproduction.

- **Guarantee:** a successful full recomputation must agree with the current source and committed computed overlay.
- **Injection and state:** two rows start with v=1/2 and derived d=2/4. A computed callback doubles v and throws on the second row while patching v to 10/20. Evaluation has already written d=20 into the shared column cache for the first row, but the computed overlay is not committed.
- **Recovery result:** disable the exception and call recomputeComputedFields(). It succeeds, yet public rows are [{v:10,d:2}, {v:20,d:40}]. The first computed value is skipped because the poisoned cache already contains 20. A second recomputation repairs it; changing that input also repairs it. One successful recovery operation is therefore insufficient.
- **Chain:** patch coordinator → computed executor → cache write → later callback throw → computed apply/overlay commit never runs. Retry compares against the uncommitted cache value.
- **Evidence:** [executor comparison and cache write](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts#L381), [callback boundary](../../../packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts#L523), [overlay commit after execution](../../../packages/datagrid-core/src/models/compute/clientRowComputedApplyRuntime.ts#L28).
- **Minimal fix / owner:** Core computed runtime should discard or invalidate speculative column-cache writes on an escaping exception; keep committed values as the retry comparison baseline.
- **Missing regression:** throw on the second row, then require the first successful full recomputation to produce d=20/40. Existing executor tests cover successful execution and formula error values, not this interrupted pass.

### F02 — P1: projection failures leave committed source/query state behind an old projection

Confidence: high; reproduced for patch, setRows, insertRowsAt, removeRows, filter accessor, and aggregation finalize.

- **Guarantee:** after a failed mutation, public reads must describe one valid state, or explicitly identify incomplete materialization and a usable retry path.
- **Injection and state:** throw from a custom comparator during a recompute-enabled patch. Source row 0 changes from v=1 to v=9, while projected rows still contain 1/2; no change notification is emitted. Insertion exposes the new ID through source lookup while projected count stays 2. Removal leaves a removed row in projection. A failing aggregate finalize leaves new source values with old totals.
- **Recovery result:** a successful explicit refresh or a different valid sort repairs the projection. For a failing filter accessor, the new filter is already installed; retrying the identical filter after fixing the callback is a no-op and still shows both rows until refresh.
- **Chain:** source/version or query setters run before projection callbacks; exceptions bypass final publication and have no recovery/invalidation completion path.
- **Evidence:** [source commit before finalize](../../../packages/datagrid-core/src/models/mutation/clientRowRowsMutationsRuntime.ts#L58), [in-place patch before compute/projection](../../../packages/datagrid-core/src/models/mutation/clientRowPatchCoordinatorRuntime.ts#L117), [query mutation and identical-query early return](../../../packages/datagrid-core/src/models/mutation/clientRowStateMutationsRuntime.ts#L151).
- **Minimal fix / owner:** Core row-model mutation boundaries must preserve the previous coherent projection or explicitly settle the changed source into a valid dirty/error state, invalidate affected caches, and allow the same request to retry. This does not require rolling back external effects.
- **Missing regression:** for each callback failure, compare source lookup, projected reads, revision, events, and the next successful identical operation/refresh. Current model tests mostly cover success or configuration rejection.

### F03 — P1: synchronous datasource pull failure permanently occupies its request lane

Confidence: high; deterministic reproduction.

- **Guarantee:** a settled failed pull releases loading/in-flight state and permits a retry.
- **Injection and state:** datasource.pull throws synchronously before returning a Promise. The async IIFE catches the throw before writeLaneInFlight has run, interprets the request as stale, and cannot clear it. The caller then registers the already-completed Promise as in-flight.
- **Recovery result:** refresh resolves with loading=true, inFlight=true, and error=null. Another refresh coalesces with that completed Promise; transport call count stays 1. A query change that aborts/replaces the lane allows a new successful pull. Ordinary retry does not.
- **Evidence / chain:** [IIFE and direct transport call](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L1107) → [missing-active request check](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L1213) → [late lane registration](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L1263).
- **Minimal fix / owner:** Core datasource runtime must publish the lane before transport code can settle, or defer invoking transport until registration is complete; all terminal paths must settle the range token and lane.
- **Missing regression:** synchronous throw, ordinary retry, resolved lane/loading flags, and preserved error. Rejected-Promise recovery is covered and passed; it does not cover this ordering.

### F04 — P1: an optimistic notification exception creates a mutation that is never sent

Confidence: high; deterministic reproduction.

- **Guarantee:** a registered optimistic mutation must reach commit processing or be removed/rolled back on an early failure.
- **Injection and state:** start from v=1; patch to 5; throw from a row-model subscriber during optimistic publication. The row cache and pending mutation are already changed, but the commit is not yet enqueued.
- **Recovery result:** patch throws; server commit call count remains 0; local value is 5. Remove the bad listener and successfully patch to 7: the server is called, but a later refresh reapplies the orphan pending patch and restores local 5. The next valid operation does not remove the orphan. Disposal removes it.
- **Evidence / chain:** [register → callbacks → enqueue](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticPatchRuntime.ts#L65), [pending edit replay](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticMutationEngine.ts#L106).
- **Minimal fix / owner:** Core optimistic patch runtime must guarantee queueing or cleanup independently of publication failures; publication must not strand a registered transaction.
- **Missing regression:** subscriber throws before enqueue, then successful patch and authoritative refresh; assert pending mutation settlement and transport count.

### F05 — P1: a broad commit catch rolls back server-accepted data locally

Confidence: high; two deterministic reproductions.

- **Guarantee:** server acceptance and local publication are separate commit stages. A notification failure cannot undo an already-confirmed server effect; mixed results must retain accepted rows.
- **Injection A:** commit result accepts row A and rejects B. The rejection branch rolls back B and throws; the enclosing catch then rolls back the whole transaction, restoring A's old local value despite its acceptance.
- **Injection B:** commit succeeds and updates the authoritative value to 5; the subscriber throws only during post-commit publication. The catch labels this a write failure and restores local 1 while server remains 5.
- **Recovery result:** the Promise rejects. Removing the bad listener and performing an authoritative refresh repairs case B, and another write succeeds. The response's accepted effects are not represented correctly before refresh.
- **Evidence / chain:** [rejection and success branches share catch](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticCommitRuntime.ts#L48), [unconditional rollback](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticCommitRuntime.ts#L79), [baseline restoration](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L498).
- **Minimal fix / owner:** Core optimistic commit runtime needs distinct transport/rejection handling and post-confirmation materialization/publication handling. Preserve accepted IDs and report mixed outcomes; do not rerun whole-transaction rollback after confirmation.
- **Missing regression:** mixed committed/rejected IDs, and one-shot notification error after server acceptance followed by refresh/retry. Existing rejection tests cover rejected-only responses.

### F06 — P1: dispose during startup can be followed by late service starts and state resurrection

Confidence: high; deferred-Promise reproduction.

- **Guarantee:** terminal disposal prevents later service effects and cannot transition back to started.
- **Injection and state:** let event.start wait on a controlled Promise. Call dispose while it waits; disposal finishes with state=disposed. Resolve the start Promise.
- **Recovery result:** rowModel.start runs after disposal and the pending start resolves with lifecycle.state=started. No lifecycle generation/state check occurs after await. A fresh instance is required for a reliable terminal boundary.
- **Evidence / chain:** [runInOrder awaits without cancellation check](../../../packages/datagrid-core/src/core/gridCore.ts#L236) → [unconditional started assignment](../../../packages/datagrid-core/src/core/gridCore.ts#L281). Orchestration also sets its started flag after awaited startup without checking disposed: [runtime start](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L623).
- **Minimal fix / owner:** Core lifecycle should coordinate in-flight lifecycle work and check terminal state after awaits/before each service effect; orchestration must guard its continuation too.
- **Missing regression:** destroy during init and start, late resolution, repeated destroy, no later service starts, and terminal state preservation. Current lifecycle tests check successful ordering/idempotence.

### F07 — P1: inline edit focus/selection failure strands pending state and skips history

Confidence: high; Vue composable reproduction.

- **Guarantee:** once a write starts, its completion/error handling is installed regardless of subsequent selection/focus failures; UI failures must not lose committed edit bookkeeping.
- **Injection and state:** commit a text edit with the normal stay target; let applyCellSelection throw, as can happen through a synchronous selection listener. The row write has completed and editingCellPending is true. Promise handlers have not yet been attached.
- **Recovery result:** commit throws, the row has its new value, pending remains true after Promise flushing, and recordEditTransaction is not called. Fixing the callback lets a new editor open, but does not clear the old pending flag. A later successful commit can clear it. A rejected write Promise in the same gap can also escape observation; this additional rejection combination was not injected.
- **Evidence / chain:** [pending → write → focus → Promise handlers](../../../packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts#L547), [synchronous selection during focus restoration](../../../packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts#L407).
- **Minimal fix / owner:** Vue inline editor must attach settlement handlers immediately and release pending in a guaranteed completion path; isolate post-write navigation from commit/history outcome.
- **Missing regression:** selection/focus callback throws after write; assert pending, history, user status, and the next edit.

### F08 — P1: Undo can change rows but leave history unchanged when UI restoration throws

Confidence: high; reproduction using real Core models and Vue app history.

- **Guarantee:** a local history operation's stack transition must match its completed data effect; UI restoration is a separate stage.
- **Injection and state:** record v=1 → v=2 with restoration metadata. During Undo, row restoration applies v=1, then applyRestorationState throws.
- **Recovery result:** Undo rejects; row is 1; canUndo remains true and canRedo is false. Disable the callback failure and run Undo again, then Redo: both finish and restore 2. The first failed call left history describing a state that was no longer current.
- **Evidence / chain:** [Vue applyRowsSnapshot then restoration](../../../packages/datagrid-vue/src/app/useDataGridAppIntentHistory.ts#L337) → [one transaction executor command](../../../packages/datagrid-orchestration/src/history/useDataGridIntentHistory.ts#L42) → [command marked undone only after executor resolves](../../../packages/datagrid-core/src/core/transactionService.ts#L491) → [stack transition after completion](../../../packages/datagrid-core/src/core/transactionService.ts#L780).
- **Minimal fix / owner:** Vue app history should separate data replay success from recoverable selection/focus restoration. If it must reject after data replay, compensate the completed local data effect or expose the committed outcome accurately.
- **Missing regression:** injected restoration failure after rows change, including next Undo/Redo and stack/row agreement. Existing history tests primarily cover successful restoration.

### F09 — P2: failed event batch delivery leaks old notifications into a later batch

Confidence: high; deterministic reproduction.

- **Guarantee:** a failed synchronous delivery must not later emit obsolete batch payloads after newer versions have been delivered.
- **Injection and state:** in one rows.batch, change column width and patch a row. Throw from rows:changed, which flushes before columns:changed. The remaining batched payloads stay in the live map.
- **Recovery result:** remove the listener; set width again outside a batch; run an empty batch. Observed column revisions are [3,2]. State remains usable, but the unrelated batch delivers a stale snapshot after the newer one.
- **Evidence / chain:** [delete only the next entry before emitting](../../../packages/datagrid-core/src/core/gridApiEventsRuntime.ts#L150); the same runtime retains its normal emit queue after a dispatch throw at [emit](../../../packages/datagrid-core/src/core/gridApiEventsRuntime.ts#L210).
- **Minimal fix / owner:** Core event runtime should detach the batch being flushed and define how its remaining notifications are drained or discarded when a listener throws. Retained work must not be flushed out of order by a later operation.
- **Missing regression:** one-shot listener failure, newer direct mutation, empty batch, and monotonic observed revisions. Normal reentrant FIFO tests do not exercise exceptional exits.

### F10 — P2: failed computed registration leaves the new definition installed

Confidence: high; deterministic reproduction; explicit current contract mismatch.

- **Guarantee:** the computed-field reference says a failed registration does not publish the new definition.
- **Injection and state:** on a healthy model, register a new computed field whose callback throws during the registration-triggered first evaluation.
- **Recovery result:** registerComputedField throws, but getComputedFields includes the new name. The next valid source patch invokes it and throws too. Explicitly unregistering the supposedly failed definition restores successful edits. Dependency validation errors and invalid formula-function removal correctly preserve their registries in the checked controls.
- **Evidence / chain:** [register before recompute](../../../packages/datagrid-core/src/models/compute/clientRowFormulaComputeModule.ts#L78); [documented registration guarantee](../../../packages/datagrid-core/docs/reference/modules/computed-fields.md).
- **Minimal fix / owner:** Core formula/compute registration should restore the prior registry/plan if initial materialization escapes, or explicitly adopt and report a committed-definition/materialization-failed result. The existing public promise currently favors rollback.
- **Missing regression:** runtime callback throw during registration, registry/graph/cache reads, next patch, and removal/retry. Compile-time registration failures alone are insufficient.

### F11 — P2: failed initialization retries already completed initializers without cleanup

Confidence: high; resource-counter reproduction.

- **Guarantee:** retry after partial init must not duplicate resources that the lifecycle can no longer account for.
- **Injection and state:** the first service init acquires one resource; the second init throws. Core remains idle while the first service's resource is live.
- **Recovery result:** fix the second service and retry init: the first init runs again, resource count becomes 2. Normal disposal invokes its disposer once and leaves one resource. The public service interface does not require callbacks to hide this duplication through their own idempotence.
- **Evidence / chain:** [sequential init](../../../packages/datagrid-core/src/core/gridCore.ts#L236), [state assigned only after all services](../../../packages/datagrid-core/src/core/gridCore.ts#L270).
- **Minimal fix / owner:** Core lifecycle should track completed phases and either unwind completed initialization on failure or resume without reinitializing them. Service-specific irreversible effects remain the service's responsibility.
- **Missing regression:** middle init/start failure with acquisition/release counters, retry, and final cleanup. Current tests cover successful ordered calls.

### F12 — P2: one failing disposer blocks other cleanup; orchestration drops the failure

Confidence: high; direct Core and orchestration reproductions.

- **Guarantee:** independent cleanup should still be attempted, and callers need a usable teardown result/retry policy.
- **Injection and state:** viewport.dispose throws. Core exits reverse cleanup before event.dispose, remains stopped, and repeating dispose repeats the failing viewport disposer. Earlier resources never receive cleanup attempts.
- **Orchestration result:** runtime.stop returns undefined, discards core.dispose's Promise, marks its own instance disposed, and makes the next stop a no-op. A diagnostic observer explicitly caught the dropped rejection; without it this path produces an unhandled rejected Promise. Core remains stopped behind an orchestration object reporting disposed.
- **Evidence:** [reverse loop and dispose](../../../packages/datagrid-core/src/core/gridCore.ts#L253), [discarded Promise and terminal flag](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L632).
- **Minimal fix / owner:** Core should attempt all independent disposers and preserve error details; orchestration must retain/observe terminal cleanup completion and define repeat-call behavior. No external-effect rollback is required.
- **Missing regression:** middle disposer failure, all cleanup attempts, observed rejection, repeat stop/destroy, and accurate terminal state.

### F13 — P2: normal orchestration/Vue stop bypasses API-owned plugin cleanup

Confidence: high; runtime and mounted Vue reproductions.

- **Guarantee:** unmount/terminal runtime stop releases API-owned plugin resources as well as model services.
- **Reproduction:** mount useDataGridRuntime with a plugin whose onDispose increments a counter. Unmount and flush pending work.
- **Actual/recovery:** onDispose count is 0; api.plugins.has(id) remains true. Explicitly calling the retained api.dispose invokes cleanup and removes the plugin. The same occurs with useDataGridRuntimeService.stop; this requires no injected plugin error.
- **Evidence / chain:** [Vue unmount → runtime.stop](../../../packages/datagrid-vue/src/composables/useDataGridRuntime.ts#L549) → [core.dispose only](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L641), whereas [API dispose owns plugins/event/refresh cleanup](../../../packages/datagrid-core/src/core/gridApi.ts#L422).
- **Minimal fix / owner:** orchestration's terminal stop must use the API's existing disposal boundary and observe its completion. Coordinate with F12 rather than adding another cleanup owner.
- **Missing regression:** plugin acquire/dispose counters through real Vue mount/unmount and repeated stop. API.plugins.unregister/clear tests pass but bypass this integration path.

### F14 — P2: import-end listener exceptions erase the original restore report

Confidence: high; success-path and failure/rollback reproductions.

- **Guarantee:** a restore failure's cause and structured rollback report remain accessible even if final notifications fail.
- **Injection and state:** make column width application fail and its rollback fail; also throw from state:import:end. The inner restore creates a DataGridStateRestoreError with partial rollback details.
- **Actual/recovery:** the finally callback replaces it with the plain end-listener Error, with no report or original cause. On a successful restore, the same listener also turns an applied result into a plain rejection; that alone is consistent with the documented general event policy, but destruction of the earlier failure details is not a useful recovery outcome. Remove listener/width faults and the next restore succeeds; busy state is released.
- **Evidence / chain:** [structured inner failure](../../../packages/datagrid-core/src/core/gridApiStateMethods.ts#L641) → [throwing finally callback](../../../packages/datagrid-core/src/core/gridApi.ts#L459).
- **Minimal fix / owner:** Core API restore wrapper should preserve the primary result/error and attach or separately surface end-notification errors without replacing the report.
- **Missing regression:** restore error plus rollback error plus end-listener error, exact cause/report preservation, and subsequent successful restore.

### F15 — P2: shared fill finalization skips gesture cleanup if its commit callback throws

Confidence: high for the orchestration helper; Vue's async rejection consequence is a separate risk below.

- **Guarantee:** ending a gesture releases its transient state even if the requested commit fails.
- **Injection and state:** call stopFillSelection(true) with applyFillPreview throwing synchronously while dragging=true.
- **Actual/recovery:** dragging remains true; pointer, base/preview range, and autoscroll cleanup callbacks are never invoked. Calling stopFillSelection(false) later releases the state. An ordinary commit retry re-enters the failing commit before cleanup.
- **Evidence:** [callback before every cleanup](../../../packages/datagrid-orchestration/src/fill/useDataGridFillSelectionLifecycle.ts#L19).
- **Minimal fix / owner:** orchestration helper should release the gesture in finally; its consumer should separately observe commit failure. The same ownership principle applies when an optional error handler itself throws.
- **Missing regression:** synchronous commit failure with all cleanup counters and next gesture. Current fill lifecycle tests exercise normal commit/cancel.

## Operation/failure/recovery matrix

| Operation | Injected failure | Required/actual guarantee | Observed state | Can continue? |
| --- | --- | --- | --- | --- |
| Column replacement | Middle key getter or duplicate key | Previous state preserved | Maps, order, snapshot cache retained; width update succeeds | Yes; passed control |
| Rows patch/set/insert/remove | Comparator/finalize/accessor | Coherent settled state or explicit dirty outcome | Source/query changed; projection/totals old; final event skipped | Explicit refresh repairs; identical query retry may not |
| Raw computed execution | Second-row throw | Next successful recompute coherent | Cache/overlay disagree; first recovery returns old first-row derived value | Second recompute or input change repairs |
| Raw computed registration | First materialization throw | Failed registration unpublished | Definition remains; later patches invoke it | Unregister then retry |
| Formula configuration | Unknown dependency / removing referenced function | Registry/plan preserved | Rejected definition absent; existing function restored | Yes |
| Formula runtime | User function throws | Per-cell diagnostic/value outcome | Runtime errors recorded; model remains operational | Replace function and recompute succeeds |
| Transaction apply | First/middle/last command throws before effects | Compensate successful earlier commands | Data baseline restored; history empty; lock released | Apply, Undo, Redo succeed |
| Transaction compensation | A rollback command throws | Partial effects must be inspectable | Intra-transaction compensation stops; no history for leftover effects | New commands work; reconcile authoritative state first |
| Transaction notification | Subscriber throws after history commit | Committed change can remain under documented event policy | Promise rejects; data/history committed | Unsubscribe, then Undo succeeds |
| State restore | One-shot rows/columns/selection/viewport failure | Structured error and best-effort rollback | Correct failedSection, complete rollback, busy=false | Next restore succeeds |
| State restore final event | End listener throws while unwinding | Preserve primary result/error | Original structured report replaced | Retry possible after listener removal |
| Datasource pull | Synchronous throw | Clear lane/loading and preserve error | Completed Promise retained as in-flight; loading=true/error=null | Same refresh stuck; query replacement recovers |
| Datasource pull | Rejected Promise | Clear lane and expose error | loading=false; error set | Next refresh succeeds |
| Datasource write | Optimistic notification throws | Queue or remove pending mutation | Local patch registered, transport never called | Later writes run but orphan reappears on refresh |
| Datasource write | Mixed accept/reject or post-confirmation listener throw | Retain confirmed effects | Accepted server value restored to old local baseline | Authoritative refresh needed |
| Vue edit | Write rejects | Release pending and allow another edit | pending=false; draft/editor cleared; failure status | Next edit succeeds; draft retention is a policy question |
| Vue edit | Selection callback throws after write | Commit bookkeeping independent of focus | Row committed; pending=true; history skipped | Later edit can open; old pending remains until another settlement |
| Vue Undo | Restoration callback throws after rows replay | History matches data commit | Rows undone; undo/redo stacks unchanged | Retry Undo then Redo works after callback repair |
| Vue activation | Selection callback throws | Structured failure and no stuck operation lock | failed result; selection mutation may already have happened | Next activation succeeds |
| Authored renderer | Renderer throws | Fallback display remains renderable | Display text returned | Existing focused tests pass |
| Core startup | Middle init fails | Track/unwind completed phases | Idle state with live resources; retry duplicates initialization | Retry can succeed but final resource leak remains |
| Core startup/dispose | Deferred start resolves after dispose | Terminal disposal | Late services start; state becomes started | Terminal guarantee broken |
| Cleanup | Disposer throws | Attempt independent cleanup; observable completion | Remaining Core cleanup skipped; orchestration marks disposed early | Core can be retried; orchestration stop refuses retry |
| Runtime unmount | Normal terminal stop | All owners cleaned | API plugin registry/resources retained | Explicit API dispose repairs |
| Fill finalization | Commit callback throws | Gesture cleanup guaranteed | Drag/range/pointer state retained | Explicit cancel releases it |

## Ambiguous contracts, permitted partial execution, and unverified risks

These are not counted as additional confirmed product defects.

1. **Permitted post-commit notification failure.** The current [event contract](../../../packages/datagrid-core/docs/reference/api/methods/state-events.md) explicitly permits synchronous listener errors after a mutation has committed. The diagnostic transaction subscriber error leaves matching data/history and permits Undo. A rejected Promise alone does not prove rollback. F04/F05/F07/F08 concern extra corruption or lost bookkeeping caused by interpreting those phases together.
2. **Intra-transaction compensation granularity is ambiguous.** A failed rollback command stops compensation of earlier commands in that same transaction. The diagnostic leaves value=3, no undo entry for it, and still accepts later transactions. The public batch report continues across prior transactions as promised, but command-level completed/uncompensated indexes are not reported structurally. Continuing every earlier command blindly might be unsafe when commands depend on each other; define this policy before changing it. A command which mutates externally and then throws is not assumed to be automatically reversible.
3. **Rejected editor draft policy.** A rejected write releases pending and permits the next edit, but the draft/editor are cleared before write confirmation. Keeping the draft would improve recovery UX; there is no verified public promise requiring it, so this is not called state corruption.
4. **Vue async fill rejection.** The previous unobserved Promise path was fixed as part of F15. A browser fault-injection run now rejects the actual `rows.applyEdits()` commit after fill preview and edge autoscroll begin; the preview and dragging state clear, autoscroll stops, and a subsequent fill gesture starts. Fill uses global mouse listeners rather than native Pointer Capture, so the browser check verifies that no native capture remains and that the gesture owner is released.
5. **Late Vue edit continuations.** A direct composable/effectScope diagnostic observes callbacks after scope.stop. This was not classified as a mounted-component leak: real app history has its own disposed guard and Vue suppresses emits from unmounted components. Real unmount during a deferred edit and every custom callback still need browser/integration coverage.
6. **Partial plugin setup resources.** API plugin onRegister failure returns false and leaves the registry unchanged; onDispose errors are isolated and do not prevent unregister/clear. Cleanup of resources acquired inside a failing onRegister before it throws is not defined by the current callback contract. This is not conflated with the proven missing successful-plugin disposal F13.
7. **Explicit best-effort state rollback.** Rollback can fail and leave partial state; its current error report says partial. That is permitted behavior. F14 concerns losing that report, not an expectation that every restore be universally atomic.

## Verified scenarios without a separate violation

- Previous invalid column replacement fix survives a throw after the first candidate definition; existing definitions and cached snapshot remain usable.
- Async rows.applyEdits rejection is awaited and does not publish a false rows:edited success event; previous detached-Promise finding stays fixed.
- Transaction disposal prevents a second command from starting and prevents history resurrection; an already-entered external executor's own effects are outside cancellation guarantees.
- First/middle/last transaction command failure with successful compensation restores data, releases the lock, and permits apply/Undo/Redo.
- Current structured batch compensation tests pass, including continuation after another transaction's compensation fails.
- Unknown computed dependency rejection and referenced formula-function removal preserve the registry. Formula runtime exceptions become diagnostics; replacing the function and applying a correct patch restores valid values.
- One-shot restore failures in rows, columns, selection, and viewport report the failed section, complete rollback, release the API busy state, and permit a successful retry.
- Rejected datasource pull Promises release loading and permit a successful refresh. Late pull responses after dispose neither emit new model callbacks nor resurrect rows.
- Rejected inline commits release pending; another edit succeeds. Rejected paste state, duplicate-paste prevention, and renderer fallback have passing existing focused coverage.
- Activation exceptions become structured failed results; a subsequent activation succeeds.
- API-level plugin event and cleanup errors are isolated by the registry; ordinary unregister/clear controls pass.

## Evidence and validation

Temporary files are under /tmp/affino-failure-audit. They are explicitly labeled DIAGNOSTIC ONLY and intentionally assert faulty outcomes where confirming a finding. Their passing status is not a claim that the product satisfies recovery invariants.

- audit.spec.ts: 38 deterministic Core/orchestration diagnostic/control cases.
- vue.spec.ts: 6 Vue diagnostic/control cases, including real component mount/unmount and activation.
- Existing suites: Core 127 tests in five files; orchestration 10 tests in two files; Vue 72 tests in four files.
- Deferred Promises, callback counters, one-shot faults, and microtask flushing controlled order. No random delays or sleeps were used to establish findings.
- Source files were not changed. Existing working-tree modifications predate this audit. This report is the audit artifact added by this task.

Existing suite paths: Core gridApi.contract, gridApiColumnSelection.contract, transactionService.contract, gridCore.lifecycle.contract, columnModel; orchestration useDataGridRuntimeService.contract and createDataGridRuntime.lifecycle.contract; Vue useDataGridAppClipboard.contract, useDataGridAppInlineEditing.contract, useDataGridAppIntentHistory.contract, and useDataGridStageCellRendering.

## Limits

- DOM and Laravel deliberately excluded.
- Most checks use Vitest/jsdom and deterministic callbacks. A local Chromium browser check now covers fill commit rejection and inline edit rejection/retry. The history restoration browser case remains unresolved: the server-backed sandbox route uses datasource-owned Undo; after injected selection restoration failure it reports `Undo failed` while the row has reverted. That route does not exercise the local Vue intent-history compensation contract covered by unit tests. The local sandbox route used for follow-up did not expose an enabled history action. A dedicated browser fixture is still needed to verify local selection/focus restoration failure and Undo/Redo retry. No real-device or worker-process crash run was performed.
- The standalone formula engine package was not comprehensively audited; the Core integration, registry rollback, runtime error handling, and compiled-plan boundaries were inspected/exercised.
- Not every custom accessor, formatter, setter, plugin allocation, dependency cycle, worker transport, and reentrant listener combination was injected. Unsupported custom write targets are distinct from executed setters.
- No real external server irreversibility, network ambiguity, PHP integration, persistence failure, or crash recovery was claimed to be reversible.
- The inspected codebase includes uncommitted changes; this is an audit of the current working tree, not a particular published npm artifact.

## Implementation follow-up

All confirmed findings F01–F15 have been addressed in the current working tree. This is not a release or commit claim.

| Finding | Resolution | Regression coverage |
| --- | --- | --- |
| F01 | Discard speculative computed-column cache writes when a compute pass escapes with an exception. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts` |
| F02 | Restore source/query/expansion inputs and re-materialize the previous projection on failure. Pagination and expand/collapse-all use the same recovery path. A failed recovery preserves both errors and remains explicitly incomplete. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts` |
| F03 | Register datasource pull lane before invoking user transport code; sync throws settle loading and lane state, allowing retry. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts` |
| F04–F05 | Enqueue optimistic writes independently of listener success; distinguish pre-confirmation rollback from post-confirmation local reconciliation, retaining accepted rows in mixed results. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts` |
| F06, F11 | Guard lifecycle continuations after awaits and track completed service phases so retry does not duplicate initialization or resurrect a disposed Core. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts` |
| F07–F08 | Settle edit pending/history before optional focus work; compensate applied row snapshots if UI restoration fails during history replay. | `packages/datagrid-vue/src/app/__tests__/useDataGridAppInlineEditing.contract.spec.ts`; `packages/datagrid-vue/src/app/__tests__/useDataGridAppIntentHistory.contract.spec.ts` |
| F09, F10 | Detach and discard undelivered stale event payloads after listener failure; unregister a computed field whose initial materialization fails. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts` |
| F12–F13 | Attempt all independent disposers, preserve terminal teardown completion/errors, and route orchestration/Vue stop through API-owned cleanup. `stop()` now returns `Promise<void>` as approved. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts`; `packages/datagrid-orchestration/src/__tests__/useDataGridRuntimeService.contract.spec.ts`; `packages/datagrid-vue/src/composables/__tests__/useDataGridRuntime.contract.spec.ts` |
| F14 | Preserve the primary structured restore report if the import-end listener also throws. | `packages/datagrid-core/src/core/__tests__/failureRecovery.contract.spec.ts` |
| F15 | Always attempt fill gesture cleanup after commit failure; observe both local/server fill Promise failures in Vue, including cleanup-chain rejection. | `packages/datagrid-orchestration/src/fill/__tests__/useDataGridFillSelectionLifecycle.contract.spec.ts`; Vue package unit suite |

Validation after implementation: Core 121 files / 942 tests passed; orchestration 26 files / 103 tests passed; Vue 145 files / 1128 tests passed. Core, orchestration, and Vue type-checks passed. Core, orchestration, and Vue package builds passed. `git diff --check` passed. Browser fault injection: fill rejection and retry passed; inline edit rejection and retry passed; local history restoration failure is not browser-verified for the reason above.

The audit's explicitly ambiguous or unverified cases remain scoped as such, not as confirmed defects: command-level compensation after a rollback command itself mutates then throws; whether rejected editors should retain drafts; custom plugin setup that acquires resources and then throws before returning cleanup; and browser verification of local history restoration failure. The server-backed browser attempt also demonstrates a committed external Undo followed by a selection-restoration error; its result is not equivalent to the local history contract and needs an explicit server-history outcome policy. Persistent failure of a user callback can still prevent projection recovery; Core reports both the initiating and recovery errors instead of implying a coherent projection.

## Minimal fix order and dependencies

1. **Core computed safety:** F01 speculative-cache cleanup, then F02 mutation/projection failure settlement; F10 registration rollback uses the same safe computation boundary.
2. **Datasource phase separation:** F03 lane registration/settlement; F04 queue-or-cleanup guarantee; F05 accepted/rejected and post-confirmation handling. These can be fixed independently of Vue.
3. **Lifecycle terminal guarantees:** F06 post-await disposal checks and F11 partial-start tracking; F12 best-effort complete cleanup and observed teardown result; then F13 route terminal runtime disposal through the existing API owner.
4. **Notification/report integrity:** F09 batch flush cleanup and F14 primary restore error preservation. Preserve the documented synchronous listener policy unless separately approved.
5. **Vue interaction recovery:** F07 immediate edit settlement/focus isolation and F08 data-versus-restoration history boundary. Add rejected async fill integration coverage before deciding the exact F15 consumer handling; fix the helper's guaranteed cleanup directly.

Each slice should add the diagnostic's recovery assertion as a product regression test with the expected healthy outcome. No new public namespace, global revision, universal transaction coordinator, or package-boundary move is needed to fix these paths.
