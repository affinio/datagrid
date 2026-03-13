# @affino/datagrid-vue-app

![npm](https://img.shields.io/npm/v/@affino/datagrid-vue-app)
![downloads](https://img.shields.io/npm/dt/@affino/datagrid-vue-app)
![license](https://img.shields.io/npm/l/@affino/datagrid-vue-app)

Declarative Vue component layer for Affino DataGrid.

`@affino/datagrid-vue-app` is the app-facing package.
It depends on [`@affino/datagrid-vue`](/Users/anton/Projects/affinio/datagrid/packages/datagrid-vue/README.md), which remains the adapter and headless foundation between Vue and the grid engine.

Boundary doc:

- [/Users/anton/Projects/affinio/datagrid/docs/datagrid-vue-app-community-vs-enterprise.md](/Users/anton/Projects/affinio/datagrid/docs/datagrid-vue-app-community-vs-enterprise.md)

Public export:

- `DataGrid`

The package ships its own runtime table-stage styles, so the default renderer does not depend on sandbox CSS.

## Planned enterprise surface

This package stays community-first and intentionally useful on its own.

Planned additive enterprise app layer:

- `@affino/datagrid-vue-app-enterprise`

Reserved enterprise candidates:

- diagnostics / profiler / explain panels
- advanced formula runtime controls
- performance / worker app presets
- license-gated enterprise app features

## Why Affino DataGrid?

Affino DataGrid is designed for applications that need more than a simple table.

It combines:

- Virtualized rendering for large datasets
- Spreadsheet-style formulas
- Grouping, aggregation, and pivot views
- Incremental row patch updates
- Unified grid state persistence

The goal is to provide a reactive analytics grid that can power dashboards, internal tools, and data-heavy applications.
In practice, the project sits somewhere between a data grid and a reactive data processing engine with grid UI.

## Key Capabilities

- Declarative grid configuration
- Reactive data transformations
- Spreadsheet-style formulas
- Built-in analytics features
- Large dataset performance

## Install

```bash
npm install @affino/datagrid-vue-app
```

```bash
pnpm add @affino/datagrid-vue-app
```

Peer dependencies:

- `vue ^3.3.0`

## Quick Start

Minimal example with virtualization and built-in features.

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  { id: 1, owner: "Maya", region: "EMEA", amount: 1200, qty: 3 },
  { id: 2, owner: "Liam", region: "AMER", amount: 860, qty: 2 },
]

const columns = [
  { key: "owner", label: "Owner" },
  { key: "region", label: "Region" },
  {
    key: "amount",
    label: "Amount",
    dataType: "currency",
    initialState: { width: 140 },
    presentation: {
      align: "right",
      headerAlign: "right",
      numberFormat: {
        locale: "en-GB",
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    },
    capabilities: { sortable: true, filterable: true, aggregatable: true },
  },
  {
    key: "start",
    label: "Start",
    dataType: "date",
    initialState: { width: 128 },
    presentation: {
      dateTimeFormat: {
        locale: "en-GB",
        year: "numeric",
        month: "short",
        day: "2-digit",
      },
    },
  },
  {
    key: "qty",
    label: "Qty",
    dataType: "number",
    initialState: { width: 96 },
    presentation: {
      align: "right",
      headerAlign: "right",
      numberFormat: {
        locale: "en-GB",
        style: "decimal",
        maximumFractionDigits: 1,
      },
    },
    capabilities: { sortable: true, filterable: true, aggregatable: true },
  },
]
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    virtualization
  />
</template>
```

Result:

- virtualized table
- column resizing
- sorting and filtering
- keyboard navigation
- selection

`presentation.numberFormat` and `presentation.dateTimeFormat` are display-only. Editing, clipboard and patch flows continue to use the raw cell value.
The shared formatter implementation lives in `@affino/datagrid-format`, so the same column formatting rules can be reused by other adapters.

## Spreadsheet Fill Handle

`DataGrid` includes spreadsheet-style fill interactions in base table mode without any extra feature flag.

- Drag the fill handle from the active selection corner to extend the fill range.
- Double-click the fill handle to fill the selected range down to the last row in the current projection.
- After a fill is applied, a floating action chip stays inside the visible viewport so the user can reapply the last fill as `Series` or `Copy`.
- Default behavior is inferred from the source matrix: numeric sequences default to `Series`, everything else defaults to `Copy`.
- Fill writes only into editable cells. Mark read-only columns with `capabilities: { editable: false }`.

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  { id: 1, sku: "A-100", month: 1, amount: 120 },
  { id: 2, sku: "A-100", month: 2, amount: 150 },
  { id: 3, sku: "A-100", month: 3, amount: 0 },
]

const columns = [
  {
    key: "sku",
    label: "SKU",
    capabilities: { editable: false },
  },
  {
    key: "month",
    label: "Month",
    capabilities: { editable: true },
  },
  {
    key: "amount",
    label: "Amount",
    capabilities: { editable: true },
  },
]
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    :client-row-model-options="{ resolveRowId: row => row.id }"
  />
</template>
```

Recommended usage:

- Keep identifier, formula-result, and derived columns read-only.
- Use fill for base table editing flows; it is not surfaced in pivot/tree/worker stage modes.
- Prefer `@affino/datagrid-vue-app` for the built-in UX; custom renderers should use the app hooks exported from `@affino/datagrid-vue`.

## Declarative Column Menu

Enable the built-in header menu with one prop:

```vue
  <DataGrid
    :rows="rows"
    :columns="columns"
    column-menu
    column-layout
    advanced-filter
    aggregations
    row-hover
    striped-rows
  />
```

Out of the box this wires:

- sort ascending / descending / clear
- pin column submenu (`left`, `right`, `none`)
- value-set filter picker with search + apply/clear
- column order / visibility popover
- clause-based advanced filter popover
- aggregation model popover

## Features

Rendering:

- virtualized rows and columns
- pagination
- tree data
- gantt view

Data computation:

- built-in formulas
- grouping and aggregation
- pivot tables
- advanced filtering
- staged data projection pipeline

State and configuration:

- declarative columns
- unified grid state
- column state
- incremental row updates

Customization:

- theme presets
- token overrides
- plugins and services

## Gantt View

`@affino/datagrid-vue-app` includes a split table + timeline gantt mode.

The gantt renderer is intentionally not a separate task system.
It reads the same row cells already used by the grid and renders only the current visible rows.

Typical source columns:

- `task`
- `start`
- `end`
- `baselineStart`
- `baselineEnd`
- `% complete`
- `predecessors`

Predecessors can stay simple (`task-1`) or include a dependency type:

- `task-1`
- `task-1:SS`
- `task-1->FF`
- `12FS`

Minimal example:

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  {
    id: "task-1",
    task: "Plan rollout",
    start: new Date("2026-03-02T00:00:00.000Z"),
    end: new Date("2026-03-06T00:00:00.000Z"),
    progress: 35,
    baselineStart: new Date("2026-03-01T00:00:00.000Z"),
    baselineEnd: new Date("2026-03-05T00:00:00.000Z"),
    dependencies: [],
  },
  {
    id: "task-2",
    task: "Launch",
    start: new Date("2026-03-09T00:00:00.000Z"),
    end: new Date("2026-03-10T00:00:00.000Z"),
    progress: 0,
    baselineStart: new Date("2026-03-08T00:00:00.000Z"),
    baselineEnd: new Date("2026-03-09T00:00:00.000Z"),
    dependencies: ["task-1:FS"],
  },
]
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="[
      { key: 'task', label: 'Task' },
      { key: 'start', label: 'Start', dataType: 'date' },
      { key: 'end', label: 'End', dataType: 'date' },
      { key: 'baselineStart', label: 'Baseline Start', dataType: 'date' },
      { key: 'baselineEnd', label: 'Baseline End', dataType: 'date' },
      { key: 'progress', label: '% Complete', dataType: 'number' },
      { key: 'dependencies', label: 'Predecessors' },
    ]"
    view-mode="gantt"
    :gantt="{
      idKey: 'id',
      labelKey: 'task',
      startKey: 'start',
      endKey: 'end',
      baselineStartKey: 'baselineStart',
      baselineEndKey: 'baselineEnd',
      progressKey: 'progress',
      dependencyKey: 'dependencies',
      computedCriticalPath: true,
      zoomLevel: 'week',
      workingCalendar: {
        workingWeekdays: [1, 2, 3, 4, 5],
      },
    }"
  />
