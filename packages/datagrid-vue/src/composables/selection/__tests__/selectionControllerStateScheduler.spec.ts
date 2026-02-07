import { describe, expect, it } from "vitest"
import { createSelectionControllerStateScheduler } from "../selectionControllerStateScheduler"

describe("selectionControllerStateScheduler", () => {
  it("coalesces rapid state updates and applies the latest state once", () => {
    const frames: Array<() => void> = []
    const ticks: Array<() => void> = []
    const applied: number[] = []

    const scheduler = createSelectionControllerStateScheduler<number>({
      applyState: state => {
        applied.push(state)
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

    scheduler.schedule(1)
    scheduler.schedule(2)
    scheduler.schedule(3)

    expect(applied).toEqual([])
    expect(frames.length).toBe(1)
    expect(ticks.length).toBe(1)

    ticks[0]?.()

    expect(applied).toEqual([3])

    frames[0]?.()
    expect(applied).toEqual([3])
  })

  it("drops pending state on cancel", () => {
    const ticks: Array<() => void> = []
    const applied: number[] = []
    let cancelled = false

    const scheduler = createSelectionControllerStateScheduler<number>({
      applyState: state => {
        applied.push(state)
      },
      requestFrame: () => 1,
      cancelFrame: () => {
        cancelled = true
      },
      scheduleNextTick: callback => {
        ticks.push(callback)
      },
    })

    scheduler.schedule(42)
    scheduler.cancel()
    ticks[0]?.()

    expect(cancelled).toBe(true)
    expect(applied).toEqual([])
  })
})
