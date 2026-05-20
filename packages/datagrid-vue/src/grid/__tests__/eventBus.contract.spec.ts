import { describe, expect, it } from "vitest"
import { createGridEventBus } from "../eventBus"

describe("createGridEventBus contract", () => {
  it("delivers feature-local events synchronously in registration order", () => {
    const bus = createGridEventBus()
    const events: string[] = []

    bus.on("feature:open", payload => {
      events.push(`first:${String(payload)}`)
    })
    bus.on("feature:open", payload => {
      events.push(`second:${String(payload)}`)
    })

    bus.emit("feature:open", "details")

    expect(events).toEqual(["first:details", "second:details"])
  })

  it("propagates feature-local handler failures to the caller", () => {
    const bus = createGridEventBus()
    const events: string[] = []

    bus.on("feature:open", () => {
      events.push("first")
    })
    bus.on("feature:open", () => {
      events.push("failing")
      throw new Error("feature event failure")
    })
    bus.on("feature:open", () => {
      events.push("after")
    })

    expect(() => {
      bus.emit("feature:open")
    }).toThrow("feature event failure")
    expect(events).toEqual(["first", "failing"])
  })
})
