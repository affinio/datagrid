# Column selection

`api.columnSelection` stores a selection of whole columns by stable `columnKey`. It is independent of cell/range selection, row selection, and column visibility/order. Core stores and applies the state; a UI adapter decides which gestures change it and how it is rendered.

## Capability and snapshot

Column selection is optional at the Core service level. Check support before enabling column-selection actions:

```ts
if (api.columnSelection.hasSupport()) {
  const snapshot = api.columnSelection.getSnapshot()
}
```

The snapshot is `{ selectedColumnKeys: readonly string[] }`. It contains unique, non-empty keys and is immutable. Keys are semantic identity: reordering or hiding a column does not change its selection. Removing a column does not implicitly mutate this snapshot; the host may reconcile it when its schema changes.

## Update selection

```ts
api.columnSelection.setSelected("status", true, { origin: "column-picker" })
api.columnSelection.selectColumns(["status", "owner"], { origin: "column-picker" })
api.columnSelection.deselectColumns(["owner"], { origin: "column-picker" })

if (api.columnSelection.isSelected("status")) {
  // apply a column-level action
}

api.columnSelection.clear({ origin: "column-picker" })
```

`setSnapshot` replaces the complete selected-key set. `getSelectedColumns` returns the selected keys in snapshot order; it does not imply display order. `clearSelectedColumns` is an alias for clearing the selected keys. Reapplying a semantically identical set is a no-op and emits no change event. Set equality ignores array order.

Mutations accept the optional `{ origin, operationId }` context. Change events include both fields; Core generates an operation ID when the caller omits it. This metadata records provenance and does not deduplicate operations.

## Versioned state

`api.state.get()` includes the `columnSelection` field. It is restored with the other supported selection state and participates in atomic rollback. Older unified state objects that omit this field migrate to an empty column selection. Strict restore rejects a non-empty column selection when the runtime has no column-selection capability, before applying state changes.

## Ownership

Core owns the stable-key snapshot, normalization, state capture/restore, and change event. The adapter owns header hit testing, pointer and keyboard gestures, focus, and preview/rendering. `api.columns` continues to own column definitions, visibility, width, pinning, and display order. Column selection does not create a cell range or imply that every cell in a selected column is selected.
