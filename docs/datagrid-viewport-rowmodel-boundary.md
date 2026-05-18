# DataGrid Viewport RowModel Boundary

Updated: `2026-05-18`

## Goal

`dataGridViewportController` consumes a single `DataGridRowModel` input and no longer relies on direct server fetch calls in virtualization hot path.

## Boundary Contract

- Viewport reads rows via `rowModel.getRowCount()` + `rowModel.getRow(index)`.
- Viewport writes demand window via `rowModel.setViewportRange({ start, end })`.
- `rowModel.getRow*` returns canonical `DataGridRowNode` (stable `rowKey` + `sourceIndex`/`displayIndex` + row state flags).
- Virtualization remains data-source agnostic and operates only on prepared row arrays.
- Legacy `serverIntegration` is now a compatibility adapter that maps to `createServerBackedRowModel`.

## Grouped And Tree Rows

- Grouped and tree projections are a row-model concern. The viewport consumes the flattened projection that `DataGridRowModel` exposes after grouping, tree expansion, filtering, sorting, pagination, and pivoting.
- Expansion and collapse must update `rowModel.getRowCount()`, `rowModel.getRowsInRange(...)`, and `rowModel.getSnapshot().groupExpansion` before the viewport materializes the next window.
- The viewport must treat row-count changes as structural invalidations, not as fast-path scroll-only updates. If expansion or collapse removes rows around the active scroll position, the next visible range is clamped to the new flattened row count.
- Group rows are selectable/renderable rows in the flattened model. Descendant selection expansion is handled by selection policy; hidden collapsed children are not part of the viewport row range.
- Server/data-source backed grouped rows remain partial for enterprise use unless the datasource returns stable placeholder rows and group expansion metadata for the requested flattened range.

## Row Height Ownership

- Row-height math remains a viewport concern, but public control is exposed through Core API `view` methods.
- Consumers must use `api.view.setRowHeightMode`, `setBaseRowHeight`, and `measureRowHeight` for mode/base/measurement.
- Per-row resize/autosize uses `api.view.setRowHeightOverride(rowIndex, height | null)` and `getRowHeightOverride(rowIndex)`.
- UI/sandbox layers keep only gesture state (drag lifecycle); override storage is not duplicated outside Core.

## Determinism

- `setViewportRange` is only called when visible range actually changes.
- `ServerBackedRowModel` ignores unchanged viewport ranges, preventing duplicate warm/fetch cycles.

## Tests

- `src/viewport/__tests__/rowModelBoundary.contract.spec.ts` validates:
  - visible range sync into active model
  - parity between client and server-backed models
  - no duplicate warm-up for unchanged viewport range
  - grouped collapse clamping when rows are removed around the active viewport
  - parent-tree collapse/re-expand materialization near the active viewport
