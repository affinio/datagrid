# DataGrid API overview

Status: current public contract.

`DataGridApi` is the framework-independent command and query interface for `@affino/datagrid-core`. It exposes model state and operations; it does not render cells or own DOM events. Create it from the Core services, then keep the instance as the integration boundary between the host UI and the engine.

For the full method signatures, parameters, and return types, use the [API method reference](reference/api/grid-api-methods.md). For the behavior of individual methods—including state effects, capability requirements, ordering semantics, and failure cases—use its [method behavior guide](reference/api/methods/README.md). This page explains how the surface is organized and which contract to use for common tasks.

## Create and start the API

Use `createDataGridApi` with a `DataGridCore` assembled from row and column model services. The [factories reference](reference/api/factories.md) has the complete assembly example and supported inputs.

```ts
const api = createDataGridApi({ core })
await api.start() // initializes services, then starts them

const unsubscribe = api.events.on("rows:changed", () => {
  render(api.rows.getSnapshot())
})

// When the host permanently removes this grid:
unsubscribe()
await api.dispose()
```

`api.start()` calls initialization when needed. The host owns its subscriptions and any separately constructed model instances; dispose those according to their model lifecycle contracts.

## Namespace map

| Namespace | Use it for | Common operations |
| --- | --- | --- |
| `lifecycle` | Guarded work and runtime status | `runExclusive`, `whenIdle`, `isBusy` |
| `rows` | Row reads, mutations, and projection models | `get`, `getById`, `patch`, `applyEdits`, sort/filter/group |
| `data` | Datasource backpressure | `pause`, `resume`, `flush` |
| `columns` | Column layout and definitions | order, visibility, width, pin |
| `view` | Viewport targets, cell activation, row heights, refresh | `scrollToCell`, `activateCell`, `reapply` |
| `selection` | Cell and range selection | snapshots, summaries, selected range data |
| `rowSelection` | Selected and focused records | selected row IDs and snapshots |
| `columnSelection` | Selected whole columns | selected column keys and snapshots |
| `transaction` | History-aware mutations | apply, batch, undo, redo |
| `pivot` | Analytical pivot state and layout | model, drilldown, import/export layout |
| `state` | Versioned state export, migration, restore | `get`, `migrate`, `set` |
| `events` | Typed runtime notifications | `on(event, listener)` |
| `compute` | Compute mode and execution state | `switchMode`, diagnostics |
| `diagnostics` | Read-only runtime inspection | `getAll`, `getFormulaExplain` |
| `meta` | Schema and compatibility information | API/protocol versions, runtime info |
| `policy` | Projection policy | get/set projection mode |
| `plugins` | Public plugin lifecycle | register, unregister, observe events |

The API keeps cell/range, record, and whole-column selection in separate namespaces. Read [cell and range selection](reference/modules/selection/cell-range.md), [column selection](reference/modules/selection/column-selection.md), and [row selection](reference/modules/selection/row-selection.md) for their distinct state contracts. Renderer-specific gestures belong to the adapter.

## Choose the operation by intent

| Intent | Use | Contract |
| --- | --- | --- |
| Commit a user edit | `api.rows.applyEdits(...)` | User-edit path; can participate in edit policy |
| Apply an external or streaming update | `api.rows.patch(...)` or `applyExternalUpdates(...)` | External data path; projection recompute is controlled by options |
| Recompute the current view | `api.view.reapply()` | Projection refresh without replacing source rows |
| Coalesce public event delivery | `api.rows.batch(callback)` | One facade event cycle; not necessarily one recompute or history item |
| Coalesce synchronous client-model mutations and recompute once | `api.rows.batchMutations(callback)` | Supported client row models only |
| Record a reversible operation | `api.transaction.apply(...)` | Uses transaction history when the transaction capability is bound |

These operations are not interchangeable. The method reference documents row-model capability differences and exact recompute behavior.

## Capabilities

`DataGridApi` always exposes its namespaces, but available operations depend on the bound Core services and row model. Row and column models are required when creating the API. Selection, transactions, viewport control, histogram queries, compute switching, and datasource controls are optional.

Check `api.capabilities` or the relevant `hasSupport()` method before enabling an optional operation in the host UI. Unsupported mutations fail explicitly; optional queries can return `null` or an empty result. See the [method reference](reference/api/grid-api-methods.md#capability-checks-and-errors) for each operation's behavior.

## State, events, and consistency

- Read current state through API snapshots. Event payloads notify the host that state changed; they are not a substitute for reading the latest snapshot.
- Subscribe through `api.events.on(...)`; always keep and call the returned unsubscribe function.
- Events are synchronous and ordered within the runtime. Reentrant events are queued FIFO. See the [event and state guide](../../../docs/datagrid-state-events-compute-diagnostics.md) for ordering and error behavior.
- `api.state.get()` and `api.state.set()` are the versioned persistence boundary. Migrate external or older data with `api.state.migrate()` before restoring. State import has explicit begin/end events and is not universally atomic; see [state semantics](../../../docs/datagrid-state-events-compute-diagnostics.md).
- Selection snapshot changes may carry `{ origin, operationId }` to trace cross-grid updates. This records provenance; it does not deduplicate operations automatically.
- Use semantic viewport targets such as `rowId` and `columnKey` for reveal and persistence. DOM nodes and raw scroll offsets belong to the adapter. The [virtualization support matrix](../../../docs/reference/datagrid-virtualization-support-matrix.md) describes integration boundaries.
- `api.lifecycle.runExclusive(...)` serializes guarded operations. It does not wait for arbitrary network work, host rendering, or unguarded mutations.

## Reference path

1. Start with this page to understand namespaces and operation choices.
2. Use the [method reference](reference/api/grid-api-methods.md) for the complete `DataGridApi` surface.
3. Use the [factories reference](reference/api/factories.md) to assemble row models and services.
4. Use [Core and UI adapter boundaries](./integration-guide.md) to understand who owns viewport, DOM, rendering, and interaction lifecycles.
5. Use the [API stability policy](../../../docs/api-stability.md) for stable, advanced, and internal import guarantees.
