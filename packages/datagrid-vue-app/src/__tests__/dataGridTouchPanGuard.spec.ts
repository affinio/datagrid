import { describe, expect, it } from "vitest"
import { resolveDataGridTouchPanAxis } from "../gestures/dataGridTouchPanGuard"

describe("dataGridTouchPanGuard", () => {
  it("locks vertical gestures to the y axis", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 10,
      deltaY: 30,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBe("y")
  })

  it("locks diagonal horizontal-dominant gestures to the x axis", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 42,
      deltaY: 26,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBe("x")
  })

  it("locks diagonal vertical-dominant gestures to the y axis", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 26,
      deltaY: 42,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBe("y")
  })

  it("locks to x when only horizontal scrolling is available", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 24,
      deltaY: 3,
      maxScrollLeft: 400,
      maxScrollTop: 0,
    })).toBe("x")
  })

  it("locks to y when only vertical scrolling is available", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 24,
      deltaY: 3,
      maxScrollLeft: 0,
      maxScrollTop: 1200,
    })).toBe("y")
  })

  it("does not claim tiny gestures before lock distance", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 3,
      deltaY: 4,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBeNull()
  })

  it("ignores gestures when the container is not scrollable", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 18,
      deltaY: 1,
      maxScrollLeft: 0,
      maxScrollTop: 0,
    })).toBeNull()
  })
})