<template>
  <div class="data-grid-header" role="rowgroup">
    <div
      class="data-grid-header-row"
      role="row"
    >
      <div
        v-for="column in visibleColumns"
        :key="column.key"
        class="data-grid-header-cell"
        role="columnheader"
      >
        {{ column.label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataGridViewContext } from "../composables/useDataGridViewContext"

const { visibleColumns } = useDataGridViewContext()
</script>

<style scoped>
.data-grid-header {
  width: 100%;
}

.data-grid-header-row {
  display: grid;
  width: 100%;
  grid-template-columns: var(--dg-grid-template);
}

.data-grid-header-cell {
  border: 1px solid var(--dg-border-color, #d7dde5);
  padding: 6px 8px;
  text-align: left;
  font-weight: 600;
  min-width: 0;
}
</style>
