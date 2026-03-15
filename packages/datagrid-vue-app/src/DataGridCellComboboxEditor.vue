<template>
  <DataGridFilterableCombobox
    :value="value"
    :options="options"
    :load-options="loadOptions"
    :placeholder="placeholder"
    @commit="handleCommit"
    @cancel="emit('cancel')"
    @options-resolved="handleOptionsResolved"
  />
</template>

<script setup lang="ts">
import DataGridFilterableCombobox from "./DataGridFilterableCombobox.vue"
import type { DataGridFilterableComboboxOption } from "./dataGridFilterableCombobox"

type CommitTarget = "stay" | "next" | "previous"

defineProps<{
  value: string
  options?: ReadonlyArray<DataGridFilterableComboboxOption>
  loadOptions?: (query: string) => Promise<ReadonlyArray<DataGridFilterableComboboxOption>>
  placeholder?: string
}>()

const emit = defineEmits<{
  (event: "commit", value: string, target?: CommitTarget): void
  (event: "cancel"): void
  (event: "optionsResolved", options: ReadonlyArray<DataGridFilterableComboboxOption>): void
}>()

function handleCommit(value: string, target?: CommitTarget): void {
  emit("commit", value, target)
}

function handleOptionsResolved(options: ReadonlyArray<DataGridFilterableComboboxOption>): void {
  emit("optionsResolved", options)
}
</script>
