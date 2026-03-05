<template>
  <button type="button" class="compute-policy-panel-trigger" @click="emit('open')">
    {{ buttonLabel }}
  </button>
  <section v-if="isOpen" class="compute-policy-panel">
    <label class="compute-policy-panel__label">
      Projection mode
      <select
        class="compute-policy-panel__select"
        :value="projectionMode"
        @change="emit('update-projection-mode', ($event.target as HTMLSelectElement).value as ProjectionMode)"
      >
        <option value="mutable">mutable</option>
        <option value="immutable">immutable</option>
        <option value="excel-like">excel-like</option>
      </select>
    </label>
    <label class="compute-policy-panel__label">
      Compute mode
      <select
        class="compute-policy-panel__select"
        :value="computeMode"
        :disabled="!computeSupported"
        @change="emit('update-compute-mode', ($event.target as HTMLSelectElement).value as ComputeMode)"
      >
        <option value="sync">sync</option>
        <option value="worker">worker</option>
      </select>
    </label>
    <div class="compute-policy-panel__actions">
      <button type="button" class="compute-policy-panel__action-button" @click="emit('apply-projection')">Apply projection</button>
      <button
        type="button"
        class="compute-policy-panel__action-button"
        :disabled="!computeSupported"
        @click="emit('apply-compute')"
      >
        Apply compute
      </button>
      <button type="button" class="compute-policy-panel__action-button" @click="emit('refresh-diagnostics')">Refresh diagnostics</button>
      <button type="button" class="compute-policy-panel__action-button" @click="emit('close')">Close</button>
    </div>
    <pre class="compute-policy-panel__snapshot">{{ diagnosticsOutput }}</pre>
  </section>
</template>

<script setup lang="ts">
type ProjectionMode = "mutable" | "immutable" | "excel-like"
type ComputeMode = "sync" | "worker"

withDefaults(defineProps<{
  isOpen: boolean
  projectionMode: ProjectionMode
  computeMode: ComputeMode
  computeSupported: boolean
  diagnosticsOutput: string
  buttonLabel?: string
}>(), {
  buttonLabel: "Compute/Policy",
})

const emit = defineEmits<{
  open: []
  close: []
  'update-projection-mode': [value: ProjectionMode]
  'update-compute-mode': [value: ComputeMode]
  'apply-projection': []
  'apply-compute': []
  'refresh-diagnostics': []
}>()
</script>
