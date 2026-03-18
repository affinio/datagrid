<template>
  <button
    :ref="floating.triggerRef"
    type="button"
    class="datagrid-app-toolbar__button"
    :class="{ 'datagrid-app-toolbar__button--active': active }"
    :style="overlayThemeVars"
    v-bind="triggerProps"
  >
    {{ buttonLabel }}
  </button>

  <Teleport :to="popoverTeleportTarget">
    <section
      v-if="popoverOpen"
      :ref="floating.contentRef"
      class="datagrid-advanced-filter"
      data-datagrid-overlay-surface="true"
      :style="[popoverContentStyle, overlayThemeVars]"
      v-bind="contentProps"
    >
      <header class="datagrid-advanced-filter__header">
        <div>
          <div class="datagrid-advanced-filter__eyebrow">Advanced filter</div>
          <h3 class="datagrid-advanced-filter__title">Build clause-based filter</h3>
        </div>
        <button type="button" class="datagrid-advanced-filter__ghost" @click="emit('cancel')">
          Close
        </button>
      </header>

      <section class="datagrid-advanced-filter__applied">
        <div class="datagrid-advanced-filter__applied-head">
          <div>
            <div class="datagrid-advanced-filter__eyebrow">Applied on table</div>
            <div class="datagrid-advanced-filter__applied-title">Current filters</div>
          </div>
          <button
            type="button"
            class="datagrid-advanced-filter__ghost"
            :disabled="!hasAnyFilters"
            data-datagrid-advanced-filter-action="reset-all"
            @click="emit('reset-all')"
          >
            Reset all filters
          </button>
        </div>

        <div v-if="appliedFilterSummaryItems.length > 0" class="datagrid-advanced-filter__applied-list">
          <span
            v-for="(item, index) in appliedFilterSummaryItems"
            :key="`applied-filter-${index}`"
            class="datagrid-advanced-filter__applied-chip"
          >
            {{ item }}
          </span>
        </div>
        <div v-else class="datagrid-advanced-filter__applied-empty">
          No filters applied
        </div>
      </section>

      <div class="datagrid-advanced-filter__rows">
        <div
          v-for="(clause, clauseIndex) in clauses"
          :key="clause.id"
          class="datagrid-advanced-filter__row"
        >
          <label class="datagrid-advanced-filter__field datagrid-advanced-filter__field--join">
            <span class="datagrid-advanced-filter__label">Join</span>
            <DataGridFilterableCombobox
              class="datagrid-advanced-filter__select"
              :value="clause.join"
              :options="JOIN_OPTIONS"
              :open-on-mount="false"
              :open-on-focus="false"
              sticky-popover-id="advanced-filter"
              :disabled="clauseIndex === 0"
              aria-label="Join operator"
              @commit="updateClause(clause.id, 'join', $event)"
            />
          </label>

          <label class="datagrid-advanced-filter__field">
            <span class="datagrid-advanced-filter__label">Column</span>
            <DataGridFilterableCombobox
              class="datagrid-advanced-filter__select"
              :value="clause.columnKey"
              :options="columnOptions"
              :open-on-mount="false"
              :open-on-focus="false"
              sticky-popover-id="advanced-filter"
              :data-advanced-filter-autofocus="clauseIndex === 0 ? 'true' : null"
              aria-label="Column"
              @commit="updateClause(clause.id, 'columnKey', $event)"
            />
          </label>

          <label class="datagrid-advanced-filter__field">
            <span class="datagrid-advanced-filter__label">Operator</span>
            <DataGridFilterableCombobox
              class="datagrid-advanced-filter__select"
              :value="clause.operator"
              :options="OPERATOR_OPTIONS"
              :open-on-mount="false"
              :open-on-focus="false"
              sticky-popover-id="advanced-filter"
              aria-label="Condition operator"
              @commit="updateClause(clause.id, 'operator', $event)"
            />
          </label>

          <label class="datagrid-advanced-filter__field datagrid-advanced-filter__field--value">
            <span class="datagrid-advanced-filter__label">Value</span>
            <input
              :value="clause.value"
              type="text"
              placeholder="Value"
              aria-label="Condition value"
              @input="updateClause(clause.id, 'value', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <div class="datagrid-advanced-filter__row-actions">
            <button
              type="button"
              class="datagrid-advanced-filter__ghost datagrid-advanced-filter__ghost--danger"
              :disabled="clauses.length <= 1"
              @click="emit('remove', clause.id)"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <footer class="datagrid-advanced-filter__footer">
        <button type="button" class="datagrid-advanced-filter__secondary" @click="emit('add')">
          Add clause
        </button>
        <div class="datagrid-advanced-filter__footer-actions">
          <button type="button" class="datagrid-advanced-filter__secondary" @click="emit('cancel')">
            Cancel
          </button>
          <button type="button" class="datagrid-advanced-filter__primary" @click="emit('apply')">
            Apply
          </button>
        </div>
      </footer>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue"
