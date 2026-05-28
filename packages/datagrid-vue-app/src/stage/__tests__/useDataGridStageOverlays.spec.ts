import { computed, ref } from "vue"
import { beforeEach, describe, expect, it } from "vitest"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type { DataGridStageOverlayGeometryContext } from "../dataGridStageOverlayGeometry"
import { useDataGridStageOverlays } from "../useDataGridStageOverlays"
import {
  DATA_GRID_PERF_STORE_KEY,
  resolveDataGridPerfStore,
} from "../../perf/dataGridPerfTrace"

function createGeometryContext(): DataGridStageOverlayGeometryContext {
  const columns = [
    { key: "left", column: {} },
    { key: "centerA", column: {} },
    { key: "centerB", column: {} },
    { key: "right", column: {} },
  ] as unknown as DataGridStageOverlayGeometryContext["renderedColumns"]

  const indexByKey = { left: 0, centerA: 1, centerB: 2, right: 3 } as const

  return {
    bodyViewportClientHeight: 120,
    indexColumnWidthPx: 72,
    leftPaneWidth: 172,
    rightPaneWidth: 90,
    renderedColumns: columns,
    pinnedLeftColumns: columns.slice(0, 1),
    pinnedRightColumns: columns.slice(3),
    layoutGridContentWidth: 252,
    columnIndexByKey(key: string): number {
      return indexByKey[key as keyof typeof indexByKey] ?? -1
    },
    resolveColumnWidth(column) {
      return { left: 80, centerA: 120, centerB: 132, right: 90 }[column.key as "left" | "centerA" | "centerB" | "right"] ?? 0
    },
    resolveLeftColumnSpacerWidth() {
      return 0
    },
  }
}

