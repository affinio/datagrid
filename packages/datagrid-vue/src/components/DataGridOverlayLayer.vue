<template>
  <div ref="overlayRef" class="ui-table__overlay-layer">
    <div ref="viewportRef" class="ui-table__overlay-viewport">
      <slot />

      <div ref="selectionGroupRef"></div>
      <div ref="activeSelectionGroupRef"></div>
      <div ref="fillPreviewGroupRef"></div>
      <div ref="cutPreviewGroupRef"></div>

      <div ref="cursorRef"
           class="ui-table__overlay-rect ui-table__overlay-selection-cursor"></div>

      <div ref="fillHandleRef"
           class="ui-table__fill-handle ui-table__overlay-interactive"
           @mousedown.prevent.stop="handleFillDrag"
           @dblclick.prevent.stop="handleAutoFill">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"
import type {
  UiTableOverlayHandle,
  UiTableOverlayRectGroups,
  UiTableOverlayTransformInput,
} from "../types/overlay"
import type { FillHandleStylePayload } from "@affino/datagrid-core/selection/fillHandleStylePool"
import {
  computeCursorSignature,
  computeRectGroupSignature,
  createOverlayNodeCache,
  renderOverlayRectGroup,
  type OverlayRectLike,
} from "./overlayRenderer"

const props = defineProps<{
  startFillDrag?: (e: MouseEvent) => void
  autoFillDown?: (e: MouseEvent) => void
}>()

/* DOM refs */
const overlayRef = ref<HTMLDivElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)

const selectionGroupRef = ref<HTMLDivElement | null>(null)
const activeSelectionGroupRef = ref<HTMLDivElement | null>(null)
const fillPreviewGroupRef = ref<HTMLDivElement | null>(null)
const cutPreviewGroupRef = ref<HTMLDivElement | null>(null)
const cursorRef = ref<HTMLDivElement | null>(null)
const fillHandleRef = ref<HTMLDivElement | null>(null)

/* Latest data */
let latestRects: UiTableOverlayRectGroups | null = null
let latestTransform: UiTableOverlayTransformInput | null = null
let latestFillStyle: FillHandleStylePayload | null = null

/* Dirty flags */
let dirtySelection = false
let dirtyActiveSelection = false
let dirtyFillPreview = false
let dirtyCutPreview = false
let dirtyCursor = false
let dirtyTransform = false
let dirtyFill = false

let rafId: number | null = null

const selectionCache = createOverlayNodeCache()
const activeSelectionCache = createOverlayNodeCache()
const fillPreviewCache = createOverlayNodeCache()
const cutPreviewCache = createOverlayNodeCache()

let selectionSignature = "0:0"
let activeSelectionSignature = "0:0"
let fillPreviewSignature = "0:0"
let cutPreviewSignature = "0:0"
let cursorSignature = "0:0"
let transformSignature = "0:0"

/* Utils */
function translate3d(x: number, y: number) {
  return `translate3d(${x}px, ${y}px, 0)`
}

function scheduleFlush() {
  if (rafId != null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    flush()
  })
}

/* --- Rendering --- */

function applyViewportTransform(transform: UiTableOverlayTransformInput | null) {
  const vp = viewportRef.value
  if (!vp || !transform) return

  vp.style.width = `${transform.viewportWidth}px`
  vp.style.height = `${transform.viewportHeight}px`
  // Scroll transform is owned by viewport sync (core). Overlay viewport only tracks size.
}

function applyCursor(rects: UiTableOverlayRectGroups | null, transform: UiTableOverlayTransformInput | null) {
  const cursor = cursorRef.value
  if (cursor) {
    const rect = rects?.cursor
    if (!rect) {
      cursor.style.visibility = "hidden"
    } else {
      cursor.style.visibility = "visible"
      const leftOffset = transform?.pinnedLeftTranslateX ?? 0
      const rightOffset = transform?.pinnedRightTranslateX ?? 0
      let x = rect.left
      if (rect.pin === "left") x += leftOffset
      if (rect.pin === "right") x += rightOffset
      cursor.style.transform = translate3d(x, rect.top)
      cursor.style.width = `${rect.width}px`
      cursor.style.height = `${rect.height}px`
    }
  }
}

function applyFillHandle(style: FillHandleStylePayload | null) {
  const el = fillHandleRef.value
  if (!el) return

  if (!style) {
    el.style.visibility = "hidden"
    return
  }

  el.style.visibility = "visible"
  el.style.transform = translate3d(style.x, style.y)
  el.style.width = `${style.widthValue}px`
  el.style.height = `${style.heightValue}px`
}

