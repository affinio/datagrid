# Core Row Selection: Record Selection

Status: public Core reference for framework-independent record-selection state and transitions.

This model selects records by stable row ID. It is separate from [cell and range selection](cell-range.md), which selects cells by rectangular coordinates.

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

Core provides row-ID selection transitions, projection-aware range resolution, and preview/commit/cancel session primitives. They are framework-independent: they do not read the DOM, assign ownership of a pointer gesture, or scroll the viewport.

The UI adapter translates pointer and keyboard input into intents, resolves the target row, owns the gesture lifecycle, and displays previews. It can use `@affino/datagrid-orchestration` to coordinate competing gestures. The application supplies domain policy such as `isSelectable` and acts on the committed set of IDs.

In the ready-made Vue component, row-header and checkbox behavior is configured in the app layer, not by this Core contract. See the [app-layer guide](../../../../../../docs/app-layer.md). General package boundaries are described in [DataGrid architecture](../../../../../../docs/datagrid-architecture.md#selection-ownership).
