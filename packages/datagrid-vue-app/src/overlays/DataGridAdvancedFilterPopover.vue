<template>
  <button
    :ref="floating.triggerRef"
    type="button"
    class="datagrid-app-toolbar__button"
    :class="{ 'datagrid-app-toolbar__button--active': active }"
    data-datagrid-toolbar-action="advanced-filter"
    :data-datagrid-advanced-filter-active="showActiveIcon ? 'true' : 'false'"
    :style="overlayThemeVars"
    v-bind="triggerProps"
  >
    <span
      v-if="showActiveIcon"
      class="datagrid-app-toolbar__button-icon datagrid-app-toolbar__button-icon--advanced-filter"
      data-datagrid-advanced-filter-icon="true"
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="M2 3.5h12l-4.6 5.2v3.2l-2.8 1.6V8.7L2 3.5Z" fill="currentColor" />
      </svg>
    </span>
    {{ resolvedButtonLabel }}
  </button>

  <Teleport :to="popoverTeleportTarget">
    <section
      v-if="popoverOpen"
      :ref="floating.contentRef"
      class="datagrid-advanced-filter"
      data-datagrid-overlay-surface="true"
      data-datagrid-overlay-surface-id="advanced-filter"
      :data-datagrid-overlay-dragging="draggable.dragging.value ? 'true' : 'false'"
      :style="[draggable.surfaceStyle.value, overlayThemeVars]"
      v-bind="contentProps"
    >
      <header class="datagrid-advanced-filter__header">
        <div
          class="datagrid-overlay-drag-handle"
          data-datagrid-overlay-drag-handle="true"
          @pointerdown="draggable.handlePointerDown"
        >
          <div class="datagrid-advanced-filter__eyebrow">{{ resolvedLabels.eyebrow }}</div>
          <h3 class="datagrid-advanced-filter__title">{{ resolvedLabels.title }}</h3>
        </div>
        <button type="button" class="datagrid-advanced-filter__ghost" @click="emit('cancel')">
          {{ resolvedLabels.close }}
        </button>
      </header>

      <section class="datagrid-advanced-filter__applied">
        <div class="datagrid-advanced-filter__applied-head">
          <div>
            <div class="datagrid-advanced-filter__eyebrow">{{ resolvedLabels.appliedEyebrow }}</div>
            <div class="datagrid-advanced-filter__applied-title">{{ resolvedLabels.appliedTitle }}</div>
          </div>
          <button
            type="button"
            class="datagrid-advanced-filter__ghost"
            :disabled="!hasAnyFilters"
            data-datagrid-advanced-filter-action="reset-all"
            @click="emit('reset-all')"
          >
            {{ resolvedLabels.resetAllFilters }}
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
          {{ resolvedLabels.noFiltersApplied }}
        </div>
      </section>

      <div class="datagrid-advanced-filter__rows">
        <div
          v-for="(clause, clauseIndex) in clauses"
          :key="clause.id"
          class="datagrid-advanced-filter__row"
        >
          <label class="datagrid-advanced-filter__field datagrid-advanced-filter__field--join">
            <span class="datagrid-advanced-filter__label">{{ resolvedLabels.joinLabel }}</span>
            <DataGridFilterableCombobox
              class="datagrid-advanced-filter__select"
              :value="clause.join"
              :options="joinOptions"
              :open-on-mount="false"
              :open-on-focus="false"
              sticky-popover-id="advanced-filter"
              :disabled="clauseIndex === 0"
              :aria-label="resolvedLabels.joinAriaLabel"
              @commit="updateClause(clause.id, 'join', $event)"
            />
          </label>

          <label class="datagrid-advanced-filter__field">
            <span class="datagrid-advanced-filter__label">{{ resolvedLabels.columnLabel }}</span>
            <DataGridFilterableCombobox
              class="datagrid-advanced-filter__select"
              :value="clause.columnKey"
              :options="columnOptions"
              :open-on-mount="false"
              :open-on-focus="false"
              sticky-popover-id="advanced-filter"
              :data-advanced-filter-autofocus="clauseIndex === 0 ? 'true' : null"
              :aria-label="resolvedLabels.columnAriaLabel"
              @commit="updateClause(clause.id, 'columnKey', $event)"
            />
          </label>

          <label class="datagrid-advanced-filter__field">
            <span class="datagrid-advanced-filter__label">{{ resolvedLabels.operatorLabel }}</span>
            <DataGridFilterableCombobox
              class="datagrid-advanced-filter__select"
              :value="clause.operator"
              :options="operatorOptions"
              :open-on-mount="false"
              :open-on-focus="false"
              sticky-popover-id="advanced-filter"
              :aria-label="resolvedLabels.operatorAriaLabel"
              @commit="updateClause(clause.id, 'operator', $event)"
            />
          </label>

          <label class="datagrid-advanced-filter__field datagrid-advanced-filter__field--value">
            <span class="datagrid-advanced-filter__label">{{ resolvedLabels.valueLabel }}</span>
            <input
              :name="`datagrid-advanced-filter-value-${clause.id}`"
              :value="clause.value"
              type="text"
              :placeholder="resolvedLabels.valuePlaceholder"
              :aria-label="resolvedLabels.valueAriaLabel"
              @input="updateClause(clause.id, 'value', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <div class="datagrid-advanced-filter__row-actions">
            <button
              type="button"
              class="datagrid-advanced-filter__ghost datagrid-advanced-filter__ghost--danger"
              @click="emit('remove', clause.id)"
            >
              {{ clauses.length <= 1 ? resolvedLabels.clearClause : resolvedLabels.removeClause }}
            </button>
          </div>
        </div>
      </div>

      <footer class="datagrid-advanced-filter__footer">
        <button type="button" class="datagrid-advanced-filter__secondary" @click="emit('add')">
          {{ resolvedLabels.addClause }}
        </button>
        <div class="datagrid-advanced-filter__footer-actions">
          <button type="button" class="datagrid-advanced-filter__secondary" @click="emit('cancel')">
            {{ resolvedLabels.cancel }}
          </button>
          <button type="button" class="datagrid-advanced-filter__primary" @click="emit('apply')">
            {{ resolvedLabels.apply }}
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
import {
  DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS,
  type DataGridResolvedAdvancedFilterLabels,
} from "../config/dataGridAdvancedFilter"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"
import { useDataGridDraggableOverlaySurface } from "./useDataGridDraggableOverlaySurface"

