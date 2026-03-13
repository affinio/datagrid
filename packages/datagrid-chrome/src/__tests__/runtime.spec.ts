import { describe, expect, it } from "vitest"
import {
  buildDataGridChromePaneModel,
  buildDataGridChromeRenderModel,
} from "../index.js"

describe("buildDataGridChromePaneModel", () => {
  it("projects row and column lines into viewport space", () => {
    const model = buildDataGridChromePaneModel({
      width: 320,
      height: 180,
      rowMetrics: [
        { top: 20, height: 30 },
        { top: 50, height: 30 },
      ],
      rowBands: [
        { top: 20, height: 30, kind: "striped" },
      ],
      scrollTop: 20,
      columnWidths: [72, 180, 120],
      scrollLeft: 72,
    })

    expect(model.bands).toEqual([{ top: 0, height: 30, kind: "striped" }])
    expect(model.horizontalLines.map(line => line.position)).toEqual([30, 60])
    expect(model.verticalLines.map(line => line.position)).toEqual([0, 180, 300])
  })

  it("supports optional visible row and column ranges", () => {
    const model = buildDataGridChromePaneModel({
      width: 320,
      height: 180,
      rowMetrics: [
        { top: 0, height: 20 },
        { top: 20, height: 30 },
        { top: 50, height: 40 },
      ],
      rowBands: [
        { rowIndex: 0, top: 0, height: 20, kind: "base" },
        { rowIndex: 1, top: 20, height: 30, kind: "striped" },
        { rowIndex: 2, top: 50, height: 40, kind: "group" },
      ],
      visibleRowRange: { start: 1, end: 2 },
      columnWidths: [72, 80, 90, 100],
      visibleColumnRange: { start: 1, end: 2 },
      scrollLeft: 72,
    })

    expect(model.bands).toEqual([
      { top: 20, height: 30, kind: "striped" },
      { top: 50, height: 40, kind: "group" },
    ])
    expect(model.horizontalLines.map(line => line.position)).toEqual([50, 90])
    expect(model.verticalLines.map(line => line.position)).toEqual([80, 170])
  })

  it("sanitizes invalid dimensions", () => {
    const model = buildDataGridChromePaneModel({
      width: Number.NaN,
      height: -1,
      rowMetrics: [{ top: 0, height: 31 }],
      columnWidths: [120],
    })

    expect(model.width).toBe(0)
    expect(model.height).toBe(0)
    expect(model.bands).toEqual([])
    expect(model.horizontalLines.map(line => line.position)).toEqual([31])
    expect(model.verticalLines.map(line => line.position)).toEqual([120])
  })
})

describe("buildDataGridChromeRenderModel", () => {
  it("builds left center and right pane geometry", () => {
    const model = buildDataGridChromeRenderModel({
      rowMetrics: [{ top: 0, height: 31 }],
      rowBands: [{ top: 0, height: 31, kind: "group" }],
      visibleRowRange: { start: 0, end: 0 },
      scrollTop: 0,
      leftPaneWidth: 160,
      centerPaneWidth: 420,
      rightPaneWidth: 140,
      viewportHeight: 240,
      leftColumnWidths: [72, 88],
      leftVisibleColumnRange: { start: 0, end: 1 },
      centerColumnWidths: [40, 180, 180],
      centerVisibleColumnRange: { start: 1, end: 2 },
      rightColumnWidths: [140],
      rightVisibleColumnRange: { start: 0, end: 0 },
      centerScrollLeft: 40,
    })

    expect(model.left.verticalLines.map(line => line.position)).toEqual([72, 160])
    expect(model.left.bands).toEqual([{ top: 0, height: 31, kind: "group" }])
    expect(model.center.verticalLines.map(line => line.position)).toEqual([0, 180, 360])
    expect(model.right.verticalLines.map(line => line.position)).toEqual([140])
  })
})
