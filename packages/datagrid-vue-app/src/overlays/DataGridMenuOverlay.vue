<template>
  <UiMenu ref="menuRef" :callbacks="menuCallbacks" :options="options">
    <UiMenuTrigger v-if="contextMenuEnabled" as-child trigger="contextmenu">
      <slot
        name="trigger"
        :open="open"
        :toggle-menu-from-element="toggleMenuFromElement"
      />
    </UiMenuTrigger>
    <slot
      v-else
      name="trigger"
      :open="open"
      :toggle-menu-from-element="toggleMenuFromElement"
    />

    <UiMenuContent
      :class-name="contentClassName"
      :align="align"
      :gutter="gutter"
      :style="contentStyle"
      v-bind="contentAttrs"
    >
      <slot
        name="content"
        :open="open"
        :close-menu="closeMenu"
      />
    </UiMenuContent>
  </UiMenu>
</template>

<script setup lang="ts">
import { ref, type CSSProperties } from "vue"
import {
  UiMenu,
  UiMenuContent,
  UiMenuTrigger,
  type MenuCallbacks,
  type MenuOptions,
} from "@affino/menu-vue"
import type {
  DataGridMenuOverlayControllerOpenReason,
  DataGridMenuOverlayOpenReason,
} from "./dataGridMenuOverlay"

type DataGridMenuContentAlign = "start" | "center" | "end"

interface UiMenuRef {
  controller?: {
    open: (reason?: DataGridMenuOverlayControllerOpenReason) => void
    setAnchor: (rect: { x: number; y: number; width: number; height: number } | null) => void
    close: (reason?: DataGridMenuOverlayControllerOpenReason) => void
  }
}

const props = withDefaults(defineProps<{
  contextMenuEnabled?: boolean
  options: MenuOptions
  contentClassName: string
  align?: DataGridMenuContentAlign
  gutter?: number
  contentStyle?: CSSProperties | Record<string, string>
  contentAttrs?: Record<string, string | boolean | number | undefined>
}>(), {
  contextMenuEnabled: false,
  align: "start",
  gutter: 6,
  contentAttrs: () => ({}),
})

const emit = defineEmits<{
  open: []
  close: []
}>()

const menuRef = ref<UiMenuRef | null>(null)
const open = ref(false)

const menuCallbacks: MenuCallbacks = {
  onOpen: () => {
    open.value = true
    emit("open")
  },
  onClose: () => {
    open.value = false
    emit("close")
  },
}

function resolveUiMenuOpenReason(reason?: DataGridMenuOverlayOpenReason): DataGridMenuOverlayControllerOpenReason {
  if (reason === "keyboard") {
    return "keyboard"
  }
  if (reason === "contextmenu") {
    return "pointer"
  }
  return "programmatic"
}

function closeMenu(): void {
  menuRef.value?.controller?.close("programmatic")
}

function openMenuFromElement(element: HTMLElement | null, reason?: DataGridMenuOverlayOpenReason): void {
  if (!element) {
    return
  }
  const controller = menuRef.value?.controller
  if (!controller) {
    return
  }
  const rect = element.getBoundingClientRect()
  controller.setAnchor({
    x: rect.left,
    y: rect.bottom,
    width: rect.width,
    height: 0,
  })
  controller.open(resolveUiMenuOpenReason(reason))
}

function toggleMenuFromElement(element: HTMLElement | null, reason?: DataGridMenuOverlayOpenReason): void {
  if (open.value) {
    closeMenu()
    return
  }
  openMenuFromElement(element, reason)
}

defineExpose({
  closeMenu,
  openMenuFromElement,
  toggleMenuFromElement,
})
</script>
