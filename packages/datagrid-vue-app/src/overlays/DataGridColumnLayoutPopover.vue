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
      class="datagrid-column-layout"
      data-datagrid-overlay-surface="true"
      :style="[popoverContentStyle, overlayThemeVars]"
      v-bind="contentProps"
    >
      <header class="datagrid-column-layout__header">
        <div>
          <div class="datagrid-column-layout__eyebrow">Column layout</div>
          <h3 class="datagrid-column-layout__title">Order and visibility</h3>
        </div>
        <button type="button" class="datagrid-column-layout__ghost" @click="emit('cancel')">
          Close
        </button>
      </header>

      <div class="datagrid-column-layout__list">
        <div
          v-for="item in items"
          :key="item.key"
          class="datagrid-column-layout__row"
        >
          <label class="datagrid-column-layout__visibility">
            <input
              type="checkbox"
              :checked="item.visible"
              @change="emitVisibility(item.key, ($event.target as HTMLInputElement).checked)"
            />
            <span class="datagrid-column-layout__label">{{ item.label }}</span>
          </label>

          <div class="datagrid-column-layout__move-actions">
            <button
              type="button"
              class="datagrid-column-layout__icon-button"
              :disabled="!item.canMoveUp"
              @click="emit('move-up', item.key)"
            >
              ↑
            </button>
            <button
              type="button"
              class="datagrid-column-layout__icon-button"
              :disabled="!item.canMoveDown"
              @click="emit('move-down', item.key)"
            >
              ↓
            </button>
          </div>
        </div>
      </div>

      <footer class="datagrid-column-layout__footer">
        <button type="button" class="datagrid-column-layout__secondary" @click="emit('cancel')">
          Cancel
        </button>
        <button type="button" class="datagrid-column-layout__primary" @click="emit('apply')">
          Apply
        </button>
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
  DataGridAppColumnLayoutPanelItem,
  DataGridAppColumnLayoutVisibilityPatch,
} from "@affino/datagrid-vue/app"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"

const props = withDefaults(defineProps<{
  isOpen: boolean
  items: readonly DataGridAppColumnLayoutPanelItem[]
  buttonLabel?: string
  active?: boolean
}>(), {
  buttonLabel: "Columns",
  active: false,
})

const emit = defineEmits<{
  open: []
  "toggle-visibility": [payload: DataGridAppColumnLayoutVisibilityPatch]
  "move-up": [key: string]
  "move-down": [key: string]
  apply: []
  cancel: []
}>()

const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const overlayThemeVars = ref<Record<string, string>>({})

const controller = usePopoverController(
  {
    id: "column-layout",
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
      const firstField = floating.contentRef.value?.querySelector<HTMLElement>('input[type="checkbox"]')
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
  () => props.items.length,
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

function emitVisibility(key: string, visible: boolean): void {
  emit("toggle-visibility", { key, visible })
}
</script>
