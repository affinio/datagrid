import { describe, expect, it, vi } from "vitest"
import {
  type DataGridCellRefreshRange,
  useDataGridCellRefreshBatcher,
} from "../useDataGridCellRefreshBatcher"

describe("useDataGridCellRefreshBatcher contract", () => {
  it("respects maxBatchSize and drains pending ranges across flushes", () => {
    const refreshCalls: Array<readonly DataGridCellRefreshRange[]> = []
    const batcher = useDataGridCellRefreshBatcher(
      {
        refreshCellsByRanges: ranges => {
          refreshCalls.push(ranges)
        },
      },
      { maxBatchSize: 2 },
    )

    batcher.queueByRanges([
      { rowKey: "r1", columnKeys: ["c1"] },
      { rowKey: "r2", columnKeys: ["c1"] },
      { rowKey: "r3", columnKeys: ["c1"] },
      { rowKey: "r4", columnKeys: ["c1"] },
      { rowKey: "r5", columnKeys: ["c1"] },
    ])

    batcher.flush()
    batcher.flush()
    batcher.flush()

    expect(refreshCalls).toHaveLength(3)
    expect(refreshCalls[0]).toHaveLength(2)
    expect(refreshCalls[1]).toHaveLength(2)
    expect(refreshCalls[2]).toHaveLength(1)

    batcher.dispose()
  })

  it("respects frameBudgetMs and limits each flush workload", () => {
    const refreshCalls: Array<readonly DataGridCellRefreshRange[]> = []
    const batcher = useDataGridCellRefreshBatcher(
      {
        refreshCellsByRanges: ranges => {
          refreshCalls.push(ranges)
        },
      },
      { frameBudgetMs: 0 },
    )

    batcher.queueByRanges([
      { rowKey: "r1", columnKeys: ["c1", "c2"] },
      { rowKey: "r2", columnKeys: ["c1", "c2"] },
      { rowKey: "r3", columnKeys: ["c1", "c2"] },
    ])

    batcher.flush()

    expect(refreshCalls).toHaveLength(1)
    expect(refreshCalls[0]).toHaveLength(1)

    batcher.dispose()
  })

  it("reports flush metrics via onBatchFlush instrumentation hook", () => {
    const onBatchFlush = vi.fn()
    const batcher = useDataGridCellRefreshBatcher(
      {
        refreshCellsByRanges: () => {},
      },
      { onBatchFlush },
    )

    batcher.queueByRanges([
      { rowKey: "r1", columnKeys: ["alpha", "beta", "  "] },
      { rowKey: "r2", columnKeys: ["gamma"] },
    ])

    batcher.flush()

    expect(onBatchFlush).toHaveBeenCalledTimes(1)
    expect(onBatchFlush).toHaveBeenCalledWith(2, 3)

    batcher.dispose()
  })

  it("treats immediate as one-shot trigger and does not persist to later batches", () => {
    const refreshCalls: Array<{ options: unknown }> = []
    const batcher = useDataGridCellRefreshBatcher(
      {
        refreshCellsByRanges: (_ranges, options) => {
          refreshCalls.push({ options })
        },
      },
      { maxBatchSize: 1 },
    )

    batcher.queueByRanges([{ rowKey: "r1", columnKeys: ["c1"] }], {
      immediate: true,
      reason: "incident-sync",
    })
    batcher.queueByRanges([{ rowKey: "r2", columnKeys: ["c1"] }])

    batcher.flush()

    expect(refreshCalls).toHaveLength(2)
    expect(refreshCalls[0]?.options).toEqual({ reason: "incident-sync" })
    expect(refreshCalls[1]?.options).toBeUndefined()

    batcher.dispose()
  })

  it("does not treat defaultOptions.immediate as global immediate policy", () => {
    vi.useFakeTimers()
    try {
      const refreshCalls: Array<{ options: unknown }> = []
      const batcher = useDataGridCellRefreshBatcher(
        {
          refreshCellsByRanges: (_ranges, options) => {
            refreshCalls.push({ options })
          },
        },
        {
          defaultOptions: {
            immediate: true,
            reason: "default-reason",
          },
          immediate: false,
        },
      )

      batcher.queueByRanges([{ rowKey: "r1", columnKeys: ["c1"] }])
      expect(refreshCalls).toHaveLength(0)

      vi.runOnlyPendingTimers()
      expect(refreshCalls).toHaveLength(1)
      expect(refreshCalls[0]?.options).toEqual({ reason: "default-reason" })

      batcher.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("accumulates distinct reasons across queued ranges before flush", () => {
    const refreshCalls: Array<{ options: unknown }> = []
    const batcher = useDataGridCellRefreshBatcher(
      {
        refreshCellsByRanges: (_ranges, options) => {
          refreshCalls.push({ options })
        },
      },
      {
        immediate: false,
      },
    )

    batcher.queueByRanges([{ rowKey: "r1", columnKeys: ["c1"] }], { reason: "edit" })
    batcher.queueByRanges([{ rowKey: "r2", columnKeys: ["c1"] }], { reason: "sort" })
    batcher.queueByRanges([{ rowKey: "r3", columnKeys: ["c1"] }], { reason: "filter" })

    batcher.flush()

    expect(refreshCalls).toHaveLength(1)
    expect(refreshCalls[0]?.options).toEqual({ reason: "edit,sort,filter" })

    batcher.dispose()
  })

  it("retains queue-level reason set across partial flush and includes newly queued reasons", () => {
    const refreshCalls: Array<{ options: unknown }> = []
    const batcher = useDataGridCellRefreshBatcher(
      {
        refreshCellsByRanges: (_ranges, options) => {
          refreshCalls.push({ options })
        },
      },
      { maxBatchSize: 1 },
    )

    batcher.queueByRanges([{ rowKey: "r1", columnKeys: ["c1"] }], { reason: "edit" })
    batcher.queueByRanges([{ rowKey: "r2", columnKeys: ["c1"] }], { reason: "sort" })

    batcher.flush()

    batcher.queueByRanges([{ rowKey: "r3", columnKeys: ["c1"] }], { reason: "filter" })
    batcher.flush()

    expect(refreshCalls).toHaveLength(2)
    expect(refreshCalls[0]?.options).toEqual({ reason: "edit,sort" })
    expect(refreshCalls[1]?.options).toEqual({ reason: "edit,sort,filter" })

    batcher.dispose()
  })
})
