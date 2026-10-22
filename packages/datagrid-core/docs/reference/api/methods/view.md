# View and viewport methods

`api.view` accepts logical view commands and records viewport-related state. The adapter still owns the scroll element, DOM measurement, pinned-pane synchronization, rendering, and focus transfer. Viewport commands may be no-ops when the bound viewport service does not implement the requested operation; position restoration can opt into strict failure.

## Position and scrolling

| Method | Contract |
| --- | --- |
| `setViewportRange(range)` | Updates the row model's logical viewport range and forwards it to the viewport service when available. The range is a model coordinate, not a DOM scroll offset. |
| `getViewportPosition()` | Returns the semantic position snapshot when supported, otherwise `null`. |
| `setViewportPosition(position, options?)` | Asks the viewport service to restore semantic position. If unsupported, it is a no-op unless `options.strict` is true, in which case it throws. |
| `scrollToRow(target)` | Requests scrolling to a row by supported semantic target such as row ID or index. No DOM element is returned. |
| `scrollToColumn(target)` | Requests scrolling to a column by key or index. Column indexes follow the target contract and can change after reorder. |
| `scrollToCell(target)` | Requests scrolling to a logical cell. This does not set cell selection or keyboard focus. |
| `activateCell(target, options?)` | Runs the adapter's full logical-cell activation operation and returns a Promise with `activated`, `unavailable`, `cancelled`, or `failed`. It can reveal, select, or focus according to options; it does not load missing rows or reveal hidden columns. Abort and supersession are reported in the result. See [activation semantics](../grid-api-methods.md#view-and-rendered-cells) and the result union. |

Use `scrollToCell` for a viewport request when no selection/focus transition is needed. Use `activateCell` when the host needs to know whether a logical target could be revealed and activated. The adapter owns pinned-region offsets, sticky occlusion, virtual-window waits, and DOM focus.

## Row height

| Method | Contract |
| --- | --- |
| `setRowHeightMode(mode)` | Requests fixed or automatic row-height behavior from the viewport service. |
| `setBaseRowHeight(height)` | Sets the base height after normalizing finite values to a positive integer. Invalid non-finite input is ignored. |
| `measureRowHeight()` | Requests adapter measurement when the service supports it. Measurement policy and DOM reads stay adapter-owned. |
| `getEffectiveRowHeight()` | Returns the effective height or `0` when the viewport service cannot report one. |
| `setRowHeightOverride(rowIndex, height)` | Sets a positive integer override for a non-negative row index. Finite heights are truncated and clamped to at least `1`; pass `null` to clear that index. Invalid indexes and non-finite heights are ignored. |
| `getRowHeightOverride(rowIndex)` | Returns an override or `null`. Reads from the viewport service first, then the API's fallback override map. |
| `getRowHeightVersion()` | Returns the viewport service revision when available, otherwise a fallback revision derived from the local override map. |
| `getRowHeightOverridesSnapshot()` | Returns the service's override map or the fallback map. Treat the result as read-only; do not mutate it. |
| `getLastRowHeightMutation()` | Returns the latest set/clear/clear-all mutation metadata, or `null` when no mutation has been recorded. |
| `clearRowHeightOverrides()` | Clears all overrides from the local fallback and asks the viewport service to clear its state. |

Row-height overrides are index-based view state. Reconcile them when projection order or row identity changes; do not persist an index as a row ID. The revision and last-mutation methods primarily support adapter synchronization and diagnostics.

## Refresh and rendered-cell invalidation

| Method | Contract |
| --- | --- |
| `refresh(options?)` | Requests row-model/view refresh. It may be synchronous or return a Promise depending on the model. This does not mean the UI framework has completed a render. |
| `reapply()` | Reapplies current projection/view settings without replacing source data. It may be synchronous or asynchronous depending on the row model. |
| `expandAllGroups()` / `collapseAllGroups()` | Compatibility aliases for the canonical row group-expansion operations. Prefer `api.rows` for code that owns projection state. |
| `refreshCellsByRowKeys(rowKeys, columnKeys, options?)` | Queues cell invalidation for stable row IDs and column keys. It does not mutate row data or selection. |
| `refreshCellsByRanges(ranges, options?)` | Queues invalidation for row/column ranges under the refresh-range contract. Coordinate semantics are defined by `DataGridCellRefreshRange`. |
| `onCellsRefresh(listener)` | Subscribes to coalesced cell-refresh batches and returns an unsubscribe function. Call the returned function during host teardown. |

Refresh requests are adapter-facing notifications. They let custom renderers invalidate mounted cells without making the Core API depend on a framework's component tree.
