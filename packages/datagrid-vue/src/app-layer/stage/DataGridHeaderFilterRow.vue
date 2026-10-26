<template>
  <form
    class="col-filter col-filter--engineering"
    :class="{
      'col-filter--engineering-between': draft.operator === 'between',
      'col-filter--engineering-operandless': isOperandless,
    }"
    @submit.prevent="$emit('apply')"
  >
    <select
      :disabled="disabled"
      class="col-filter-input col-filter-input--operator"
      :aria-label="`${label} filter operator`"
      :value="draft.operator"
      @mousedown.stop
      @click.stop
      @keydown.stop="handleKeydown"
      @change="update({ operator: ($event.target as HTMLSelectElement).value })"
    >
      <option v-for="option in operatorOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <select
      v-if="!isOperandless && isBoolean"
      :disabled="disabled"
      class="col-filter-input"
      :aria-label="`${label} filter value`"
      :value="draft.value"
      @mousedown.stop
      @click.stop
      @keydown.stop="handleKeydown"
      @change="update({ value: ($event.target as HTMLSelectElement).value })"
    >
      <option value="" disabled>Choose…</option>
      <option value="true">True</option>
      <option value="false">False</option>
    </select>
    <input
      v-if="!isOperandless && !isBoolean"
      :disabled="disabled"
      class="col-filter-input"
      :aria-label="`${label} filter value`"
      :inputmode="isNumeric ? 'decimal' : undefined"
      :value="draft.value"
      :placeholder="draft.operator === 'between' ? 'From' : 'Value'"
      @mousedown.stop
      @click.stop
      @keydown.stop="handleKeydown"
      @input="update({ value: ($event.target as HTMLInputElement).value })"
    />
    <input
      v-if="draft.operator === 'between'"
      :disabled="disabled"
      class="col-filter-input"
      :aria-label="`${label} filter upper value`"
      :inputmode="isNumeric ? 'decimal' : undefined"
      :value="draft.value2"
      placeholder="To"
      @mousedown.stop
      @click.stop
      @keydown.stop="handleKeydown"
      @input="update({ value2: ($event.target as HTMLInputElement).value })"
    />
  </form>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { DataGridHeaderFilterDraft } from "./dataGridTableStage.types"

const props = defineProps<{
  label: string
  dataType?: string
  draft: DataGridHeaderFilterDraft
  disabled?: boolean
}>()

const normalizedType = computed(() => props.dataType?.toLowerCase() ?? "text")
const isNumeric = computed(() => ["number", "integer", "float", "numeric", "currency", "percent"].includes(normalizedType.value))
const isBoolean = computed(() => normalizedType.value === "boolean")
const isOperandless = computed(() => props.draft.operator === "" || ["isEmpty", "notEmpty", "isNull", "notNull"].includes(props.draft.operator))
const operatorOptions = computed(() => {
  const noFilter = { value: "", label: "No filter" }
  const common = [
    { value: "isEmpty", label: "Is empty" },
    { value: "notEmpty", label: "Is not empty" },
    { value: "isNull", label: "Is null" },
    { value: "notNull", label: "Is not null" },
  ]
  if (isNumeric.value) {
    return [
      noFilter,
      { value: "equals", label: "Equals" },
      { value: "notEquals", label: "Does not equal" },
      { value: "gt", label: "Greater than" },
      { value: "gte", label: "At least" },
      { value: "lt", label: "Less than" },
      { value: "lte", label: "At most" },
      { value: "between", label: "Between" },
      ...common,
    ]
  }
  if (isBoolean.value) {
    return [
      noFilter,
      { value: "equals", label: "Equals" },
      { value: "notEquals", label: "Does not equal" },
      ...common,
    ]
  }
  return [
    noFilter,
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "notEquals", label: "Does not equal" },
    { value: "startsWith", label: "Starts with" },
    { value: "endsWith", label: "Ends with" },
    ...common,
  ]
})

function update(patch: Partial<DataGridHeaderFilterDraft>): void {
  emit("update", { ...props.draft, ...patch })
}

const emit = defineEmits<{
  apply: []
  cancel: []
  update: [draft: DataGridHeaderFilterDraft]
}>()

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault()
    emit("apply")
  } else if (event.key === "Escape") {
    event.preventDefault()
    emit("cancel")
  }
}
</script>
