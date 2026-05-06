import { describe, expect, it, vi } from "vitest"
import type { DataGridDataSource } from "@affino/datagrid-vue"
import type { ServerDemoRow } from "./types"
import { createServerDemoDatasourceHttpFillDataSource } from "./serverDemoDatasourceHttpFillDataSource"

function createFallbackDataSource(): DataGridDataSource<ServerDemoRow> {
  return {
    async pull() {
      return { rows: [], total: 0, cursor: null }
    },
    async resolveFillBoundary() {
      return {
        endRowIndex: 1,
        endRowId: "srv-000001",
        boundaryKind: "gap",
        scannedRowCount: 1,
        truncated: false,
      }
    },
    async commitFillOperation() {
      return {
        operationId: "fake-fill",
        affectedRowCount: 1,
        affectedCellCount: 1,
        revision: 1,
        invalidation: null,
        warnings: [],
      }
    },
    async undoFillOperation() {
      return {
        operationId: "fake-fill",
        revision: 1,
        invalidation: null,
        warnings: [],
      }
    },
    async redoFillOperation() {
      return {
        operationId: "fake-fill",
        revision: 1,
        invalidation: null,
        warnings: [],
      }
    },
    subscribe() {
      return () => {}
    },
    invalidate() {},
  }
}

function createProjection() {
  return {
    sortModel: [],
    filterModel: null,
    groupBy: null,
    groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
    treeData: null,
    pivot: null,
    pagination: {
      snapshot: {
        enabled: false,
        pageSize: 0,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 0,
        startIndex: 0,
        endIndex: 0,
      },
      cursor: null,
    },
  }
}

