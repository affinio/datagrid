<template>
  <section
    class="data-grid affino-datagrid"
    :class="`data-grid--theme-${theme}`"
    :data-theme="theme"
    data-affino-datagrid="bridge"
    role="grid"
    :aria-rowcount="viewModel.rowSnapshot.value.rowCount"
    :aria-colcount="columnCount"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <slot
      :api="grid.api"
      :core="grid.runtime.core"
      :runtime="grid.runtime"
      :grid="grid"
      :rowModel="grid.runtime.rowModel"
      :columnModel="grid.runtime.columnModel"
      :columnSnapshot="grid.runtime.columnSnapshot.value"
      :setRows="grid.runtime.setRows"
      :syncRowsInRange="grid.runtime.syncRowsInRange"
      :virtualWindow="slotVirtualWindow"
    >
      <div
        class="data-grid-layout"
        role="presentation"
        :style="gridLayoutStyle"
      >
        <GridHeader />
        <GridBody
          @row-select="handleRowSelect"
          @cell-click="handleCellClick"
        />
      </div>
    </slot>
  </section>
</template>

<script setup lang="ts">
import type {
  CreateDataGridCoreOptions,
  DataGridColumnDef,
  DataGridCoreServiceRegistry,
  DataGridApiPluginDefinition,
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import { computed, toRef, watch } from "vue"
import {
  createDataGridFeatureRegistry,
  type DataGridExportContext,
  type DataGridExportPayload,
  type DataGridFeatureName,
  resolveDataGridFeatureDependencies,
} from "../composables/useDataGridFeatureRegistry"
import { provideDataGridTheme, type DataGridTheme } from "../composables/useDataGridTheme"
import { useDataGridEngine } from "../composables/useDataGridEngine"
import { useDataGridEventBridge } from "../composables/useDataGridEventBridge"
import { useDataGridFeatureInstaller } from "../composables/useDataGridFeatureInstaller"
import { provideDataGridContext } from "../composables/useDataGridContext"
import { useDataGridViewModel } from "../composables/useDataGridViewModel"
import GridBody from "./GridBody.vue"
import GridHeader from "./GridHeader.vue"
import type { DataGridCellClickPayload, DataGridRowSelectPayload } from "./gridUiTypes"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

interface DataGridPaginationInput {
  pageSize: number
  currentPage: number
}

interface DataGridColumnPolicy {
  readOnly?: boolean
  maxWidth?: number
  type?: "text" | "number" | "date" | "boolean"
}

interface DataGridRowsChangedEvent {
  snapshot: DataGridRowModelSnapshot<unknown>
}

interface DataGridSelectionChangedEvent {
  snapshot: DataGridSelectionSnapshot | null
}

interface DataGridColumnAutosizeOptions {
  minWidth?: number
  maxWidth?: number
  maxRows?: number
  charWidth?: number
  padding?: number
}

const props = withDefaults(defineProps<{
  rows: readonly unknown[]
  rowModel?: DataGridRowModel<unknown>
  columns: readonly DataGridColumnDef[]
  features?: readonly DataGridFeatureName[]
  theme?: DataGridTheme
  renderMode?: "virtualization" | "pagination"
  pagination?: DataGridPaginationInput | null
  columnPolicies?: Readonly<Record<string, DataGridColumnPolicy>>
  plugins?: readonly DataGridApiPluginDefinition<unknown>[]
  services?: DataGridRuntimeOverrides
  startupOrder?: CreateDataGridCoreOptions["startupOrder"]
  autoStart?: boolean
  resolveCellTextValue?: (value: unknown, columnKey: string) => string
  resolveExportCsv?: (context: DataGridExportContext<unknown>) => Promise<string | DataGridExportPayload> | string | DataGridExportPayload
  resolveExportExcel?: (context: DataGridExportContext<unknown>) => Promise<string | DataGridExportPayload> | string | DataGridExportPayload
  columnAutosize?: DataGridColumnAutosizeOptions
}>(), {
  features: () => [],
  theme: "light",
  renderMode: "virtualization",
  pagination: null,
  columnPolicies: () => ({}),
  plugins: () => [],
  autoStart: true,
  columnAutosize: undefined,
})

const emit = defineEmits<{
  (event: "cell-change", payload: DataGridRowsChangedEvent): void
  (event: "selection-change", payload: DataGridSelectionChangedEvent): void
  (event: "row-select", payload?: unknown): void
}>()

const grid = useDataGridEngine({
  rows: toRef(props, "rows"),
  rowModel: props.rowModel,
  columns: toRef(props, "columns"),
  plugins: props.plugins,
  services: props.services,
  startupOrder: props.startupOrder,
  autoStart: props.autoStart,
})

const featureRegistry = createDataGridFeatureRegistry<unknown>({
  isColumnReadOnly: (columnKey: string) => Boolean(props.columnPolicies?.[columnKey]?.readOnly),
  resolveCellTextValue: props.resolveCellTextValue,
  resolveExportCsv: props.resolveExportCsv,
  resolveExportExcel: props.resolveExportExcel,
  columnAutosize: props.columnAutosize,
})

const installedFeatures = computed<readonly DataGridFeatureName[]>(() => {
  return resolveDataGridFeatureDependencies(props.features)
})

useDataGridFeatureInstaller({
  grid,
  features: installedFeatures,
  registry: featureRegistry,
})

useDataGridEventBridge({
  grid,
  emit,
})

provideDataGridTheme(computed(() => props.theme))

const viewModel = useDataGridViewModel(grid)
const visibleColumns = computed(() => viewModel.visibleColumns.value)
const visibleRows = computed(() => viewModel.visibleRows.value)
const columnCount = computed(() => visibleColumns.value.length)
const gridTemplate = computed(() => `repeat(${Math.max(1, columnCount.value)}, minmax(0, 1fr))`)
const gridLayoutStyle = computed(() => ({
  "--dg-grid-template": gridTemplate.value,
}))

provideDataGridContext({
  engine: {
    grid,
  },
  view: {
    viewModel,
    visibleRows,
    visibleColumns,
  },
})

const theme = computed(() => props.theme)

const syncPaginationState = (): void => {
  if (props.renderMode === "pagination") {
    const safePagination = props.pagination ?? { pageSize: 100, currentPage: 1 }
    grid.api.rows.setPagination({
      pageSize: Math.max(1, Math.trunc(safePagination.pageSize)),
      currentPage: Math.max(1, Math.trunc(safePagination.currentPage)),
    })
    return
  }
  grid.api.rows.setPagination(null)
}

watch(
  () => props.renderMode,
  () => {
    syncPaginationState()
  },
  { immediate: true },
)

watch(
  () => props.pagination,
  () => {
    syncPaginationState()
  },
  { immediate: true, deep: true },
)

const slotVirtualWindow = computed(() => {
  const window = viewModel.virtualWindow.value
  return {
    ...(window ?? {}),
    rowTotal: viewModel.rowSnapshot.value.rowCount,
    colTotal: columnCount.value,
  }
})

const handleRowSelect = (payload: DataGridRowSelectPayload): void => {
  grid.emit("row-select", payload)
}

const handleCellClick = (payload: DataGridCellClickPayload): void => {
  grid.emit("cell-click", payload)
}

const handleKeydown = (event: KeyboardEvent): void => {
  grid.emit("keydown", event)
}

defineExpose({
  api: grid.api,
  core: grid.runtime.core,
  runtime: grid.runtime,
  rowModel: grid.runtime.rowModel,
  columnModel: grid.runtime.columnModel,
  columnSnapshot: grid.runtime.columnSnapshot,
  setRows: grid.runtime.setRows,
  syncRowsInRange: grid.runtime.syncRowsInRange,
  virtualWindow: grid.runtime.virtualWindow,
  start: grid.runtime.start,
  stop: grid.runtime.stop,
})
</script>

<style scoped>
.data-grid {
  --dg-border-color: #d7dde5;
  --dg-bg: #ffffff;
  --dg-fg: #1f2933;
  width: 100%;
  display: block;
  color: var(--dg-fg);
  background: var(--dg-bg);
}

.data-grid-layout {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.data-grid--theme-light {
  --dg-border-color: #d7dde5;
  --dg-bg: #ffffff;
  --dg-fg: #1f2933;
}

.data-grid--theme-dark {
  --dg-border-color: #2f3a46;
  --dg-bg: #161b22;
  --dg-fg: #f8fbff;
}
</style>
