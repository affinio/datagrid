import { computed, ref } from "vue"
import {
  buildDataGridOverlayTransform,
} from "./selectionOverlayTransform"
import type { DataGridOverlayTransformInput } from "../types"

export interface UseDataGridOverlayScrollStateOptions {
  viewportWidth: number
  viewportHeight: number
  pinnedOffsetLeft?: number
  pinnedOffsetRight?: number
  initialScrollLeft?: number
  initialScrollTop?: number
}

export function useDataGridOverlayScrollState(
  options: UseDataGridOverlayScrollStateOptions,
) {
  const scrollLeft = ref(options.initialScrollLeft ?? 0)
  const scrollTop = ref(options.initialScrollTop ?? 0)

  const overlayTransformInput = computed<DataGridOverlayTransformInput>(() => ({
    viewportWidth: options.viewportWidth,
    viewportHeight: options.viewportHeight,
    scrollLeft: scrollLeft.value,
    scrollTop: scrollTop.value,
    pinnedOffsetLeft: options.pinnedOffsetLeft ?? 0,
    pinnedOffsetRight: options.pinnedOffsetRight ?? 0,
  }))

  const overlayTransform = computed(() => buildDataGridOverlayTransform(overlayTransformInput.value))

  function syncFromScrollTarget(target: Pick<HTMLElement, "scrollLeft" | "scrollTop">) {
    scrollLeft.value = target.scrollLeft
    scrollTop.value = target.scrollTop
  }

  return {
    scrollLeft,
    scrollTop,
    overlayTransformInput,
    overlayTransform,
    syncFromScrollTarget,
  }
}
