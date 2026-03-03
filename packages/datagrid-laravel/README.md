# @affino/datagrid-laravel

Laravel/Livewire-oriented facade for Affino DataGrid.

Use this package as the public entrypoint in Laravel apps instead of importing
`@affino/datagrid-core` and `@affino/datagrid-orchestration` directly.

## Canonical Feature Catalog

Single source of truth for platform capabilities:

- [DataGrid Feature Catalog](https://github.com/affinio/affinio/blob/main/docs/datagrid-feature-catalog.md)

It re-exports a curated set of:

- core row/column/filter helpers
- pivot helpers (`setPivotModel`, drilldown, layout export/import, interop export)
- server/data-source row model contracts (including server-side pivot pull context)
- orchestration runtime/layout/wheel primitives

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
