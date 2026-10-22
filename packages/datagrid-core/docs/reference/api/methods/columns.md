# Column methods

`api.columns` reads and changes the column model. A `columnKey` is the stable identity used by selection, cell references, and application state. Display indexes and zone positions are layout coordinates and can change after reorder, visibility, or pinning.

| Method | Contract |
| --- | --- |
| `getSnapshot()` | Returns the current ordered column model, including per-column state and zone order. Use it as the authoritative read after `columns:changed`. |
| `get(key)` | Returns one column snapshot by stable key, or `undefined` when the key is absent. |
| `setAll(columns)` | Replaces definitions, order, zones, and per-column runtime state. A retained key receives the new definition and its new `initialState`; previous width, visibility, pin, and custom order are discarded. Duplicate keys throw. |
| `insertAt(index, columns)` | Inserts definitions at a position in the global column order and returns whether the model accepted the insertion. |
| `insertBefore(columnKey, columns)` / `insertAfter(columnKey, columns)` | Inserts definitions relative to an existing stable key. Returns `false` when the target key is absent or the insertion list is empty. Invalid definitions follow column-model validation and can throw. |
| `setOrder(keys)` | Applies the supplied known unique keys first, then appends every omitted key in its prior global order. Unknown and repeated keys are ignored. It changes presentation order, not row data or key identity. |
| `setZoneOrder(zone, keys)` | Reorders only keys already in that zone. Unknown, cross-zone, and repeated keys are ignored; omitted keys are appended in their prior zone order. Other zones are unchanged. |
| `setVisibility(key, visible)` | Shows or hides one existing column. Hidden columns remain in the model and keep their stable key. |
| `setWidth(key, width)` | Sets the explicit width. Pass `null` to clear it and return to model sizing behavior. |
| `setPin(key, pin)` | Changes the column's pinned zone (`left`, `right`, or `none`). It does not set scroll position. |
| `getHistogram(columnId, options?)` | Returns histogram data for a column when histogram capability is available. Check `api.capabilities.histogram`; when unsupported, this query returns an empty list. |

Column mutations emit `columns:changed` with the current column snapshot. The API does not perform DOM drag-and-drop, resize gestures, or menu behavior. An adapter should translate those inputs into calls here and render from the resulting snapshot.

Column state is keyed only by the current column definitions. `setAll()` does not reconcile filters, sorting, formulas, selection, or application state held by other services; owners of those states must clear or migrate references to removed keys. Pivot-generated columns are owned by the row model's pivot projection and are reconciled by the adapter runtime; authored base definitions remain the schema supplied to `setAll()`. Widths are clamped to each definition's `minWidth`/`maxWidth`; setting `null` clears the explicit width. Pinning appends to a pinned zone, while unpinning inserts into center according to current global order. Zone order determines visible order within each pin zone; global order is an independent canonical order.

For persisted whole-column selection, use `api.columnSelection`; it is independent of column order and visibility. See [column selection](../../modules/selection/column-selection.md).
