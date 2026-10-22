# DataGrid API method behavior

Use [the signature inventory](../grid-api-methods.md) as the canonical list of public methods and TypeScript signatures. These pages explain what each method reads or changes, which ordering its arguments use, when capabilities are required, and what callers should expect after a call.

The method pages describe the stable root API. Lower-level helpers and model constructors may have different stability guarantees; see [API stability](../../../../../../docs/api-stability.md) before depending on advanced entrypoints.

## By responsibility

- [Rows and projection](rows.md) — projected reads, source mutations, projection settings, computed fields, formulas, batching.
- [Columns](columns.md) — column identity, order, zones, visibility, sizing, pinning, histograms.
- [View and viewport](view.md) — semantic scrolling, activation, row heights, refresh, rendered-cell invalidation.
- [Pivot](pivot.md) — pivot configuration, layout snapshots, drilldown, and interop exports.
- [Selection](selection.md) — cell ranges, record selection, column selection, summaries, provenance.
- [Transactions](transactions.md) — reversible operations, batches, undo and redo.
- [State and events](state-events.md) — migration, restore, events, plugins, and operation context.
- [Runtime and diagnostics](runtime.md) — lifecycle, capabilities, compute mode, schema, diagnostics, projection policy.
- [Datasource controls](datasource.md) — backpressure operations and their asynchronous behavior.
- [Read views](read.md) — synchronous cross-namespace snapshots, revisions, and row ownership.
- [Cell values](cells.md) — source, computed/accessor, formatted display values, and write-target hints.

## Reading a method contract

1. Check `hasSupport()` or `api.capabilities` when the method depends on an optional service.
2. Use stable `rowId` and `columnKey` when a request targets a logical record or column. Indexes address a particular current projection or display order as specified by that method.
3. Await methods whose return type is a Promise. A synchronous API call does not imply that the host framework has rendered its changes.
4. Subscribe to the documented event when the host needs notification; read a fresh snapshot for current state.

The API facade validates capabilities and delegates to the bound models. It does not create a DOM, wait for a UI render, fetch missing data unless a datasource contract explicitly does so, or infer product policy.

## Result policy exceptions

There is no single fallback for every unsupported operation; follow the individual method contract:

- Row data mutations generally throw when their required capability is missing. `rows.insertDataAt`, `insertDataBefore`, and `insertDataAfter` also throw when the corresponding insert capability is missing; `false` is a model-level outcome such as an unavailable target or rejected insertion.
- `columns.insertBefore` and `insertAfter` return `false` when the target key is absent or the insertion list is empty. Invalid column definitions still follow column-model validation and can throw. These operations do not use a row-model capability.
- `columns.getHistogram` returns an empty list when histogram capability is unavailable.
- Viewport commands such as `scrollToRow` and `scrollToCell` are requests to an optional viewport service and silently do nothing when that service method is absent. `setViewportPosition` can opt into a capability error with `{ strict: true }`.
- `view.activateCell` always returns a structured result; missing adapter support is reported as `status: "failed"`.

These return values are not interchangeable: `false` or an empty list may be a supported no-result outcome, while a viewport request may only have been forwarded. Do not infer that a requested adapter action completed unless the specific method reports completion.

For new methods, use this result policy: throw a capability error when the model cannot perform the operation; return a documented structured unavailable result when a valid target is absent; make an already-satisfied operation a no-op without a revision/event; and throw a validation error for malformed input. Adapter requests must be named and documented as requests, not reported as completed mutations.
