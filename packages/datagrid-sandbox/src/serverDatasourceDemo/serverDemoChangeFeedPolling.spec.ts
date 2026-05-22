import { describe, expect, it } from "vitest"

import {
  resolveServerDemoChangeFeedPollingEnabled,
  resolveServerDemoChangeFeedPollingIntervalMs,
  resolveServerDemoLiveUpdatesEnabled,
} from "./serverDemoChangeFeedPolling"

describe("serverDemo live-update config", () => {
  it("enables live updates by default in HTTP mode", () => {
    expect(resolveServerDemoLiveUpdatesEnabled({
      httpModeEnabled: true,
    })).toBe(true)
  })

  it("allows live updates to be disabled explicitly", () => {
    expect(resolveServerDemoLiveUpdatesEnabled({
      httpModeEnabled: true,
      envValue: "false",
    })).toBe(false)
  })

  it("keeps live updates disabled outside HTTP mode", () => {
    expect(resolveServerDemoLiveUpdatesEnabled({
      httpModeEnabled: false,
      envValue: "true",
    })).toBe(false)
  })

  it("keeps the general live-update gate independent from the legacy polling flag", () => {
    expect(resolveServerDemoLiveUpdatesEnabled({
      httpModeEnabled: true,
      envValue: "true",
      legacyPollingEnvValue: "false",
    })).toBe(true)
  })

  it("keeps the legacy polling flag scoped to polling", () => {
    expect(resolveServerDemoChangeFeedPollingEnabled({
      httpModeEnabled: true,
      legacyPollingEnvValue: "false",
    })).toBe(false)
  })

  it("normalizes the polling interval to a demo-safe minimum", () => {
    expect(resolveServerDemoChangeFeedPollingIntervalMs("250")).toBe(500)
    expect(resolveServerDemoChangeFeedPollingIntervalMs(0)).toBe(500)
    expect(resolveServerDemoChangeFeedPollingIntervalMs(750)).toBe(750)
  })
})
