import { describe, expect, it } from "vitest"
import { resolveDataGridVelocityOverscanRange } from "../server/velocityOverscan"

describe("resolveDataGridVelocityOverscanRange", () => {
  it("uses base overscan when velocity is unknown or slow", () => {
    const result = resolveDataGridVelocityOverscanRange(
      { range: { start: 100, end: 119 }, timestampMs: 1_000 },
      { range: { start: 100, end: 119 }, timestampMs: 900 },
      {
        baseRows: 8,
        expectedLoadMs: 100,
        maxRows: 64,
        totalRows: 1_000,
      },
    )

    expect(result.overscanRows).toBe(8)
    expect(result.range).toEqual({ start: 96, end: 123 })
  })

  it("increases overscan for fast scroll samples", () => {
    const result = resolveDataGridVelocityOverscanRange(
      { range: { start: 300, end: 319 }, timestampMs: 1_016 },
      { range: { start: 100, end: 119 }, timestampMs: 1_000 },
      {
        baseRows: 8,
        expectedLoadMs: 120,
        maxRows: 128,
        totalRows: 1_000,
      },
    )

    expect(result.velocityRowsPerMs).toBeGreaterThan(10)
    expect(result.overscanRows).toBeGreaterThan(8)
    expect(result.range.start).toBeLessThan(300)
    expect(result.range.end).toBeGreaterThan(319)
  })

  it("biases overscan toward the scroll direction", () => {
    const down = resolveDataGridVelocityOverscanRange(
      { range: { start: 300, end: 319 }, timestampMs: 1_020 },
      { range: { start: 100, end: 119 }, timestampMs: 1_000 },
      {
        expectedLoadMs: 120,
        maxRows: 120,
      },
    )
    const up = resolveDataGridVelocityOverscanRange(
      { range: { start: 100, end: 119 }, timestampMs: 1_020 },
      { range: { start: 300, end: 319 }, timestampMs: 1_000 },
      {
        expectedLoadMs: 120,
        maxRows: 120,
      },
    )

    expect(down.trailingRows).toBeGreaterThan(down.leadingRows)
    expect(up.leadingRows).toBeGreaterThan(up.trailingRows)
  })

  it("respects max cap and total row bounds", () => {
    const result = resolveDataGridVelocityOverscanRange(
      { range: { start: 90, end: 99 }, timestampMs: 1_010 },
      { range: { start: 0, end: 9 }, timestampMs: 1_000 },
      {
        baseRows: 4,
        expectedLoadMs: 1_000,
        maxRows: 20,
        totalRows: 100,
      },
    )

    expect(result.overscanRows).toBe(20)
    expect(result.range.end).toBe(99)
  })
})
