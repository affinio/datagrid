import { describe, expect, it } from "vitest"
import { createAnalyticsCore } from "../index"

describe("analytics-core", () => {
  it("creates a versioned core instance", () => {
    expect(createAnalyticsCore()).toEqual({ version: "0.1.0" })
  })
})
