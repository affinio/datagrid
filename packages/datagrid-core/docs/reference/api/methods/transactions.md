# Transaction methods

Transactions are the Core undo/redo history boundary. They are distinct from direct row-model methods such as `rows.setData`, `rows.patch`, and `rows.applyEdits`; those methods do not automatically become transaction-history entries.

| Method | Contract |
| --- | --- |
| `hasSupport()` | Reports whether a transaction service is bound. |
| `getSnapshot()` | Returns the current history snapshot or `null` when unsupported. Use it to render history status, not as a mutable history object. |
| `beginBatch(label?)` | Starts the single pending transaction batch and returns its ID. Batches cannot nest; commit or roll back the current batch before starting another. |
| `commitBatch(batchId?)` | Commits the current or named batch asynchronously and returns the committed transaction IDs. |
| `rollbackBatch(batchId?)` | Rolls back the current or named uncommitted batch synchronously and returns affected transaction identifiers. |
| `apply(transaction, options?)` | Applies one transaction and resolves to its transaction ID. If a batch is open, it appends to that pending batch and is applied when the batch commits. `options.signal` can abort before application; an already-aborted signal rejects with an `AbortError`. |
| `canUndo()` / `canRedo()` | Report whether one history step is currently available. These are state reads; subscribe to `transaction:changed` to keep controls current. |
| `undo()` / `redo()` | Applies one committed history step and resolves to the applied transaction ID, or `null` when no step is applied. |

Mutations require transaction support; unsupported mutations throw a capability error. `commitBatch`, `apply`, `undo`, and `redo` are asynchronous: await them before assuming history has settled. A transaction may reject due to a conflict or invalid lifecycle; handle the Promise rejection and refresh the snapshot.

Use `rows.batchMutations()` to reduce client projection recomputations, not to create undo history. Use transaction batches when several reversible operations should form one history unit. The exact mutation vocabulary is defined by `DataGridTransactionInput` and the bound transaction service.
