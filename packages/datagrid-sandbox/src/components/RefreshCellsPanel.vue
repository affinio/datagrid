<template>
  <button type="button" class="refresh-cells-panel-trigger" @click="emit('open')">
    {{ buttonLabel }}
  </button>
  <section v-if="isOpen" class="refresh-cells-panel">
    <label class="refresh-cells-panel__label">
      Row keys (comma-separated)
      <input
        class="refresh-cells-panel__input"
        :value="rowKeys"
        placeholder="core-1, core-2"
        @input="emit('update-row-keys', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="refresh-cells-panel__label">
      Column keys (comma-separated)
      <input
        class="refresh-cells-panel__input"
        :value="columnKeys"
        placeholder="name, status"
        @input="emit('update-column-keys', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <div class="refresh-cells-panel__actions">
      <button type="button" class="refresh-cells-panel__action-button" @click="emit('refresh')">Refresh cells</button>
      <button type="button" class="refresh-cells-panel__action-button" @click="emit('close')">Close</button>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  isOpen: boolean
  rowKeys: string
  columnKeys: string
  buttonLabel?: string
}>(), {
  buttonLabel: "Refresh cells",
})

const emit = defineEmits<{
  open: []
  close: []
  refresh: []
  'update-row-keys': [value: string]
  'update-column-keys': [value: string]
}>()
</script>
