# State, events, and plugin methods

## Unified state

| Method | Contract |
| --- | --- |
| `state.get(options?)` | Captures a versioned snapshot through current model/service boundaries without mutating live state. `includeViewportPosition` requests the semantic viewport section when supported. A bound transaction service can contribute a transaction snapshot, but `state.set` does not restore transaction history. |
| `state.migrate(state, options?)` | Converts versioned unknown input to a normalized current `DataGridUnifiedState`, or returns `null` when the payload cannot be migrated. With `strict: true`, malformed input and unsupported versions throw. Service-capability validation is performed by `state.set`, not by migration alone. |
| `state.validate(state, options?)` | Preflights the state version and strict capability requirements without mutation. Returns applicable sections, skipped sections, and issues. It cannot guarantee later mutations will succeed. |
| `state.set(state, options?)` | Applies migrated state through model APIs and returns a frozen report listing applied/skipped sections. Row projection, columns, selection, and viewport can be independently controlled by options; `strict` prevalidates unsupported requested sections before mutation. `atomic` requests best-effort rollback for supported local state, not universal rollback of remote/adapter effects. Runtime failures throw `DataGridStateRestoreError` with `failedSection`, applied/skipped sections, and rollback status (`not-requested`, `complete`, or `partial`). |

State format version is currently `1`. Older snapshots may omit optional fields such as `columnSelection`; migration normalizes them. `state:imported` is emitted only after successful application. `state:import:end` runs in `finally`, including on validation or mutation failure. State application is sequential unless atomic rollback is requested; rollback is best-effort and a failed rollback is reported as partial. Do not use a raw Core state snapshot as a user saved-view format without filtering transient or unsupported sections according to the host's policy.

## Events

| Method / event | Contract |
| --- | --- |
| `events.on(event, listener)` | Subscribes to one typed API event and returns an unsubscribe callback. Keep and call it when the host/runtime is disposed. |
| `rows:changed` | Announces a row-model snapshot update. Read `api.rows.getSnapshot()` for current state. |
| `rows:edited` | Reports successful edit-origin row changes with source and old/new row data. |
| `columns:changed` | Announces the current column-model snapshot. |
| `projection:recomputed` | Reports projection version change and stale stages after recomputation. |
| `selection:changed`, `row-selection:changed`, `column-selection:changed` | Report their respective independent selection snapshots. Selection payloads include an operation ID and optional origin. |
| `pivot:changed`, `transaction:changed`, `viewport:changed` | Announce the relevant subsystem snapshot or position update. |
| `state:import:begin`, `state:import:end`, `state:imported` | Delimit the state-restore lifecycle and report completion. Begin/end do not mean UI rendering has completed. |
| `error` | Reports a structured runtime error with operation, recoverability, and original error value. |

API events are synchronous. Reentrant emissions are queued FIFO after the current event finishes dispatching; FIFO describes delivery order, not permission to mutate reentrantly. A listener exception propagates synchronously and stops remaining listeners for that event, so listeners should not throw. The triggering model mutation may already have committed when its listener throws; the exception does not imply rollback. Events are invalidation/change notifications, not durable operation logs; read a fresh snapshot for current state. Row edit payloads contain row objects owned by the model and are not deep-frozen. Copy values in the listener when they must outlive later source updates. See the [event matrix](../../../../../../docs/reference/datagrid-event-matrix.md) for cross-package event mapping.

## Plugins

| Method | Contract |
| --- | --- |
| `plugins.register(plugin)` | Registers a plugin by ID and returns whether it was added. Duplicate IDs are not added. Registration invokes its lifecycle hook when provided. |
| `plugins.unregister(id)` | Removes a plugin and returns whether the ID existed. |
| `plugins.has(id)` | Checks whether an ID is registered. |
| `plugins.list()` | Returns registered IDs as a read-only list. |
| `plugins.clear()` | Unregisters all plugins and runs their cleanup hooks. |

Plugins observe the public API contract and declared capabilities. They do not acquire implicit access to model internals. See [plugin capability model](../../../../../../docs/reference/datagrid-plugin-capability-model.md).
