<template>
  <main class="height-fixture">
    <label class="height-fixture__placement">
      Toolbar placement
      <select v-model="toolbarPlacement" data-testid="toolbar-placement">
        <option value="stacked">Stacked</option>
        <option value="integrated">Integrated</option>
        <option value="hidden">Hidden</option>
      </select>
    </label>

    <section
      class="height-fixture__host"
      :class="{ 'height-fixture__host--hidden-toolbar': toolbarPlacement === 'hidden' }"
      data-testid="bounded-grid-host"
    >
      <header class="height-fixture__heading">Height sizing fixture</header>
      <DataGridModuleHost
        v-if="toolbarPlacement === 'hidden'"
        :modules="toolbarModules"
        :theme="theme"
        :chrome="chrome"
      />
      <DataGrid
        class="height-fixture__grid"
        :rows="rows"
        :columns="columns"
        :chrome="chrome"
        :theme="theme"
        quick-filter
        column-menu
        virtualization
        @toolbar-modules-change="toolbarModules = $event"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import {
  DataGrid,
  DataGridModuleHost,
  type DataGridAppToolbarModule,
  type DataGridToolbarPlacement,
} from "@affino/datagrid-vue"

const theme = "default" as const
const toolbarPlacement = ref<DataGridToolbarPlacement>("stacked")
const toolbarModules = ref<readonly DataGridAppToolbarModule[]>([])
const chrome = computed(() => ({ toolbarPlacement: toolbarPlacement.value }))
const rows = Array.from({ length: 240 }, (_, index) => ({
  id: `height-row-${index}`,
  name: `Row ${index}`,
  value: index * 3,
  status: index % 2 === 0 ? "Ready" : "Pending",
}))
const columns = [
  { key: "name", label: "Name", initialState: { width: 180 } },
  { key: "value", label: "Value", dataType: "number" as const, initialState: { width: 140 } },
  { key: "status", label: "Status", initialState: { width: 140 } },
]
</script>

<style scoped>
.height-fixture {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  padding: 12px;
}

.height-fixture__host {
  display: grid;
  grid-template-rows: 36px minmax(0, 1fr);
  width: 760px;
  height: 520px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.height-fixture__host--hidden-toolbar {
  grid-template-rows: 36px auto minmax(0, 1fr);
}

.height-fixture__heading {
  display: flex;
  align-items: center;
}

.height-fixture__placement {
  display: flex;
  align-items: center;
  gap: 8px;
}

.height-fixture__grid {
  min-width: 0;
  min-height: 0;
}
</style>
