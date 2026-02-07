import { describe, expect, it } from "vitest"
import {
  clientToTableSpace,
  createWorldRowSpan,
  tableToViewportSpace,
  viewportToTableSpace,
} from "../coordinateSpace"

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

describe("selection coordinate-space contract", () => {
  it("round-trips table <-> viewport coordinates", () => {
    for (let index = 0; index < 500; index += 1) {
      const table = randomBetween(-10_000, 10_000)
      const scroll = randomBetween(-2_000, 2_000)
      const viewport = tableToViewportSpace(table, scroll)
      const roundTrip = viewportToTableSpace(viewport, scroll)
      expect(roundTrip).toBeCloseTo(table, 8)
    }
  })

  it("maps client coordinates into table space using viewport origin + scroll", () => {
    for (let index = 0; index < 500; index += 1) {
      const client = randomBetween(-5_000, 5_000)
      const origin = randomBetween(-2_000, 2_000)
      const scroll = randomBetween(-2_000, 2_000)
      const fromClient = clientToTableSpace(client, origin, scroll)
      const fromViewport = viewportToTableSpace(client - origin, scroll)
      expect(fromClient).toBeCloseTo(fromViewport, 8)
    }
  })

  it("creates valid world row spans", () => {
    expect(createWorldRowSpan(0, 0, 32)).toEqual({ top: 0, height: 32 })
    expect(createWorldRowSpan(3, 1, 20)).toEqual({ top: 20, height: 60 })
    expect(createWorldRowSpan(-4, -1, 20)).toBeNull()
    expect(createWorldRowSpan(2, 2, 0)).toBeNull()
    expect(createWorldRowSpan(2, 2, -1)).toBeNull()

    for (let index = 0; index < 400; index += 1) {
      const start = Math.floor(randomBetween(-40, 120))
      const end = Math.floor(randomBetween(-40, 120))
      const rowHeight = randomBetween(1, 80)
      const span = createWorldRowSpan(start, end, rowHeight)

      const normalizedStart = Math.min(start, end)
      const normalizedEnd = Math.max(start, end)

      if (normalizedEnd < 0) {
        expect(span).toBeNull()
        continue
      }

      expect(span).not.toBeNull()
      if (!span) continue

      expect(span.top).toBeGreaterThanOrEqual(0)
      expect(span.height).toBeGreaterThan(0.5)
      expect(span.top + span.height).toBeGreaterThan(span.top)
    }
  })
})
