# Vue adapter: `@affino/datagrid-vue`

Status: public integration guide.

Use this layer when the application needs Vue runtime ownership without rebuilding the framework-independent core. It is a complete adapter surface for custom renderers, datasource-backed models, selectors, overlays, and runtime integration.

For ordinary application grids, use `@affino/datagrid-vue-app` instead.

## Entrypoints

| Import | Use |
| --- | --- |
| `@affino/datagrid-vue` | Main adapter surface and row-model factories. |
| `@affino/datagrid-vue/stable` | Explicit stable adapter entrypoint. |
| `@affino/datagrid-vue/advanced/*` | Custom renderer and interaction plumbing. |
| `@affino/datagrid-vue/worker` | Worker-owned runtime integration. |

Do not deep-import package implementation files. Advanced APIs are intended for integrations that own the corresponding DOM or interaction behavior.

## Row-model ownership

Choose one owner for the row model and keep it alive for the lifetime of the grid. For a server datasource:

```ts
import { onBeforeUnmount } from "vue"
import { createDataSourceBackedRowModel } from "@affino/datagrid-vue"
import { createAffinoDatasource } from "@affino/datagrid-server-adapters"

const datasource = createAffinoDatasource({
  baseUrl: "http://localhost:8000",
  tableId: "orders",
})

const rowModel = createDataSourceBackedRowModel({
  dataSource: datasource,
  initialTotal: 0,
})

onBeforeUnmount(() => rowModel.dispose())
```

Pass the model to `DataGrid` or bind it to a custom renderer. Filtering and sorting should update the model; do not replace the model for every query.

## Stable adapter responsibilities

The adapter owns Vue lifecycle, refs, DOM integration, overlay transforms, selectors, and event bridging. The core owns deterministic row/model state and does not know about Vue components or DOM nodes. Keep those responsibilities separate when building a custom renderer.

Useful stable surfaces include `useDataGridRuntime`, settings adapters, accessibility mapping, overlay transforms, context-menu integration, and the `DATA_GRID_SELECTORS` contract. Use the [core API guide](./core-api.md) for model semantics and the [advanced entrypoint reference](./reference/datagrid-vue-advanced-entrypoint.md) for low-level APIs.

## When to use advanced APIs

Use an advanced entrypoint only when your host owns a specific concern: viewport geometry, pointer routing, selection gestures, editing, clipboard, filtering, or history. One interaction should have one owner. If the app component already owns the interaction, do not attach a second router to the same gesture.
