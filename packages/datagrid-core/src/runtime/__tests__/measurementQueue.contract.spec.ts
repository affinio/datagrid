import { describe, expect, it } from "vitest"
import { createMeasurementQueue } from "../measurementQueue"

describe("measurementQueue error semantics", () => {
  it("returns rejected promise in sync mode when measure throws", async () => {
    const queue = createMeasurementQueue({ globalObject: {} as typeof globalThis })
    const error = new Error("sync-measure-failed")

    const handle = queue.schedule(() => {
      throw error
    })

    await expect(handle.promise).rejects.toBe(error)
  })

  it("returns rejected promise when queue is disposed and measure throws", async () => {
    const queue = createMeasurementQueue({ globalObject: {} as typeof globalThis })
    const error = new Error("disposed-measure-failed")
    queue.dispose()

    const handle = queue.schedule(() => {
      throw error
    })

    await expect(handle.promise).rejects.toBe(error)
  })
})
