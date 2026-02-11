import { describe, expect, it } from "vitest"
import * as stable from "../../public"
import * as advanced from "../../advanced"

describe("event contract tier exports", () => {
  it("exposes canonical event tier constants from stable entrypoint", () => {
    expect(stable.DATAGRID_EVENT_TIERS).toEqual([
      "stable",
      "advanced",
      "internal",
    ])
    expect(stable.DATAGRID_EVENT_TIER_ENTRYPOINTS).toEqual({
      stable: "@affino/datagrid-core",
      advanced: "@affino/datagrid-core/advanced",
      internal: "@affino/datagrid-core/internal",
    })
  })

  it("creates event envelope payloads with deterministic timestamp fallback", () => {
    const envelope = stable.createDataGridEventEnvelope({
      tier: "stable",
      name: "rowClick",
      args: [{ rowId: "row-1" }],
      source: "ui",
      phase: "change",
    })

    expect(envelope.timestampMs).toBeTypeOf("number")
    expect(envelope.tier).toBe("stable")
    expect(envelope.name).toBe("rowClick")
  })

  it("keeps tier guards consistent across stable and advanced entrypoints", () => {
    expect(stable.isDataGridEventTier("stable")).toBe(true)
    expect(advanced.isDataGridEventTier("advanced")).toBe(true)
    expect(stable.isDataGridEventTier("legacy")).toBe(false)
  })
})
