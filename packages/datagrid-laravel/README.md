# @affino/datagrid-laravel

Laravel/Livewire-oriented facade for Affino DataGrid.

Use `@affino/datagrid-laravel` as the Laravel/Livewire integration facade.
It provides the supported Laravel-facing runtime, row-model, pivot, and
orchestration exports without requiring consumers to import implementation
packages directly.

The facade exposes the framework-independent state restore contract:
`api.state.validate()` returns preflight issues and applicable sections, while
`api.state.set()` returns applied/skipped sections. Restore failures throw
`DataGridStateRestoreError` with the failed section and rollback status. Use
`api.view.setRowHeightOverrideById()` for application-owned row heights that
should follow a record through projection changes; index overrides are for
virtualizer measurements.

## Canonical Feature Catalog

Single source of truth for platform capabilities:

- [DataGrid Feature Catalog](https://github.com/affinio/datagrid/blob/main/docs/datagrid-feature-catalog.md)

## Formula engine boundary

If a Laravel integration needs direct formula-engine APIs, use:

- [@affino/datagrid-formula-engine](https://github.com/affinio/datagrid/tree/main/packages/datagrid-formula-engine#readme)

Keep Laravel grid/runtime integration through `@affino/datagrid-laravel`.

## Pivot boundary

If a Laravel integration needs direct pivot contracts or layout snapshot types, use:

- [@affino/datagrid-pivot](https://github.com/affinio/datagrid/tree/main/packages/datagrid-pivot#readme)

Keep Laravel grid/runtime integration through `@affino/datagrid-laravel`.

It re-exports a curated set of:

- core row/column/filter helpers
- pivot helpers (`setPivotModel`, drilldown, layout export/import, interop export)
- server/data-source row model contracts (including server-side pivot pull context)
- orchestration runtime/layout/wheel primitives

The `DataGridApi` type includes the Core `read.captureView()` contract. Laravel or
Livewire adapters that receive a grid API can use it to take one synchronous
read of the current projection, columns, computed-field metadata, and selection.
Check `rows.value.coverage` before treating a server-backed projection as
complete. This package exposes the API types and failure error types; API
construction remains the responsibility of the adapter that owns the grid.
The framework-independent `api.cells.resolveValue({ rowId, columnKey, purpose })`
contract also separates source, accessor/computed, and display-formatted values.
Use `source` for raw field reads, `computed` for column accessor/value-getter
semantics, and `display` only for presentation; an accessor does not imply a
write mapping. Laravel adapters that own a grid API should use its returned
`writeTarget` hint before building an edit patch.

## Runtime mode decision (Main thread vs Worker vs Server-side)

| Scenario | Recommended mode | Why |
| --- | --- | --- |
| Up to ~10k rows, simple interaction profile | `main-thread` | Minimal complexity, predictable baseline |
| 20k+ rows with frequent patch/edit/sort/group pressure | `worker-owned` | Better UI responsiveness under synchronous interaction load |
| Large remote datasets, backend-owned query/pivot/aggregation | `server-side row model` | Keeps heavy data shaping in backend and reduces client pressure |

Practical default:

- Start with `main-thread` for small grids.
- Move to `worker-owned` when UI thread starts stalling under interaction pressure.
- Move to `server-side` when backend can own query + projection lifecycle.

## Feature overview

- Sorting, filtering, grouping, pagination, viewport control.
- Pivot model with generated columns, subtotals/grand totals, layout export/import, drilldown.
- Range selection, clipboard, fill, move and keyboard orchestration.
- Patch/edit lifecycle with freeze/reapply control semantics.
- Worker-owned row model support for off-main-thread compute.
- Data-source/server row model contracts for backend-driven data flows.

## Performance snapshot (user-facing)

Representative trend from pressure benchmarks:

- `20k` rows: worker path about `~5.4x` faster end-to-end than main-thread.
- `100k` rows: worker path about `~1.6x` faster.
- `200k` rows (heavier patch size): worker path about `~1.34x` faster.

Use this as a routing heuristic, then confirm with your own dataset/profile.

## Install

```bash
pnpm add @affino/datagrid-laravel
```

`@affino/datagrid-core` and `@affino/datagrid-orchestration` are pulled as internal dependencies.

## Example (Laravel demo-style JS integration)

```ts
import {
  evaluateDataGridAdvancedFilterExpression,
  createDataGridRuntime,
  buildDataGridColumnLayers,
  resolveDataGridLayerTrackTemplate,
  useDataGridColumnLayoutOrchestration,
  useDataGridManagedWheelScroll,
  resolveDataGridHeaderLayerViewportGeometry,
  resolveDataGridHeaderScrollSyncLeft,
} from "@affino/datagrid-laravel"
```
