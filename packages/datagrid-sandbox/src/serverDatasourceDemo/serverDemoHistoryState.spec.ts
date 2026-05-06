import { describe, expect, it } from "vitest"

import {
  hasServerDemoHistoryState,
  normalizeServerDemoHistoryState,
  shouldRefreshHistoryStatusAfterCommit,
} from "./serverDemoHistoryState"

describe("serverDemoHistoryState", () => {
  it("detects history state on commit responses", () => {
    expect(hasServerDemoHistoryState({
      canUndo: true,
      canRedo: false,
    })).toBe(true)
    expect(normalizeServerDemoHistoryState({
      operationId: "op-1",
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "op-1",
      latestRedoOperationId: null,
      affectedRows: 2,
      affectedCells: 4,
    })).toEqual({
      operationId: "op-1",
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "op-1",
      latestRedoOperationId: null,
      affectedRows: 2,
      affectedCells: 4,
    })
  })

  it("falls back to a history status probe when commit responses omit history state", () => {
    expect(shouldRefreshHistoryStatusAfterCommit({
      operationId: "legacy-op",
      revision: "rev-legacy",
    })).toBe(true)
    expect(shouldRefreshHistoryStatusAfterCommit({
      operationId: "modern-op",
      canUndo: true,
      canRedo: false,
    })).toBe(false)
  })
})
