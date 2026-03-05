<template>
  <button type="button" class="state-panel-trigger" @click="emit('open')">
    {{ buttonLabel }}
  </button>
  <section v-if="isOpen" class="state-panel">
    <div class="state-panel__actions">
      <button type="button" class="state-panel__action-button" @click="emit('export-state')">Export state</button>
      <button type="button" class="state-panel__action-button" @click="emit('migrate-state')">Migrate import</button>
      <button type="button" class="state-panel__action-button" @click="emit('apply-state')">Apply import</button>
      <button type="button" class="state-panel__action-button" @click="emit('close')">Close</button>
    </div>
    <label class="state-panel__label">
      Import JSON
      <textarea
        class="state-panel__textarea"
        :value="importText"
        placeholder="Paste state JSON"
        @input="emit('update-import', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <label class="state-panel__label">
      Output
      <textarea
        class="state-panel__textarea"
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
  buttonLabel: "State",
})

const emit = defineEmits<{
  open: []
  close: []
  'export-state': []
  'migrate-state': []
  'apply-state': []
  'update-import': [value: string]
}>()
</script>
