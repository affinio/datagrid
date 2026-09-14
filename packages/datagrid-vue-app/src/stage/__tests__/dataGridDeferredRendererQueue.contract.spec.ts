import { describe, expect, it, vi } from "vitest"
import { createDataGridDeferredRendererQueue } from "../dataGridDeferredRendererQueue"

describe("deferred renderer queue contract", () => {
  it("flushes pinned and visible work before overscan work", () => {
    const queue = createDataGridDeferredRendererQueue(8)
    const calls: string[] = []
    queue.enqueue({ key: "overscan", priority: "overscan", render: () => calls.push("overscan") })
    queue.enqueue({ key: "visible", priority: "visible", render: () => calls.push("visible") })
    queue.enqueue({ key: "pinned", priority: "pinned", render: () => calls.push("pinned") })

    expect(queue.flush(2)).toBe(2)
    expect(calls).toEqual(["pinned", "visible"])
    expect(queue.size).toBe(1)
  })

  it("rejects lower priority work at capacity and cancels stale keys", () => {
    const queue = createDataGridDeferredRendererQueue(2)
    const render = vi.fn()
    expect(queue.enqueue({ key: "a", priority: "visible", render })).toBe(true)
    expect(queue.enqueue({ key: "b", priority: "overscan", render })).toBe(true)
    expect(queue.enqueue({ key: "c", priority: "overscan", render })).toBe(false)
    expect(queue.enqueue({ key: "p", priority: "pinned", render })).toBe(true)
    expect(queue.cancel("p")).toBe(true)
    expect(queue.flush(10)).toBe(1)
    expect(render).toHaveBeenCalledTimes(1)
  })
})
