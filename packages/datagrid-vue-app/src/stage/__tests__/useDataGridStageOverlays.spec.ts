import { computed, ref } from "vue"
import { describe, expect, it } from "vitest"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type { DataGridStageOverlayGeometryContext } from "../dataGridStageOverlayGeometry"
import { useDataGridStageOverlays } from "../useDataGridStageOverlays"

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
  })
})
