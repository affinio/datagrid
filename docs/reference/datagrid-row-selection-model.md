# Core Row-Selection Model

Status: public core reference for framework-independent row-selection primitives.

These functions are exported from the root `@affino/datagrid-core` entrypoint.
They model committed selected row IDs and interaction transitions without
reading DOM state. `resolveDataGridSelectableRowRange` resolves IDs against a
host-provided logical projection, including rows outside the rendered window.
The host still owns event and gesture wiring.

## Committed selection

`DataGridRowSelectionModelSnapshot` contains a `revision` and immutable
`selectedRowIds`. Its backing set is not exposed for mutation.

```ts
import {
  addDataGridRowSelectionModelRows,
  createDataGridRowSelectionModelSnapshot,
  toggleDataGridRowSelectionModelRow,
} from "@affino/datagrid-core"

let selected = createDataGridRowSelectionModelSnapshot(["row-1"])
selected = addDataGridRowSelectionModelRows(selected, ["row-2"])
selected = toggleDataGridRowSelectionModelRow(selected, "row-1")
```

`replaceDataGridRowSelectionModel`, `addDataGridRowSelectionModelRows`,
`removeDataGridRowSelectionModelRows`, and
`toggleDataGridRowSelectionModelRow` return the original snapshot when the set
does not change. Otherwise they return a new snapshot with `revision` advanced
by one. These functions do not infer ranges from row indices.

## Selection intents

`resolveDataGridSelectableRowRange` accepts anchor and target IDs, projection
revisions, ID-to-index lookup, and an index reader. It skips group and other
synthetic nodes, excludes rows marked unselectable, and returns `incomplete`
when an unloaded segment or missing projection row prevents a complete answer.
It reports a missing anchor separately so the interaction can fall back to the
target. The target itself must be a selectable data row.

`applyDataGridRowSelectionIntent(selection, interaction, intent)` supports
replace, toggle, extend-range, and additive-range operations. Range operations
carry a `DataGridSelectableRowRangeResolution`, including its projection
revision and status. Incomplete or stale ranges and unselectable targets are
rejected without changing committed selection. Callers can also provide
`expectedSelectionRevision` to reject an interaction based on an outdated
selection snapshot.

The result reports whether the transition was accepted, the resulting
selection, and the updated anchor/extent interaction snapshot. When the
previous anchor no longer exists in the resolved projection, the operation
falls back to selecting the target row.

## Pointer selection sessions

Use `beginDataGridRowSelectionSession` to capture the base selection,
interaction anchor, and projection revision. Call
`updateDataGridRowSelectionSession` as the target changes; each preview is
computed from the captured base selection, so reversing the drag contracts the
range. `commitDataGridRowSelectionSession` applies the latest preview once.
`cancelDataGridRowSelectionSession` leaves committed selection unchanged and
restores the base interaction anchor.

Projection changes or conflicting committed selection revisions invalidate a
session. An incomplete range can be retried while the session remains active;
stale projection or a selection conflict rejects and clears it.

## Integration boundary

The Vue app connects the session controller to `api.rowSelection` and the
logical row projection. Row-header behavior stays backward-compatible by
default: it selects cell ranges. Set `rowHeader.action` to `"select-records"`
to enable record selection, or `"none"` to disable row-header selection.

```vue
<DataGrid
  :row-selection="{ enabled: true, isSelectable: row => row.rowId !== 'locked' }"
  :row-header="{ action: 'select-records' }"
/>
```

With `select-records`, a plain row-header click replaces the selection,
Ctrl/Meta-click toggles one record, Shift-click extends the anchor range, and
Ctrl/Meta+Shift adds a range. Mouse drag previews and commits one range; Escape,
pointer cancellation, projection changes, and disposal cancel it. Shift+Up/Down
extends selection while focus is on a row header. The body-cell drag owner,
editing, and touch-first scrolling remain separate. Selection is stored by row
ID, and range lookup includes logical rows outside the rendered virtual window.
When row reordering is enabled, dragging the row index remains owned by row
reordering; use click and keyboard gestures for record selection in that mode.

`rowSelection.isSelectable` filters record checkbox, bulk, range, and drag
selection, including the descendants affected by a group checkbox.
See [selection ownership](../datagrid-architecture.md#selection-ownership) for
the package boundaries.