</template>
```

Current gantt capabilities:

- canvas timeline renderer
- dependency lines and dependency selection
- drag move / resize writing back to row cells
- baseline bars from row cells
- baseline variance markers
- dependency types (`FS`, `SS`, `FF`, `SF`)
- milestones
- progress overlay
- working calendar and holiday shading
- summary bars for visible group rows
- computed critical path highlighting

Reference:

- [/Users/anton/Projects/affinio/datagrid/docs/datagrid-gantt.md](/Users/anton/Projects/affinio/datagrid/docs/datagrid-gantt.md)

## Table Chrome Engine

The default table renderer uses [`@affino/datagrid-chrome`](/Users/anton/Projects/affinio/datagrid/packages/datagrid-chrome/src/index.ts) for shared headless table chrome geometry.

That engine derives:

- row divider positions
- column divider positions
- row background bands for striped / group / tree / pivot states
- pinned left / center / right pane line projection

It also accepts optional visible row / column range hints, so future adapters can clip chrome geometry earlier when they already know viewport index windows.

Vue still owns the browser-specific work:

- DOM measurement
- scroll wiring
- `ResizeObserver`
- canvas drawing

That split keeps the table renderer reusable across frameworks without duplicating pane math.

## Comparison

| Feature | Affino DataGrid | Simple Table | Spreadsheet |
| --- | --- | --- | --- |
| Virtualization | ✓ | ✗ | partial |
| Formulas | ✓ | ✗ | ✓ |
| Pivot | ✓ | ✗ | ✓ |
| Tree data | ✓ | ✗ | ✗ |
| Incremental updates | ✓ | ✗ | ✗ |

## Use Cases

Affino DataGrid works well for:

- analytics dashboards
- admin panels
- financial data tools
- operational back-office systems
- engineering data tools

## Public API

### Core props

- `rows`
- `columns`
- `theme`
- `column-menu`
- `column-layout`
- `advanced-filter`
- `aggregations`
- `row-hover`
- `striped-rows`
- `row-height-mode`
- `base-row-height`

### Data shaping props

- `sort-model`
- `filter-model`
- `group-by`
- `aggregation-model`
- `pivot-model`
- `computed-fields`
- embedded formulas on `columns`
- `formulas`
- `formula-functions`

### View modes

- `virtualization`
- `pagination`
- `page-size`
- `current-page`
- `render-mode`

`render-mode` exists as an advanced/internal-oriented prop.
Most consumers should use `virtualization` and `pagination`.

### State

- `column-state`
- `column-order`
- `hidden-column-keys`
- `column-widths`
- `column-pins`
- `state`
- `state-options`

### Runtime

- `row-model`
- `client-row-model-options`
- `plugins`
- `services`
- `startup-order`
- `auto-start`

## Formulas

Recommended sugar: embed formulas in `columns`.

```vue
<DataGrid
  :rows="rows"
  :columns="[
    { key: 'price', label: 'Price' },
    { key: 'qty', label: 'Qty' },
    { key: 'taxRate', label: 'Tax rate' },
    { key: 'subtotal', label: 'Subtotal', formula: 'price * qty' },
    { key: 'tax', label: 'Tax', formula: 'subtotal * taxRate' },
    { key: 'total', label: 'Total', formula: 'subtotal + tax' },
  ]"
  :client-row-model-options="{ resolveRowId: row => row.id }"
