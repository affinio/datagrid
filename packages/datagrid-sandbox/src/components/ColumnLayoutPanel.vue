<template>
  <button type="button" class="column-layout-panel-trigger" @click="emit('open')">
    {{ buttonLabel }}
  </button>
  <section v-if="isOpen" class="column-layout-panel">
    <div class="column-layout-panel__list">
      <div
        v-for="item in items"
        :key="item.key"
        class="column-layout-panel__row"
      >
        <label class="column-layout-panel__visibility">
          <input
            type="checkbox"
            :checked="item.visible"
            @change="emitVisibility(item.key, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ item.label }}</span>
        </label>
        <div class="column-layout-panel__move-actions">
          <button type="button" class="column-layout-panel__action-button" :disabled="!item.canMoveUp" @click="emit('move-up', item.key)">↑</button>
          <button type="button" class="column-layout-panel__action-button" :disabled="!item.canMoveDown" @click="emit('move-down', item.key)">↓</button>
        </div>
      </div>
    </div>
    <div class="column-layout-panel__actions">
      <button type="button" class="column-layout-panel__action-button" @click="emit('apply')">Apply</button>
      <button type="button" class="column-layout-panel__action-button" @click="emit('cancel')">Cancel</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DataGridAppColumnLayoutPanelItem,
  DataGridAppColumnLayoutVisibilityPatch,
} from "@affino/datagrid-vue"

withDefaults(defineProps<{
  isOpen: boolean
  items: readonly DataGridAppColumnLayoutPanelItem[]
  buttonLabel?: string
}>(), {
  buttonLabel: "Columns",
})

const emit = defineEmits<{
  open: []
  "toggle-visibility": [payload: DataGridAppColumnLayoutVisibilityPatch]
  "move-up": [key: string]
  "move-down": [key: string]
  apply: []
  cancel: []
}>()

const emitVisibility = (key: string, visible: boolean): void => {
  emit("toggle-visibility", { key, visible })
}
</script>

<style scoped>
.column-layout-panel__visibility {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
}

.column-layout-panel__visibility input[type="checkbox"] {
  width: 0.78rem;
  height: 0.78rem;
  margin: 0;
}
</style>
