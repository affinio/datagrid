import { describe, expect, it } from "vitest"
import { resolveDataGridGroupHeaderGeometry } from "../dataGridGroupHeaderGeometry"

describe("DataGrid group header viewport geometry", () => {
  it("starts a fully visible group's label at the group's left edge", () => {
    expect(resolveDataGridGroupHeaderGeometry({ groupStart: 20, groupWidth: 100, scrollLeft: 0, viewportWidth: 200, labelWidth: 50 }))
      .toEqual({ visible: true, left: 0, width: 50, alignment: "left" })
  })

  it("sticks the label to the visible group start as its original columns scroll away", () => {
    const afterFirstChild = resolveDataGridGroupHeaderGeometry({
      groupStart: 20, groupWidth: 320, scrollLeft: 100, viewportWidth: 200, labelWidth: 80,
    })
    const afterMoreChildren = resolveDataGridGroupHeaderGeometry({
      groupStart: 20, groupWidth: 320, scrollLeft: 180, viewportWidth: 200, labelWidth: 80,
    })

    expect(20 + afterFirstChild.left - 100).toBe(0)
    expect(20 + afterMoreChildren.left - 180).toBe(0)
    expect(afterFirstChild.alignment).toBe("left")
  })

  it("keeps the full label inside the remaining visible group width where possible", () => {
    const geometry = resolveDataGridGroupHeaderGeometry({
      groupStart: 140, groupWidth: 100, scrollLeft: 0, viewportWidth: 180, labelWidth: 70,
    })

    expect(geometry).toEqual({ visible: true, left: 0, width: 40, alignment: "left" })
    expect(geometry.left + geometry.width).toBeLessThanOrEqual(100)
    expect(140 + geometry.left + geometry.width).toBeLessThanOrEqual(180)
  })

  it("hides labels for groups fully outside the pane viewport", () => {
    expect(resolveDataGridGroupHeaderGeometry({ groupStart: 240, groupWidth: 80, scrollLeft: 0, viewportWidth: 200, labelWidth: 50 }))
      .toEqual({ visible: false, left: 0, width: 0, alignment: "center" })
  })

  it("uses the same group-local clamp for nested groups with independent bounds", () => {
    const parent = resolveDataGridGroupHeaderGeometry({
      groupStart: 0, groupWidth: 400, scrollLeft: 120, viewportWidth: 200, labelWidth: 90,
    })
    const child = resolveDataGridGroupHeaderGeometry({
      groupStart: 100, groupWidth: 120, scrollLeft: 120, viewportWidth: 200, labelWidth: 70,
    })

    expect(parent.left).toBe(120)
    expect(child.left).toBe(20)
    expect(child.left + child.width).toBeLessThanOrEqual(120)
  })
})
