<template>
  <button type="button" class="diagnostics-panel-trigger" @click="emit('open')">
    {{ buttonLabel }}
  </button>
  <section v-if="isOpen" class="diagnostics-panel">
    <div class="diagnostics-panel__actions">
      <button type="button" class="diagnostics-panel__action-button" @click="emit('refresh')">Refresh</button>
      <button type="button" class="diagnostics-panel__action-button" @click="emit('close')">Close</button>
    </div>
    <pre class="diagnostics-panel__snapshot">{{ formattedSnapshot }}</pre>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{
  isOpen: boolean
  snapshot: unknown | null
  buttonLabel?: string
}>(), {
  buttonLabel: "Diagnostics",
})

const emit = defineEmits<{
  open: []
  close: []
  refresh: []
}>()

const formattedSnapshot = computed(() => {
  if (!props.snapshot) {
    return "No diagnostics snapshot"
  }
  return JSON.stringify(props.snapshot, null, 2)
})
</script>