const props = withDefaults(defineProps<{
  isOpen: boolean
  clauses: readonly DataGridAppAdvancedFilterClauseDraft[]
  columns: readonly DataGridAppAdvancedFilterColumnOption[]
  appliedFilterSummaryItems?: readonly string[]
  hasAnyFilters?: boolean
  buttonLabel?: string
  labels?: DataGridResolvedAdvancedFilterLabels
  active?: boolean
  showActiveIcon?: boolean
}>(), {
  appliedFilterSummaryItems: () => [],
  hasAnyFilters: false,
  labels: () => DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS,
  active: false,
  showActiveIcon: false,
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
const draggable = useDataGridDraggableOverlaySurface({
  surfaceId: "advanced-filter",
  rootElementRef,
  floating,
})

const triggerProps = computed(() => controller.getTriggerProps({ role: "dialog" }))
const contentProps = computed(() => controller.getContentProps({ role: "dialog", tabIndex: -1 }))
const popoverOpen = computed(() => controller.state.value.open)
const popoverTeleportTarget = computed(() => floating.teleportTarget.value)
const resolvedLabels = computed(() => props.labels ?? DEFAULT_DATAGRID_ADVANCED_FILTER_LABELS)
const resolvedButtonLabel = computed(() => {
  return typeof props.buttonLabel === "string" && props.buttonLabel.trim().length > 0
    ? props.buttonLabel.trim()
    : resolvedLabels.value.buttonLabel
})
const joinOptions = computed<readonly DataGridFilterableComboboxOption[]>(() => Object.freeze([
  { value: "and", label: resolvedLabels.value.joins.and },
  { value: "or", label: resolvedLabels.value.joins.or },
]))
const operatorOptions = computed<readonly DataGridFilterableComboboxOption[]>(() => Object.freeze([
  { value: "contains", label: resolvedLabels.value.operators.contains },
  { value: "in", label: resolvedLabels.value.operators.in },
  { value: "equals", label: resolvedLabels.value.operators.equals },
  { value: "not-equals", label: resolvedLabels.value.operators["not-equals"] },
  { value: "starts-with", label: resolvedLabels.value.operators["starts-with"] },
  { value: "ends-with", label: resolvedLabels.value.operators["ends-with"] },
  { value: "gt", label: resolvedLabels.value.operators.gt },
  { value: "gte", label: resolvedLabels.value.operators.gte },
  { value: "lt", label: resolvedLabels.value.operators.lt },
  { value: "lte", label: resolvedLabels.value.operators.lte },
]))
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
