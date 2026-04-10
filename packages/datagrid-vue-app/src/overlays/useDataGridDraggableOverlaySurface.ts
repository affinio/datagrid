import { computed, ref, type ComputedRef, type Ref } from "vue"
import type { FloatingPopoverBindings } from "@affino/popover-vue"

interface DataGridOverlaySurfacePosition {
  left: number
  top: number
}

export interface UseDataGridDraggableOverlaySurfaceOptions {
  surfaceId: string
  rootElementRef: Ref<HTMLElement | null>
  floating: Pick<FloatingPopoverBindings, "contentRef" | "contentStyle">
}

export interface UseDataGridDraggableOverlaySurfaceResult {
  surfaceStyle: ComputedRef<Record<string, string>>
  dragging: Ref<boolean>
  handlePointerDown: (event: PointerEvent) => void
}

const fallbackPersistedPositions = new Map<string, DataGridOverlaySurfacePosition>()
const persistedPositionsByRoot = new WeakMap<HTMLElement, Map<string, DataGridOverlaySurfacePosition>>()

function clonePosition(
  position: DataGridOverlaySurfacePosition | null | undefined,
): DataGridOverlaySurfacePosition | null {
  if (!position) {
    return null
  }
  return {
    left: position.left,
    top: position.top,
  }
}

function parsePixelValue(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolvePersistedStore(rootElement: HTMLElement | null): Map<string, DataGridOverlaySurfacePosition> {
  if (!rootElement) {
    return fallbackPersistedPositions
  }
  const existing = persistedPositionsByRoot.get(rootElement)
  if (existing) {
    return existing
  }
  const created = new Map<string, DataGridOverlaySurfacePosition>()
  persistedPositionsByRoot.set(rootElement, created)
  return created
}

function readPersistedPosition(
  rootElement: HTMLElement | null,
  surfaceId: string,
): DataGridOverlaySurfacePosition | null {
  return clonePosition(resolvePersistedStore(rootElement).get(surfaceId))
}

function writePersistedPosition(
  rootElement: HTMLElement | null,
  surfaceId: string,
  position: DataGridOverlaySurfacePosition,
): void {
  resolvePersistedStore(rootElement).set(surfaceId, clonePosition(position) ?? position)
}

function clampSurfacePosition(
  position: DataGridOverlaySurfacePosition,
  surfaceElement: HTMLElement | null,
  view: Window | null,
): DataGridOverlaySurfacePosition {
  if (!surfaceElement || !view) {
    return position
  }

  const bounds = surfaceElement.getBoundingClientRect()
  const width = Number.isFinite(bounds.width) && bounds.width > 0
    ? bounds.width
    : Math.max(surfaceElement.offsetWidth, surfaceElement.clientWidth, 0)
  const height = Number.isFinite(bounds.height) && bounds.height > 0
    ? bounds.height
    : Math.max(surfaceElement.offsetHeight, surfaceElement.clientHeight, 0)

  const padding = 8
  const maxLeft = Math.max(padding, view.innerWidth - width - padding)
  const maxTop = Math.max(padding, view.innerHeight - height - padding)

  return {
    left: Math.max(padding, Math.min(maxLeft, position.left)),
    top: Math.max(padding, Math.min(maxTop, position.top)),
  }
}

export function useDataGridDraggableOverlaySurface(
  options: UseDataGridDraggableOverlaySurfaceOptions,
): UseDataGridDraggableOverlaySurfaceResult {
  const manualPosition = ref<DataGridOverlaySurfacePosition | null>(
    readPersistedPosition(options.rootElementRef.value, options.surfaceId),
  )
  const dragging = ref(false)

  const surfaceStyle = computed<Record<string, string>>(() => {
    const baseStyle = options.floating.contentStyle.value
    const resolvedManualPosition = manualPosition.value
      ?? readPersistedPosition(options.rootElementRef.value, options.surfaceId)
    if (!resolvedManualPosition) {
      return baseStyle
    }
    return {
      ...baseStyle,
      left: `${Math.round(resolvedManualPosition.left)}px`,
      top: `${Math.round(resolvedManualPosition.top)}px`,
    }
  })

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return
    }

    const surfaceElement = options.floating.contentRef.value
    const ownerDocument = surfaceElement?.ownerDocument ?? options.rootElementRef.value?.ownerDocument ?? document
    const view = ownerDocument.defaultView
    const baseStyle = surfaceStyle.value
    const startLeft = parsePixelValue(baseStyle.left)
    const startTop = parsePixelValue(baseStyle.top)
    if (startLeft == null || startTop == null) {
      return
    }

    const pointerCaptureTarget = event.currentTarget as Element | null
    const startClientX = event.clientX
    const startClientY = event.clientY
    const activePointerId = event.pointerId
    const startingPosition: DataGridOverlaySurfacePosition = {
      left: startLeft,
      top: startTop,
    }
    const previousUserSelect = ownerDocument.body.style.userSelect

    event.preventDefault()
    ownerDocument.body.style.userSelect = "none"
    dragging.value = true

    if (pointerCaptureTarget && "setPointerCapture" in pointerCaptureTarget) {
      try {
        pointerCaptureTarget.setPointerCapture(activePointerId)
      } catch {
        // Ignore unsupported capture implementations in tests or older browsers.
      }
    }

    const commitPosition = (nextPosition: DataGridOverlaySurfacePosition): void => {
      manualPosition.value = nextPosition
      writePersistedPosition(options.rootElementRef.value, options.surfaceId, nextPosition)
    }

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== activePointerId) {
        return
      }
      const nextPosition = clampSurfacePosition({
        left: startingPosition.left + (moveEvent.clientX - startClientX),
        top: startingPosition.top + (moveEvent.clientY - startClientY),
      }, surfaceElement, view)
      commitPosition(nextPosition)
    }

    const finishDrag = (endEvent: PointerEvent): void => {
      if (endEvent.pointerId !== activePointerId) {
        return
      }
      dragging.value = false
      ownerDocument.body.style.userSelect = previousUserSelect
      view?.removeEventListener("pointermove", handlePointerMove)
      view?.removeEventListener("pointerup", finishDrag)
      view?.removeEventListener("pointercancel", finishDrag)
      if (pointerCaptureTarget && "releasePointerCapture" in pointerCaptureTarget) {
        try {
          pointerCaptureTarget.releasePointerCapture(activePointerId)
        } catch {
          // Ignore unsupported capture implementations in tests or older browsers.
        }
      }
    }

    view?.addEventListener("pointermove", handlePointerMove)
    view?.addEventListener("pointerup", finishDrag)
    view?.addEventListener("pointercancel", finishDrag)
  }

  return {
    surfaceStyle,
    dragging,
    handlePointerDown,
  }
}