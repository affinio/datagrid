# Column methods

`api.columns` reads and changes the column model. A `columnKey` is the stable identity used by selection, cell references, and application state. Display indexes and zone positions are layout coordinates and can change after reorder, visibility, or pinning.

| Method | Contract |
| --- | --- |
| `getSnapshot()` | Returns the current ordered column model, including per-column state and zone order. Use it as the authoritative read after `columns:changed`. |
| `get(key)` | Returns one column snapshot by stable key, or `undefined` when the key is absent. |
| `setAll(columns)` | Replaces the complete column definition set. Treat this as schema replacement; it may remove keys referenced by application state. |
| `insertAt(index, columns)` | Inserts definitions at a position in the global column order and returns whether the model accepted the insertion. |
| `insertBefore(columnKey, columns)` / `insertAfter(columnKey, columns)` | Inserts definitions relative to an existing stable key. Returns `false` when the target or operation is unavailable. |
| `setOrder(keys)` | Replaces global display order by key. It changes presentation order, not row data or key identity. |
| `setZoneOrder(zone, keys)` | Replaces order within one pin zone (`pinnedLeft`, `center`, or `pinnedRight`); other zones are unchanged. These are zone identifiers, distinct from pin values (`left`, `right`, `none`). |
| `setVisibility(key, visible)` | Shows or hides one existing column. Hidden columns remain in the model and keep their stable key. |
| `setWidth(key, width)` | Sets the explicit width. Pass `null` to clear it and return to model sizing behavior. |
| `setPin(key, pin)` | Changes the column's pinned zone (`left`, `right`, or `none`). It does not set scroll position. |
| `getHistogram(columnId, options?)` | Returns histogram data for a column when histogram capability is available. Check `api.capabilities.histogram`; unsupported calls fail with a capability error. |

Column mutations emit `columns:changed` with the current column snapshot. The API does not perform DOM drag-and-drop, resize gestures, or menu behavior. An adapter should translate those inputs into calls here and render from the resulting snapshot.

For persisted whole-column selection, use `api.columnSelection`; it is independent of column order and visibility. See [column selection](../../modules/selection/column-selection.md).