function flush() {
  if (dirtyTransform) {
    applyViewportTransform(latestTransform)
  }

  if (dirtySelection || dirtyTransform) {
    renderOverlayRectGroup({
      target: selectionGroupRef.value,
      rects: latestRects?.selection as readonly OverlayRectLike[] | undefined,
      transform: latestTransform,
      cache: selectionCache,
    })
  }

  if (dirtyActiveSelection || dirtyTransform) {
    renderOverlayRectGroup({
      target: activeSelectionGroupRef.value,
      rects: latestRects?.activeSelection as readonly OverlayRectLike[] | undefined,
      transform: latestTransform,
      cache: activeSelectionCache,
    })
  }

  if (dirtyFillPreview || dirtyTransform) {
    renderOverlayRectGroup({
      target: fillPreviewGroupRef.value,
      rects: latestRects?.fillPreview as readonly OverlayRectLike[] | undefined,
      transform: latestTransform,
      cache: fillPreviewCache,
    })
  }

  if (dirtyCutPreview || dirtyTransform) {
    renderOverlayRectGroup({
      target: cutPreviewGroupRef.value,
      rects: latestRects?.cutPreview as readonly OverlayRectLike[] | undefined,
      transform: latestTransform,
      cache: cutPreviewCache,
    })
  }

  if (dirtyCursor || dirtyTransform) {
    applyCursor(latestRects, latestTransform)
  }

  if (dirtyFill) {
    applyFillHandle(latestFillStyle)
  }

  dirtySelection = false
  dirtyActiveSelection = false
  dirtyFillPreview = false
  dirtyCutPreview = false
  dirtyCursor = false
  dirtyTransform = false
  dirtyFill = false
}

/* --- Exposed API for adapter --- */

function updateRects(payload: UiTableOverlayRectGroups) {
  const nextSelectionSignature = computeRectGroupSignature(payload.selection as readonly OverlayRectLike[] | undefined)
  const nextActiveSelectionSignature = computeRectGroupSignature(
    payload.activeSelection as readonly OverlayRectLike[] | undefined,
  )
  const nextFillPreviewSignature = computeRectGroupSignature(payload.fillPreview as readonly OverlayRectLike[] | undefined)
  const nextCutPreviewSignature = computeRectGroupSignature(payload.cutPreview as readonly OverlayRectLike[] | undefined)
  const nextCursorSignature = computeCursorSignature(payload.cursor as OverlayRectLike | null | undefined)

  if (nextSelectionSignature !== selectionSignature) {
    selectionSignature = nextSelectionSignature
    dirtySelection = true
  }
  if (nextActiveSelectionSignature !== activeSelectionSignature) {
    activeSelectionSignature = nextActiveSelectionSignature
    dirtyActiveSelection = true
  }
  if (nextFillPreviewSignature !== fillPreviewSignature) {
    fillPreviewSignature = nextFillPreviewSignature
    dirtyFillPreview = true
  }
  if (nextCutPreviewSignature !== cutPreviewSignature) {
    cutPreviewSignature = nextCutPreviewSignature
    dirtyCutPreview = true
  }
  if (nextCursorSignature !== cursorSignature) {
    cursorSignature = nextCursorSignature
    dirtyCursor = true
  }

  latestRects = payload
  if (dirtySelection || dirtyActiveSelection || dirtyFillPreview || dirtyCutPreview || dirtyCursor) {
    scheduleFlush()
  }
}

function updateTransforms(snapshot: UiTableOverlayTransformInput) {
  const nextTransformSignature = [
    snapshot.viewportWidth,
    snapshot.viewportHeight,
    snapshot.pinnedLeftTranslateX,
    snapshot.pinnedRightTranslateX,
  ].join("|")
  if (nextTransformSignature === transformSignature) {
    return
  }
  transformSignature = nextTransformSignature
  latestTransform = snapshot
  dirtyTransform = true
  dirtyCursor = true
  scheduleFlush()
}

function updateFillHandleStyle(style: FillHandleStylePayload | null) {
  latestFillStyle = style
  dirtyFill = true
  scheduleFlush()
}

function handleFillDrag(e: MouseEvent) {
  props.startFillDrag?.(e)
}

function handleAutoFill(e: MouseEvent) {
  props.autoFillDown?.(e)
}

/* Expose */
const api: UiTableOverlayHandle = {
  overlayRef: overlayRef.value,
  viewportRef: viewportRef.value,
  updateRects,
  updateTransforms,
  updateFillHandleStyle,
}

defineExpose(api)

/* Lifecycle */
onMounted(() => scheduleFlush())
onBeforeUnmount(() => {
  if (rafId != null) cancelAnimationFrame(rafId)
})
</script>