describe("useDataGridStageOverlays", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[DATA_GRID_PERF_STORE_KEY]
  })

  it("builds selection and custom overlay lanes", () => {
    const geometryContext = computed(() => createGeometryContext())
    const range: DataGridOverlayRange = {
      startRow: 0,
      endRow: 0,
      startColumn: 1,
      endColumn: 2,
    }

    const result = useDataGridStageOverlays({
      overlayGeometryContext: geometryContext,
      bodyViewportClientHeight: ref(120),
      bodyViewportScrollTop: ref(0),
      bottomViewportClientHeight: ref(120),
      visibleColumns: computed(() => createGeometryContext().renderedColumns),
      displayRows: computed(() => [{}, {}]),
      selectionRanges: computed(() => [range]),
      selectionRange: computed(() => range),
      fillPreviewRange: computed(() => null),
      rangeMovePreviewRange: computed(() => null),
      rowMetrics: computed(() => [
        { top: 0, height: 31 },
        { top: 31, height: 31 },
      ]),
      pinnedBottomRowMetrics: computed(() => []),
      isCellSelectedSafe: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 1 && columnIndex <= 2,
      isCellInFillPreviewSafe: () => false,
      isAdditiveSelection: computed(() => false),
      isFillDragging: computed(() => false),
      isRangeMoving: computed(() => false),
      resolveVisibleRangeBounds(rangeValue) {
        if (!rangeValue) {
          return null
        }
        return {
          startRowOffset: rangeValue.startRow,
          endRowOffset: rangeValue.endRow,
          startColumnIndex: rangeValue.startColumn,
          endColumnIndex: rangeValue.endColumn,
        }
      },
      resolvePinnedBottomVisibleRangeBounds(rangeValue) {
        if (!rangeValue) {
          return null
        }
        return {
          startRowOffset: rangeValue.startRow,
          endRowOffset: rangeValue.endRow,
          startColumnIndex: rangeValue.startColumn,
          endColumnIndex: rangeValue.endColumn,
        }
      },
      customOverlays: computed(() => [{
        key: "custom",
        ranges: [range],
      }]),
    })

    expect(result.centerSelectionOverlaySegments.value).toHaveLength(1)
    expect(result.rightSelectionSeamOverlaySegments.value).toHaveLength(0)
    expect(result.centerCustomOverlayLanes.value).toHaveLength(1)
    expect(result.centerCustomOverlayLanes.value[0]?.segments).toHaveLength(1)
    expect(resolveDataGridPerfStore()?.latest("overlayCompute")).toBeNull()
  })

  it("records overlay segment telemetry only when perf tracing is enabled", () => {
    const geometryContext = computed(() => createGeometryContext())
    const range: DataGridOverlayRange = {
      startRow: 0,
      endRow: 0,
      startColumn: 1,
      endColumn: 2,
    }

    const result = useDataGridStageOverlays({
      overlayGeometryContext: geometryContext,
      bodyViewportClientHeight: ref(120),
      bodyViewportScrollTop: ref(0),
      bottomViewportClientHeight: ref(120),
      visibleColumns: computed(() => createGeometryContext().renderedColumns),
      displayRows: computed(() => [{}, {}]),
      selectionRanges: computed(() => [range]),
      selectionRange: computed(() => range),
      fillPreviewRange: computed(() => null),
      rangeMovePreviewRange: computed(() => null),
      rowMetrics: computed(() => [
        { top: 0, height: 31 },
        { top: 31, height: 31 },
      ]),
      pinnedBottomRowMetrics: computed(() => []),
      isCellSelectedSafe: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 1 && columnIndex <= 2,
      isCellInFillPreviewSafe: () => false,
      isAdditiveSelection: computed(() => false),
      isFillDragging: computed(() => false),
      isRangeMoving: computed(() => false),
      resolveVisibleRangeBounds(rangeValue) {
        if (!rangeValue) {
          return null
        }
        return {
          startRowOffset: rangeValue.startRow,
          endRowOffset: rangeValue.endRow,
          startColumnIndex: rangeValue.startColumn,
          endColumnIndex: rangeValue.endColumn,
        }
      },
      resolvePinnedBottomVisibleRangeBounds() {
        return null
      },
      customOverlays: computed(() => [{
        key: "custom",
        ranges: [range],
      }]),
      perfTraceEnabled: true,
    })

    expect(result.centerSelectionOverlaySegments.value).toHaveLength(1)
    expect(resolveDataGridPerfStore()?.latest("overlayCompute")).toMatchObject({
      scope: "overlayCompute",
      overlayKind: "selection",
      surface: "body",
      pane: "center",
      segmentCount: 1,
      laneCount: 0,
      visibleRowCount: 2,
      visibleColumnCount: 4,
      selectionRangeCount: 1,
      customOverlayCount: 1,
    })

    expect(result.centerCustomOverlayLanes.value).toHaveLength(1)
    expect(resolveDataGridPerfStore()?.latest("overlayCompute")).toMatchObject({
      scope: "overlayCompute",
      overlayKind: "custom",
      surface: "body",
      pane: "center",
      segmentCount: 1,
      laneCount: 1,
    })
  })

  it("does not invalidate empty body seam overlays on body scroll", () => {
    const geometryContext = computed(() => createGeometryContext())
    const bodyViewportScrollTop = ref(0)
    let selectionPredicateCalls = 0

    const result = useDataGridStageOverlays({
      overlayGeometryContext: geometryContext,
      bodyViewportClientHeight: ref(120),
      bodyViewportScrollTop,
      bottomViewportClientHeight: ref(120),
      visibleColumns: computed(() => createGeometryContext().renderedColumns),
      displayRows: computed(() => [{}, {}]),
      selectionRanges: computed(() => []),
      selectionRange: computed(() => null),
      fillPreviewRange: computed(() => null),
      rangeMovePreviewRange: computed(() => null),
      rowMetrics: computed(() => [
        { top: 0, height: 31 },
        { top: 31, height: 31 },
      ]),
      pinnedBottomRowMetrics: computed(() => []),
      isCellSelectedSafe: () => {
        selectionPredicateCalls += 1
        return false
      },
      isCellInFillPreviewSafe: () => false,
      isAdditiveSelection: computed(() => false),
      isFillDragging: computed(() => false),
      isRangeMoving: computed(() => false),
      resolveVisibleRangeBounds() {
        return null
      },
      resolvePinnedBottomVisibleRangeBounds() {
        return null
      },
      customOverlays: computed(() => []),
      perfTraceEnabled: true,
    })

    const bodySeamSelectionSampleCount = (): number => (
      resolveDataGridPerfStore()?.samples.filter(sample => (
        sample.scope === "overlayCompute"
        && sample.overlayKind === "selection"
        && sample.surface === "body-seam"
      )).length ?? 0
    )

    expect(result.leftSelectionSeamOverlaySegments.value).toHaveLength(0)
    expect(result.rightSelectionSeamOverlaySegments.value).toHaveLength(0)
    const samplesBeforeScroll = bodySeamSelectionSampleCount()

    bodyViewportScrollTop.value = 96

    expect(result.leftSelectionSeamOverlaySegments.value).toHaveLength(0)
    expect(result.rightSelectionSeamOverlaySegments.value).toHaveLength(0)
    expect(bodySeamSelectionSampleCount()).toBe(samplesBeforeScroll)
    expect(selectionPredicateCalls).toBe(0)
  })

  it("keeps body pinned seam overlays aligned with transformed pinned content on scroll", () => {
    const geometryContext = computed(() => createGeometryContext())
    const range: DataGridOverlayRange = {
      startRow: 43,
      endRow: 64,
      startColumn: 0,
      endColumn: 0,
    }

    const result = useDataGridStageOverlays({
      overlayGeometryContext: geometryContext,
      bodyViewportClientHeight: ref(120),
      bodyViewportScrollTop: ref(1_302),
      bottomViewportClientHeight: ref(120),
      visibleColumns: computed(() => createGeometryContext().renderedColumns),
      displayRows: computed(() => Array.from({ length: 22 }, () => ({}))),
      selectionRanges: computed(() => [range]),
      selectionRange: computed(() => range),
      fillPreviewRange: computed(() => null),
      rangeMovePreviewRange: computed(() => null),
      rowMetrics: computed(() => Array.from({ length: 22 }, (_unused, offset) => ({
        top: 1_333 + offset * 31,
        height: 31,
      }))),
      pinnedBottomRowMetrics: computed(() => []),
      isCellSelectedSafe: (rowOffset, columnIndex) => rowOffset >= 0 && rowOffset <= 21 && columnIndex === 0,
      isCellInFillPreviewSafe: () => false,
      isAdditiveSelection: computed(() => false),
      isFillDragging: computed(() => false),
      isRangeMoving: computed(() => false),
      resolveVisibleRangeBounds(rangeValue) {
        if (!rangeValue) {
          return null
        }
        return {
          startRowOffset: 0,
          endRowOffset: rangeValue.endRow - rangeValue.startRow,
          startColumnIndex: rangeValue.startColumn,
          endColumnIndex: rangeValue.endColumn,
        }
      },
      resolvePinnedBottomVisibleRangeBounds() {
        return null
      },
      customOverlays: computed(() => []),
    })

    expect(result.leftSelectionOverlaySegments.value[0]?.style.top).toBe("1332px")
    expect(result.leftSelectionSeamOverlaySegments.value[0]?.style.top).toBe("30px")
  })

  it("uses content-local body overlays and viewport-local seam overlays with a native scroll row origin", () => {
    const geometryContext = computed(() => createGeometryContext())
    const range: DataGridOverlayRange = {
      startRow: 12,
      endRow: 12,
      startColumn: 1,
      endColumn: 2,
    }

    const result = useDataGridStageOverlays({
      overlayGeometryContext: geometryContext,
      bodyViewportClientHeight: ref(120),
      bodyViewportScrollTop: ref(400),
      bodyOverlayRowOrigin: ref(124),
      bottomViewportClientHeight: ref(120),
      visibleColumns: computed(() => createGeometryContext().renderedColumns),
      displayRows: computed(() => Array.from({ length: 20 }, () => ({}))),
      selectionRanges: computed(() => [range]),
      selectionRange: computed(() => range),
      fillPreviewRange: computed(() => null),
      rangeMovePreviewRange: computed(() => null),
      rowMetrics: computed(() => Array.from({ length: 20 }, (_unused, offset) => ({
        top: 124 + offset * 31,
        height: 31,
      }))),
      pinnedBottomRowMetrics: computed(() => []),
      isCellSelectedSafe: (rowOffset, columnIndex) => rowOffset === 8 && columnIndex >= 1 && columnIndex <= 2,
      isCellInFillPreviewSafe: () => false,
      isAdditiveSelection: computed(() => false),
      isFillDragging: computed(() => false),
      isRangeMoving: computed(() => false),
      resolveVisibleRangeBounds(rangeValue) {
        if (!rangeValue) {
          return null
        }
        return {
          startRowOffset: 8,
          endRowOffset: 8,
          startColumnIndex: rangeValue.startColumn,
          endColumnIndex: rangeValue.endColumn,
        }
      },
      resolvePinnedBottomVisibleRangeBounds() {
        return null
      },
      customOverlays: computed(() => [{
        key: "custom",
        ranges: [range],
      }]),
    })

    expect(result.centerSelectionOverlaySegments.value[0]?.style.top).toBe("247px")
    expect(result.centerCustomOverlayLanes.value[0]?.segments[0]?.style.top).toBe("247px")
    expect(result.rightSelectionSeamOverlaySegments.value).toHaveLength(0)

    const leftRange: DataGridOverlayRange = {
      startRow: 12,
      endRow: 12,
      startColumn: 0,
      endColumn: 0,
    }
    const seamResult = useDataGridStageOverlays({
      overlayGeometryContext: geometryContext,
      bodyViewportClientHeight: ref(120),
      bodyViewportScrollTop: ref(400),
      bodyOverlayRowOrigin: ref(124),
      bottomViewportClientHeight: ref(120),
      visibleColumns: computed(() => createGeometryContext().renderedColumns),
      displayRows: computed(() => Array.from({ length: 20 }, () => ({}))),
      selectionRanges: computed(() => [leftRange]),
      selectionRange: computed(() => leftRange),
      fillPreviewRange: computed(() => null),
      rangeMovePreviewRange: computed(() => null),
      rowMetrics: computed(() => Array.from({ length: 20 }, (_unused, offset) => ({
        top: 124 + offset * 31,
        height: 31,
      }))),
      pinnedBottomRowMetrics: computed(() => []),
      isCellSelectedSafe: (rowOffset, columnIndex) => rowOffset === 8 && columnIndex === 0,
      isCellInFillPreviewSafe: () => false,
      isAdditiveSelection: computed(() => false),
      isFillDragging: computed(() => false),
      isRangeMoving: computed(() => false),
      resolveVisibleRangeBounds() {
        return {
          startRowOffset: 8,
          endRowOffset: 8,
          startColumnIndex: 0,
          endColumnIndex: 0,
        }
      },
      resolvePinnedBottomVisibleRangeBounds() {
        return null
      },
      customOverlays: computed(() => []),
    })

    expect(seamResult.leftSelectionOverlaySegments.value[0]?.style.top).toBe("247px")
    expect(seamResult.leftSelectionSeamOverlaySegments.value[0]?.style.top).toBe("-28px")
  })

  it("limits additive selection overlay lanes to the active range across body and pinned-bottom panes", () => {
    const geometryContext = computed(() => createGeometryContext())
    const inactiveRange: DataGridOverlayRange = {
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0,
    }
    const activeRange: DataGridOverlayRange = {
      startRow: 1,
      endRow: 1,
      startColumn: 1,
      endColumn: 3,
    }

    const result = useDataGridStageOverlays({
      overlayGeometryContext: geometryContext,
      bodyViewportClientHeight: ref(120),
      bodyViewportScrollTop: ref(0),
      bottomViewportClientHeight: ref(80),
      visibleColumns: computed(() => createGeometryContext().renderedColumns),
      displayRows: computed(() => [{}, {}]),
      selectionRanges: computed(() => [inactiveRange, activeRange]),
      selectionRange: computed(() => activeRange),
      fillPreviewRange: computed(() => null),
      rangeMovePreviewRange: computed(() => null),
      rowMetrics: computed(() => [
        { top: 0, height: 31 },
        { top: 31, height: 31 },
      ]),
      pinnedBottomRowMetrics: computed(() => [
        { top: 0, height: 31 },
        { top: 31, height: 31 },
      ]),
      isCellSelectedSafe: (rowOffset, columnIndex) => (
        (rowOffset === 0 && columnIndex === 0)
        || (rowOffset === 1 && columnIndex >= 1 && columnIndex <= 3)
      ),
      isCellInFillPreviewSafe: () => false,
      isAdditiveSelection: computed(() => true),
      isFillDragging: computed(() => false),
      isRangeMoving: computed(() => false),
      resolveVisibleRangeBounds(rangeValue) {
        if (!rangeValue) {
          return null
        }
        return {
          startRowOffset: rangeValue.startRow,
          endRowOffset: rangeValue.endRow,
          startColumnIndex: rangeValue.startColumn,
          endColumnIndex: rangeValue.endColumn,
        }
      },
      resolvePinnedBottomVisibleRangeBounds(rangeValue) {
        if (!rangeValue) {
          return null
        }
        return {
          startRowOffset: rangeValue.startRow,
          endRowOffset: rangeValue.endRow,
          startColumnIndex: rangeValue.startColumn,
          endColumnIndex: rangeValue.endColumn,
        }
      },
      customOverlays: computed(() => []),
    })

    expect(result.leftSelectionOverlaySegments.value).toHaveLength(0)
    expect(result.centerSelectionOverlaySegments.value).toHaveLength(1)
    expect(result.rightSelectionOverlaySegments.value).toHaveLength(1)
    expect(result.rightSelectionSeamOverlaySegments.value).toHaveLength(1)
    expect(result.leftPinnedBottomSelectionOverlaySegments.value).toHaveLength(0)
    expect(result.centerPinnedBottomSelectionOverlaySegments.value).toHaveLength(1)
    expect(result.rightPinnedBottomSelectionOverlaySegments.value).toHaveLength(1)
    expect(result.rightPinnedBottomSelectionSeamOverlaySegments.value).toHaveLength(1)
  })
})
