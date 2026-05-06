import { describe, expect, it } from "vitest"
import type { DataGridRowModelSnapshot } from "../../models/rowModel.js"
import {
  buildDataGridSelectionProjectionIdentity,
  canDataGridOperationDelegateToServer,
  collectDataGridSelectionLoadedCoverage,
  createDataGridVirtualSelectionMetadata,
  evaluateDataGridVirtualSelectionOperation,
  getDataGridSelectionMissingRowIntervals,
  getDataGridSelectionVisibleRowOverlap,
  isDataGridSelectionRangeFullyLoaded,
  normalizeDataGridSelectionRangeLike,
} from "../virtualSelection.js"

function createProjectionSnapshot(
  overrides: Partial<DataGridRowModelSnapshot> = {},
): DataGridRowModelSnapshot {
  return {
    kind: "server",
    revision: 1,
    datasetVersion: 10,
    rowCount: 100,
    loading: false,
    error: null,
    viewportRange: { start: 0, end: 20 },
    pagination: {
      enabled: false,
      pageSize: 0,
      currentPage: 0,
      pageCount: 0,
      totalRowCount: 100,
      startIndex: 0,
      endIndex: 99,
    },
    sortModel: [],
    filterModel: null,
    groupBy: null,
    groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
    ...overrides,
  }
}

