import {
  buildCustomOverlayLane,
  buildPaneOverlaySegments,
  buildPaneOverlaySegmentsForMetricsList,
  buildPinnedPaneSeamOverlaySegments,
  buildPinnedPaneSeamOverlaySegmentsForMetricsList,
  resolveOverlayMetricsList,
  type DataGridStageOverlayGeometryContext,
} from "../dataGridStageOverlayGeometry"
import type { DataGridTableStageCustomOverlay } from "../dataGridTableStage.types"

function createGeometryContext(): DataGridStageOverlayGeometryContext {
  const indexByKey = { left: 0, center: 1, right: 2 } as const
  const columns = [
    { key: "left", column: {} },
    { key: "center", column: {} },
    { key: "right", column: {} },
  ] as unknown as DataGridStageOverlayGeometryContext["renderedColumns"]
  return {
    bodyViewportClientHeight: 200,
    indexColumnWidthPx: 72,
    leftPaneWidth: 172,
    rightPaneWidth: 80,
    renderedColumns: columns,
    pinnedLeftColumns: columns.slice(0, 1),
    pinnedRightColumns: columns.slice(2),
    layoutGridContentWidth: 300,
    columnIndexByKey(key: string): number {
      return indexByKey[key as keyof typeof indexByKey] ?? -1
    },
    resolveColumnWidth(column) {
      return { left: 100, center: 120, right: 80 }[column.key as "left" | "center" | "right"] ?? 0
    },
    resolveLeftColumnSpacerWidth() {
      return 30
    },
  }
}

describe("dataGridStageOverlayGeometry", () => {
  it("builds pane overlay segments for center and pinned panes", () => {
    const context = createGeometryContext()
    const metrics = {
      startRowOffset: 1,
      endRowOffset: 2,
      startColumnIndex: 1,
      endColumnIndex: 2,
      top: 50,
      height: 20,
    }

    const centerSegments = buildPaneOverlaySegments(context, metrics, "center", "selection")
    const leftSegments = buildPaneOverlaySegments(context, {
      ...metrics,
      startColumnIndex: 0,
      endColumnIndex: 0,
    }, "left", "selection")

    expect(centerSegments).toHaveLength(1)
    expect(centerSegments[0]?.style).toMatchObject({
      top: "49px",
      left: "129px",
      width: "201px",
      height: "22px",
    })
    expect(leftSegments).toHaveLength(1)
    expect(leftSegments[0]?.style).toMatchObject({
      top: "49px",
      left: "71px",
      width: "101px",
      height: "22px",
    })
  })

  it("builds pinned pane seam overlay segments when selection crosses into a pinned pane", () => {
    const context = createGeometryContext()
    const seamSegments = buildPinnedPaneSeamOverlaySegments(context, {
      startRowOffset: 1,
      endRowOffset: 2,
      startColumnIndex: 1,
      endColumnIndex: 2,
      top: 20,
      height: 18,
    }, "right", "selection")

    expect(seamSegments).toHaveLength(1)
    expect(seamSegments[0]?.style).toMatchObject({
      top: "19px",
      left: "0px",
      width: "var(--datagrid-pinned-pane-separator-size)",
      height: "20px",
    })
  })

  it("expands list variants into stable keyed segments", () => {
    const context = createGeometryContext()
    const overlay = {
      key: "demo",
      ranges: [],
      hideSingleCell: false,
    } satisfies DataGridTableStageCustomOverlay
    const metricsList = resolveOverlayMetricsList([
      { startRowOffset: 0, endRowOffset: 0, startColumnIndex: 1, endColumnIndex: 1 },
      { startRowOffset: 3, endRowOffset: 3, startColumnIndex: 1, endColumnIndex: 2 },
    ], bounds => bounds, [
      { top: 0, height: 18 },
      { top: 18, height: 18 },
      { top: 36, height: 18 },
      { top: 54, height: 18 },
    ])

    const segments = buildPaneOverlaySegmentsForMetricsList(context, metricsList, "center", "selection")
    const seamSegments = buildPinnedPaneSeamOverlaySegmentsForMetricsList(context, metricsList, "right", "selection")
    const lane = buildCustomOverlayLane(context, overlay, "center", metricsList)

    expect(segments.map(segment => segment.key)).toEqual(["selection-0-center-0-0", "selection-1-center-3-3"])
    expect(seamSegments).toHaveLength(1)
    expect(lane?.segments).toHaveLength(2)
  })
})