/>
```

Advanced formula registration is still supported through `formulas`:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :client-row-model-options="{ resolveRowId: row => row.id }"
  :formulas="[
    { name: 'subtotal', formula: 'price * qty' },
    { name: 'tax', formula: 'subtotal * taxRate' },
  ]"
/>
```

## Common Patterns

### Virtualization

Simple:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  virtualization
/>
```

Advanced:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :virtualization="{
    rows: true,
    columns: true,
    overscan: 8,
  }"
/>
```

Full override:

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

### Pagination

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  pagination
  :page-size="100"
  :current-page="0"
/>
```

### Grouping and aggregation

Simple `group-by` sugar:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  group-by="department"
  :aggregation-model="{
    columns: [
      { key: 'amount', op: 'sum' },
      { key: 'qty', op: 'sum' },
    ],
    basis: 'filtered',
  }"
/>
```

Object form:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :group-by="{
    fields: ['department'],
    expandedByDefault: true,
  }"
/>
```

## Pivot

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :pivot-model="{
    rows: ['department'],
    columns: ['month'],
    values: [{ field: 'amount', agg: 'sum' }],
  }"
/>
```

## Example: Analytics Dashboard

```vue
<DataGrid
  :rows="sales"
  :columns="columns"
  group-by="department"
  :aggregation-model="{
    columns: [{ key: 'amount', op: 'sum' }],
    basis: 'filtered',
  }"
  :pivot-model="{
    rows: ['department'],
    columns: ['month'],
    values: [{ field: 'amount', agg: 'sum' }],
  }"
/>
```

## Tree Data

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :client-row-model-options="{
    resolveRowId: row => row.id,
    initialTreeData: {
      mode: 'path',
      getDataPath: row => row.path,
      expandedByDefault: true,
      filterMode: 'include-descendants',
    },
  }"
/>
```

## Theme

Preset string:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  theme="sugar"
/>
```

Preset object:

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"
import { industrialNeutralTheme } from "@affino/datagrid-theme"
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    :theme="industrialNeutralTheme"
  />
