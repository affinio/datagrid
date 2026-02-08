import { describe, expect, it } from "vitest"
import {
  createDataGridTransactionService,
  type DataGridTransactionCommand,
  type DataGridTransactionExecutionContext,
} from "../transactionService"

interface CounterPayload {
  key: string
  value: number
}

function createCounterExecutor(
  state: Record<string, number>,
  events: string[],
  failOnApplyValue?: number,
) {
  return async (
    command: DataGridTransactionCommand,
    context: DataGridTransactionExecutionContext,
  ): Promise<void> => {
    const payload = command.payload as CounterPayload
    events.push(`${context.direction}:${context.transactionId}:${context.commandIndex}:${payload.value}`)
    if (context.direction === "apply" && payload.value === failOnApplyValue) {
      throw new Error(`failed on value ${payload.value}`)
    }
    state[payload.key] = payload.value
  }
}

describe("transaction service contracts", () => {
  it("applies transaction atomically and supports undo/redo hooks", async () => {
    const state: Record<string, number> = { score: 0 }
    const events: string[] = []
    const hooks: string[] = []
    const service = createDataGridTransactionService({
      execute: createCounterExecutor(state, events),
      onApplied(event) {
        hooks.push(`applied:${event.committedId}:${event.transactionIds.join(",")}`)
      },
      onUndone(event) {
        hooks.push(`undone:${event.committedId}:${event.transactionIds.join(",")}`)
      },
      onRedone(event) {
        hooks.push(`redone:${event.committedId}:${event.transactionIds.join(",")}`)
      },
    })

    const transactionId = await service.applyTransaction({
      id: "tx-score",
      commands: [
        { type: "set", payload: { key: "score", value: 1 }, rollbackPayload: { key: "score", value: 0 } },
        { type: "set", payload: { key: "score", value: 2 }, rollbackPayload: { key: "score", value: 1 } },
      ],
    })

    expect(transactionId).toBe("tx-score")
    expect(state.score).toBe(2)
    expect(service.getSnapshot().undoDepth).toBe(1)
    expect(service.canUndo()).toBe(true)

    await service.undo()
    expect(state.score).toBe(0)
    expect(service.canRedo()).toBe(true)

    await service.redo()
    expect(state.score).toBe(2)
    expect(service.getSnapshot().redoDepth).toBe(0)
    expect(hooks).toEqual([
      "applied:commit-1:tx-score",
      "undone:commit-1:tx-score",
      "redone:commit-1:tx-score",
    ])

    expect(events).toEqual([
      "apply:tx-score:0:1",
      "apply:tx-score:1:2",
      "undo:tx-score:1:1",
      "undo:tx-score:0:0",
      "redo:tx-score:0:1",
      "redo:tx-score:1:2",
    ])
  })

  it("rolls back already applied commands when apply fails", async () => {
    const state: Record<string, number> = { score: 0 }
    const events: string[] = []
    const rollbackEvents: string[] = []
    const service = createDataGridTransactionService({
      execute: createCounterExecutor(state, events, 2),
      onRolledBack(event) {
        rollbackEvents.push(`${event.committedId}:${event.transactionIds.join(",")}`)
      },
    })

    await expect(
      service.applyTransaction({
        id: "tx-fail",
        commands: [
          { type: "set", payload: { key: "score", value: 1 }, rollbackPayload: { key: "score", value: 0 } },
          { type: "set", payload: { key: "score", value: 2 }, rollbackPayload: { key: "score", value: 1 } },
        ],
      }),
    ).rejects.toThrow(/apply failed/i)

    expect(state.score).toBe(0)
    expect(service.getSnapshot().undoDepth).toBe(0)
    expect(rollbackEvents).toEqual(["commit-1:tx-fail"])
    expect(events).toEqual([
      "apply:tx-fail:0:1",
      "apply:tx-fail:1:2",
      "rollback:tx-fail:0:0",
    ])
  })

  it("queues transactions in batch and commits as a single undo unit", async () => {
    const state: Record<string, number> = { score: 0 }
    const events: string[] = []
    const service = createDataGridTransactionService({
      execute: createCounterExecutor(state, events),
    })

    const batchId = service.beginBatch("bulk update")
    await service.applyTransaction({
      id: "tx-1",
      commands: [{ type: "set", payload: { key: "score", value: 1 }, rollbackPayload: { key: "score", value: 0 } }],
    })
    await service.applyTransaction({
      id: "tx-2",
      commands: [{ type: "set", payload: { key: "score", value: 2 }, rollbackPayload: { key: "score", value: 1 } }],
    })

    expect(state.score).toBe(0)
    expect(service.getSnapshot().pendingBatch?.size).toBe(2)

    const committed = await service.commitBatch(batchId)
    expect(committed).toEqual(["tx-1", "tx-2"])
    expect(state.score).toBe(2)
    expect(service.getSnapshot().undoDepth).toBe(1)

    await service.undo()
    expect(state.score).toBe(0)
    await service.redo()
    expect(state.score).toBe(2)

    expect(events).toEqual([
      "apply:tx-1:0:1",
      "apply:tx-2:0:2",
      "undo:tx-2:0:1",
      "undo:tx-1:0:0",
      "redo:tx-1:0:1",
      "redo:tx-2:0:2",
    ])
  })

  it("caps undo history depth while preserving deterministic apply/undo order", async () => {
    const state: Record<string, number> = { score: 0 }
    const events: string[] = []
    const service = createDataGridTransactionService({
      execute: createCounterExecutor(state, events),
      maxHistoryDepth: 2,
    })

    await service.applyTransaction({
      id: "tx-1",
      commands: [{ type: "set", payload: { key: "score", value: 1 }, rollbackPayload: { key: "score", value: 0 } }],
    })
    await service.applyTransaction({
      id: "tx-2",
      commands: [{ type: "set", payload: { key: "score", value: 2 }, rollbackPayload: { key: "score", value: 1 } }],
    })
    await service.applyTransaction({
      id: "tx-3",
      commands: [{ type: "set", payload: { key: "score", value: 3 }, rollbackPayload: { key: "score", value: 2 } }],
    })

    expect(state.score).toBe(3)
    expect(service.getSnapshot().undoDepth).toBe(2)

    await service.undo()
    expect(state.score).toBe(2)
    await service.undo()
    expect(state.score).toBe(1)
    await expect(service.undo()).resolves.toBeNull()
    expect(state.score).toBe(1)

    expect(events).toEqual([
      "apply:tx-1:0:1",
      "apply:tx-2:0:2",
      "apply:tx-3:0:3",
      "undo:tx-3:0:2",
      "undo:tx-2:0:1",
    ])
  })

  it("propagates normalized intent metadata for transaction and command events", async () => {
    const state: Record<string, number> = { score: 0 }
    const eventTransactions: Array<readonly string[]> = []
    const eventIntents: Array<string | undefined> = []
    const eventRanges: Array<string | null> = []

    const service = createDataGridTransactionService({
      execute: createCounterExecutor(state, []),
      onApplied(event) {
        eventTransactions.push(event.transactions.map(entry => entry.id))
        const transactionMeta = event.transactions[0]?.meta
        eventIntents.push(transactionMeta?.intent)
        const range = transactionMeta?.affectedRange ?? null
        eventRanges.push(range ? `${range.startRow}:${range.endRow}:${range.startColumn}:${range.endColumn}` : null)
      },
    })

    await service.applyTransaction({
      id: "tx-meta",
      label: "Paste range",
      meta: {
        intent: "  paste  ",
        affectedRange: {
          startRow: 4,
          endRow: 2,
          startColumn: 7,
          endColumn: 5,
        },
      },
      commands: [
        {
          type: "set",
          payload: { key: "score", value: 1 },
          rollbackPayload: { key: "score", value: 0 },
          meta: { intent: "paste" },
        },
      ],
    })

    expect(eventTransactions).toEqual([["tx-meta"]])
    expect(eventIntents).toEqual(["paste"])
    expect(eventRanges).toEqual(["2:4:5:7"])
  })
})
