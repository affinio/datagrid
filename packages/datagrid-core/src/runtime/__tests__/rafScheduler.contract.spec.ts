import { describe, expect, it } from "vitest"
import { createRafScheduler } from "../rafScheduler"

describe("RAF scheduler disposal during a frame", () => {
  it("does not start tasks detached from the queue after disposal", () => {
    const scheduler = createRafScheduler()
    const calls: string[] = []
    scheduler.schedule(() => {
      calls.push("first")
      scheduler.dispose()
    })
    scheduler.schedule(() => calls.push("second"))

    scheduler.flush()

    expect(calls).toEqual(["first"])
  })
})
