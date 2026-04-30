import { describe, expect, it } from "vitest"
import { buildDataGridChromeRenderModel } from "@affino/datagrid-chrome"

import {
  resolveDataGridVirtualChromeRowMetrics,
  resolveDeviceAlignedCanvasLineWidth,
  resolveDeviceAlignedCanvasStrokeCenter,
} from "../dataGridChromeCanvasMath"

describe("dataGridChromeCanvasMath", () => {
  it("keeps css pixel lines unchanged on integer device pixel ratios", () => {
    expect(resolveDeviceAlignedCanvasLineWidth(1, 1)).toBe(1)
    expect(resolveDeviceAlignedCanvasLineWidth(1, 2)).toBe(1)
    expect(resolveDeviceAlignedCanvasStrokeCenter(72, 1, 1)).toBe(71.5)
    expect(resolveDeviceAlignedCanvasStrokeCenter(72, 1, 2)).toBe(71.5)
  })

  it("snaps canvas strokes to physical pixels on fractional device pixel ratios", () => {
    expect(resolveDeviceAlignedCanvasLineWidth(1, 1.25)).toBeCloseTo(0.8)
    expect(resolveDeviceAlignedCanvasStrokeCenter(72, 1, 1.25)).toBeCloseTo(71.6)
    expect(resolveDeviceAlignedCanvasStrokeCenter(31, 1, 1.25)).toBeCloseTo(30.8)
  })

  it("falls back safely for invalid ratios and widths", () => {
    expect(resolveDeviceAlignedCanvasLineWidth(0, 1.25)).toBe(0)
    expect(resolveDeviceAlignedCanvasLineWidth(1, Number.NaN)).toBe(1)
    expect(resolveDeviceAlignedCanvasStrokeCenter(40, 1, Number.NaN)).toBe(39.5)
  })

  it("computes sparse virtual row geometry without loaded display rows", () => {
    const unloadedMetrics = resolveDataGridVirtualChromeRowMetrics({
      rowStart: 10_000,
      rowEnd: 10_050,
      rowTotal: 100_000,
      topSpacerHeight: 10_000 * 31,
      baseRowHeight: 31,
    })

    expect(unloadedMetrics).toHaveLength(51)
    expect(unloadedMetrics[0]).toEqual({ rowIndex: 10_000, top: 310_000, height: 31 })
    expect(unloadedMetrics.at(-1)).toEqual({ rowIndex: 10_050, top: 311_550, height: 31 })

    const loadedMetrics = resolveDataGridVirtualChromeRowMetrics({
      rowStart: 10_000,
      rowEnd: 10_050,
      rowTotal: 100_000,
      topSpacerHeight: 10_000 * 31,
      baseRowHeight: 31,
    })

    expect(loadedMetrics).toEqual(unloadedMetrics)

    const renderModel = buildDataGridChromeRenderModel({
      rowMetrics: unloadedMetrics,
      scrollTop: 10_000 * 31,
      leftPaneWidth: 72,
      centerPaneWidth: 320,
      rightPaneWidth: 0,
      viewportHeight: 31 * 10,
      leftColumnWidths: [72],
      centerColumnWidths: [120, 140],
      rightColumnWidths: [],
      centerScrollLeft: 0,
    })

    expect(renderModel.center.horizontalLines.slice(0, 3).map(line => line.position)).toEqual([31, 62, 93])
    expect(renderModel.center.horizontalLines).toHaveLength(51)
  })

  it("uses row height resolvers for dynamic virtual row geometry", () => {
    const rowHeights = new Map<number, number>([
      [10_000, 40],
      [10_001, 28],
      [10_002, 36],
    ])
    const resolveRowHeight = (rowIndex: number) => rowHeights.get(rowIndex) ?? 31
    const resolveRowOffset = (rowIndex: number) => {
      let offset = 0
      for (let index = 0; index < rowIndex; index += 1) {
        offset += resolveRowHeight(index)
      }
      return offset
    }

    expect(resolveDataGridVirtualChromeRowMetrics({
      rowStart: 10_000,
      rowEnd: 10_002,
      rowTotal: 100_000,
      topSpacerHeight: resolveRowOffset(10_000),
      baseRowHeight: 31,
      resolveRowHeight,
      resolveRowOffset,
    })).toEqual([
      { rowIndex: 10_000, top: 310_000, height: 40 },
      { rowIndex: 10_001, top: 310_040, height: 28 },
      { rowIndex: 10_002, top: 310_068, height: 36 },
    ])
  })
})
