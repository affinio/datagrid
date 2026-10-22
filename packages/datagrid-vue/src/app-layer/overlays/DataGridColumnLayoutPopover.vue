<template>
  <button
    :ref="floating.triggerRef"
    type="button"
    class="datagrid-app-toolbar__button"
    :class="{ 'datagrid-app-toolbar__button--active': active }"
    data-datagrid-toolbar-action="column-layout"
    :style="overlayThemeVars"
    v-bind="triggerProps"
  >
    {{ resolvedButtonLabel }}
  </button>

  <Teleport :to="popoverTeleportTarget">
    <section
      v-if="popoverOpen"
      :ref="floating.contentRef"
      class="datagrid-column-layout"
      data-datagrid-overlay-surface="true"
      data-datagrid-overlay-surface-id="column-layout"
      :data-datagrid-overlay-dragging="draggable.dragging.value ? 'true' : 'false'"
      :style="[draggable.surfaceStyle.value, overlayThemeVars]"
      v-bind="contentProps"
    >
      <header class="datagrid-column-layout__header">
        <div
          class="datagrid-overlay-drag-handle"
          data-datagrid-overlay-drag-handle="true"
          @pointerdown="draggable.handlePointerDown"
        >
          <div class="datagrid-column-layout__eyebrow">{{ resolvedLabels.eyebrow }}</div>
          <h3 class="datagrid-column-layout__title">{{ resolvedLabels.title }}</h3>
        </div>
        <button type="button" class="datagrid-column-layout__ghost" @click="emit('cancel')">
          {{ resolvedLabels.close }}
        </button>
      </header>

      <div class="datagrid-column-layout__list">
        <div
          v-for="item in items"
          :key="item.key"
          class="datagrid-column-layout__row"
          :class="{
            'datagrid-column-layout__row--drag-source': draggedKey === item.key,
            'datagrid-column-layout__row--drop-before': dropTargetKey === item.key && dropPlacement === 'before',
            'datagrid-column-layout__row--drop-after': dropTargetKey === item.key && dropPlacement === 'after',
          }"
          :draggable="true"
          @dragstart="handleDragStart($event, item.key)"
          @dragover="handleDragOver($event, item.key)"
          @drop="handleDrop($event, item.key)"
          @dragend="handleDragEnd"
        >
          <label class="datagrid-column-layout__visibility">
            <span class="datagrid-column-layout__drag-handle" aria-hidden="true">::</span>
            <input
              :name="`datagrid-column-layout-visible-${item.key}`"
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
              :aria-label="`${resolvedLabels.moveUp}: ${item.label}`"
              :title="`${resolvedLabels.moveUp}: ${item.label}`"
              @click="emit('move-up', item.key)"
            >
              ↑
            </button>
            <button
              type="button"
              class="datagrid-column-layout__icon-button"
              :disabled="!item.canMoveDown"
              :aria-label="`${resolvedLabels.moveDown}: ${item.label}`"
              :title="`${resolvedLabels.moveDown}: ${item.label}`"
              @click="emit('move-down', item.key)"
            >
              ↓
            </button>
          </div>
        </div>
      </div>

      <footer class="datagrid-column-layout__footer">
        <button type="button" class="datagrid-column-layout__secondary" @click="emit('cancel')">
          {{ resolvedLabels.cancel }}
        </button>
        <button type="button" class="datagrid-column-layout__primary" @click="emit('apply')">
          {{ resolvedLabels.apply }}
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
import {
  DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS,
  type DataGridResolvedColumnLayoutLabels,
} from "../config/dataGridColumnLayout"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"
import { useDataGridDraggableOverlaySurface } from "./useDataGridDraggableOverlaySurface"

const props = withDefaults(defineProps<{
  isOpen: boolean
  items: readonly DataGridAppColumnLayoutPanelItem[]
  buttonLabel?: string
  labels?: DataGridResolvedColumnLayoutLabels
  active?: boolean
}>(), {
  labels: () => DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS,
  active: false,
})

const emit = defineEmits<{
  open: []
  "toggle-visibility": [payload: DataGridAppColumnLayoutVisibilityPatch]
  "move-up": [key: string]
  "move-down": [key: string]
  "move-to-position": [payload: { key: string; targetKey: string; placement: "before" | "after" }]
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
const draggable = useDataGridDraggableOverlaySurface({
  surfaceId: "column-layout",
  rootElementRef,
  floating,
})

const triggerProps = computed(() => controller.getTriggerProps({ role: "dialog" }))
const contentProps = computed(() => controller.getContentProps({ role: "dialog", tabIndex: -1 }))
const popoverOpen = computed(() => controller.state.value.open)
const popoverTeleportTarget = computed(() => floating.teleportTarget.value)
const resolvedLabels = computed(() => props.labels ?? DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS)
const resolvedButtonLabel = computed(() => {
  return typeof props.buttonLabel === "string" && props.buttonLabel.trim().length > 0
    ? props.buttonLabel.trim()
    : resolvedLabels.value.buttonLabel
})
const draggedKey = ref<string | null>(null)
const dropTargetKey = ref<string | null>(null)
const dropPlacement = ref<"before" | "after" | null>(null)

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

function resolveDropPlacement(event: DragEvent): "before" | "after" {
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const rect = target?.getBoundingClientRect()
  if (!rect || rect.height <= 0) {
    return "after"
  }
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after"
}

function handleDragStart(event: DragEvent, key: string): void {
  draggedKey.value = key
  dropTargetKey.value = null
  dropPlacement.value = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", key)
  }
}

function handleDragOver(event: DragEvent, key: string): void {
  if (!draggedKey.value || draggedKey.value === key) {
    dropTargetKey.value = null
    dropPlacement.value = null
    return
  }
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move"
  }
  dropTargetKey.value = key
  dropPlacement.value = resolveDropPlacement(event)
}

function handleDrop(event: DragEvent, key: string): void {
  if (!draggedKey.value || draggedKey.value === key) {
    handleDragEnd()
    return
  }
  event.preventDefault()
  emit("move-to-position", {
    key: draggedKey.value,
    targetKey: key,
    placement: resolveDropPlacement(event),
  })
  handleDragEnd()
}

function handleDragEnd(): void {
  draggedKey.value = null
  dropTargetKey.value = null
  dropPlacement.value = null
}
</script>
