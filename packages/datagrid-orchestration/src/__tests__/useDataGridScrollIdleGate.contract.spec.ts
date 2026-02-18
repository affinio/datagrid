import { describe, expect, it, vi } from "vitest"
import { useDataGridScrollIdleGate } from "../useDataGridScrollIdleGate"

describe("useDataGridScrollIdleGate contract", () => {
  it("runs callback immediately when idle", () => {
    const gate = useDataGridScrollIdleGate({
      setTimeout: ((callback) => {
        callback()
        return 0 as unknown as ReturnType<typeof globalThis.setTimeout>
      }) as UseSetTimeout,
      clearTimeout: (() => {}) as UseClearTimeout,
    })

    const callback = vi.fn()
    gate.runWhenScrollIdle(callback)

    expect(callback).toHaveBeenCalledTimes(1)
    gate.dispose()
  })

  it("defers callback until idle timeout elapsed", () => {
    vi.useFakeTimers()
    try {
      const callback = vi.fn()
      const gate = useDataGridScrollIdleGate({ resolveIdleDelayMs: () => 50 })

      gate.markScrollActivity()
      gate.runWhenScrollIdle(callback)
      expect(callback).toHaveBeenCalledTimes(0)

      vi.advanceTimersByTime(49)
      expect(callback).toHaveBeenCalledTimes(0)

      vi.advanceTimersByTime(1)
      expect(callback).toHaveBeenCalledTimes(1)
      gate.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("resets idle timer on repeated activity", () => {
    vi.useFakeTimers()
    try {
      const callback = vi.fn()
      const gate = useDataGridScrollIdleGate({ resolveIdleDelayMs: () => 40 })

      gate.markScrollActivity()
      vi.advanceTimersByTime(20)
      gate.markScrollActivity()
      gate.runWhenScrollIdle(callback)

      vi.advanceTimersByTime(39)
      expect(callback).toHaveBeenCalledTimes(0)

      vi.advanceTimersByTime(1)
      expect(callback).toHaveBeenCalledTimes(1)
      gate.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("clears queued callbacks on dispose", () => {
    vi.useFakeTimers()
    try {
      const callback = vi.fn()
      const gate = useDataGridScrollIdleGate({ resolveIdleDelayMs: () => 20 })

      gate.markScrollActivity()
      gate.runWhenScrollIdle(callback)
      gate.dispose()

      vi.advanceTimersByTime(50)
      expect(callback).toHaveBeenCalledTimes(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it("supports re-entrancy when deferred callback restarts scroll activity", () => {
    vi.useFakeTimers()
    try {
      const gate = useDataGridScrollIdleGate({ resolveIdleDelayMs: () => 30 })
      const nested = vi.fn()
      const primary = vi.fn(() => {
        gate.markScrollActivity()
        gate.runWhenScrollIdle(nested)
      })

      gate.markScrollActivity()
      gate.runWhenScrollIdle(primary)

      vi.advanceTimersByTime(30)
      expect(primary).toHaveBeenCalledTimes(1)
      expect(gate.isScrollActive()).toBe(true)
      expect(nested).toHaveBeenCalledTimes(0)

      vi.advanceTimersByTime(30)
      expect(nested).toHaveBeenCalledTimes(1)
      expect(gate.isScrollActive()).toBe(false)

      gate.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
})

type UseSetTimeout = (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>
type UseClearTimeout = (handle: ReturnType<typeof globalThis.setTimeout>) => void
