import { describe, expect, it } from "vitest"
import { createSelectionControllerStateScheduler } from "../selectionControllerStateScheduler"
import { createSelectionOverlayUpdateScheduler } from "../selectionOverlayUpdateScheduler"

describe("selection decomposition integration", () => {
  it("keeps latest controller state and coalesces overlay flushes", () => {
    const ticks: Array<() => void> = []
    const frames: Array<() => void> = []
    const microtasks: Array<() => void> = []

    const appliedStates: number[] = []
    let overlayFlushCount = 0

    const overlayScheduler = createSelectionOverlayUpdateScheduler({
      request: () => 1,
      cancel: () => {},
      queueMicrotask: callback => {
        microtasks.push(callback)
      },
      flush: () => {
        overlayFlushCount += 1
      },
    })

    const stateScheduler = createSelectionControllerStateScheduler<number>({
      applyState: state => {
        appliedStates.push(state)
        overlayScheduler.schedule()
      },
      requestFrame: callback => {
        frames.push(callback)
        return frames.length - 1
      },
      cancelFrame: () => {},
      scheduleNextTick: callback => {
        ticks.push(callback)
      },
    })

    stateScheduler.schedule(1)
    stateScheduler.schedule(2)
    stateScheduler.schedule(3)

    expect(appliedStates).toEqual([])
    expect(frames.length).toBe(1)
    expect(ticks.length).toBe(1)

    ticks[0]?.()
    microtasks[0]?.()

    expect(appliedStates).toEqual([3])
    expect(overlayFlushCount).toBe(1)
  })
})
