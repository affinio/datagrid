# Transaction methods

Transactions are the Core undo/redo history boundary. They are distinct from direct row-model methods such as `rows.setData`, `rows.patch`, and `rows.applyEdits`; those methods do not automatically become transaction-history entries.

| Method | Contract |
| --- | --- |
| `hasSupport()` | Reports whether a transaction service is bound. |
| `getSnapshot()` | Returns the current history snapshot or `null` when unsupported. Use it to render history status, not as a mutable history object. |
| `beginBatch(label?)` | Starts the single pending transaction batch and returns its ID. Batches cannot nest; commit or roll back the current batch before starting another. |
| `commitBatch(batchId?)` | Takes the pending batch, applies its transactions sequentially, and returns their IDs after application succeeds. A non-empty batch becomes one undo/redo history step. |
| `rollbackBatch(batchId?)` | Discards the pending batch synchronously and returns its transaction IDs. Transactions in a pending batch have not run, so this does not execute rollback commands. |
| `apply(transaction, options?)` | Without an open batch, applies the transaction and resolves to its ID after application succeeds. With an open batch, appends it to the pending batch and resolves to its ID once queued; it is not applied until `commitBatch()`. `options.signal` can abort before queueing/application; an already-aborted signal rejects with an `AbortError`. |
| `canUndo()` / `canRedo()` | Report whether one history step is currently available. These are state reads; subscribe to `transaction:changed` to keep controls current. |
| `undo()` / `redo()` | Applies one committed history step and resolves to the applied transaction ID, or `null` when no step is applied. |

Mutations require transaction support; unsupported mutations throw a capability error. `commitBatch`, `apply`, `undo`, and `redo` are asynchronous, but their completion points differ: `apply()` inside a batch means **queued**, while successful `commitBatch()` means **applied and recorded in history**. Awaiting the queued `apply()` does not wait for commit.

On commit failure, Core removes the pending batch and attempts to roll back every transaction already applied by that operation, continuing after individual compensation failures. A rejected commit is therefore not retryable as the same pending batch. The promise rejects with `DataGridTransactionBatchCommitError`; its immutable `report` includes the batch/commit IDs, direction, failed transaction ID, applied and compensated transaction IDs, compensation failures, and original cause. A non-empty `compensationFailures` list means external state may be partial; callers should inspect their authoritative model. The same error type reports a failed redo, with `direction: "redo"`. Batches cannot overlap another active transaction action; concurrent apply/undo/redo operations reject while an action is in flight.

There is no operation to remove or abort one transaction after it has been queued in a pending batch. `rollbackBatch()` discards the entire uncommitted batch. An abort signal supplied to `apply()` is checked before the transaction is queued/applied; it does not cancel a transaction that has already entered the pending batch.

Use `rows.batchMutations()` to reduce client projection recomputations, not to create undo history. Use transaction batches when several reversible operations should form one history unit. The exact mutation vocabulary is defined by `DataGridTransactionInput` and the bound transaction service.
