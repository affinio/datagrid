# @affino/datagrid-laravel

Laravel/Livewire-oriented facade for Affino DataGrid.

Use this package as the public entrypoint in Laravel apps instead of importing
`@affino/datagrid-core` and `@affino/datagrid-orchestration` directly.

It re-exports a curated set of:

- core row/column/filter helpers
- orchestration runtime/layout/wheel primitives

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
