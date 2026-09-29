# Editing and fill

Mark only user-editable columns as editable. Give rows stable ids; if the field is not named `rowId`, configure `resolveRowId` through `client-row-model-options`.

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  { id: "r-1", sku: "A-100", month: 1, amount: 120 },
  { id: "r-2", sku: "A-100", month: 2, amount: 150 },
  { id: "r-3", sku: "A-100", month: 3, amount: 0 },
]

const columns = [
  { key: "sku", label: "SKU", capabilities: { editable: false } },
  { key: "month", label: "Month", capabilities: { editable: true } },
  { key: "amount", label: "Amount", capabilities: { editable: true } },
]
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    :client-row-model-options="{ resolveRowId: row => row.id }"
    fill-handle
    :history="{ controls: true }"
  />
</template>
```

Fill uses the same editability contract as direct editing. Identifier and derived columns should remain read-only. The built-in history controls can undo an edit or fill operation when history is enabled.
