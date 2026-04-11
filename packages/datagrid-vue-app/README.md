# @affino/datagrid-vue-app

![npm](https://img.shields.io/npm/v/@affino/datagrid-vue-app)
![downloads](https://img.shields.io/npm/dt/@affino/datagrid-vue-app)
![license](https://img.shields.io/npm/l/@affino/datagrid-vue-app)

Declarative Vue component layer for Affino DataGrid.

`@affino/datagrid-vue-app` is the app-facing package.
It depends on [`@affino/datagrid-vue`](https://github.com/affinio/affinio/tree/main/packages/datagrid-vue#readme), which remains the adapter and headless foundation between Vue and the grid engine.

Boundary doc:

- [datagrid-vue-app-community-vs-enterprise.md](https://github.com/affinio/affinio/blob/main/docs/datagrid-vue-app-community-vs-enterprise.md)

Public export:

- `DataGrid`
- `DataGridModuleHost`

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
- Package-level height integration via `layoutMode`
- Custom Vue cell content via per-column `cellRenderer`

## Install

```bash
npm install @affino/datagrid-vue-app
```

```bash
pnpm add @affino/datagrid-vue-app
```

Peer dependencies:

- `vue ^3.3.0`

## Optional Entrypoints

The root package entry is intentionally kept as the base table app surface.

Use subpath imports when you want optional feature modules explicitly:

- `@affino/datagrid-vue-app/gantt`
- `@affino/datagrid-vue-app/advanced-filter`
- `@affino/datagrid-vue-app/find-replace`
- `@affino/datagrid-vue-app/aggregations`

Practical implications:

- ordinary `DataGrid` table usage no longer needs to pull `@affino/datagrid-gantt` through the root runtime graph
- gantt stage code is loaded lazily only when the gantt view is rendered
- advanced filter, find / replace, and aggregations remain available as optional package entrypoints instead of mandatory consumer-side chunking requirements

Consumer-side chunk tuning can still help, but it is now an optimization rather than a workaround for the package boundary.

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

## Layout Modes

`DataGrid` exposes a package-level height contract so pages do not need to wrap the grid in ad-hoc `height: 100%` containers.

- `fill`: app-shell behavior; the grid fills the available container height
- `auto-height`: the grid computes its own table height from header and rows
- `minRows`: optional lower bound for `auto-height`
- `maxRows`: optional upper bound for `auto-height`; scrolling stays inside the body after this clamp

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  layout-mode="auto-height"
  :min-rows="6"
  :max-rows="14"
/>
```

Normalization rules:

- row limits are only applied in `auto-height`
- `fill` always ignores `minRows` and `maxRows`
- `0`, negative, `NaN`, and non-finite row limits are treated as unset
- if both limits are present and `maxRows < minRows`, `maxRows` is clamped up to `minRows`
- prefer `fill` for full-screen shells such as split gantt layouts and `auto-height` for embedded cards, stacked dashboard sections, and form flows

## Chrome Layout

`DataGrid` now exposes package-level chrome controls so apps do not need CSS overrides just to remove the default toolbar-to-stage gap or collapse spreadsheet shells into a single surface.

- `chrome.toolbarPlacement`: `"stacked"`, `"integrated"`, or `"hidden"`
- `chrome.density`: `"comfortable"` or `"compact"`
- `chrome.toolbarGap`: controls `--datagrid-app-layout-gap`
- `chrome.workspaceGap`: controls `--datagrid-app-workspace-gap`

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :chrome="{
    toolbarPlacement: 'integrated',
    density: 'compact',
    toolbarGap: 0,
    workspaceGap: 8,
  }"
  :history="{ controls: true }"
/>
```

Notes:

- `stacked` keeps the previous app-shell structure and remains the default
- `integrated` renders the toolbar inside the same surface as the table with a divider instead of a vertical gap
- `hidden` disables the internal toolbar renderer so the host can place modules in its own header
- gantt currently falls back to `stacked` when `integrated` is requested

When you hide the internal toolbar, the component emits the resolved built-in plus custom toolbar modules through `@toolbar-modules-change`, and the package exports `DataGridModuleHost` so the host can render the exact same modules externally.

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  DataGrid,
  DataGridModuleHost,
  type DataGridAppToolbarModule,
} from "@affino/datagrid-vue-app"

const toolbarModules = ref<readonly DataGridAppToolbarModule[]>([])
</script>

<template>
  <header class="sheet-header">
    <DataGridModuleHost :modules="toolbarModules" />
  </header>

  <DataGrid
    :rows="rows"
    :columns="columns"
    :history="{ controls: true }"
    :chrome="{ toolbarPlacement: 'hidden' }"
    @toolbar-modules-change="toolbarModules = $event"
  />
</template>
```

## Placeholder Rows

`DataGrid` can render an Excel-like visual tail without forcing your app to persist empty records up front.

- `rows` stay materialized only: real rows still drive save/export/formulas/filtering/sorting/history snapshots.
- `placeholderRows.count` adds a visual empty tail after the last real row.
- `placeholderRows.createRowAt(...)` materializes a real row only when the user performs a write action.
- the current package-level policy is `fixed-tail`
- built-in materialization triggers are `edit`, `paste`, and checkbox/toggle writes
- before materialization, placeholder rows do not increase `api.rows.getCount()`
- row-index `copy`, `cut`, and `delete selected` actions continue to operate on the real materialized rows from a full-row selection, even when that selection extends into the placeholder tail
- authored `cellRenderer` and `groupCellRenderer` contexts expose `surface.kind` so custom rendering can distinguish real rows from placeholder visual rows
- the Vue sandbox base-table card includes a live `Placeholder tail` toggle so you can verify visual tail rendering and first-write materialization end to end

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  { rowId: "r1", owner: "NOC", amount: 10 },
]

const columns = [
  { key: "owner", label: "Owner", capabilities: { editable: true } },
  { key: "amount", label: "Amount", capabilities: { editable: true } },
]

let nextRowId = 2
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    :placeholder-rows="{
      count: 8,
      createRowAt: ({ visualRowIndex, reason }) => ({
        rowId: `new-${nextRowId++}`,
        owner: reason === 'paste' ? `Imported ${visualRowIndex + 1}` : '',
        amount: 0,
      }),
    }"
  />
</template>
```

Current semantics:

- editing the first placeholder row materializes exactly that row
- editing a deeper placeholder row materializes rows up to that visual index so coordinates stay stable
- when built-in `history` is enabled, undo restores a just-materialized placeholder row back to visual-tail state

## Spreadsheet Fill Handle

`DataGrid` keeps spreadsheet-style fill interactions off by default.
Enable them declaratively with `fill-handle` when the host flow actually wants spreadsheet editing affordances.

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
    fill-handle
  />
</template>
```

Recommended usage:

- Keep identifier, formula-result, and derived columns read-only.
- Use fill for base table editing flows; it is not surfaced in pivot/tree/worker stage modes.
- Prefer `@affino/datagrid-vue-app` for the built-in UX; custom renderers should use the app hooks exported from `@affino/datagrid-vue`.

## Range Move

Selection drag-move is also off by default in `DataGrid`.
Enable it with `range-move` when you want spreadsheet-style move semantics for an existing selection.

- drag starts from inside the current selection
- the grid shows a move preview before commit
- dropping writes the moved cell payload back through the normal grid mutation path

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :client-row-model-options="{ resolveRowId: row => row.id }"
  fill-handle
  range-move
/>
```

Recommended usage:

- leave both props off for form-like tables where accidental spreadsheet gestures are a UX risk
- enable them together for spreadsheet-heavy editing surfaces
- keep them off for read-only, reporting, and embedded summary tables unless the interaction model is explicitly spreadsheet-like

## Custom Toolbar Modules

`DataGrid` exposes a public `toolbar-modules` prop for additive toolbar actions.
Use it when you want to keep the built-in app renderer and append custom buttons, popovers, or small workflow panels to the same toolbar row.

- built-in modules such as column layout, advanced filter, and aggregations still render first
- custom modules are appended after the built-in modules in declaration order
- each module provides a stable `key`, a Vue `component`, and optional props passed into that component

Type shape:

```ts
interface DataGridAppToolbarModule {
  key: string
  component: Component
  props?: Record<string, unknown>
}
```

Practical guidance:

- use a stable `key` per module instance
- keep the rendered trigger on the shared toolbar button class when you want built-in styling: `datagrid-app-toolbar__button`
- add your own `data-datagrid-toolbar-action` when you want deterministic selectors for tests or analytics

```vue
<script setup lang="ts">
import { DataGrid, type DataGridAppToolbarModule } from "@affino/datagrid-vue-app"
import { defineComponent, h } from "vue"

const ExportButton = defineComponent({
  name: "ExportButton",
  props: {
    label: {
      type: String,
      required: true,
    },
    onTrigger: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    return () => h("button", {
      type: "button",
      class: "datagrid-app-toolbar__button",
      onClick: () => props.onTrigger(),
    }, props.label)
  },
})

const toolbarModules: readonly DataGridAppToolbarModule[] = [
  {
    key: "export",
    component: ExportButton,
    props: {
      label: "Export",
      onTrigger: () => {
        console.log("export current view")
      },
    },
  },
]
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    :toolbar-modules="toolbarModules"
    column-layout
    advanced-filter
  />
</template>
```

Prefer `toolbar-modules` over replacing the whole default slot when the only goal is to extend the built-in toolbar.
Use the default slot only when you need to take over the entire runtime renderer contract.

## Declarative History

Enable built-in undo/redo with one prop:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  history
/>
```

The object form lets you control the source, depth, shortcuts, and built-in controls:

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  DataGrid,
  type DataGridHistoryProp,
  type DataGridTableStageHistoryAdapter,
} from "@affino/datagrid-vue-app"

const historyAdapter: DataGridTableStageHistoryAdapter = {
  captureSnapshot: () => null,
  recordIntentTransaction: () => undefined,
  canUndo: () => true,
  canRedo: () => false,
  runHistoryAction: async direction => direction === "undo" ? "intent-1" : null,
}

const history: DataGridHistoryProp = {
  depth: 80,
  shortcuts: "window",
  controls: "toolbar",
  adapter: historyAdapter,
}

const gridRef = ref<{
  getHistory?: () => {
    runHistoryAction?: (direction: "undo" | "redo") => Promise<string | null>
  }
} | null>(null)

async function undoFromExternalButton() {
  await gridRef.value?.getHistory()?.runHistoryAction("undo")
}
</script>

<template>
  <button type="button" @click="undoFromExternalButton">
    Undo from external UI
  </button>

  <DataGrid
    ref="gridRef"
    :rows="rows"
    :columns="columns"
    :history="history"
  />
</template>
```

Supported history options:

- `enabled`: explicit on/off switch when the object form is used
- `depth`: max undo depth for recorded transactions/intents
- `shortcuts`: `false`, `"grid"`, or `"window"`
- `controls`: `false`, `"toolbar"`, or `"external-only"`
- `adapter`: provide an external history source instead of the built-in app intent history

Notes:

- `depth` limits undoable transactions/intents, not raw per-cell keystrokes.
- When `adapter` is omitted, the app facade falls back to its built-in intent history.
- The component ref always exposes a stable history controller through `history` and `getHistory()`.

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

`column-menu` also accepts a declarative object when you want to control the
built-in sections instead of replacing the menu renderer.

```vue
<script setup lang="ts">
import { DataGrid, type DataGridColumnMenuProp } from "@affino/datagrid-vue-app"

const columnMenu: DataGridColumnMenuProp = {
  trigger: "button+contextmenu",
  items: ["sort", "group", "pin", "filter"],
  disabled: ["pin"],
  disabledReasons: {
    pin: "Pinning is locked for this saved view",
  },
  labels: {
    group: "Toggle grouping",
    filter: "Quick filters",
  },
  actions: {
    sortAsc: { label: "Ascending order" },
    clearSort: { hidden: true },
    pinMenu: { disabled: true, disabledReason: "Pinning is managed globally" },
  },
  customItems: [
    {
      key: "insert-left",
      label: "Insert column left",
      placement: "after:group",
      onSelect: ({ columnKey }) => {
        console.log("Insert before", columnKey)
      },
    },
    {
      key: "organize",
      kind: "submenu",
      label: "Organize",
      placement: "end",
      items: [
        {
          key: "duplicate",
          label: "Duplicate column",
          onSelect: ({ columnKey }) => {
            console.log("Duplicate", columnKey)
          },
        },
        {
          key: "advanced",
          kind: "submenu",
          label: "Advanced",
          items: [
            {
              key: "freeze-snapshot",
              label: "Freeze current layout",
              onSelect: ({ columnKey, closeMenu }) => {
                console.log("Freeze", columnKey)
                closeMenu()
              },
            },
          ],
        },
      ],
    },
  ],
  columns: {
    amount: {
      hide: ["group"],
      labels: {
        pin: "Freeze amount",
      },
      actions: {
        pinLeft: { label: "Freeze left" },
      },
    },
    owner: {
      customItems: [
        {
          key: "rename",
          label: "Rename column",
          placement: "end",
          onSelect: ({ columnKey, closeMenu }) => {
            console.log("Rename", columnKey)
            closeMenu()
          },
        },
      ],
    },
    start: {
      disabled: ["filter"],
      disabledReasons: {
        filter: "Filtering is disabled for schedule columns",
      },
    },
  },
}
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    :column-menu="columnMenu"
  />
</template>
```

Supported app-level menu controls:

- `trigger`: `button`, `contextmenu`, or `button+contextmenu` (default)
- `items`: choose and order built-in sections (`sort`, `group`, `pin`, `filter`)
- `disabled`: force specific built-in sections into a disabled state
- `disabledReasons`: attach explanatory text to disabled built-in sections
- `labels`: override built-in section labels
- `actions`: override built-in action `label`, `hidden`, `disabled`, and `disabledReason` state
- `customItems`: add custom menu entries around the built-in sections
- `columns[columnKey]`: per-column `items`, `hide`, `disabled`, `disabledReasons`, `labels`, `actions`, and `customItems`

Custom menu items support:

- `key`: stable item id
- `kind`: `item` (default) or `submenu`
- `label`: rendered menu text
- `placement`: `start`, `end`, `before:sort`, `after:sort`, `before:group`, `after:group`, `before:pin`, `after:pin`, `before:filter`, `after:filter`
- `hidden`, `disabled`, `disabledReason`
- `onSelect(context)`: callback with `{ columnKey, columnLabel, closeMenu }` for leaf items
- `items`: nested submenu entries when `kind: "submenu"`

Grouping triggered from the built-in column menu updates the public controlled
surface through `@update:groupBy` / `v-model:groupBy`.

Out of the box this wires:

- sort ascending / descending / clear
- group / ungroup for groupable columns
- pin column submenu (`left`, `right`, `none`)
- value-set filter picker with search + apply/clear
- column order / visibility popover

Supported action keys for `actions` are:

- `sortAsc`, `sortDesc`, `clearSort`
- `toggleGroup`
- `pinMenu`, `pinLeft`, `pinRight`, `unpin`
- `clearFilter`, `addCurrentSelectionToFilter`, `selectAllValues`, `clearAllValues`, `applyFilter`, `cancelFilter`

Disabled sections and actions can expose a reason string so users see why a menu affordance is unavailable.
- `trigger: "button"` disables the standard header `contextmenu` open path while keeping the menu button.
- `trigger: "contextmenu"` keeps right-click open on the header cell and hides the button.
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

- [datagrid-gantt.md](https://github.com/affinio/affinio/blob/main/docs/datagrid-gantt.md)

## Table Chrome Engine

The default table renderer uses [`@affino/datagrid-chrome`](https://github.com/affinio/affinio/tree/main/packages/datagrid-chrome#readme) for shared headless table chrome geometry.

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
- `layout-mode`
- `min-rows`
- `max-rows`
- `fill-handle`
- `range-move`
- `column-menu`
- `column-layout`
- `advanced-filter`
- `aggregations`
- `row-hover`
- `striped-rows`
- `grid-lines`
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

### Grid lines

`DataGrid` uses full spreadsheet-style grid lines by default.

Preset form:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  grid-lines="rows"
/>
```

Supported presets:

- `all`
- `rows`
- `columns`
- `none`

Object form:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :grid-lines="{
    body: 'rows',
    header: 'columns',
    pinnedSeparators: true,
  }"
/>
```

`body` controls body row and column dividers, `header` controls header vertical dividers, and `pinnedSeparators` controls the stronger seam between left / center / right panes.

In this monorepo, `/vue/shell/base-grid` exposes the same options as live checkboxes so you can compare the visual modes before wiring them into a product surface.

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

## Custom Cell Renderers

Columns can provide a `cellRenderer` callback that returns Vue content for the display layer.
If a custom cell also needs keyboard-accessible interaction without breaking the grid-owned focus model, declare `cellInteraction` on the column and use `context.interactive` inside the renderer.
For grouped rows, prefer `groupCellRenderer` so you receive structured group metadata instead of reverse-engineering the formatted disclosure label.

```vue
<script setup lang="ts">
import { h } from "vue"
import { DataGrid, type DataGridAppColumnInput } from "@affino/datagrid-vue-app"

interface Row {
  id: string
  employee: string
  status: string
  approval: string
  approved: boolean
}

const rows: Row[] = [
  { id: "w1", employee: "Maya Patel", status: "Submitted", approval: "Waiting", approved: false },
  { id: "w2", employee: "Liam Chen", status: "Approved", approval: "Approved", approved: true },
]

const columns: DataGridAppColumnInput<Row>[] = [
  { key: "employee", label: "Employee" },
  {
    key: "status",
    label: "Status",
    cellInteraction: {
      click: true,
      keyboard: ["enter", "space"],
      role: "button",
      label: ({ row }) => row?.approved ? "Reopen approval" : "Approve row",
      pressed: ({ row }) => row?.approved === true,
      onInvoke: ({ rowId, row }) => {
        console.log("toggle approval", rowId, row?.status)
      },
    },
    cellRenderer: ({ displayValue, row }) => h("span", {
      class: [
        "status-pill",
        row?.status === "Approved" ? "status-pill--success" : "status-pill--info",
      ],
    }, displayValue),
  },
  {
    key: "approval",
    label: "Approval",
    cellRenderer: ({ displayValue, interactive }) => h("button", {
      type: "button",
      class: "approval-action",
      disabled: interactive?.enabled === false,
      "aria-pressed": interactive?.ariaPressed,
      onClick: event => {
        event.stopPropagation()
        interactive?.activate("click")
      },
    }, displayValue),
  },
]
</script>

<template>
  <DataGrid :rows="rows" :columns="columns" />
</template>
```

`cellRenderer` receives a context with:

- `row`: current authored row object when available
- `rowNode`: runtime row node
- `rowOffset`: visible row offset inside the current viewport lane
- `column` and `columnIndex`
- `value`: raw string value used by the stage
- `displayValue`: formatted display string after presentation rules
- `interactive`: resolved cell interaction contract when the column declares `cellInteraction`; otherwise `null`

`groupCellRenderer` receives the same display fields for group rows plus `group`, which includes:

- `key`, `field`, `value`
- `childrenCount`
- `isLabelColumn`
- `renderMeta` with normalized `level`, `isExpanded`, and `hasChildren`
- `toggle()` to expand or collapse the current group row

When you author `groupCellRenderer`, treat `group.toggle()` as the canonical expand/collapse trigger.
The stage keeps the rest of the group cell surface available for grid selection and navigation, so expansion should live behind an explicit trigger button or disclosure control inside the renderer rather than on the entire cell wrapper.

```ts
{
  key: "name",
  label: "Name",
  groupCellRenderer: ({ displayValue, group }) => h("div", { class: "group-cell" }, [
    h("button", {
      type: "button",
      class: "group-cell__trigger",
      "aria-label": group.renderMeta.isExpanded ? "Collapse group" : "Expand group",
      onClick: event => {
        event.stopPropagation()
        group.toggle()
      },
    }, group.renderMeta.isExpanded ? "▾" : "▸"),
    h("span", { class: "group-cell__label" }, displayValue),
    h("span", { class: "group-cell__count" }, String(group.childrenCount)),
  ]),
}
```

`interactive` exposes:

- `enabled`: `false` only when the interaction is currently disabled
- `click`: whether click invocation is enabled for the cell wrapper
- `keyboard`: enabled keyboard triggers (`enter`, `space`)
- `role`, `ariaLabel`, `ariaPressed`, `ariaChecked`, `ariaDisabled`
- `activate(trigger?)`: invoke the same column-level interaction path used by grid keyboard and wrapper click handling

Guidelines:

- keep interaction intent on the column via `cellInteraction`; use `interactive.activate(...)` from the renderer instead of ad-hoc row-local handlers
- keep group expand/collapse behind an explicit trigger inside `groupCellRenderer`; do not rely on the whole group cell acting as the disclosure target
- the grid shell still owns focus, selection, fill, clipboard, menus, and editing; `cellInteraction` only adds semantic invoke behavior inside that model
- prefer pure render output from row data over local mutable renderer state
- keep identifiers, derived values, and formula-result columns read-only where appropriate
- if a renderer caches local UI state, listen for targeted app-layer cell refresh and re-sync on refresh

### System checkbox interactions

The built-in row-selection checkbox column uses the same `cellInteraction` contract internally.
That means row checkboxes and the header select-all control now follow the same semantic path as authored interactive cells: click and keyboard invoke flow through one runtime contract, while the stage exposes the matching checkbox ARIA state.

Practical implications:

- `row-selection` is the reference example of a package-owned `cellInteraction` column
- row checkboxes expose checkbox semantics without introducing nested focus targets inside the grid cell
- the header checkbox stays aligned with the current visible body rows, including filtered slices
- custom boolean/action columns should prefer this pattern instead of bespoke click handlers attached inside renderers

For a live example, open the sandbox route `/vue/row-selection-grid` and switch between the visible row filters before using the header checkbox.

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

When `state` is the only controlled input, the built-in app toolbar and filter affordances derive their effective sort, filter, grouping, and pivot state from that unified snapshot. You do not need to mirror the same payload back into separate `sort-model`, `filter-model`, `group-by`, or `pivot-model` props just to keep the default renderer synchronized.

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

`applyState()` and `applySavedView()` also queue the restore until the runtime and declared columns are ready. Host pages can restore presets before async column definitions finish loading instead of maintaining a separate pending-saved-view scheduler.

Saved views sanitize transient transaction history before serialization and restore. The persisted envelope keeps layout, filters, grouping, pivoting, row selection, and `viewMode`, but drops undo/redo history.

### Controlled Row Selection

`rowSelection` still enables the built-in checkbox column and header select-all control. When a page wants to own the selected-row snapshot directly, use `rowSelectionState` with `update:rowSelectionState`.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"

const rowSelectionState = ref({
  focusedRow: null,
  selectedRows: ["r2"],
})
</script>

<template>
  <DataGrid
    :rows="rows"
    :columns="columns"
    row-selection
    :row-selection-state="rowSelectionState"
    @update:row-selection-state="rowSelectionState = $event"
  />
</template>
```

The legacy `row-select` event still exists, but `rowSelectionState` is the stable controlled API when the page wants to bind selected row ids without diffing unified-state updates.

function exportSavedView() {
  return gridRef.value?.getSavedView()
}

function importSavedView(raw: unknown) {
  const migrated = gridRef.value?.migrateSavedView(raw)
  if (migrated) {
    gridRef.value?.applySavedView(migrated)
  }
}

function persistSavedView() {
  const savedView = gridRef.value?.getSavedView()
  if (!savedView) {
    return
  }
  localStorage.setItem("demo-saved-view", JSON.stringify(savedView))
}
</script>
```

## Column State

Column definitions can also declare `flex` when a center-pane column should absorb the remaining viewport width.
The column keeps its base width from `initialState.width`, controlled `column-widths`, or the default width, and `flex` adds a proportional share of any free space on top.

```vue
<script setup lang="ts">
const columns = [
  {
    key: 'project',
    label: 'Project',
    flex: 1,
    minWidth: 240,
    initialState: { width: 240 },
  },
  {
    key: 'mon',
    label: 'Mon',
    initialState: { width: 104 },
  },
  {
    key: 'total',
    label: 'Total',
    initialState: { width: 128, pin: 'right' },
  },
]
</script>
```

Notes:

- `flex` is declared on the column definition, not in unified column state.
- Multiple flex columns share leftover available stage width by their flex weight.
- If there is no free space, the column falls back to its base width.
- Pinned and unpinned columns participate in the same effective width calculation.

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
- `row-selection-change`
- `row-select` (legacy alias; prefer `row-selection-change` for typed row-selection snapshots)
- `update:column-state`
- `update:column-order`
- `update:hidden-column-keys`
- `update:column-widths`
- `update:column-pins`
- `update:state`
- `ready`

## Advanced Filter UX

- When at least one filter is active, the `Advanced filter` toolbar button shows an active filter icon and active button styling.
- Removing the only advanced-filter clause does not lock the UI; the builder keeps one empty clause row so the user can clear and rebuild the expression in place.

## Built-in Overlay Panels

- The built-in `Column layout`, `Advanced filter`, and `Find / replace` toolbar panels render through the shared Affino overlay host rather than inline in the grid tree.
- These built-in panels are draggable by their header title area and reopen at the last detached position for the current grid instance during the active page session.

## Column Reorder

Column drag-and-drop is declarative and opt-in.

- `columnReorder: true` enables drag reorder from header cells
- `columnReorder: false` keeps header cells non-draggable
- the feature currently reorders only regular visible data columns inside the same pin lane
- row-selection headers and pivot header layouts do not participate in header drag reorder

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :column-reorder="true"
/>
```

If you only want manual order changes inside the built-in `Columns` panel, leave `columnReorder` unset and keep using `columnLayout`.

## Row Reorder

Row drag-and-drop is declarative and opt-in.

- `rowReorder: true` enables drag reorder from the row index column
- `rowReorder: false` keeps the row index non-draggable
- the feature only applies when the grid is using a mutable rows API and `showRowIndex` is enabled
- placeholder rows, group rows, and pinned rows are not draggable

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :show-row-index="true"
  :row-reorder="true"
/>
```

If you need to ship the UI but keep row order locked, leave `rowReorder` unset or pass `false`.

## Ref API

### Runtime access

- `getApi()`
- `getRuntime()`
- `getCore()`

### History

- `history.canUndo()`
- `history.canRedo()`
- `history.runHistoryAction(direction)`
- `getHistory()`

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
- `getSavedView()`
- `migrateSavedView(savedView, options?)`
- `applySavedView(savedView, options?)`

Saved-view persistence helpers:

- `serializeDataGridSavedView(savedView)`
- `parseDataGridSavedView(raw, migrateState, options?)`
- `writeDataGridSavedViewToStorage(storage, key, savedView)`
- `readDataGridSavedViewFromStorage(storage, key, migrateState, options?)`
- `clearDataGridSavedViewInStorage(storage, key)`

Saved views are a thin app-level envelope around unified state plus `viewMode`, so presets can restore both grid layout/runtime state and whether the app is currently in `table` or `gantt` mode.

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