</template>
```

Lightweight token override:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :theme="{
    tokens: {
      gridAccentStrong: '#b45309',
      gridHeaderCellBackgroundColor: '#f4e8d5',
      pinnedRightBackgroundColor: '#fff7e8',
    },
  }"
/>
```

Supported preset names:

- `default`
- `industrial-neutral`
- `industrialNeutral`
- `sugar`

## Unified State

The public component exposes full grid state round-tripping.

Controlled state:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :state="state"
  @update:state="state = $event"
/>
```

Imperative state helpers via `ref`:

```vue
<script setup lang="ts">
import { ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"

const gridRef = ref<InstanceType<typeof DataGrid> | null>(null)

function exportState() {
  return gridRef.value?.getState()
}

function importState(raw: unknown) {
  const migrated = gridRef.value?.migrateState(raw)
  if (migrated) {
    gridRef.value?.applyState(migrated)
  }
}
</script>
```

## Column State

Unified column-state object:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :column-state="{
    order: ['amount', 'owner', 'region'],
    visibility: {
      owner: true,
      region: false,
      amount: true,
    },
    widths: {
      owner: 240,
      region: 180,
      amount: 150,
    },
    pins: {
      owner: 'left',
      region: 'none',
      amount: 'right',
    },
  }"
/>
```

Or split control:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :column-order="columnOrder"
  :hidden-column-keys="hiddenColumnKeys"
  :column-widths="columnWidths"
  :column-pins="columnPins"
/>
```

Update events:

- `@update:column-state`
- `@update:column-order`
- `@update:hidden-column-keys`
- `@update:column-widths`
- `@update:column-pins`

## Performance

Affino DataGrid is designed for large datasets.
It is intended for datasets from hundreds to tens of thousands of rows.
Virtualization keeps DOM size effectively constant as data volume grows.

Key techniques:

- row and column virtualization
- incremental row patch updates
- staged projection pipeline
- formula dependency graph

Typical use cases:

- 10k+ row interactive tables
- analytics dashboards
- operational back-office tools

## Non-goals

Affino DataGrid is not intended to be a spreadsheet editor.
For spreadsheet-first editing scenarios, use a dedicated spreadsheet engine.

## Events

The component emits:

- `cell-change`
- `selection-change`
- `update:column-state`
- `update:column-order`
- `update:hidden-column-keys`
- `update:column-widths`
- `update:column-pins`
- `update:state`
- `ready`

## Ref API

### Runtime access

- `getApi()`
- `getRuntime()`
- `getCore()`

### Column state

- `getColumnState()`
- `getColumnSnapshot()`
- `applyColumnState(columnState)`
- `insertColumnsAt(index, columns)`
- `insertColumnBefore(columnKey, columns)`
- `insertColumnAfter(columnKey, columns)`

### Grid state

- `getState()`
- `migrateState(state, options?)`
- `applyState(state, options?)`

### Row and column insertion

- `insertRowsAt(index, rows)`
- `insertRowBefore(rowId, rows)`
- `insertRowAfter(rowId, rows)`

### Selection

- `getSelectionAggregatesLabel()`
- `getSelectionSummary()`

### Pivot

- `exportPivotLayout()`
- `exportPivotInterop()`
- `importPivotLayout(layout, options?)`

### Groups

- `expandAllGroups()`
- `collapseAllGroups()`

## Architecture

Affino DataGrid is built in layers:

`@affino/datagrid-core`  
-> grid engine, projection pipeline, formula runtime

`@affino/datagrid-vue`  
-> Vue adapter and reactive bindings

`@affino/datagrid-vue-app`  
-> declarative component and default renderer

## Custom Renderer Slot

If you need to keep the public `DataGrid` runtime but render your own shell, use the default slot.

The slot receives:

- `api`
- `core`
- `runtime`
- `grid`
- `rowModel`
- `columnModel`
- `columnSnapshot`
- `setRows`
- `syncRowsInRange`
- `virtualWindow`

Example:

```vue
<DataGrid :rows="rows" :columns="columns">
  <template #default="{ api, columnSnapshot, virtualWindow }">
    <pre>{{ columnSnapshot.visibleColumns.length }}</pre>
    <pre>{{ virtualWindow }}</pre>
    <button type="button" @click="api.rows.expandAllGroups()">Expand all</button>
  </template>
</DataGrid>
```

## Escape Hatches

Use these only if the declarative API is not sufficient.

For advanced integrations you can still pass:

- a custom `row-model`
- `client-row-model-options` for owned client row models
- `plugins`
- `services`
- `startup-order`
- `auto-start`

This keeps `@affino/datagrid-vue-app` ergonomic for the common path without blocking advanced usage.
