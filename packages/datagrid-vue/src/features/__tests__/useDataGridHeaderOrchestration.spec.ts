import { describe, expect, it } from "vitest"
import { createDataGridHeaderBindings } from "../useDataGridHeaderOrchestration"
import type { UiTableHeaderBindings } from "../../context"

describe("useDataGridHeaderOrchestration", () => {
  it("keeps header binding object unchanged when passing through facade", () => {
    const bindings = { any: "value" } as unknown as UiTableHeaderBindings
    const resolved = createDataGridHeaderBindings(bindings)
    expect(resolved).toBe(bindings)
  })
})
