# Read view methods

`api.read.captureView()` reads selected namespaces synchronously during one JavaScript turn. Use it when a consumer must capture rows, columns, computed-field metadata, and selection together before doing later work.

| Method | Contract |
| --- | --- |
| `captureView({ include, cloneRow? })` | Captures only the requested parts. Every requested part is returned with `status: "available"` or `"unsupported"`; supported empty selection is `available` with `null` snapshots. |

```ts
const view = api.read.captureView({
  include: ["rows", "columns", "computed", "selection"],
  cloneRow: row => structuredClone(row),
})

if (view.rows?.status === "available" && view.columns?.status === "available") {
  const columnOrder = view.columns.value.order
  const rows = view.rows.value.projection
  // Keep this captured bundle for a consistent synchronous read.
}
```

The capture contains the row-model snapshot and projected row nodes, the column-model snapshot, computed/formula field registration snapshots, and the available cell/row/column selection snapshots. Row and column revisions are reported independently. Selection does not yet expose one shared service revision and reports `null`.

`rows.value.coverage` describes only the captured current projection. Client row models report `complete`. Datasource models report `partial` when loaded intervals leave gaps, with inclusive display-index `missingIntervals`; they report `complete` when every projected index is loaded. A model without loaded-interval support reports `unknown`. `loadedRowCount` is `null` when it cannot be determined. `queryRevision` is the row-model revision, not a server-issued query identity; `datasetVersion` is copied from the row snapshot when supplied.

The returned view and its structural containers are detached and frozen. Row `data` and `row` values remain source-owned references by default; external mutation of those objects can still be observed through the capture. Supply `cloneRow` when the consumer needs an independent row value. Plain objects and arrays returned by `cloneRow` are copied and frozen structurally. Core does not promise a deep clone for class instances, maps, sets, or other custom objects.

The operation does not lock the live grid or retain model resources. The captured structure remains usable after later grid changes or disposal, subject to the row ownership rule above. For a datasource-backed model, the projection can contain loading placeholders; inspect coverage before treating it as complete. `captureView()` itself is synchronous and returns a new object per call, so a React `useSyncExternalStore` adapter must cache the captured value by its subscribed revision.

Computed values are represented here by their field/formula registration snapshots. This method does not resolve arbitrary display values or source write targets; use [`api.cells.resolveValue()`](./cells.md) for one logical cell. For current method boundaries, see [rows and projection](./rows.md), [columns](./columns.md), and [the Core module guide](../../modules/computed-fields.md).
