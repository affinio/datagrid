# DataGrid Cell-level Refresh API

`@affino/datagrid-core` supports targeted cell refresh without full row replacement.

## Public API

```ts
api.view.refreshCellsByRowKeys(rowKeys, columnKeys, options?)
api.view.refreshCellsByRanges([{ rowKey, columnKeys }], options?)
```

- `rowKeys`: row ids (`string | number`).
- `columnKeys`: DataGrid column keys.
- `options.immediate`: flush synchronously instead of `requestAnimationFrame` batching.
- `options.reason`: optional label for diagnostics.

## Behavior

- Refresh invalidation is batched in `requestAnimationFrame` in core.
- Only cells intersecting current viewport + visible columns are emitted to repaint pipeline.
- No full `api.view.refresh()` or `columnModel` recalculation is triggered.
- Sort/filter/group/selection/pinned-column state remains unchanged.

## Vue adapter notes

`@affino/datagrid-vue` exposes these methods through `api` (`defineExpose` + `useAffinoDataGrid` result).

The adapter applies best-effort targeted DOM patch for visible cells and emits `affino-datagrid:cell-refresh` per refreshed cell.

## Limitations

- Automatic DOM text patch assumes plain object row access by `columnKey`.
- Complex custom cell renderers should listen to `affino-datagrid:cell-refresh` and update local view state if needed.
- Non-visible rows are intentionally skipped until they enter viewport.
