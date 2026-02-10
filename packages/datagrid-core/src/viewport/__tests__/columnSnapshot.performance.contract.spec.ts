import { describe, expect, it, vi } from "vitest"
import {
  createEmptyColumnSnapshot,
  updateColumnSnapshot,
  type ColumnSnapshotMeta,
} from "../../virtualization/columnSnapshot"
import type { DataGridColumn } from "../../types"

describe("columnSnapshot performance contract", () => {
  it("does not rebuild width map when only meta version changes without width-layout delta", () => {
    const columns: DataGridColumn[] = [
      { key: "id", label: "ID", width: 80 },
      { key: "name", label: "Name", width: 180 },
      { key: "status", label: "Status", width: 140 },
    ]

    const metrics = {
      widths: [80, 180, 140],
      offsets: [0, 80, 260],
      totalWidth: 400,
    }

    const baseMeta: ColumnSnapshotMeta<DataGridColumn> = {
      scrollableColumns: columns,
      scrollableIndices: [0, 1, 2],
      metrics,
      pinnedLeft: [],
      pinnedRight: [],
      pinnedLeftWidth: 0,
      pinnedRightWidth: 0,
      containerWidthForColumns: 640,
      indexColumnWidth: 0,
      scrollDirection: 0,
      version: 1,
      zoom: 1,
    }

    const snapshot = createEmptyColumnSnapshot<DataGridColumn>()
    updateColumnSnapshot({
      snapshot,
      meta: baseMeta,
      range: { start: 0, end: 3 },
      payload: {
        visibleStart: 0,
        visibleEnd: 3,
        leftPadding: 0,
        rightPadding: 0,
        totalScrollableWidth: metrics.totalWidth,
        visibleScrollableWidth: metrics.totalWidth,
      },
      getColumnKey: column => column.key,
      resolveColumnWidth: column => column.width ?? 0,
    })

    const clearSpy = vi.spyOn(snapshot.columnWidthMap, "clear")
    const setSpy = vi.spyOn(snapshot.columnWidthMap, "set")

    updateColumnSnapshot({
      snapshot,
      meta: {
        ...baseMeta,
        version: 2,
        // Same width-layout references, only meta version changed.
        metrics,
      },
      range: { start: 0, end: 3 },
      payload: {
        visibleStart: 0,
        visibleEnd: 3,
        leftPadding: 0,
        rightPadding: 0,
        totalScrollableWidth: metrics.totalWidth,
        visibleScrollableWidth: metrics.totalWidth,
      },
      getColumnKey: column => column.key,
      resolveColumnWidth: column => column.width ?? 0,
    })

    expect(clearSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
  })
})
