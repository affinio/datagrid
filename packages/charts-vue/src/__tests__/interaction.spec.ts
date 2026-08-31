import { describe, expect, it } from "vitest"
import { resolveChartTooltipPlacement } from "../interaction"

const base = {
  container: { width: 320, height: 220 },
  tooltip: { width: 100, height: 60 },
  offsetX: 12,
  offsetY: 12,
  padding: 8,
  constrainToChart: true,
}

describe("chart tooltip placement", () => {
  it("prefers the right/below quadrant in the center", () => {
    expect(resolveChartTooltipPlacement({ ...base, pointer: { x: 120, y: 80 } })).toEqual({
      left: 132,
      top: 92,
      placement: "right-bottom",
    })
  })

  it("flips horizontally at both side boundaries", () => {
    expect(resolveChartTooltipPlacement({ ...base, pointer: { x: 10, y: 80 } }).placement).toBe("right-bottom")
    expect(resolveChartTooltipPlacement({ ...base, pointer: { x: 310, y: 80 } })).toMatchObject({
      left: 198,
      placement: "left-bottom",
    })
  })

  it("flips vertically at both top and bottom boundaries", () => {
    expect(resolveChartTooltipPlacement({ ...base, pointer: { x: 120, y: 10 } }).placement).toBe("right-bottom")
    expect(resolveChartTooltipPlacement({ ...base, pointer: { x: 120, y: 210 } })).toMatchObject({
      top: 138,
      placement: "right-top",
    })
  })

  it("clamps oversized tooltips to the final chart bounds", () => {
    const result = resolveChartTooltipPlacement({
      ...base,
      tooltip: { width: 400, height: 300 },
      pointer: { x: 160, y: 110 },
    })
    expect(result.left).toBe(8)
    expect(result.top).toBe(8)
    expect(result.placement).toBe("right-bottom")
  })

  it("can intentionally leave collision constraints disabled", () => {
    expect(resolveChartTooltipPlacement({
      ...base,
      constrainToChart: false,
      pointer: { x: 310, y: 210 },
    })).toEqual({
      left: 322,
      top: 222,
      placement: "right-bottom",
    })
  })
})
