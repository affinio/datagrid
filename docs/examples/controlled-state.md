# Controlled state

Use unified `state` when the host owns saved views, URL state, or persistence. Do not mirror sort, filter, selection, and column state into unrelated application stores unless you need a separate product-level model.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"
import type { DataGridUnifiedState } from "@affino/datagrid-core"

const rows = [
  { rowId: "r-1", owner: "Maya", region: "EMEA", amount: 1200 },
  { rowId: "r-2", owner: "Liam", region: "AMER", amount: 860 },
]

const columns = [
  { key: "owner", label: "Owner" },
  { key: "region", label: "Region" },
  { key: "amount", label: "Amount", dataType: "number" },
]

const state = ref<DataGridUnifiedState<Order> | null>(null)
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    v-model:state="state"
  />
</template>
```

For storage, serialize the received snapshot and restore it only after rows and columns are available. For untrusted or older data, call the component ref's `migrateState` before `applyState`; see [Unified Grid API](../datagrid-grid-api.md) for the core state semantics.
