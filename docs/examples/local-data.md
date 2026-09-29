# Local data and formatting

Use the app layer for local rows. Keep values raw and put display concerns in `presentation`.

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  { rowId: "svc-1", service: "Billing API", owner: "Payments", revenue: 1200.5 },
  { rowId: "svc-2", service: "Edge Gateway", owner: "Platform", revenue: 860 },
]

const columns = [
  { key: "service", label: "Service", initialState: { width: 220 } },
  { key: "owner", label: "Owner", capabilities: { sortable: true, filterable: true } },
  {
    key: "revenue",
    label: "Revenue",
    dataType: "number",
    capabilities: { sortable: true, filterable: true, aggregatable: true },
    presentation: {
      align: "right",
      headerAlign: "right",
      numberFormat: {
        locale: "en-GB",
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
      },
    },
  },
]
</script>

<template>
  <DataGrid :rows="rows" :columns="columns" virtualization />
</template>
```

`numberFormat` changes the rendered text only. Sorting, editing, clipboard operations, and patches continue to use the raw numeric value.
