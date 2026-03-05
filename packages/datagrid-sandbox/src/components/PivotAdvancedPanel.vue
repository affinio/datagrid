<template>
  <button type="button" class="pivot-advanced-panel-trigger" @click="emit('open')">
    {{ buttonLabel }}
  </button>
  <section v-if="isOpen" class="pivot-advanced-panel">
    <div class="pivot-advanced-panel__actions">
      <button type="button" class="pivot-advanced-panel__action-button" @click="emit('export-layout')">Export layout</button>
      <button type="button" class="pivot-advanced-panel__action-button" @click="emit('export-interop')">Export interop</button>
      <button type="button" class="pivot-advanced-panel__action-button" @click="emit('close')">Close</button>
    </div>
    <label class="pivot-advanced-panel__label">
      Import layout JSON
      <textarea
        class="pivot-advanced-panel__textarea"
        :value="importText"
        placeholder="Paste layout JSON"
        @input="emit('update-import', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <div class="pivot-advanced-panel__actions">
      <button type="button" class="pivot-advanced-panel__action-button" @click="emit('import-layout')">Import layout</button>
      <button type="button" class="pivot-advanced-panel__action-button" @click="emit('clear-import')">Clear import</button>
    </div>
    <label class="pivot-advanced-panel__label">
      Output
      <textarea
        class="pivot-advanced-panel__textarea"
        :value="outputText"
        readonly
      />
    </label>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  isOpen: boolean
  importText: string
  outputText: string
  buttonLabel?: string
}>(), {
  buttonLabel: "Pivot advanced",
})

const emit = defineEmits<{
  open: []
  close: []
  'export-layout': []
  'export-interop': []
  'update-import': [value: string]
  'import-layout': []
  'clear-import': []
}>()
</script>
