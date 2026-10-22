# Cell value methods

`api.cells.resolveValue()` resolves a logical cell by stable row ID and column key. It returns independent source, accessor/computed, formatted, and display values so consumers do not accidentally use formatted text for calculations or writes.

```ts
const result = api.cells.resolveValue({
  rowId: "order-42",
  columnKey: "netAmount",
  purpose: "display",
})

if (result.status === "available") {
  render(result.displayValue)
  // Use result.writeTarget to determine whether a row patch can represent an edit.
}
```

`purpose` selects `value`: `source` reads the configured field (or column key), `computed` invokes the column accessor/value getter when present, and `display` returns the cell type's display-formatted text. The full result always includes `sourceValue`, `computedValue`, `formattedValue`, and `displayValue`.

Unavailable outcomes distinguish a missing row, an unloaded datasource row, a group row, and an unknown column. A value getter/accessor is a read contract and does not imply a write path. `writeTarget` is a row-patch key only when a shallow patch represents the configured field; a custom value setter is reported as `custom-setter`, and nested paths without a setter return no patch target. The adapter remains responsible for invoking a custom setter and applying validated edits.

This method resolves authored column accessors and built-in cell formatting. It does not infer formula engine overlays that are not materialized in the row value, nor does it serialize arbitrary presentation columns. `api.read.captureView()` remains the consistent multi-namespace read operation; use this resolver for one logical cell.

For work that spans asynchronous boundaries, pass the row and column from one captured read view:

```ts
const view = api.read.captureView({ include: ["rows", "columns"] })
const row = view.rows?.status === "available"
  ? view.rows.value.projection.find(candidate => candidate.rowId === rowId)
  : undefined
const column = view.columns?.status === "available"
  ? view.columns.value.byKey[columnKey]
  : undefined

if (row && column) {
  const result = api.cells.resolveValue({
    rowId,
    columnKey,
    purpose: "computed",
    snapshot: { row, column },
  })
}
```

When `snapshot` is supplied, the resolver reads only its row data and column definition. It does not look up either value in the live models. This makes the resolution consistent with the supplied capture; it does not deep-clone row data itself. Use `captureView({ cloneRow })` when source rows may be mutated in place, and make that callback copy nested mutable values used by the operation.
