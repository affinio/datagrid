<template>
  <div class="ui-table__viewport-wrapper" :class="viewportWrapperClass">
    <div v-if="debugActive && debugMetrics" class="ui-table__virtual-debug-layer">
      <UiVirtualDebugPanel :metrics="debugMetrics" />
    </div>
    <div ref="layoutRef" class="ui-table__layout">
      <div class="ui-table__layout-scroll">
        <div
          ref="splitViewportRef"
          class="ui-table__viewport ui-table__container ui-table__scroll-container scroll-container"
          :class="tableContainerClass"
          data-testid="table-container"
          role="grid"
          :aria-rowcount="ariaRowCount"
          :aria-colcount="ariaColCount"
          aria-multiselectable="true"
          tabindex="0"
          @focusin="onGridFocusIn"
          @focusout="onGridFocusOut"
          @keydown="handleKeydown"
          @wheel.passive.stop="handleWheel"
          @scroll="handleBodyScroll"
        >
          <div ref="backgroundSpacerRef" class="ui-table__background-spacer background-spacer" />
          <div
            ref="viewportContentRef"
            class="ui-table__viewport-content ui-table__content-viewport content-viewport"
          >
            <div ref="colsLayerRef" class="ui-table__header-layer cols-layer">
              <div ref="headerLayerRef" class="ui-table__header-layout">
                <div class="ui-table__header-section ui-table__header-section--pinned-left">
                  <div
                    ref="headerPinnedLeftRef"
                    class="ui-table__header-pinned-left ui-table__header-surface ui-table__header-surface--pinned-left"
                  >
                    <div
                      ref="headerPinnedLeftContentRef"
                      class="ui-table__header-pinned-left-content ui-table__header-surface-content"
                    >
                      <slot name="header-pinned-left" />
                    </div>
                  </div>
                </div>\n                <div class="ui-table__header-section ui-table__header-section--main">
                  <div
                    ref="headerMainRef"
                    class="ui-table__header-main ui-table__header-surface ui-table__header-surface--main"
                  >
                    <div
                      ref="headerMainContentRef"
                      class="ui-table__header-main-content ui-table__header-surface-content"
                    >
                      <slot name="header-main" />
                    </div>
                  </div>
                </div>
                <div class="ui-table__header-section ui-table__header-section--pinned-right">
                  <div
                    ref="headerPinnedRightRef"
                    class="ui-table__header-pinned-right ui-table__header-surface ui-table__header-surface--pinned-right"
                  >
                    <div
                      ref="headerPinnedRightContentRef"
                      class="ui-table__header-pinned-right-content ui-table__header-surface-content"
                    >
                      <slot name="header-pinned-right" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              ref="rowsLayerRef"
              class="ui-table__rows-layer rows-layer"
              :style="rowsLayerInlineStyle"
            >
              <div ref="bodyLayerRef" class="ui-table__body-layer">
                <div class="ui-table__body-section ui-table__body-section--pinned-left">
                  <div
                    ref="pinnedLeftRef"
                    class="ui-table__pinned-left ui-table__body-surface ui-table__body-surface--pinned-left"
                    @focusin="onGridFocusIn"
                    @focusout="onGridFocusOut"
                    @keydown="handleKeydown"
                    @wheel.passive.stop="handleWheel"
                  >
                    <div
                      ref="pinnedLeftContentRef"
                      class="ui-table__pinned-left-content ui-table__body-surface-content"
                    >
                      <slot name="body-pinned-left" />
                    </div>
                  </div>
                </div>
                <div class="ui-table__body-section ui-table__body-section--main">
                  <div
                    ref="bodyMainSurfaceRef"
                    class="ui-table__body-surface ui-table__body-surface--main"
                  >
                    <div
                      ref="bodyMainContentRef"
                      class="ui-table__body-main-content ui-table__body-surface-content"
                    >
                      <slot name="body-main" />
                    </div>
                  </div>
                </div>
                <div class="ui-table__body-section ui-table__body-section--pinned-right">
                  <div
                    ref="pinnedRightRef"
                    class="ui-table__pinned-right ui-table__body-surface ui-table__body-surface--pinned-right"
                    @focusin="onGridFocusIn"
                    @focusout="onGridFocusOut"
                    @keydown="handleKeydown"
                    @wheel.passive.stop="handleWheel"
                  >
                    <div
                      ref="pinnedRightContentRef"
                      class="ui-table__pinned-right-content ui-table__body-surface-content"
                    >
                      <slot name="body-pinned-right" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DataGridOverlayLayer
        ref="overlayComponentRef"
        :start-fill-drag="startFillDrag"
        :auto-fill-down="autoFillDown"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect, onBeforeUnmount, watch, toRef } from "vue"
