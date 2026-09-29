# Core API: `@affino/datagrid-core`

Status: public API guide.

The core package is framework-agnostic. It is the communication boundary for row models, projection, lifecycle, state, events, and the namespaced `DataGridApi`. It does not render DOM and does not depend on Vue.

```ts
import { createClientRowModel, createDataGridApi } from "@affino/datagrid-core"
```

## Runtime model

The core pipeline is explicit:

```text
source rows -> filter -> sort -> group/tree -> pivot -> aggregate -> paginate -> visible rows
```

Each stage has state and invalidation semantics. A mutation may update cell values without immediately changing visible order; call `view.reapply()` or use the appropriate edit policy when projection must be recomputed.

## Client row model

```ts
const rowModel = createClientRowModel({
  rows: [
    { rowId: "r-1", team: "Platform", amount: 1200 },
    { rowId: "r-2", team: "Payments", amount: 860 },
  ],
})

rowModel.setSortModel([{ colId: "amount", sort: "desc" }])
const snapshot = rowModel.getSnapshot()
```

Use `setRows` for full source replacement and `patchRows` for partial updates by row id. `patchRows` accepts explicit `recomputeSort`, `recomputeFilter`, and `recomputeGroup` policy flags; disabling them preserves the current view while data changes and marks affected stages stale.

## `DataGridApi` namespaces

Create the API only through public factories and interact through namespaces:

| Namespace | Responsibility |
| --- | --- |
| `lifecycle` | `init`, `start`, `stop`, `dispose`, exclusive mutation windows. |
| `rows` | Read projected rows, patches, edits, batches, and row-model operations. |
| `data` | Pause, resume, and flush supported datasource flows. |
| `columns` | Column state and layout operations. |
| `view` | Reapply projection, semantic viewport position, row heights. |
| `selection` / `rowSelection` | Cell/range selection, summaries, and full-row selection. |
| `pivot` | Pivot model, generated columns, layout, and drilldown. |
| `transaction` | Structured mutation, undo, redo, and rollback where supported. |
| `state` | Unified export/import and migration. |
| `events` | Typed event subscription. |
| `compute` | Runtime compute mode. |
| `diagnostics` / `meta` | Read-only diagnostics and compatibility metadata. |
| `policy` / `plugins` | Runtime policy and public plugin lifecycle. |

The complete method-level reference is [Unified Grid API](./datagrid-grid-api.md). `@affino/datagrid-core/advanced` and `/internal` are not interchangeable with the stable root entrypoint.

## Mutation rules

```ts
await api.rows.applyEdits(edits) // user edit semantics
api.rows.patch(patches)           // external/streaming data update
api.rows.batch(() => {      // one public event-delivery cycle
  api.rows.patch(firstPatch)
  api.rows.patch(secondPatch)
})
api.view.reapply()                // projection only
```

`rows.batch` coalesces public event delivery; it does not guarantee one row-model
recomputation or one transaction-history entry. Use `rows.batchMutations` for
the explicit client row-model recomputation boundary. Use `transaction.apply` when
rollback or transaction history is part of the contract. `rows.applyEdits` is
the user-edit pipeline but does not automatically participate in generic
transaction history. Guard capability-dependent operations through
`api.capabilities`.

## State, events, and determinism

Use `api.state.get()` / `api.state.set()` as the persistence boundary. Migrate older or untrusted payloads with `api.state.migrate()` before restoring. Viewport persistence is semantic and should use row/column targets, not DOM scroll offsets.

Subscribe through `api.events.on`; public events are typed and queued FIFO during reentrant emission. Read operations are revision-consistent within a synchronous call stack. Diagnostics are read-only and do not trigger recomputation.

For server-owned data, use the [data source API](./reference/datagrid-data-source-api.md) and the [server quick start](./server-datasource/quick-start.md).

## Building a core runtime

For framework-independent integrations, assemble a core registry from row and column models, then create the API facade:

```ts
import {
  createClientRowModel,
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
} from "@affino/datagrid-core"

const rowModel = createClientRowModel({ rows })
const columnModel = createDataGridColumnModel({ columns })
const core = createDataGridCore({
  services: {
    rowModel: { name: "rowModel", model: rowModel },
    columnModel: { name: "columnModel", model: columnModel },
  },
})

const api = createDataGridApi({ core })
await api.start()
```

The core registry requires row and column model services. Selection, transactions, viewport, compute, histogram, and datasource controls are capability-dependent. Check `api.capabilities` before calling an operation that needs an optional service, and call `await api.dispose()` when the host is destroyed.

See the [core factories reference](./reference/datagrid-core-factories-reference.md) for the supported constructor shapes.
