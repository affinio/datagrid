import { describe, expect, it, vi } from "vitest"
import { createClientRowCalculationSnapshotRuntime } from "../clientRowCalculationSnapshotRuntime.js"

function createRuntime() {
  return createClientRowCalculationSnapshotRuntime({
    getBaseSourceRows: () => [],
    createComputedSnapshot: () => ({
      computedFields: [],
      overlayValuesByField: {},
      rowCount: 0,
    }),
    getModelSnapshot: () => ({}) as never,
    getAggregationModel: () => null,
    cloneAggregationModel: () => null,
    getFormulaComputeStageDiagnosticsSnapshot: () => null,
    getFormulaRowRecomputeDiagnosticsSnapshot: () => null,
    applySnapshotRestore: vi.fn(() => true),
  })
}

describe("client row calculation snapshot history retention", () => {
  it("retains only the newest 100 entries and releases them on clear", () => {
    const runtime = createRuntime()

    for (let index = 0; index < 105; index += 1) {
      runtime.pushCalculationSnapshot(`snapshot-${index}`)
    }

    const history = runtime.getCalculationSnapshotHistory()
    expect(history.entries).toHaveLength(100)
    expect(history.entries[0]?.label).toBe("snapshot-5")
    expect(history.entries.at(-1)?.label).toBe("snapshot-104")
    expect(history.index).toBe(99)

    runtime.clear()

    expect(runtime.getCalculationSnapshotHistory()).toEqual({ index: -1, entries: [] })
  })
})
