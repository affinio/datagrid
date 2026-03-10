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
      class="datagrid-diagnostics"
      :style="[popoverContentStyle, overlayThemeVars]"
      v-bind="contentProps"
    >
      <header class="datagrid-diagnostics__header">
        <div>
          <div class="datagrid-diagnostics__eyebrow">Diagnostics</div>
          <h3 class="datagrid-diagnostics__title">Runtime snapshot</h3>
        </div>
        <div class="datagrid-diagnostics__actions">
          <button type="button" class="datagrid-diagnostics__secondary" @click="emit('refresh')">
            Refresh
          </button>
          <button type="button" class="datagrid-diagnostics__ghost" @click="emit('close')">
            Close
          </button>
        </div>
      </header>

      <pre class="datagrid-diagnostics__snapshot">{{ formattedSnapshot }}</pre>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue"
import {
  useFloatingPopover,
  usePopoverController,
} from "@affino/popover-vue"
import { dataGridAppRootElementKey } from "./dataGridAppContext"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"

const props = withDefaults(defineProps<{
  isOpen: boolean
  snapshot: unknown | null
  buttonLabel?: string
  active?: boolean
}>(), {
  buttonLabel: "Diagnostics",
  active: false,
})

const emit = defineEmits<{
  open: []
  close: []
  refresh: []
}>()

const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const overlayThemeVars = ref<Record<string, string>>({})

const controller = usePopoverController(
  {
    id: "diagnostics",
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
        emit("close")
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
const formattedSnapshot = computed(() => {
  if (!props.snapshot) {
    return "No diagnostics snapshot"
  }
  return JSON.stringify(props.snapshot, null, 2)
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
  () => formattedSnapshot.value,
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
</script>
