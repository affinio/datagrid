import { describe, expect, it, vi } from "vitest"
import {
  type DataGridTableStageHistoryAdapter,
  useDataGridTableStageHistory,
} from "../useDataGridTableStageHistory"

function createRuntime() {
  return {
    api: {
      rows: {
        get: () => null,
        getCount: () => 0,
        setData: vi.fn(),
      },
    },
    getBodyRowAtIndex: () => null,
    resolveBodyRowIndexById: () => -1,
  }
}

describe("useDataGridTableStageHistory", () => {
  it("forwards server fill operation ids to the external history adapter", () => {
    const recordServerFillTransaction = vi.fn()
    const runHistoryAction = vi.fn(async direction => `${direction}:fill-1`)
    const historyAdapter: DataGridTableStageHistoryAdapter = {
      captureSnapshot: () => null,
      recordIntentTransaction: () => undefined,
      recordServerFillTransaction,
      canUndo: () => true,
      canRedo: () => false,
      runHistoryAction,
    }
    const history = useDataGridTableStageHistory<Record<string, unknown>>({
      runtime: createRuntime(),
      cloneRowData: row => ({ ...row }),
      syncViewport: vi.fn(),
      history: historyAdapter,
    })

    history.recordServerFillTransaction({
      intent: "fill",
      label: "Server fill",
      affectedRange: {
        startRow: 1,
        endRow: 3,
        startColumn: 0,
        endColumn: 0,
      },
      operationId: "fill-1",
      revision: "rev-fill-1",
      mode: "copy",
    })

    expect(recordServerFillTransaction).toHaveBeenCalledWith({
      intent: "fill",
      label: "Server fill",
      affectedRange: {
        startRow: 1,
        endRow: 3,
        startColumn: 0,
        endColumn: 0,
      },
      operationId: "fill-1",
      revision: "rev-fill-1",
      mode: "copy",
    })
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)
  })
})
