import { describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { useDataGridViewportBridge } from "../useDataGridViewportBridge"

describe("useDataGridViewportBridge", () => {
  it("coalesces scroll events into a single animation frame dispatch", () => {
    const calls: Event[] = []
    const frameQueue: FrameRequestCallback[] = []
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancel = globalThis.cancelAnimationFrame

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
      frameQueue.push(callback)
      return frameQueue.length
    }) as typeof globalThis.requestAnimationFrame
    globalThis.cancelAnimationFrame = vi.fn() as typeof globalThis.cancelAnimationFrame

    const bridge = useDataGridViewportBridge({
      handleViewportScroll: event => {
        calls.push(event)
      },
      scrollLeft: ref(0),
      scrollTop: ref(0),
      emitOverlayScrollSnapshot: () => {},
    })

    const firstTarget = document.createElement("div")
    const secondTarget = document.createElement("div")
    bridge.handleViewportScrollEvent({ target: firstTarget } as unknown as Event)
    bridge.handleViewportScrollEvent({ target: secondTarget } as unknown as Event)

    expect(frameQueue.length).toBe(1)
    expect(calls.length).toBe(0)

    frameQueue[0]?.(performance.now())

    expect(calls.length).toBe(1)
    expect((calls[0] as Event).target).toBe(secondTarget)

    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCancel
  })

  it("syncs scroll refs and overlay snapshot from imperative payload", () => {
    const scrollLeft = ref(0)
    const scrollTop = ref(0)
    let snapshot: { scrollLeft: number; scrollTop: number } | null = null

    const bridge = useDataGridViewportBridge({
      handleViewportScroll: () => {},
      scrollLeft,
      scrollTop,
      emitOverlayScrollSnapshot: payload => {
        snapshot = payload
      },
    })

    bridge.handleViewportScrollSync({
      scrollLeft: 240,
      scrollTop: 880,
      timestamp: Date.now(),
    })

    expect(scrollLeft.value).toBe(240)
    expect(scrollTop.value).toBe(880)
    expect(snapshot).toEqual({ scrollLeft: 240, scrollTop: 880 })
  })
})
