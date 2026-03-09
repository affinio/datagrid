# @affino/datagrid-vue-app

Declarative component layer for Affino DataGrid Vue integrations.

This package is the app-facing surface.
It depends on [`@affino/datagrid-vue`](/Users/anton/Projects/affinio/datagrid/packages/datagrid-vue/README.md),
which remains the adapter/headless foundation between Vue and the DataGrid engine.

Current public export:

- `DataGrid`

The package also bootstraps its own base table-stage styles at runtime, so the
default renderer does not depend on sandbox CSS.

Example virtualization contract:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :virtualization="{
    rows: true,
    columns: true,
    rowOverscan: 8,
    columnOverscan: 2,
  }"
/>
```

Short-hand public API:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  virtualization
  pagination
  :page-size="100"
  :current-page="0"
  group-by="department"
/>
```

Advanced virtualization override:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :virtualization="{ columns: true, overscan: 8 }"
/>
```

Example declarative formulas:

```vue
<DataGrid
  :rows="rows"
  :columns="[
    { key: 'price', label: 'Price' },
    { key: 'qty', label: 'Qty' },
    { key: 'subtotal', label: 'Subtotal', formula: 'price * qty' },
    { key: 'tax', label: 'Tax', formula: 'subtotal * taxRate' },
    { key: 'total', label: 'Total', formula: 'subtotal + tax' },
  ]"
  :client-row-model-options="{ resolveRowId: row => row.id }"
  compute-mode="sync"
/>
```

Advanced override is still supported through a separate `formulas` prop when formula
definitions need to be generated outside the column list.
