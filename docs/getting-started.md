# Getting started

Status: public onboarding guide.

For a normal Vue application, install the unified Vue package:

```bash
pnpm add @affino/datagrid-vue
```

The package supports Vue `^3.3.0`.

## First grid

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue"

type Order = {
  id: string
  customer: string
  status: "open" | "paid" | "cancelled"
  total: number
}

const rows: Order[] = [
  { id: "o-1", customer: "Acme", status: "paid", total: 1200 },
  { id: "o-2", customer: "Globex", status: "open", total: 860 },
]

const columns = [
  { key: "customer", label: "Customer", initialState: { width: 180 } },
  { key: "status", label: "Status", capabilities: { sortable: true, filterable: true } },
  {
    key: "total",
    label: "Total",
    dataType: "number",
    capabilities: { sortable: true, filterable: true, aggregatable: true },
    presentation: { align: "right", headerAlign: "right" },
  },
]
</script>

<template>
  <DataGrid :rows="rows" :columns="columns" virtualization layout-mode="auto-height" />
</template>
```

The app layer owns the renderer, keyboard navigation, selection, column controls, and the default interaction shell. `virtualization` should normally remain enabled for product tables. This small example uses `auto-height` so it fits a normal document flow; use `fill` when the application gives the grid a bounded area.

## Filling an application panel

`fill` makes the grid occupy the height its host gives it. The host must have a
height from its own parent or layout; the grid cannot infer the space left by
page headers outside its host. For a full-height panel with a page header:

```vue
<div class="orders-page">
  <header>Orders</header>
  <main class="orders-page__grid">
    <DataGrid :rows="rows" :columns="columns" virtualization />
  </main>
</div>
```

```css
.orders-page {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}
.orders-page__grid {
  min-width: 0;
  min-height: 0;
}
```

For a fixed-height report area, the host can be a simple block:

```vue
<div style="height: 32rem">
  <DataGrid :rows="rows" :columns="columns" virtualization />
</div>
```

The same bounded-host rule applies. For ordinary document flow, use
`layout-mode="auto-height"`; `min-rows` and `max-rows` control the
body row area, and the body scrolls after `max-rows`. `row-height-mode="auto"`
controls individual row sizing and is independent from component layout mode.

## Choosing the next layer

Use [the app layer guide](./app-layer.md) for props and user-facing features. Move to [the Vue adapter](./vue-adapter.md) when your application owns the renderer or row-model lifecycle. Use [the core guide](./core-api.md) when a framework-independent runtime or `DataGridApi` is the integration boundary.

For backend-owned data, follow the [server datasource quick start](./server-datasource/quick-start.md).
