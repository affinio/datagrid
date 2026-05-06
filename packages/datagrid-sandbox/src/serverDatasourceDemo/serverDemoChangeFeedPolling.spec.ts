import { describe, expect, it } from "vitest"

import {
  resolveServerDemoChangeFeedPollingEnabled,
  resolveServerDemoChangeFeedPollingIntervalMs,
} from "./serverDemoChangeFeedPolling"

describe("serverDemo change-feed polling config", () => {
  it("enables polling by default in HTTP mode", () => {
    expect(resolveServerDemoChangeFeedPollingEnabled({
      httpModeEnabled: true,
    })).toBe(true)
  })

  it("allows polling to be disabled explicitly", () => {
    expect(resolveServerDemoChangeFeedPollingEnabled({
      httpModeEnabled: true,
      envValue: "false",
    })).toBe(false)
  })

  it("keeps polling disabled outside HTTP mode", () => {
    expect(resolveServerDemoChangeFeedPollingEnabled({
      httpModeEnabled: false,
      envValue: "true",
    })).toBe(false)
  })

  it("normalizes the polling interval to a demo-safe minimum", () => {
    expect(resolveServerDemoChangeFeedPollingIntervalMs("250")).toBe(500)
    expect(resolveServerDemoChangeFeedPollingIntervalMs(0)).toBe(500)
    expect(resolveServerDemoChangeFeedPollingIntervalMs(750)).toBe(750)
  })
})