import UiVirtualDebugPanel from "./UiVirtualDebugPanel.vue"
import DataGridOverlayLayer from "./DataGridOverlayLayer.vue"
import type { VirtualDebugMetrics } from "../composables/useVirtualDebug"
import type { UiTableExposeBindings } from "../context"
import type { UiTableOverlayHandle } from "../types/overlay"
import type { ViewportSyncTargets } from "@affino/datagrid-core/viewport/tableViewportTypes"
import { createWheelAccumulator } from "../utils/createWheelAccumulator"

const props = defineProps<{
  viewportWrapperClass?: string | string[] | Record<string, boolean>
  tableContainerClass?: string | string[] | Record<string, boolean>
  ariaRowCount: number
  ariaColCount: number
  containerRef: HTMLDivElement | null
  exposedApi?: UiTableExposeBindings
  debugActive?: boolean
  debugMetrics?: VirtualDebugMetrics | null
  startFillDrag?: (event: MouseEvent) => void
  autoFillDown?: (event: MouseEvent) => void
}>()

const viewportWrapperClass = toRef(props, "viewportWrapperClass")
const tableContainerClass = toRef(props, "tableContainerClass")
const ariaRowCount = toRef(props, "ariaRowCount")
const ariaColCount = toRef(props, "ariaColCount")
const externalContainerRef = toRef(props, "containerRef")
const debugActive = toRef(props, "debugActive")
const debugMetrics = toRef(props, "debugMetrics")
const startFillDrag = toRef(props, "startFillDrag")
const autoFillDown = toRef(props, "autoFillDown")

const emit = defineEmits<{
  (event: "focus-in", payload: FocusEvent): void
  (event: "focus-out", payload: FocusEvent): void
  (event: "keydown", payload: KeyboardEvent): void
  (event: "wheel", payload: WheelEvent): void
  (event: "scroll", payload: Event): void
  (event: "update:containerRef", payload: HTMLDivElement | null): void
  (event: "update:syncTargets", payload: ViewportSyncTargets): void
}>()

const splitViewportRef = ref<HTMLDivElement | null>(null)
const layoutRef = ref<HTMLDivElement | null>(null)
const headerLayerRef = ref<HTMLDivElement | null>(null)
const headerPinnedLeftRef = ref<HTMLDivElement | null>(null)
const headerPinnedRightRef = ref<HTMLDivElement | null>(null)
const headerMainRef = ref<HTMLDivElement | null>(null)
const headerPinnedLeftContentRef = ref<HTMLDivElement | null>(null)
const headerPinnedRightContentRef = ref<HTMLDivElement | null>(null)
const headerMainContentRef = ref<HTMLDivElement | null>(null)
const pinnedLeftRef = ref<HTMLDivElement | null>(null)
const pinnedRightRef = ref<HTMLDivElement | null>(null)
const pinnedLeftContentRef = ref<HTMLDivElement | null>(null)
const pinnedRightContentRef = ref<HTMLDivElement | null>(null)
const bodyMainSurfaceRef = ref<HTMLDivElement | null>(null)
const bodyMainContentRef = ref<HTMLDivElement | null>(null)
const bodyLayerRef = ref<HTMLDivElement | null>(null)
const backgroundSpacerRef = ref<HTMLDivElement | null>(null)
const colsLayerRef = ref<HTMLDivElement | null>(null)
const rowsLayerRef = ref<HTMLDivElement | null>(null)
const viewportContentRef = ref<HTMLDivElement | null>(null)
const overlayComponentRef = ref<UiTableOverlayHandle | null>(null)

const rowsLayerInlineStyle = computed(() => ({
  height: "var(--ui-table-total-height, 0px)",
}))

type ViewportExpose = {
  clampScrollTopValue?: (value: number) => number
}

const overlayLayerRef = computed<HTMLDivElement | null>(() => overlayComponentRef.value?.overlayRef ?? null)
const exposedViewport = computed<ViewportExpose | null>(() => {
  const api = props.exposedApi as { viewport?: ViewportExpose } | undefined
  return api?.viewport ?? null
})
const clampViewportScrollTop = computed(() => exposedViewport.value?.clampScrollTopValue ?? null)

