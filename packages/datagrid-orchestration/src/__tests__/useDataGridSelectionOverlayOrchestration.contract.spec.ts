import { describe, expect, it } from "vitest"
import { useDataGridSelectionOverlayOrchestration } from "../useDataGridSelectionOverlayOrchestration"

describe("useDataGridSelectionOverlayOrchestration contract", () => {
  it("renders only scroll segment when range spans pinned-left and scroll columns", () => {
    const snapshot = useDataGridSelectionOverlayOrchestration({
      headerHeight: 40,
      rowHeight: 20,
      orderedColumns: [
        { pin: "left" },
        { pin: "none" },
        { pin: "none" },
      ],
      orderedColumnMetrics: [
        { start: 0, end: 50 },
        { start: 50, end: 140 },
        { start: 140, end: 220 },
      ],
      cellSelectionRange: {
        startRow: 1,
        endRow: 2,
        startColumn: 0,
        endColumn: 2,
      },
      fillPreviewRange: null,
      fillBaseRange: null,
      rangeMovePreviewRange: null,
      rangeMoveBaseRange: null,
      isRangeMoving: false,
      virtualWindow: {
        rowTotal: 10,
        colTotal: 3,
      },
      resolveDevicePixelRatio: () => 1,
    })

    expect(snapshot.cellSelectionOverlaySegments).toEqual([
      {
        key: "selection-scroll-1-2",
        mode: "scroll",
        style: {
          top: "60px",
          left: "50px",
          width: "170px",
          height: "40px",
        },
      },
    ])
  })

  it("clamps overlay ranges by canonical virtualWindow totals", () => {
    const snapshot = useDataGridSelectionOverlayOrchestration({
      headerHeight: 20,
      rowHeight: 20,
      orderedColumns: [{ pin: "none" }, { pin: "none" }],
      orderedColumnMetrics: [
        { start: 0, end: 80 },
        { start: 80, end: 160 },
      ],
      cellSelectionRange: {
        startRow: 0,
        endRow: 99,
        startColumn: 0,
        endColumn: 99,
      },
      fillPreviewRange: null,
      fillBaseRange: null,
      rangeMovePreviewRange: null,
      rangeMoveBaseRange: null,
      isRangeMoving: false,
      virtualWindow: {
        rowTotal: 4,
        colTotal: 2,
      },
      resolveDevicePixelRatio: () => 1,
    })

    expect(snapshot.cellSelectionOverlaySegments).toEqual([
      {
        key: "selection-scroll-0-1",
        mode: "scroll",
        style: {
          top: "20px",
          left: "0px",
          width: "160px",
          height: "80px",
        },
      },
    ])
  })
})
