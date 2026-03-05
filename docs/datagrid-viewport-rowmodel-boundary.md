# DataGrid Viewport RowModel Boundary

Updated: `2026-03-05`

## Goal

`dataGridViewportController` consumes a single `DataGridRowModel` input and no longer relies on direct server fetch calls in virtualization hot path.

## Boundary Contract

- Viewport reads rows via `rowModel.getRowCount()` + `rowModel.getRow(index)`.
- Viewport writes demand window via `rowModel.setViewportRange({ start, end })`.
- `rowModel.getRow*` returns canonical `DataGridRowNode` (stable `rowKey` + `sourceIndex`/`displayIndex` + row state flags).
- Virtualization remains data-source agnostic and operates only on prepared row arrays.
- Legacy `serverIntegration` is now a compatibility adapter that maps to `createServerBackedRowModel`.

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
