# DataGrid Vue Stable Entrypoint (Common Usage)

Updated: `2026-03-03`

This document defines the stable, semver-safe entrypoints for common `@affino/datagrid-vue` integrations.

## Stable Entrypoints

- Primary: `@affino/datagrid-vue`
- Explicit alias: `@affino/datagrid-vue/stable`
- Stable components: `@affino/datagrid-vue/components`

`@affino/datagrid-vue` and `@affino/datagrid-vue/stable` are contract-equivalent.

## Stable Surface

- Runtime/base:
  - `createDataGridVueRuntime`
  - `useDataGridRuntime`
  - `DataGrid`
  - Pivot utilities through `useDataGridRuntime`: `setPivotModel`, `getPivotModel`, `getPivotCellDrilldown`, `exportPivotLayout`, `importPivotLayout`, `exportPivotInterop`
- Sugar API:
  - `useAffinoDataGrid`
  - `useAffinoDataGridUi`
  - `AffinoDataGridSimple` (`@affino/datagrid-vue/components`)
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
import { AffinoDataGridSimple } from "@affino/datagrid-vue/components"

const rows = ref([
  { rowId: "1", service: "edge-gateway", owner: "NOC" },
  { rowId: "2", service: "billing-api", owner: "Payments" },
])

const columns = [
  { key: "service", label: "Service", width: 220 },
  { key: "owner", label: "Owner", width: 180 },
]
```

```vue
<AffinoDataGridSimple
  v-model:rows="rows"
  :columns="columns"
  :features="{ selection: true, clipboard: true, editing: true }"
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
  - `packages/datagrid-vue/src/components/__tests__/DataGrid.contract.spec.ts`
  - `packages/datagrid-vue/src/components/__tests__/AffinoDataGridSimple.contract.spec.ts`
- Run package contract suite:
  - `pnpm --filter @affino/datagrid-vue run test:contracts`

## Removed Legacy Aliases

Legacy aliases were removed from package code and are no longer supported:

- `useTableSettingsStore`
- `createPiniaTableSettingsAdapter`
- `buildSelectionOverlayTransform`
- `buildSelectionOverlayTransformFromSnapshot`

Use only canonical names from the stable surface.
