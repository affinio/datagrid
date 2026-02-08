import { describe, expect, it } from "vitest"
import { createClientRowModel } from "../clientRowModel"

interface StressRow {
  id: number
  value: string
}

function buildRows(count: number): StressRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    value: `row-${index}`,
  }))
}

describe("client row model stress suite", () => {
  it("keeps deterministic range access under sustained high-volume viewport updates", () => {
    const rowCount = 120_000
    const rangeSize = 180
    const iterations = 1_200
    const model = createClientRowModel<StressRow>({
      rows: buildRows(rowCount),
      resolveRowId: row => row.id,
    })

    try {
      const maxStart = rowCount - rangeSize - 1
      for (let index = 0; index < iterations; index += 1) {
        const start = (index * 97) % maxStart
        const end = start + rangeSize
        model.setViewportRange({ start, end })
        const rows = model.getRowsInRange({ start, end })
        expect(rows).toHaveLength(rangeSize + 1)
        expect(rows[0]?.displayIndex).toBe(start)
        expect(rows[rangeSize]?.displayIndex).toBe(end)
      }

      const snapshot = model.getSnapshot()
      expect(snapshot.rowCount).toBe(rowCount)
      expect(snapshot.viewportRange.start).toBeGreaterThanOrEqual(0)
      expect(snapshot.viewportRange.end).toBeGreaterThanOrEqual(snapshot.viewportRange.start)
      expect(snapshot.viewportRange.end).toBeLessThan(rowCount)
    } finally {
      model.dispose()
    }
  })
})

