import { describe, expect, it } from "vitest"
import { createClientRowModel } from "../clientRowModel"

interface SampleRow {
  id: number
  value: string
}

function createRng(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) {
    state += 2147483646
  }
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function randomInt(rng: () => number, min: number, max: number): number {
  const span = Math.max(1, max - min + 1)
  return min + Math.floor(rng() * span)
}

function buildRows(count: number, offset = 0): SampleRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: offset + index,
    value: `row-${offset + index}`,
  }))
}

function normalizeRange(start: number, end: number, rowCount: number): { start: number; end: number } {
  const safeCount = Math.max(0, Math.trunc(rowCount))
  if (safeCount <= 0) {
    return { start: 0, end: 0 }
  }
  const maxIndex = safeCount - 1
  const normalizedStart = Math.max(0, Math.min(maxIndex, Math.trunc(start)))
  const normalizedEnd = Math.max(normalizedStart, Math.min(maxIndex, Math.trunc(end)))
  return { start: normalizedStart, end: normalizedEnd }
}

describe("client row model property invariants", () => {
  it("keeps range/identity invariants under randomized command sequences", () => {
    const seeds = [1337, 7331, 2026]
    for (const seed of seeds) {
      const rng = createRng(seed)
      const initialCount = randomInt(rng, 0, 240)
      const model = createClientRowModel<SampleRow>({
        rows: buildRows(initialCount),
        resolveRowId: row => row.id,
      })

      try {
        for (let step = 0; step < 320; step += 1) {
          const op = randomInt(rng, 0, 3)

          if (op === 0) {
            const rowCount = model.getRowCount()
            const start = randomInt(rng, -64, rowCount + 64)
            const end = randomInt(rng, -64, rowCount + 64)
            model.setViewportRange({ start, end })
          } else if (op === 1) {
            const nextCount = randomInt(rng, 0, 260)
            const offset = randomInt(rng, 0, 50_000)
            model.setRows(buildRows(nextCount, offset))
          } else if (op === 2) {
            const rowCount = model.getRowCount()
            const start = randomInt(rng, -64, rowCount + 64)
            const end = randomInt(rng, -64, rowCount + 64)
            model.getRowsInRange({ start, end })
          } else {
            const rowCount = model.getRowCount()
            const index = randomInt(rng, -64, rowCount + 64)
            model.getRow(index)
          }

          const snapshot = model.getSnapshot()
          const normalized = normalizeRange(snapshot.viewportRange.start, snapshot.viewportRange.end, snapshot.rowCount)
          expect(snapshot.viewportRange).toEqual(normalized)
          expect(snapshot.rowCount).toBe(model.getRowCount())

          const rangeRows = model.getRowsInRange(snapshot.viewportRange)
          if (snapshot.rowCount === 0) {
            expect(rangeRows).toHaveLength(0)
          } else {
            const expectedLength = normalized.end - normalized.start + 1
            expect(rangeRows).toHaveLength(expectedLength)
            for (let index = 0; index < rangeRows.length; index += 1) {
              const node = rangeRows[index]
              const expectedDisplay = normalized.start + index
              expect(node?.displayIndex).toBe(expectedDisplay)
              expect(node?.rowKey).toBe(node?.rowId)
              expect(typeof node?.rowId === "number" || typeof node?.rowId === "string").toBe(true)
            }
          }
        }
      } finally {
        model.dispose()
      }
    }
  })
})

