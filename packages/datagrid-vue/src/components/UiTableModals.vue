<template>
  <AdvancedFilterModal
    :open="advancedOpen"
    :column-label="advancedColumnLabel"
    :type="advancedType"
    :condition="advancedCondition"
    @apply="value => emit('advanced-apply', value)"
    @clear="() => emit('advanced-clear')"
    @cancel="() => emit('advanced-cancel')"
  />
  <FindModal
    :open="findOpen"
    @close="() => emit('close-find')"
  />
  <ReplaceModal
    :open="replaceOpen"
    @close="() => emit('close-replace')"
  />
</template>

<script setup lang="ts">
import { toRefs } from "vue"
import AdvancedFilterModal from "./AdvancedFilterModal.vue"
import FindModal from "../modals/FindModal.vue"
import ReplaceModal from "../modals/ReplaceModal.vue"
import type { FilterCondition } from "../composables/useTableFilters"

const props = defineProps<{
  advancedOpen: boolean
  advancedColumnLabel: string
  advancedType: FilterCondition["type"]
  advancedCondition: FilterCondition | null
  findOpen: boolean
  replaceOpen: boolean
}>()

const {
  advancedOpen,
  advancedColumnLabel,
  advancedType,
  advancedCondition,
  findOpen,
  replaceOpen,
} = toRefs(props)

const emit = defineEmits<{
  (event: "advanced-apply", payload: FilterCondition | null): void
  (event: "advanced-clear"): void
  (event: "advanced-cancel"): void
  (event: "close-find"): void
  (event: "close-replace"): void
}>()
</script>
