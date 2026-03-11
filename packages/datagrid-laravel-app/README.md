# `@affino/datagrid-laravel-app`

Application-facing Laravel facade for Affino DataGrid.

## Role

This package mirrors the `@affino/datagrid-vue` -> `@affino/datagrid-vue-app`
split for the Laravel track:

- `@affino/datagrid-laravel` stays the lower-level Laravel/Livewire adapter bridge
- `@affino/datagrid-laravel-app` is the app-facing facade for Laravel teams

Today `@affino/datagrid-laravel-app` is intentionally thin and re-exports the
current community-safe Laravel facade while freezing the package boundary for
future Laravel-specific app DX and enterprise layering.

## Install

```bash
pnpm add @affino/datagrid-laravel-app
```

## Example

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
} from "@affino/datagrid-laravel-app"
```

## Boundary

- `@affino/datagrid-laravel-app` may depend on `@affino/datagrid-laravel`
- `@affino/datagrid-laravel` must not depend on `@affino/datagrid-laravel-app`

The intent is the same as on the Vue side:

- adapter package owns low-level integration/runtime plumbing
- app package owns the user-facing install path and future opinionated UX