describe("createServerDemoDatasourceHttpFillDataSource", () => {
  it("uses HTTP fill methods when HTTP mode is enabled", async () => {
    const fallback = createFallbackDataSource()
    const refreshHistoryStatus = vi.fn()
    const applyInvalidation = vi.fn()
    const httpResolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 5,
      endRowId: "srv-000005",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 3,
      truncated: true,
    }))
    const httpCommitFillOperation = vi.fn(async () => ({
      operationId: "fill-123",
      affectedRowCount: 2,
      affectedCellCount: 2,
      affectedRows: 2,
      affectedCells: 2,
      revision: "rev-1",
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "fill-123",
      latestRedoOperationId: null,
      invalidation: {
        kind: "range" as const,
        range: {
          start: 1,
          end: 3,
        },
      },
      serverInvalidation: {
        type: "range" as const,
        range: {
          startRow: 1,
          endRow: 3,
          startColumn: "status",
          endColumn: "status",
        },
      },
      warnings: ["server fill committed"],
    }))
    const httpUndoFillOperation = vi.fn(async () => ({
      operationId: "fill-123",
      revision: "rev-undo",
      invalidation: null,
      warnings: [],
    }))
    const httpRedoFillOperation = vi.fn(async () => ({
      operationId: "fill-123",
      revision: "rev-redo",
      invalidation: null,
      warnings: [],
    }))
    const dataSource = createServerDemoDatasourceHttpFillDataSource({
      enabled: true,
      fallbackDataSource: fallback,
      httpDatasource: {
        resolveFillBoundary: httpResolveFillBoundary,
        commitFillOperation: httpCommitFillOperation,
        undoFillOperation: httpUndoFillOperation,
        redoFillOperation: httpRedoFillOperation,
      },
      refreshHistoryStatus,
      applyInvalidation,
    })

    const boundary = await dataSource.resolveFillBoundary!({
      direction: "down",
      baseRange: { start: 0, end: 0 },
      fillColumns: ["name"],
      referenceColumns: ["name"],
      projection: createProjection(),
      startRowIndex: 1,
      startColumnIndex: 0,
      limit: 10,
    })
    const fillResult = await dataSource.commitFillOperation!({
      operationId: "fill-123",
      revision: "rev-before",
      projection: createProjection(),
      sourceRange: { start: 0, end: 0 },
      targetRange: { start: 1, end: 1 },
      fillColumns: ["name"],
      referenceColumns: ["name"],
      mode: "copy",
    })
    const undoResult = await dataSource.undoFillOperation!({
      operationId: "fill-123",
      revision: "rev-before",
      projection: createProjection(),
    })
    const redoResult = await dataSource.redoFillOperation!({
      operationId: "fill-123",
      revision: "rev-before",
      projection: createProjection(),
    })

    expect(httpResolveFillBoundary).toHaveBeenCalledTimes(1)
    expect(httpCommitFillOperation).toHaveBeenCalledTimes(1)
    expect(httpUndoFillOperation).toHaveBeenCalledTimes(1)
    expect(httpRedoFillOperation).toHaveBeenCalledTimes(1)
    expect(applyInvalidation).toHaveBeenCalledTimes(2)
    expect(applyInvalidation).toHaveBeenNthCalledWith(1, { type: "dataset" })
    expect(applyInvalidation).toHaveBeenNthCalledWith(2, { type: "dataset" })
    expect(refreshHistoryStatus).toHaveBeenCalledTimes(2)
    expect(boundary).toMatchObject({ boundaryKind: "cache-boundary", endRowIndex: 5 })
    expect(fillResult).toMatchObject({
      operationId: "fill-123",
      revision: "rev-1",
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "fill-123",
      latestRedoOperationId: null,
    })
    expect(undoResult).toMatchObject({ operationId: "fill-123", revision: "rev-undo" })
    expect(redoResult).toMatchObject({ operationId: "fill-123", revision: "rev-redo" })
  })

  it("keeps the fake datasource untouched when HTTP mode is disabled", async () => {
    const fallback = createFallbackDataSource()
    const httpResolveFillBoundary = vi.fn()
    const dataSource = createServerDemoDatasourceHttpFillDataSource({
      enabled: false,
      fallbackDataSource: fallback,
      httpDatasource: {
        resolveFillBoundary: httpResolveFillBoundary,
        commitFillOperation: vi.fn(),
        undoFillOperation: vi.fn(),
        redoFillOperation: vi.fn(),
      },
    })

    const boundary = await dataSource.resolveFillBoundary!({
      direction: "down",
      baseRange: { start: 0, end: 0 },
      fillColumns: ["name"],
      referenceColumns: ["name"],
      projection: createProjection(),
      startRowIndex: 1,
      startColumnIndex: 0,
      limit: 10,
    })

    expect(httpResolveFillBoundary).not.toHaveBeenCalled()
    expect(boundary).toMatchObject({ boundaryKind: "gap", endRowIndex: 1 })
  })

  it("leaves commit range invalidation to the grid refresh path", async () => {
    const fallback = createFallbackDataSource()
    const applyInvalidation = vi.fn()
    const httpCommitFillOperation = vi.fn(async () => ({
      operationId: "fill-range",
      affectedRowCount: 2,
      affectedCellCount: 2,
      revision: "rev-range",
      canUndo: true,
      canRedo: false,
      serverInvalidation: {
        type: "range" as const,
        range: {
          startRow: 1,
          endRow: 2,
          startColumn: "name",
          endColumn: "name",
        },
      },
      warnings: [],
    }))
    const dataSource = createServerDemoDatasourceHttpFillDataSource({
      enabled: true,
      fallbackDataSource: fallback,
      httpDatasource: {
        resolveFillBoundary: vi.fn(),
        commitFillOperation: httpCommitFillOperation,
        undoFillOperation: vi.fn(),
        redoFillOperation: vi.fn(),
      },
      applyInvalidation,
    })

    await dataSource.commitFillOperation!({
      operationId: "fill-range",
      revision: "rev-before",
      projection: createProjection(),
      sourceRange: { start: 0, end: 0 },
      targetRange: { start: 1, end: 2 },
      fillColumns: ["name"],
      referenceColumns: ["name"],
      mode: "copy",
    })

    expect(httpCommitFillOperation).toHaveBeenCalledTimes(1)
    expect(applyInvalidation).not.toHaveBeenCalled()
  })

  it("refreshes history status for legacy fill responses without history state", async () => {
    const fallback = createFallbackDataSource()
    const refreshHistoryStatus = vi.fn()
    const httpCommitFillOperation = vi.fn(async () => ({
      operationId: "fill-legacy",
      affectedRowCount: 1,
      affectedCellCount: 1,
      revision: "rev-legacy",
      invalidation: null,
      warnings: [],
    }))
    const dataSource = createServerDemoDatasourceHttpFillDataSource({
      enabled: true,
      fallbackDataSource: fallback,
      httpDatasource: {
        resolveFillBoundary: vi.fn(),
        commitFillOperation: httpCommitFillOperation,
        undoFillOperation: vi.fn(async () => ({ operationId: "fill-legacy", revision: "rev-undo", invalidation: null, warnings: [] })),
        redoFillOperation: vi.fn(async () => ({ operationId: "fill-legacy", revision: "rev-redo", invalidation: null, warnings: [] })),
      },
      refreshHistoryStatus,
    })

    const result = await dataSource.commitFillOperation!({
      operationId: "fill-legacy",
      revision: "rev-before",
      projection: createProjection(),
      sourceRange: { start: 0, end: 0 },
      targetRange: { start: 1, end: 1 },
      fillColumns: ["name"],
      referenceColumns: ["name"],
      mode: "copy",
    })

    expect(result).toMatchObject({ operationId: "fill-legacy", revision: "rev-legacy" })
    expect(refreshHistoryStatus).toHaveBeenCalledTimes(1)
  })
})
