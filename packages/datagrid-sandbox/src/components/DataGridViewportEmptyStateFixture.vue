<template>
  <main class="viewport-empty-state-fixture">
    <DataGrid
      :rows="[]"
      :columns="columns"
      :row-selection="false"
      :show-row-index="false"
      layout-mode="fill"
      empty-state-alignment="viewport"
    />
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import { DataGrid } from "@affino/datagrid-vue"

const route = useRoute()
const isPinned = computed(() => route.params.pinMode === "pinned")
const centerColumns = Array.from({ length: 16 }, (_, index) => ({
  key: `center-${index}`,
  label: `Center ${index}`,
  initialState: { width: 180 },
}))
const columns = computed(() => [
  ...(isPinned.value
    ? [{ key: "left", label: "Left pinned", initialState: { width: 160, pin: "left" as const } }]
    : []),
  ...centerColumns,
  ...(isPinned.value
    ? [{ key: "right", label: "Right pinned", initialState: { width: 160, pin: "right" as const } }]
    : []),
])
</script>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}

.viewport-empty-state-fixture {
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
}
</style>
