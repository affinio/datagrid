<template>
  <button
    :ref="floating.triggerRef"
    type="button"
    class="datagrid-app-toolbar__button"
    :class="{ 'datagrid-app-toolbar__button--active': active }"
    data-datagrid-toolbar-action="find-replace"
    :style="overlayThemeVars"
    v-bind="triggerProps"
  >
    {{ buttonLabel }}
  </button>

  <Teleport :to="popoverTeleportTarget">
    <section
      v-if="popoverOpen"
      :ref="floating.contentRef"
      class="datagrid-find-replace"
      data-datagrid-overlay-surface="true"
      data-datagrid-overlay-surface-id="find-replace"
      :data-datagrid-overlay-dragging="draggable.dragging.value ? 'true' : 'false'"
      :style="[draggable.surfaceStyle.value, overlayThemeVars]"
      v-bind="contentProps"
    >
      <header class="datagrid-find-replace__header">
        <div
          class="datagrid-overlay-drag-handle"
          data-datagrid-overlay-drag-handle="true"
          @pointerdown="draggable.handlePointerDown"
        >
          <div class="datagrid-find-replace__eyebrow">Find / replace</div>
          <h3 class="datagrid-find-replace__title">Search visible cells and apply batched edits</h3>
        </div>
        <button type="button" class="datagrid-find-replace__ghost" @click="emit('cancel')">
          Close
        </button>
      </header>

      <div class="datagrid-find-replace__grid">
        <label class="datagrid-find-replace__field">
          <span class="datagrid-find-replace__label">Find</span>
          <input
            name="datagrid-find-replace-find"
            data-find-replace-autofocus="true"
            :value="findText"
            type="text"
            placeholder="Search text"
            @input="emit('update-find-text', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="handleFindInputEnter"
          />
        </label>

        <label class="datagrid-find-replace__field">
          <span class="datagrid-find-replace__label">Replace</span>
          <input
            name="datagrid-find-replace-replace"
            :value="replaceText"
            type="text"
            placeholder="Replacement"
            @input="emit('update-replace-text', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <label class="datagrid-find-replace__toggle">
        <input
          name="datagrid-find-replace-match-case"
          :checked="matchCase"
          type="checkbox"
          @change="emit('update-match-case', ($event.target as HTMLInputElement).checked)"
        />
        <span>Match case</span>
      </label>

      <div class="datagrid-find-replace__status" :data-has-message="statusText.length > 0 ? 'true' : 'false'">
        {{ statusText || 'Use Enter for Find next and Shift+Enter for Find previous.' }}
      </div>

      <footer class="datagrid-find-replace__footer">
        <div class="datagrid-find-replace__footer-actions">
          <button
            type="button"
            class="datagrid-find-replace__secondary"
            :disabled="!canFind"
            @click="emit('find-previous')"
          >
            Find previous
          </button>
          <button
            type="button"
            class="datagrid-find-replace__secondary"
            :disabled="!canFind"
            @click="emit('find-next')"
          >
            Find next
          </button>
        </div>
        <div class="datagrid-find-replace__footer-actions">
          <button
            type="button"
            class="datagrid-find-replace__secondary"
            :disabled="!canReplaceCurrent"
            @click="emit('replace-current')"
          >
            Replace
          </button>
          <button
            type="button"
            class="datagrid-find-replace__primary"
            :disabled="!canReplaceAll"
            @click="emit('replace-all')"
          >
            Replace all
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
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"
import { useDataGridDraggableOverlaySurface } from "./useDataGridDraggableOverlaySurface"

const props = withDefaults(defineProps<{
  isOpen: boolean
  findText: string
  replaceText: string
  matchCase: boolean
  statusText?: string
  buttonLabel?: string
  active?: boolean
  canFind?: boolean
  canReplaceCurrent?: boolean
  canReplaceAll?: boolean
}>(), {
  statusText: "",
  buttonLabel: "Find / replace",
  active: false,
  canFind: false,
  canReplaceCurrent: false,
  canReplaceAll: false,
})

const emit = defineEmits<{
  open: []
  cancel: []
  "update-find-text": [value: string]
  "update-replace-text": [value: string]
  "update-match-case": [value: boolean]
  "find-next": []
  "find-previous": []
  "replace-current": []
  "replace-all": []
}>()

const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const overlayThemeVars = ref<Record<string, string>>({})

const controller = usePopoverController(
  {
    id: "find-replace",
    role: "dialog",
    closeOnEscape: true,
    // Excel-style find/replace should stay open while the grid selection moves.
    closeOnInteractOutside: false,
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
  surfaceId: "find-replace",
  rootElementRef,
  floating,
})

const triggerProps = computed(() => controller.getTriggerProps({ role: "dialog" }))
const contentProps = computed(() => controller.getContentProps({ role: "dialog", tabIndex: -1 }))
const popoverOpen = computed(() => controller.state.value.open)
const popoverTeleportTarget = computed(() => floating.teleportTarget.value)

watch(
  () => props.isOpen,
  async open => {
    if (open) {
      syncOverlayThemeVars()
      if (!controller.state.value.open) {
        controller.open("programmatic")
      }
      await nextTick()
      const findField = floating.contentRef.value?.querySelector<HTMLElement>('[data-find-replace-autofocus="true"]')
      findField?.focus({ preventScroll: true })
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
  () => `${props.findText}:${props.replaceText}:${props.statusText}:${props.matchCase ? "1" : "0"}`,
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

function handleFindInputEnter(event: KeyboardEvent): void {
  if (event.shiftKey) {
    emit("find-previous")
    return
  }
  emit("find-next")
}
</script>