describe("virtual selection helpers", () => {
  it("normalizes reversed ranges without clamping negative indexes", () => {
    expect(normalizeDataGridSelectionRangeLike({
      startRow: 5,
      endRow: 2,
      startColumn: 3,
      endColumn: 1,
    })).toEqual({
      startRow: 2,
      endRow: 5,
      startColumn: 1,
      endColumn: 3,
    })
    expect(normalizeDataGridSelectionRangeLike({
      startRow: -1,
      endRow: -4,
      startColumn: -2,
      endColumn: -6,
    })).toEqual({
      startRow: -4,
      endRow: -1,
      startColumn: -6,
      endColumn: -2,
    })
  })

  it("rejects missing columns and non-finite inputs without clamping", () => {
    expect(normalizeDataGridSelectionRangeLike({
      startRow: 0,
      endRow: 2,
    })).toBeNull()
    expect(normalizeDataGridSelectionRangeLike({
      startRow: 0,
      endRow: Number.NaN,
      startColumn: 0,
      endColumn: 1,
    })).toBeNull()
    expect(collectDataGridSelectionLoadedCoverage({
      startRow: 0,
      endRow: Number.POSITIVE_INFINITY,
      startColumn: 0,
      endColumn: 1,
    }, {
      isRowLoaded: () => true,
    })).toEqual({
      isFullyLoaded: false,
      loadedRowCount: 0,
      totalRowCount: 0,
      missingIntervals: [],
      rowIds: [],
      scanLimited: false,
    })
  })

  it("reports missing intervals and loaded row ids without collapsing the logical range", () => {
    const range = { startRow: 2, endRow: 8, startColumn: 1, endColumn: 3 }
    const loadedRows = new Set([2, 3, 6, 8])
    const coverage = collectDataGridSelectionLoadedCoverage(range, {
      isRowLoaded: rowIndex => loadedRows.has(rowIndex),
      getRowIdAtIndex: rowIndex => `r${rowIndex}`,
    })

    expect(coverage).toEqual({
      isFullyLoaded: false,
      loadedRowCount: 4,
      totalRowCount: 7,
      missingIntervals: [
        { startRow: 4, endRow: 5 },
        { startRow: 7, endRow: 7 },
      ],
      rowIds: [
        { rowIndex: 2, rowId: "r2" },
        { rowIndex: 3, rowId: "r3" },
        { rowIndex: 6, rowId: "r6" },
        { rowIndex: 8, rowId: "r8" },
      ],
      scanLimited: false,
    })
    expect(isDataGridSelectionRangeFullyLoaded(range, rowIndex => loadedRows.has(rowIndex))).toBe(false)
    expect(getDataGridSelectionMissingRowIntervals(range, rowIndex => loadedRows.has(rowIndex))).toEqual(coverage.missingIntervals)
  })

  it("handles moderate large ranges while documenting row-by-row coverage expectations", () => {
    const coverage = collectDataGridSelectionLoadedCoverage({
      startRow: 0,
      endRow: 999,
      startColumn: 0,
      endColumn: 0,
    }, {
      isRowLoaded: rowIndex => !(rowIndex >= 100 && rowIndex <= 199) && !(rowIndex >= 500 && rowIndex <= 505),
    })

    expect(coverage.totalRowCount).toBe(1000)
    expect(coverage.loadedRowCount).toBe(894)
    expect(coverage.isFullyLoaded).toBe(false)
    expect(coverage.scanLimited).toBe(false)
    expect(coverage.missingIntervals).toEqual([
      { startRow: 100, endRow: 199 },
      { startRow: 500, endRow: 505 },
    ])
  })

  it("caps huge virtual coverage scans and returns safe truncated coverage", () => {
    let scannedRowCount = 0
    const coverage = collectDataGridSelectionLoadedCoverage({
      startRow: 0,
      endRow: 100_000,
      startColumn: 0,
      endColumn: 0,
    }, {
      maxScanRows: 128,
      isRowLoaded: rowIndex => {
        scannedRowCount += 1
        return rowIndex % 2 === 0
      },
      getRowIdAtIndex: rowIndex => `r${rowIndex}`,
    })

    expect(scannedRowCount).toBe(128)
    expect(coverage.scanLimited).toBe(true)
    expect(coverage.isFullyLoaded).toBe(false)
    expect(coverage.loadedRowCount).toBe(64)
    expect(coverage.rowIds).toHaveLength(64)
    expect(coverage.missingIntervals.at(-1)).toEqual({
      startRow: 127,
      endRow: 100_000,
    })
  })

  it("separates materialized, server-delegated, and blocked operation decisions", () => {
    const unloadedCoverage = {
      isFullyLoaded: false,
      loadedRowCount: 1,
      totalRowCount: 3,
      missingIntervals: [{ startRow: 2, endRow: 3 }],
      rowIds: [{ rowIndex: 1, rowId: "r1" }],
    }
    const loadedCoverage = {
      ...unloadedCoverage,
      isFullyLoaded: true,
      missingIntervals: [],
    }

    expect(evaluateDataGridVirtualSelectionOperation("copy", unloadedCoverage)).toMatchObject({
      allowed: false,
      mode: "blocked",
      reason: "Selected range includes unloaded rows and cannot be copied without server support.",
    })
    expect(evaluateDataGridVirtualSelectionOperation("copy", unloadedCoverage, { copy: true })).toMatchObject({
      allowed: true,
      mode: "server",
    })
    expect(evaluateDataGridVirtualSelectionOperation("cut", unloadedCoverage, { copy: true })).toMatchObject({
      allowed: false,
      mode: "blocked",
      reason: "Selected range includes unloaded rows and cannot be cut without server support.",
    })
    expect(evaluateDataGridVirtualSelectionOperation("cut", unloadedCoverage, { cut: true })).toMatchObject({
      allowed: true,
      mode: "server",
    })
    expect(evaluateDataGridVirtualSelectionOperation("cut", unloadedCoverage, { copy: true, clear: true })).toMatchObject({
      allowed: true,
      mode: "server",
    })
    expect(evaluateDataGridVirtualSelectionOperation("fill", unloadedCoverage, { fill: true })).toMatchObject({
      allowed: true,
      mode: "server",
    })
    expect(evaluateDataGridVirtualSelectionOperation("fill", unloadedCoverage)).toMatchObject({
      allowed: false,
      mode: "blocked",
      reason: "Selected fill range includes unloaded rows and server-backed fill is not available.",
    })
    expect(evaluateDataGridVirtualSelectionOperation("clear", loadedCoverage)).toMatchObject({
      allowed: true,
      mode: "materialized",
    })
    expect(evaluateDataGridVirtualSelectionOperation("navigate", unloadedCoverage)).toMatchObject({
      allowed: true,
      mode: "virtual",
    })
    expect(canDataGridOperationDelegateToServer("cut", { copy: true, delete: true })).toBe(false)
  })

  it("returns operation-specific blocked reasons for virtual mutations", () => {
    const coverage = {
      isFullyLoaded: false,
    }

    expect(evaluateDataGridVirtualSelectionOperation("clear", coverage)).toMatchObject({
      allowed: false,
      reason: "Selected range includes unloaded rows and cannot be modified without server support.",
    })
    expect(evaluateDataGridVirtualSelectionOperation("delete", coverage)).toMatchObject({
      allowed: false,
      reason: "Selected range includes unloaded rows and cannot be modified without server support.",
    })
    expect(evaluateDataGridVirtualSelectionOperation("clear", coverage, { clear: true })).toMatchObject({
      allowed: true,
      mode: "server",
    })
    expect(evaluateDataGridVirtualSelectionOperation("delete", coverage, { delete: true })).toMatchObject({
      allowed: true,
      mode: "server",
    })
    expect(evaluateDataGridVirtualSelectionOperation("range-move", coverage)).toMatchObject({
      allowed: false,
      reason: "Selected range includes unloaded rows and range move cannot be performed without server support.",
    })
  })

  it("builds virtual metadata and marks projection identity separately from dataset revision", () => {
    const projectionIdentity = buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      revision: 12,
      datasetVersion: 30,
      rowCount: 10,
      pagination: {
        enabled: false,
        pageSize: 0,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 10,
        startIndex: 0,
        endIndex: 9,
      },
      sortModel: [],
    }))
    const coverage = collectDataGridSelectionLoadedCoverage({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 1,
    }, {
      isRowLoaded: rowIndex => rowIndex !== 1,
      getRowIdAtIndex: rowIndex => `r${rowIndex}`,
    })

    const metadata = createDataGridVirtualSelectionMetadata({
      range: { startRow: 0, endRow: 2, startCol: 0, endCol: 1 },
      anchorCell: { rowIndex: 0, colIndex: 0, rowId: "r0" },
      focusCell: { rowIndex: 2, colIndex: 1, rowId: "r2" },
      coverage,
      projectionIdentity,
    })

    expect(metadata).toMatchObject({
      startRowIndex: 0,
      endRowIndex: 2,
      startColumnIndex: 0,
      endColumnIndex: 1,
      datasetVersion: 30,
      isVirtualSelection: true,
      projectionStale: false,
    })
    expect(getDataGridSelectionVisibleRowOverlap({ startRow: 0, endRow: 5, startCol: 0, endCol: 2 }, { start: 2, end: 3 })).toEqual({
      startRow: 2,
      endRow: 3,
      startColumn: 0,
      endColumn: 2,
    })
  })

  it("computes visible row overlap while preserving selection columns", () => {
    expect(getDataGridSelectionVisibleRowOverlap({
      startRow: 5,
      endRow: 10,
      startColumn: 2,
      endColumn: 4,
    }, {
      startRow: 8,
      endRow: 12,
    })).toEqual({
      startRow: 8,
      endRow: 10,
      startColumn: 2,
      endColumn: 4,
    })
    expect(getDataGridSelectionVisibleRowOverlap({
      startRow: 5,
      endRow: 10,
      startColumn: 2,
      endColumn: 4,
    }, {
      start: 11,
      end: 12,
    })).toBeNull()
  })

  it("keeps projection identity stable for equivalent snapshots and changes for projection inputs", () => {
    const baseKey = buildDataGridSelectionProjectionIdentity(createProjectionSnapshot())?.projectionKey
    expect(buildDataGridSelectionProjectionIdentity(createProjectionSnapshot())?.projectionKey).toBe(baseKey)

    expect(buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      sortModel: [{ key: "name", direction: "asc" }],
    }))?.projectionKey).not.toBe(baseKey)
    expect(buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      filterModel: { columnFilters: { status: { selectedTokens: ["active"] } } } as never,
    }))?.projectionKey).not.toBe(baseKey)
    expect(buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      groupBy: { fields: ["segment"], expandedByDefault: false },
    }))?.projectionKey).not.toBe(baseKey)
    expect(buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      pivotModel: { rows: [], columns: [], values: [] } as never,
    }))?.projectionKey).not.toBe(baseKey)
    expect(buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      pagination: {
        enabled: true,
        pageSize: 25,
        currentPage: 2,
        pageCount: 4,
        totalRowCount: 100,
        startIndex: 25,
        endIndex: 49,
      },
    }))?.projectionKey).not.toBe(baseKey)
  })

  it("reflects revision and datasetVersion without changing projectionKey by themselves", () => {
    const baseIdentity = buildDataGridSelectionProjectionIdentity(createProjectionSnapshot())
    const changedVersionIdentity = buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      revision: 8,
      datasetVersion: 99,
    }))

    expect(changedVersionIdentity).toMatchObject({
      revision: 8,
      datasetVersion: 99,
    })
    expect(changedVersionIdentity?.projectionKey).toBe(baseIdentity?.projectionKey)
  })

  it("serializes cyclic and heavy projection inputs safely", () => {
    const cyclicFilter: Record<string, unknown> = {
      items: Array.from({ length: 256 }, (_, index) => ({ index, value: `v${index}` })),
    }
    cyclicFilter.self = cyclicFilter

    const identity = buildDataGridSelectionProjectionIdentity(createProjectionSnapshot({
      filterModel: cyclicFilter as never,
    }))

    expect(identity?.projectionKey).toContain("[Circular]")
    expect(identity?.projectionKey?.length ?? 0).toBeLessThan(2_000)
  })
})
