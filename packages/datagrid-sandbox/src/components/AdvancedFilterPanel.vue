<template>
  <button type="button" @click="emit('open')">
    {{ buttonLabel }}
  </button>
  <section v-if="isOpen" class="advanced-filter-panel">
    <div
      v-for="(clause, clauseIndex) in clauses"
      :key="clause.id"
      class="advanced-filter-panel__row"
    >
      <select
        :value="clause.join"
        :disabled="clauseIndex === 0"
        aria-label="Join operator"
        @change="updateClause(clause.id, 'join', ($event.target as HTMLSelectElement).value)"
      >
        <option value="and">AND</option>
        <option value="or">OR</option>
      </select>
      <select
        :value="clause.columnKey"
        aria-label="Column"
        @change="updateClause(clause.id, 'columnKey', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="column in columns"
          :key="`advanced-filter-column-${column.key}`"
          :value="column.key"
        >
          {{ column.label }}
        </option>
      </select>
      <select
        :value="clause.operator"
        aria-label="Condition operator"
        @change="updateClause(clause.id, 'operator', ($event.target as HTMLSelectElement).value)"
      >
        <option value="contains">Contains</option>
        <option value="equals">Equals</option>
        <option value="not-equals">Not equals</option>
        <option value="starts-with">Starts with</option>
        <option value="ends-with">Ends with</option>
        <option value="gt">&gt;</option>
        <option value="gte">&gt;=</option>
        <option value="lt">&lt;</option>
        <option value="lte">&lt;=</option>
      </select>
      <input
        :value="clause.value"
        type="text"
        placeholder="Value"
        aria-label="Condition value"
        @input="updateClause(clause.id, 'value', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        :disabled="clauses.length <= 1"
        @click="emit('remove', clause.id)"
      >
        Remove
      </button>
    </div>
    <div class="advanced-filter-panel__actions">
      <button type="button" @click="emit('add')">Add</button>
      <button type="button" @click="emit('apply')">Apply</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DataGridAppAdvancedFilterClauseDraft,
  DataGridAppAdvancedFilterClausePatch,
  DataGridAppAdvancedFilterColumnOption,
} from "@affino/datagrid-vue"

withDefaults(defineProps<{
  isOpen: boolean
  clauses: readonly DataGridAppAdvancedFilterClauseDraft[]
  columns: readonly DataGridAppAdvancedFilterColumnOption[]
  buttonLabel?: string
}>(), {
  buttonLabel: "Advanced filter",
})

const emit = defineEmits<{
  open: []
  add: []
  remove: [clauseId: number]
  apply: []
  cancel: []
  "update-clause": [payload: DataGridAppAdvancedFilterClausePatch]
}>()

const updateClause = (
  clauseId: number,
  field: DataGridAppAdvancedFilterClausePatch["field"],
  value: string,
): void => {
  emit("update-clause", { clauseId, field, value })
}
</script>
