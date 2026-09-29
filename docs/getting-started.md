# Getting started

Status: public onboarding guide.

For a normal Vue application, install the app package:

```bash
pnpm add @affino/datagrid-vue-app
```

The package supports Vue `^3.3.0`.

## First grid

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

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
  <DataGrid :rows="rows" :columns="columns" virtualization />
</template>
```

The app layer owns the renderer, keyboard navigation, selection, column controls, and the default interaction shell. `virtualization` should normally remain enabled for product tables.

## Choosing the next layer

Use [the app layer guide](./app-layer.md) for props and user-facing features. Move to [the Vue adapter](./vue-adapter.md) when your application owns the renderer or row-model lifecycle. Use [the core guide](./core-api.md) when a framework-independent runtime or `DataGridApi` is the integration boundary.

For backend-owned data, follow the [server datasource quick start](./server-datasource/quick-start.md).
