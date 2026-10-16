<template>
  <main class="theme-canvas-fixture">
    <div class="theme-canvas-fixture__controls">
      <button type="button" data-testid="theme-prop-default" @click="theme = 'default'">Default theme prop</button>
      <button type="button" data-testid="theme-prop-industrial" @click="theme = 'industrial-neutral'">Industrial theme prop</button>
      <button type="button" data-testid="theme-prop-fixed" @click="theme = fixedTheme">Fixed theme prop</button>
    </div>
    <div class="theme-canvas-fixture__grids">
      <DataGrid
        v-for="gridId in gridIds"
        :key="gridId"
        :data-testid="`theme-grid-${gridId}`"
        :rows="rows"
        :columns="columns"
        :theme="theme"
        :row-selection="false"
        :row-index-menu="false"
        :column-menu="false"
        :cell-menu="false"
        :fill-handle="false"
        :range-move="false"
        striped-rows
        grid-lines="all"
        layout-mode="fill"
        class="theme-canvas-fixture__grid"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"
import type { DataGridStyleConfig } from "@affino/datagrid-theme"

const theme = ref<"default" | "industrial-neutral" | DataGridStyleConfig>("default")
const fixedTheme: DataGridStyleConfig = {
  inheritThemeFromDocument: false,
  tokens: {
    bodyRowBackgroundColor: "#fff7ed",
    rowDividerColor: "rgba(154, 52, 18, 0.42)",
    columnDividerColor: "rgba(154, 52, 18, 0.38)",
    headerDividerColor: "rgba(154, 52, 18, 0.5)",
  },
}
const gridIds = ["first", "second"] as const
const rows = Array.from({ length: 240 }, (_, index) => ({
  id: `theme-row-${index}`,
  name: `Row ${index}`,
  value: index * 3,
  asset: `Asset ${index % 17}`,
  quality: index % 3 === 0 ? "Good" : "Questionable",
  status: index % 2 === 0 ? "Ready" : "Pending",
}))
const columns = [
  { key: "name", label: "Name", initialState: { width: 150, pin: "left" as const } },
  { key: "value", label: "Value", dataType: "number" as const, initialState: { width: 180 } },
  { key: "asset", label: "Asset", initialState: { width: 180 } },
  { key: "quality", label: "Quality", initialState: { width: 180 } },
  { key: "status", label: "Status", initialState: { width: 150, pin: "right" as const } },
]
</script>

<style scoped>
.theme-canvas-fixture {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.theme-canvas-fixture__controls,
.theme-canvas-fixture__grids {
  display: flex;
  gap: 12px;
}

.theme-canvas-fixture__grids {
  min-width: 0;
}

.theme-canvas-fixture__grid {
  width: 50%;
  height: 480px;
  min-width: 0;
}
</style>
