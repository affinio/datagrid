import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridSelectionOverlayOrchestration } from "../useDataGridSelectionOverlayOrchestration"

describe("useDataGridSelectionOverlayOrchestration contract", () => {
  it("builds selection overlay for scrollable part and excludes pinned-left segment", () => {
    const api = useDataGridSelectionOverlayOrchestration({
      headerHeight: ref(40),
      rowHeight: 20,
      orderedColumns: ref([
        { pin: "left" },
        { pin: "none" },
        { pin: "none" },
      ]),
      orderedColumnMetrics: ref([
        { start: 0, end: 50 },
        { start: 50, end: 140 },
        { start: 140, end: 220 },
      ]),
      cellSelectionRange: ref({
        startRow: 1,
        endRow: 2,
        startColumn: 0,
        endColumn: 2,
      }),
      fillPreviewRange: ref(null),
      fillBaseRange: ref(null),
      rangeMovePreviewRange: ref(null),
      rangeMoveBaseRange: ref(null),
      isRangeMoving: ref(false),
      virtualWindow: ref({
        rowTotal: 10,
        colTotal: 3,
      }),
      resolveDevicePixelRatio: () => 1,
    })

    expect(api.cellSelectionOverlaySegments.value).toEqual([
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

  it("suppresses fill preview overlay when preview equals base", () => {
    const sameRange = {
      startRow: 0,
      endRow: 0,
      startColumn: 1,
      endColumn: 1,
    }
    const api = useDataGridSelectionOverlayOrchestration({
      headerHeight: ref(30),
      rowHeight: 18,
      orderedColumns: ref([{ pin: "none" }, { pin: "none" }]),
      orderedColumnMetrics: ref([
        { start: 0, end: 100 },
        { start: 100, end: 200 },
      ]),
      cellSelectionRange: ref(null),
      fillPreviewRange: ref(sameRange),
      fillBaseRange: ref(sameRange),
      rangeMovePreviewRange: ref(null),
      rangeMoveBaseRange: ref(null),
      isRangeMoving: ref(false),
      virtualWindow: ref({
        rowTotal: 10,
        colTotal: 2,
      }),
    })

    expect(api.fillPreviewOverlaySegments.value).toEqual([])
  })

  it("builds move preview overlay only when move mode is active", () => {
    const movePreview = {
      startRow: 2,
      endRow: 3,
      startColumn: 0,
      endColumn: 1,
    }
    const moveBase = {
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 1,
    }
    const isRangeMoving = ref(false)

    const api = useDataGridSelectionOverlayOrchestration({
      headerHeight: ref(10),
      rowHeight: 25,
      orderedColumns: ref([{ pin: "none" }, { pin: "none" }]),
      orderedColumnMetrics: ref([
        { start: 0, end: 80 },
        { start: 80, end: 140 },
      ]),
      cellSelectionRange: ref(null),
      fillPreviewRange: ref(null),
      fillBaseRange: ref(null),
      rangeMovePreviewRange: ref(movePreview),
      rangeMoveBaseRange: ref(moveBase),
      isRangeMoving,
      virtualWindow: ref({
        rowTotal: 10,
        colTotal: 2,
      }),
      resolveDevicePixelRatio: () => 1,
    })

    expect(api.rangeMoveOverlaySegments.value).toEqual([])

    isRangeMoving.value = true
    expect(api.rangeMoveOverlaySegments.value).toEqual([
      {
        key: "move-preview-scroll-0-1",
        mode: "scroll",
        style: {
          top: "60px",
          left: "0px",
          width: "140px",
          height: "50px",
        },
      },
    ])
  })

  it("clamps overlay ranges using virtualWindow totals", () => {
    const api = useDataGridSelectionOverlayOrchestration({
      headerHeight: ref(20),
      rowHeight: 20,
      orderedColumns: ref([{ pin: "none" }, { pin: "none" }]),
      orderedColumnMetrics: ref([
        { start: 0, end: 80 },
        { start: 80, end: 160 },
      ]),
      cellSelectionRange: ref({
        startRow: 0,
        endRow: 99,
        startColumn: 0,
        endColumn: 99,
      }),
      fillPreviewRange: ref(null),
      fillBaseRange: ref(null),
      rangeMovePreviewRange: ref(null),
      rangeMoveBaseRange: ref(null),
      isRangeMoving: ref(false),
      virtualWindow: ref({
        rowTotal: 4,
        colTotal: 2,
      }),
      resolveDevicePixelRatio: () => 1,
    })

    expect(api.cellSelectionOverlaySegments.value).toEqual([
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