import {
  useFloatingPopover,
  usePopoverController,
} from "@affino/popover-vue"
import type {
  DataGridAppAdvancedFilterClauseDraft,
  DataGridAppAdvancedFilterClausePatch,
  DataGridAppAdvancedFilterColumnOption,
} from "@affino/datagrid-vue/app"
import DataGridFilterableCombobox from "./DataGridFilterableCombobox.vue"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import type { DataGridFilterableComboboxOption } from "./dataGridFilterableCombobox"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"

const JOIN_OPTIONS: readonly DataGridFilterableComboboxOption[] = Object.freeze([
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
])

const OPERATOR_OPTIONS: readonly DataGridFilterableComboboxOption[] = Object.freeze([
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "not-equals", label: "Not equals" },
  { value: "starts-with", label: "Starts with" },
  { value: "ends-with", label: "Ends with" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
])

const props = withDefaults(defineProps<{
  isOpen: boolean
  clauses: readonly DataGridAppAdvancedFilterClauseDraft[]
  columns: readonly DataGridAppAdvancedFilterColumnOption[]
  appliedFilterSummaryItems?: readonly string[]
  hasAnyFilters?: boolean
  buttonLabel?: string
  active?: boolean
}>(), {
  appliedFilterSummaryItems: () => [],
  hasAnyFilters: false,
  buttonLabel: "Advanced filter",
  active: false,
})

const emit = defineEmits<{
  open: []
  add: []
  remove: [clauseId: number]
  apply: []
  cancel: []
  "reset-all": []
  "update-clause": [payload: DataGridAppAdvancedFilterClausePatch]
}>()

const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const overlayThemeVars = ref<Record<string, string>>({})

const controller = usePopoverController(
  {
    id: "advanced-filter",
    role: "dialog",
    closeOnEscape: true,
    closeOnInteractOutside: true,
  },
  {
    onOpen: () => {
      if (!props.isOpen) {
        emit("open")
      }
      syncOverlayThemeVars()
    },
    onClose: () => {
      if (props.isOpen) {
        emit("cancel")
      }
    },
  },
)

const floating = useFloatingPopover(controller, {
  placement: "bottom",
  align: "start",
  gutter: 10,
  viewportPadding: 12,
  zIndex: 180,
  lockScroll: false,
  returnFocus: true,
})

const triggerProps = computed(() => controller.getTriggerProps({ role: "dialog" }))
const contentProps = computed(() => controller.getContentProps({ role: "dialog", tabIndex: -1 }))
const popoverOpen = computed(() => controller.state.value.open)
const popoverContentStyle = computed(() => floating.contentStyle.value)
const popoverTeleportTarget = computed(() => floating.teleportTarget.value)
const columnOptions = computed<readonly DataGridFilterableComboboxOption[]>(() => {
  return props.columns.map(column => ({
    value: column.key,
    label: column.label,
  }))
})

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      syncOverlayThemeVars()
      if (!controller.state.value.open) {
        controller.open("programmatic")
      }
      await nextTick()
      const firstField = floating.contentRef.value?.querySelector<HTMLElement>('[data-advanced-filter-autofocus="true"]')
      firstField?.focus({ preventScroll: true })
      await floating.updatePosition()
      return
    }
    if (controller.state.value.open) {
      controller.close("programmatic")
    }
  },
  { immediate: true },
)

watch(rootElementRef, () => {
  if (controller.state.value.open) {
    syncOverlayThemeVars()
  }
})

watch(
  () => props.clauses.length,
  async () => {
    if (!controller.state.value.open) {
      return
    }
    await nextTick()
    await floating.updatePosition()
  },
)

function syncOverlayThemeVars(): void {
  overlayThemeVars.value = readDataGridOverlayThemeVars(rootElementRef.value)
}

function updateClause(
  clauseId: number,
  field: DataGridAppAdvancedFilterClausePatch["field"],
  value: string,
): void {
  emit("update-clause", { clauseId, field, value })
}
</script>
