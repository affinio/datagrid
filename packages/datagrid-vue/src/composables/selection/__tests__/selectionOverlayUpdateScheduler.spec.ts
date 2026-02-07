import { describe, expect, it } from "vitest"
import { createSelectionOverlayUpdateScheduler } from "../selectionOverlayUpdateScheduler"

describe("selectionOverlayUpdateScheduler", () => {
  it("coalesces user-blocking updates into a single microtask flush", () => {
    const microtasks: Array<() => void> = []
    let flushCount = 0

    const scheduler = createSelectionOverlayUpdateScheduler({
      request: () => 1,
      cancel: () => {},
      queueMicrotask: callback => {
        microtasks.push(callback)
      },
      flush: () => {
        flushCount += 1
      },
    })

    scheduler.schedule()
    scheduler.schedule()
    scheduler.schedule({ priority: "user-blocking" })

    expect(microtasks.length).toBe(1)
    expect(flushCount).toBe(0)

    microtasks[0]?.()
    expect(flushCount).toBe(1)
  })

  it("cancels pending frame microtask when background mode supersedes it", () => {
    const microtasks: Array<() => void> = []
    const idleCallbacks: Array<() => void> = []
    const cancelled: number[] = []

    const scheduler = createSelectionOverlayUpdateScheduler({
      request: callback => {
        idleCallbacks.push(callback)
        return 100 + idleCallbacks.length
      },
      cancel: handle => {
        cancelled.push(handle)
      },
      queueMicrotask: callback => {
        microtasks.push(callback)
      },
      flush: () => {},
    })

    scheduler.schedule({ priority: "user-blocking" })
    scheduler.schedule({ priority: "background", timeout: 250 })

    expect(microtasks.length).toBe(1)
    expect(idleCallbacks.length).toBe(1)
    expect(cancelled).toEqual([])
  })

  it("cancels idle request on dispose-like cancel call", () => {
    const cancelled: number[] = []

    const scheduler = createSelectionOverlayUpdateScheduler({
      request: () => 77,
      cancel: handle => {
        cancelled.push(handle)
      },
      flush: () => {},
    })

    scheduler.schedule({ priority: "background" })
    scheduler.cancel()

    expect(cancelled).toEqual([77])
  })
})