const wheelAccumulator = createWheelAccumulator({
  requestFrame:
    typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : undefined,
  cancelFrame:
    typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function"
      ? window.cancelAnimationFrame.bind(window)
      : undefined,
  apply: ({ deltaX, deltaY }) => {
    const viewport = splitViewportRef.value
    if (!viewport || (deltaX === 0 && deltaY === 0)) {
      return
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)

    const nextScrollLeft = viewport.scrollLeft + deltaX
    const nextScrollTop = viewport.scrollTop + deltaY

    const clampScrollTop = clampViewportScrollTop.value
    const clampedScrollTop = clampScrollTop
      ? clampScrollTop(nextScrollTop)
      : Math.max(0, Math.min(maxScrollTop, nextScrollTop))
    const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft))

    if (clampedScrollLeft !== viewport.scrollLeft) {
      viewport.scrollLeft = clampedScrollLeft
    }
    if (clampedScrollTop !== viewport.scrollTop) {
      viewport.scrollTop = clampedScrollTop
    }
  },
})

const syncTargets = computed<ViewportSyncTargets>(() => ({
  scrollHost: splitViewportRef.value,
  mainViewport: bodyMainSurfaceRef.value,
  layoutRoot: layoutRef.value,
  bodyLayer: bodyMainContentRef.value,
  headerLayer: headerMainContentRef.value ?? headerLayerRef.value,
  pinnedLeftLayer: pinnedLeftContentRef.value ?? pinnedLeftRef.value,
  pinnedRightLayer: pinnedRightContentRef.value ?? pinnedRightRef.value,
  overlayRoot: overlayLayerRef.value,
}))

watch(
  syncTargets,
  value => {
    emit("update:syncTargets", value)
  },
  { immediate: true },
)

const activeContainerRef = computed<HTMLDivElement | null>(() => splitViewportRef.value)

watchEffect(() => {
  emit("update:containerRef", activeContainerRef.value)
})

watch(
  () => externalContainerRef.value,
  container => {
    if (container !== splitViewportRef.value) {
      splitViewportRef.value = container
    }
  },
)

onBeforeUnmount(() => {
  emit("update:containerRef", null)
  wheelAccumulator.cancel()
})

function onGridFocusIn(event: FocusEvent) {
  emit("focus-in", event)
}

function onGridFocusOut(event: FocusEvent) {
  emit("focus-out", event)
}

function handleKeydown(event: KeyboardEvent) {
  emit("keydown", event)
}

function handleWheel(event: WheelEvent) {
  emit("wheel", event)

  const viewport = splitViewportRef.value
  if (!viewport) {
    return
  }

  if (event.ctrlKey || event.metaKey) {
    return
  }

  const currentTarget = event.currentTarget as HTMLElement | null
  if (!currentTarget || currentTarget === viewport) {
    return
  }

  const scaleDelta = (delta: number) => {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return delta * 16
    }
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return delta * viewport.clientHeight
    }
    return delta
  }

  let deltaX = 0
  let deltaY = 0

  if (event.shiftKey) {
    if (event.deltaY !== 0) {
      deltaX += scaleDelta(event.deltaY)
    }
    if (event.deltaX !== 0) {
      deltaX += scaleDelta(event.deltaX)
    }
  } else {
    if (event.deltaY !== 0) {
      deltaY += scaleDelta(event.deltaY)
    }

    if (event.deltaX !== 0) {
      deltaX += scaleDelta(event.deltaX)
    }
  }

  if (deltaX !== 0 || deltaY !== 0) {
    wheelAccumulator.queue(deltaX, deltaY)
  }
}

function handleBodyScroll(event: Event) {
  emit("scroll", event)
}

defineExpose({
  containerRef: activeContainerRef,
  headerPinnedLeftRef,
  headerLayerRef,
  headerPinnedRightRef,
  headerMainRef,
  headerMainContentRef,
  headerPinnedLeftContentRef,
  headerPinnedRightContentRef,
  pinnedLeftRef,
  pinnedRightRef,
  pinnedLeftContentRef,
  pinnedRightContentRef,
  bodyMainSurfaceRef,
  bodyMainContentRef,
  splitViewportRef,
  layoutRef,
  bodyLayerRef,
  backgroundSpacerRef,
  colsLayerRef,
  rowsLayerRef,
  viewportContentRef,
  overlayRef: overlayLayerRef,
  overlayComponentRef,
  ...(props.exposedApi ?? {}),
})
</script>
