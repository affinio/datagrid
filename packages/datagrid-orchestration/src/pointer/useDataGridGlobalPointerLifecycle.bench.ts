import { bench, describe } from "vitest"
import { useDataGridGlobalPointerLifecycle } from "./useDataGridGlobalPointerLifecycle"

const EVENT_COUNT = 1_000
const EVENTS_PER_FRAME = 10

type FrameCallback = FrameRequestCallback

function createLifecycle(mode: "sync" | "raf") {
  let commits = 0
  const frameQueue: FrameCallback[] = []
  const lifecycle = useDataGridGlobalPointerLifecycle({
    resolveInteractionState: () => ({
      isRangeMoving: true,
      isColumnResizing: false,
      isFillDragging: false,
      isDragSelecting: false,
    }),
    resolveRangeMovePointer: () => null,
    setRangeMovePointer: () => {},
    applyRangeMovePreviewFromPointer: () => { commits += 1 },
    stopRangeMove: () => {},
    applyColumnResizeFromPointer: () => {},
    stopColumnResize: () => {},
    resolveFillPointer: () => null,
    setFillPointer: () => {},
    applyFillPreviewFromPointer: () => {},
    stopFillSelection: () => {},
    resolveDragPointer: () => null,
    setDragPointer: () => {},
    applyDragSelectionFromPointer: () => {},
    stopDragSelection: () => {},
    pointerPreviewApplyMode: mode,
    requestAnimationFrame: callback => {
      frameQueue.push(callback)
      return frameQueue.length
    },
    cancelAnimationFrame: () => {},
  })
  return { lifecycle, frameQueue, getCommits: () => commits }
}

function dispatchBurst(mode: "sync" | "raf"): number {
  const state = createLifecycle(mode)
  for (let index = 0; index < EVENT_COUNT; index += 1) {
    state.lifecycle.dispatchGlobalMouseMove({
      buttons: 1,
      clientX: index,
      clientY: index,
    } as MouseEvent)
    if (mode === "raf" && (index + 1) % EVENTS_PER_FRAME === 0) {
      state.frameQueue.shift()?.(index)
    }
  }
  return state.getCommits()
}

describe("pointer preview burst", () => {
  bench("sync: 1000 pointer events", () => {
    dispatchBurst("sync")
  })

  bench("raf: 1000 pointer events / 100 frames", () => {
    dispatchBurst("raf")
  })
})
