# Overload audit fixes

Updated: 2026-10-24. This follow-up closes the confirmed queue/lifecycle defects recorded in the [overload audit](./datagrid-overload-audit-2026-10.md). It does not change public APIs.

## Closed findings

| Finding | Correction | Regression coverage |
| --- | --- | --- |
| F01 | Worker-owned commands coalesce only when adjacent in the pending command order. A patch cannot cross `set-rows` or another command and replace its slot/request ID. | `workerOwnedRowModel.spec.ts`: patch → replacement → patch keeps the final proxy value and both patch commands. |
| F02 | Formula registrations are no longer coalesced by command type; independent definitions are delivered in order. | `workerOwnedRowModel.spec.ts`: two registrations in one turn both appear and compute. |
| F03 | Disposal immediately rejects and releases closures for queued, undispatched writes. A dispatched write's rejection remains observable after disposal; successful remote completion may still resolve while local publication is suppressed. | `dataSourceBackedRowModel.spec.ts`: immediate queued cancellation and in-flight transport rejection after dispose. |
| F04 | API disposal immediately rejects queued exclusive work and releases its callback closures; new async and sync submissions are rejected. An already-running callback is allowed to settle. | `gridApiLifecycleRuntime.contract.spec.ts` and overload harness. |
| F05 | Poll request cleanup is owned by its controller/generation. Old success and error paths cannot clear a restarted request's pending state or deliver stale callbacks. | `changeFeedPoller.spec.ts`: restart, old abort settlement, explicit poll attempt, and current request completion. |
| F06 | Manual refresh-batcher flush cancels its scheduled frame before consuming the batch. | `useDataGridCellRefreshBatcher.contract.spec.ts`: manual flush leaves no duplicate scheduled delivery. |
| F07 | Refresh-batcher schedules remaining rows in `finally` when a consumer or instrumentation callback throws. The failed chunk is not retried automatically; remaining distinct work continues draining and the current callback error remains observable. | `useDataGridCellRefreshBatcher.contract.spec.ts`: first chunk throws, later chunks drain. |
| F08 | RAF scheduler rechecks terminal disposal between callbacks detached into the current frame batch. It does not begin another callback after a previous callback disposes it. | `rafScheduler.contract.spec.ts`. |
| G01 | Compute postMessage transport has a terminal disposed state. Dispatch after disposal throws before posting or allocating timeout bookkeeping, preventing a fallback from being mistaken for successful transport work. | `postMessageTransport.spec.ts`. |

Worker command coalescing remains available for adjacent compatible states such as consecutive patches, viewport ranges, and repeated projection setters. Business commands and formula registrations are never dropped across another command. Worker-owned model mutation methods still have no per-command completion Promise; that separate API contract was not changed here.

## Measured observations that remain separate

- The audit's bounded-burst `runExclusive` workload showed poor input responsiveness because a synchronous/microtask-heavy FIFO sequence does not yield to browser input or paint. This is a fairness/scheduling concern, not loss or reordering. Changing task scheduling affects latency and needs an explicit runtime policy and browser UX budget.
- Rapid cell activation performs an initial reveal for requests that are superseded before their final result. Final activation remains latest-wins and explicit cancellation results are preserved. Coalescing reveal work changes timing and is not part of these correctness fixes.
- Optimistic commit and exclusive queues remain intentionally lossless, FIFO, and without admission limits. Silent dropping is not safe. A bounded policy needs an explicit refusal outcome at submission and a documented capacity contract; no arbitrary hard cap was added.
- The compute transport's 32-entry cap bounds acknowledgement metadata, not already posted physical messages. No new worker credit protocol was introduced. A true downstream credit/window contract is a separate transport protocol change.
- A datasource that ignores AbortSignal indefinitely can keep its own Promise pending, including a foreground flush waiting on it. The prior audit classified this as conditional transport liveness; no timeout or locally detached barrier was added.

These items are not represented as closed by the regression fixes above.

## Validation

Completed checks:

- Overload harness: **25 tests passed**.
- Focused suites: **8 files / 226 tests passed** across worker, Core API/datasource/lifecycle/RAF, polling, and refresh batching.
- Full worker package suite: **3 files / 38 tests passed**.
- Full orchestration unit suite: **26 files / 106 tests passed**.
- Type-checks passed for Core, orchestration, and server-client; worker package build passed.
- `git diff --check` passed.

No post-fix browser latency or visual run was performed. The browser measurements in the original audit remain historical baselines. Scheduling/fairness and activation changes, if taken up separately, require fresh browser measurements.
