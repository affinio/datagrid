<template>
  <button
    :ref="floating.triggerRef"
    type="button"
    class="datagrid-app-toolbar__button"
    :class="{ 'datagrid-app-toolbar__button--active': active }"
    data-datagrid-toolbar-action="aggregations"
    v-bind="triggerProps"
    :style="overlayThemeVars"
    :disabled="disabled"
    :title="disabledReason || undefined"
  >
    {{ buttonLabel }}
  </button>

  <Teleport :to="popoverTeleportTarget">
    <section
      v-if="popoverOpen"
      :ref="floating.contentRef"
      class="datagrid-aggregations"
      data-datagrid-overlay-surface="true"
      :style="[popoverContentStyle, overlayThemeVars]"
      v-bind="contentProps"
    >
      <header class="datagrid-aggregations__header">
        <div>
          <div class="datagrid-aggregations__eyebrow">Aggregations</div>
          <h3 class="datagrid-aggregations__title">Group aggregate model</h3>
        </div>
        <button type="button" class="datagrid-aggregations__ghost" @click="emit('cancel')">
          Close
        </button>
      </header>

      <label class="datagrid-aggregations__basis">
        <span class="datagrid-aggregations__label">Basis</span>
        <DataGridFilterableCombobox
          class="datagrid-aggregations__select"
          :value="basis"
          :options="basisOptions"
          :open-on-mount="false"
          :open-on-focus="false"
          sticky-popover-id="aggregations"
          data-aggregations-autofocus="true"
          @commit="emit('update-basis', $event as 'filtered' | 'source')"
        />
      </label>

      <div v-if="items.length > 0" class="datagrid-aggregations__list">
        <div
          v-for="item in items"
          :key="item.key"
          class="datagrid-aggregations__row"
        >
          <label class="datagrid-aggregations__toggle">
            <input
              type="checkbox"
              :checked="item.enabled"
              @change="emit('toggle-column', item.key, ($event.target as HTMLInputElement).checked)"
            />
            <span class="datagrid-aggregations__row-label">{{ item.label }}</span>
          </label>

          <DataGridFilterableCombobox
            class="datagrid-aggregations__op"
            :value="item.op"
            :options="buildAggOpOptions(item.allowedOps)"
            :open-on-mount="false"
            :open-on-focus="false"
            sticky-popover-id="aggregations"
            :disabled="!item.enabled"
            @commit="emit('update-op', item.key, $event)"
          />
        </div>
      </div>

      <div v-else class="datagrid-aggregations__empty">
        No aggregatable columns in the current grid schema.
      </div>

      <footer class="datagrid-aggregations__footer">
        <button type="button" class="datagrid-aggregations__secondary" @click="emit('clear')">
          Clear
        </button>
        <div class="datagrid-aggregations__footer-actions">
          <button type="button" class="datagrid-aggregations__secondary" @click="emit('cancel')">
            Cancel
          </button>
          <button type="button" class="datagrid-aggregations__primary" @click="emit('apply')">
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
import type { DataGridAggOp } from "@affino/datagrid-vue"
import DataGridFilterableCombobox from "./DataGridFilterableCombobox.vue"
import type { DataGridAggregationPanelItem } from "../config/dataGridAggregations"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import type { DataGridFilterableComboboxOption } from "./dataGridFilterableCombobox"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"

const basisOptions: readonly DataGridFilterableComboboxOption[] = Object.freeze([
  { value: "filtered", label: "Filtered rows" },
  { value: "source", label: "Source rows" },
])

const props = withDefaults(defineProps<{
  isOpen: boolean
  basis: "filtered" | "source"
  items: readonly DataGridAggregationPanelItem[]
  buttonLabel?: string
  active?: boolean
  disabled?: boolean
  disabledReason?: string
}>(), {
  buttonLabel: "Aggregations",
  active: false,
  disabled: false,
  disabledReason: "",
})

const emit = defineEmits<{
  open: []
  apply: []
  clear: []
  cancel: []
  "update-basis": [basis: "filtered" | "source"]
  "toggle-column": [key: string, enabled: boolean]
  "update-op": [key: string, op: string]
}>()

const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const overlayThemeVars = ref<Record<string, string>>({})

const controller = usePopoverController(
  {
    id: "aggregations",
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

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      syncOverlayThemeVars()
      if (!controller.state.value.open) {
        controller.open("programmatic")
      }
      await nextTick()
      const firstField = floating.contentRef.value?.querySelector<HTMLElement>('[data-aggregations-autofocus="true"]')
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
  () => `${props.basis}:${props.items.length}`,
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

function formatAggOp(op: DataGridAggOp): string {
  if (op === "countNonNull") {
    return "Count non-null"
  }
  return op.charAt(0).toUpperCase() + op.slice(1)
}

function buildAggOpOptions(ops: readonly DataGridAggOp[]): readonly DataGridFilterableComboboxOption[] {
  return ops.map(op => ({
    value: op,
    label: formatAggOp(op),
  }))
}
</script>
