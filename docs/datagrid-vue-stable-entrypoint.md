# DataGrid Vue Stable Entrypoint (Common Usage)

Updated: `2026-03-03`

This document defines the stable, semver-safe entrypoints for common `@affino/datagrid-vue` integrations.

## Stable Entrypoints

- Primary: `@affino/datagrid-vue`
- Explicit alias: `@affino/datagrid-vue/stable`
- Declarative app layer: `@affino/datagrid-vue-app`

`@affino/datagrid-vue` and `@affino/datagrid-vue/stable` are contract-equivalent.

## Stable Surface

- Runtime/base:
  - `createDataGridVueRuntime`
  - `useDataGridRuntime`
  - Pivot utilities through `useDataGridRuntime`: `setPivotModel`, `getPivotModel`, `getPivotCellDrilldown`, `exportPivotLayout`, `importPivotLayout`, `exportPivotInterop`
- Sugar API:
  - `useAffinoDataGrid`
  - `useAffinoDataGridUi`
- Settings + overlays + a11y:
  - `useDataGridSettingsStore`
  - `createDataGridSettingsAdapter`
  - `buildDataGridOverlayTransform`
  - `buildDataGridOverlayTransformFromSnapshot`
  - `mapDataGridA11yGridAttributes`
  - `mapDataGridA11yCellAttributes`
  - `useDataGridContextMenu`

No advanced hooks are part of this surface.

Advanced hooks are available only via:
- `@affino/datagrid-vue/advanced`

## 60-Second Setup (Recommended)

```ts
import { ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = ref([
  { rowId: "1", service: "edge-gateway", owner: "NOC" },
  { rowId: "2", service: "billing-api", owner: "Payments" },
])

const columns = [
  { key: "service", label: "Service", initialState: { width: 220 } },
  { key: "owner", label: "Owner", initialState: { width: 180 } },
]

const columnState = ref(null)
const gridState = ref(null)
```

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  v-model:column-state="columnState"
  v-model:state="gridState"
/>
```

## If You Need More Control

```ts
import { useAffinoDataGridUi } from "@affino/datagrid-vue"
```

`useAffinoDataGridUi` keeps sugar ergonomics, but exposes explicit action/binding APIs for custom table UIs.

## Contract Guard

- Stable/runtime contract coverage lives in:
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridRuntime.contract.spec.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useAffinoDataGrid.contract.spec.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useAffinoDataGridUi.contract.spec.ts`
- Run package contract suite:
  - `pnpm --filter @affino/datagrid-vue run test:contracts`

## Removed Legacy Aliases

Legacy aliases were removed from package code and are no longer supported:

- `useTableSettingsStore`
- `createPiniaTableSettingsAdapter`
- `buildSelectionOverlayTransform`
- `buildSelectionOverlayTransformFromSnapshot`

Use only canonical names from the stable surface.
