# DataGrid Public API — Contract Hardening Status

Status date: 2026-09-29

This status file records implementation work against the baseline audit in
`DataGrid-Public-API-Architecture-Contract-Audit.md`.

## Gap closure matrix

| Finding | Resolution | Status |
| --- | --- | --- |
| API-001 — `whenIdle` is not universal | Scope is documented. No misleading universal barrier was added. | CLOSED WITH DOCUMENTED LIMITATIONS |
| API-002 — `rows.batch` is event-only | Event-batching semantics are preserved; `rows.batchMutations` now provides a separate client recomputation boundary. | CLOSED |
| API-003 — state import is not rollback-atomic | Added opt-in `{ atomic: true }` rollback for supported local row, column, selection, and viewport state; default remains sequential. | CLOSED WITH DOCUMENTED LIMITATIONS |
| API-004 — direct mutations bypass history | Direct mutation and generic transaction history are documented and covered by contract tests. | CLOSED |
| API-005 — insertion index ambiguity | Source/projected index spaces are documented and regression-tested. | CLOSED |
| API-006 — unsupported behavior varies | Capability checks and per-operation unsupported behavior are documented and tested; existing return conventions are preserved. | CLOSED WITH DOCUMENTED LIMITATIONS |
| API-007 — no formula/computed-field removal | Added public unregister methods, capability checks, dependency cleanup, materialized-value cleanup, and lifecycle tests. | CLOSED |
| API-008 — mutation origins and aliases underdocumented | Mutation matrix, group alias behavior, adapter/orchestration/shell exposure, and completion/history semantics are documented and tested. | CLOSED |

## Added public surface

```ts
api.rows.getById(rowId)
api.rows.hasRowIdLookupSupport()
api.rows.removeData(rowIds)
api.rows.hasRemoveSupport()
api.rows.unregisterComputedField(name)
api.rows.hasComputedUnregisterSupport()
api.rows.unregisterFormulaField(name)
api.rows.hasFormulaUnregisterSupport()
api.state.set(state, { applyRows?: boolean })
```

The row lookup and deletion operations are local capability-bound operations.
Datasource-backed models do not claim support when the required local index or
mutation capability is unavailable.

## Remaining intentional limitations

- `lifecycle.whenIdle()` covers guarded API work, not arbitrary datasource,
  compute-worker, adapter-render, or browser activity.
- `rows.batch()` coalesces facade event delivery; it does not promise one row
  model recomputation for the callback.
- `rows.batchMutations()` is supported by client row models; datasource-backed
  models execute the callback synchronously without claiming a batch.
- State import remains sequential by default. `{ atomic: true }` cannot reverse
  every datasource or adapter operation; `dataSource.atomic` controls
  backpressure and is not itself rollback.
- Direct row mutations remain outside generic transaction undo/redo history.

## Validation

- Core contract suite: 106 files, 837 tests passed.
- Core TypeScript typecheck passed.
- Orchestration, Vue adapter, and Vue shell contract tests/typechecks passed.
- `git diff --check` passed.
