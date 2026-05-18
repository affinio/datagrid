import { describe, expect, it, vi } from "vitest"
import { useDataGridScrollPerfTelemetry } from "../scrolling/useDataGridScrollPerfTelemetry"

describe("useDataGridScrollPerfTelemetry contract", () => {
  it("reports good quality for stable frame cadence", () => {
    vi.useFakeTimers()
    try {
      const frames: FrameRequestCallback[] = []
      const telemetry = useDataGridScrollPerfTelemetry({
        resolveIdleDelayMs: () => 120,
        resolveMinFrameSample: () => 4,
        requestAnimationFrame(callback) {
          frames.push(callback)
          return frames.length
        },
        cancelAnimationFrame: vi.fn(),
      })

      telemetry.markScrollActivity()
      runFrame(frames, 0)
      runFrame(frames, 16)
      runFrame(frames, 32)
      runFrame(frames, 48)
      runFrame(frames, 64)

      const snapshot = telemetry.getSnapshot()
      expect(snapshot.active).toBe(true)
      expect(snapshot.frameCount).toBe(4)
      expect(snapshot.quality).toBe("good")
      expect(snapshot.fps).toBeGreaterThan(55)

      telemetry.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("reports degraded quality for heavy frames", () => {
    vi.useFakeTimers()
    try {
      const frames: FrameRequestCallback[] = []
      const telemetry = useDataGridScrollPerfTelemetry({
        resolveIdleDelayMs: () => 120,
        resolveMinFrameSample: () => 3,
        requestAnimationFrame(callback) {
          frames.push(callback)
          return frames.length
        },
        cancelAnimationFrame: vi.fn(),
      })

      telemetry.markScrollActivity()
      runFrame(frames, 0)
      runFrame(frames, 35)
      runFrame(frames, 70)
      runFrame(frames, 130)

      const snapshot = telemetry.getSnapshot()
      expect(snapshot.frameCount).toBe(3)
      expect(snapshot.droppedFrames).toBeGreaterThan(0)
      expect(snapshot.longTaskFrames).toBeGreaterThan(0)
      expect(snapshot.quality).toBe("degraded")

      telemetry.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns to inactive after idle timeout", () => {
    vi.useFakeTimers()
    try {
      const frames: FrameRequestCallback[] = []
      const telemetry = useDataGridScrollPerfTelemetry({
        resolveIdleDelayMs: () => 40,
        requestAnimationFrame(callback) {
          frames.push(callback)
          return frames.length
        },
        cancelAnimationFrame: vi.fn(),
      })

      telemetry.markScrollActivity()
      runFrame(frames, 0)
      runFrame(frames, 16)
      expect(telemetry.getSnapshot().active).toBe(true)

      vi.advanceTimersByTime(40)
      expect(telemetry.getSnapshot().active).toBe(false)

      telemetry.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps virtualization event recording disabled by default", () => {
    const telemetry = useDataGridScrollPerfTelemetry()

    telemetry.recordVirtualizationEvent({
      type: "viewport",
      timestamp: 12,
      totalMs: 3,
      renderedRows: 24,
      renderedColumns: 8,
    })

    expect(telemetry.getSnapshot().virtualizationEvents).toEqual([])
    expect(telemetry.getSnapshot().latestVirtualizationEvent).toBeNull()

    telemetry.dispose()
  })

  it("records bounded virtualization event shape when explicitly enabled", () => {
    const telemetry = useDataGridScrollPerfTelemetry({
      virtualizationTelemetryEnabled: true,
      maxVirtualizationEvents: 1,
    })

    telemetry.recordVirtualizationEvent({
      type: "viewport",
      timestamp: 12,
      totalMs: 3,
      renderedRows: 24,
      renderedColumns: 8,
      rowStart: 40,
      rowEnd: 63,
      columnStart: 2,
      columnEnd: 9,
      rowOverscan: 8,
      columnOverscan: 2,
      placeholderRows: 0,
      blankViewport: false,
    })
    telemetry.recordVirtualizationEvent({
      type: "blank-viewport",
      timestamp: 16,
      renderedRows: 0,
      renderedColumns: 8,
      blankViewport: true,
    })

    expect(telemetry.getSnapshot().virtualizationEvents).toEqual([
      expect.objectContaining({
        type: "blank-viewport",
        timestamp: 16,
        renderedRows: 0,
        renderedColumns: 8,
        blankViewport: true,
        longTaskFrames: 0,
      }),
    ])
    expect(telemetry.getSnapshot().latestVirtualizationEvent?.type).toBe("blank-viewport")

    telemetry.dispose()
  })
})

function runFrame(queue: FrameRequestCallback[], timestamp: number): void {
  const callback = queue.shift()
  if (!callback) {
    return
  }
  callback(timestamp)
}
