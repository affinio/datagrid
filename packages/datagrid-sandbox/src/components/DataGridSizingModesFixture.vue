<template>
  <main class="sizing-modes">
    <section class="sizing-modes__auto" data-testid="auto-height-host">
      <button data-testid="load-auto-rows" @click="autoRows = makeRows(8)">Load 8 rows</button>
      <button data-testid="clear-auto-rows" @click="autoRows = []">Clear rows</button>
      <DataGrid
        :rows="autoRows"
        :columns="columns"
        layout-mode="auto-height"
        :min-rows="2"
        :max-rows="4"
        row-height-mode="auto"
        :empty-state="() => 'No rows'"
      />
    </section>
    <section class="sizing-modes__inspector" data-testid="inspector-host">
      <DataGrid
        :rows="ganttRows"
        :columns="columns"
        layout-mode="fill"
      >
        <template #default="slotProps">
          <DataGridDefaultRenderer
            v-bind="slotProps.defaultRendererProps"
            :inspector-panel="{ component: InspectorPanel }"
          />
        </template>
      </DataGrid>
    </section>
    <section class="sizing-modes__gantt" data-testid="gantt-host">
      <DataGrid
        :rows="ganttRows"
        :columns="columns"
        layout-mode="fill"
        view-mode="gantt"
        :gantt="true"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { DataGrid } from "../../../datagrid-vue/src/app-layer/gantt"
import { DataGridDefaultRenderer } from "@affino/datagrid-vue/internal"
import { defineComponent, h } from "vue"

const InspectorPanel = defineComponent({
  setup: () => () => h("div", { "data-testid": "fixture-inspector" }, "Inspector") ,
})

const columns = [
  { key: "name", label: "Name", initialState: { width: 180 } },
  { key: "value", label: "Value", dataType: "number" as const, initialState: { width: 140 } },
]
const makeRows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `auto-${index}`, name: `Auto ${index}`, value: index }))
const autoRows = ref(makeRows(2))
const ganttRows = Array.from({ length: 30 }, (_, index) => ({
  id: `gantt-${index}`,
  name: `Task ${index}`,
  value: index,
  startDate: "2026-10-01",
  endDate: "2026-10-04",
}))
</script>

<style scoped>
.sizing-modes { display: grid; gap: 16px; padding: 12px; }
.sizing-modes__auto { width: 760px; }
.sizing-modes__inspector { display: flex; width: 760px; height: 520px; min-height: 0; }
.sizing-modes__gantt { width: 760px; height: 520px; min-height: 0; }
</style>
