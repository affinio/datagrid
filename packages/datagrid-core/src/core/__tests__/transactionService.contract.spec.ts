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

function createDeferred(): { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void } {
  let resolve: () => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<void>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })
  return { promise, resolve, reject }
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

  it("rejects concurrent history actions while an async apply is in flight", async () => {
    const state: Record<string, number> = { score: 0 }
    const events: string[] = []
    const deferred = createDeferred()
    let firstApplyBlocked = true
    const service = createDataGridTransactionService({
      execute: async (command, context) => {
        const payload = command.payload as CounterPayload
        events.push(`${context.direction}:${context.transactionId}:${context.commandIndex}:${payload.value}`)
        if (context.direction === "apply" && firstApplyBlocked) {
          firstApplyBlocked = false
          await deferred.promise
        }
        state[payload.key] = payload.value
      },
    })

    const applyPromise = service.applyTransaction({
      id: "tx-1",
      commands: [{ type: "set", payload: { key: "score", value: 1 }, rollbackPayload: { key: "score", value: 0 } }],
    })

    await expect(
      service.applyTransaction({
        id: "tx-2",
        commands: [{ type: "set", payload: { key: "score", value: 2 }, rollbackPayload: { key: "score", value: 0 } }],
      }),
    ).rejects.toThrow(/apply transaction.*in progress/i)
    await expect(service.commitBatch()).rejects.toThrow(/apply transaction.*in progress/i)
    expect(() => service.beginBatch()).toThrow(/apply transaction.*in progress/i)

    deferred.resolve()
    await expect(applyPromise).resolves.toBe("tx-1")
    expect(state.score).toBe(1)
    expect(service.getSnapshot().undoDepth).toBe(1)
    expect(events).toEqual(["apply:tx-1:0:1"])
  })

  it("rejects concurrent undo and redo while an async undo is in flight", async () => {
    const state: Record<string, number> = { score: 0 }
    const events: string[] = []
    const deferred = createDeferred()
    let undoBlocked = true
    const service = createDataGridTransactionService({
      execute: async (command, context) => {
        const payload = command.payload as CounterPayload
        events.push(`${context.direction}:${context.transactionId}:${context.commandIndex}:${payload.value}`)
        if (context.direction === "undo" && undoBlocked) {
          undoBlocked = false
          await deferred.promise
        }
        state[payload.key] = payload.value
      },
    })

    await service.applyTransaction({
      id: "tx-1",
      commands: [{ type: "set", payload: { key: "score", value: 1 }, rollbackPayload: { key: "score", value: 0 } }],
    })

    const undoPromise = service.undo()
    await expect(service.undo()).rejects.toThrow(/undo.*in progress/i)
    await expect(service.redo()).rejects.toThrow(/undo.*in progress/i)
    await expect(
      service.applyTransaction({
        id: "tx-2",
        commands: [{ type: "set", payload: { key: "score", value: 2 }, rollbackPayload: { key: "score", value: 1 } }],
      }),
    ).rejects.toThrow(/undo.*in progress/i)

    deferred.resolve()
    await expect(undoPromise).resolves.toBe("commit-1")
    expect(state.score).toBe(0)
    expect(service.getSnapshot().undoDepth).toBe(0)
    expect(service.getSnapshot().redoDepth).toBe(1)
    expect(events).toEqual(["apply:tx-1:0:1", "undo:tx-1:0:0"])
  })

  it("compensates commands already rolled back when undo fails within a transaction", async () => {
    const state: Record<string, number> = { a: 0, b: 0 }
    const events: string[] = []
    const service = createDataGridTransactionService({
      execute: async (command, context) => {
        const payload = command.payload as CounterPayload
        events.push(`${context.direction}:${context.transactionId}:${context.commandIndex}:${payload.key}:${payload.value}`)
        if (context.direction === "undo" && payload.key === "a") {
          throw new Error("undo a failed")
        }
        state[payload.key] = payload.value
      },
    })

    await service.applyTransaction({
      id: "tx-ab",
      commands: [
        { type: "set", payload: { key: "a", value: 1 }, rollbackPayload: { key: "a", value: 0 } },
        { type: "set", payload: { key: "b", value: 2 }, rollbackPayload: { key: "b", value: 0 } },
      ],
    })

    await expect(service.undo()).rejects.toThrow(/undo failed/i)

    expect(state).toEqual({ a: 1, b: 2 })
    expect(service.getSnapshot().undoDepth).toBe(1)
    expect(service.getSnapshot().redoDepth).toBe(0)
    expect(events).toEqual([
      "apply:tx-ab:0:a:1",
      "apply:tx-ab:1:b:2",
      "undo:tx-ab:1:b:0",
      "undo:tx-ab:0:a:0",
      "redo:tx-ab:1:b:2",
    ])
  })

  it("compensates transactions already rolled back when undo fails within a batch", async () => {
    const state: Record<string, number> = { a: 0, b: 0 }
    const events: string[] = []
    const service = createDataGridTransactionService({
      execute: async (command, context) => {
        const payload = command.payload as CounterPayload
        events.push(`${context.direction}:${context.transactionId}:${context.commandIndex}:${payload.key}:${payload.value}`)
        if (context.direction === "undo" && payload.key === "a") {
          throw new Error("undo a failed")
        }
        state[payload.key] = payload.value
      },
    })

    const batchId = service.beginBatch("batch")
    await service.applyTransaction({
      id: "tx-a",
      commands: [{ type: "set", payload: { key: "a", value: 1 }, rollbackPayload: { key: "a", value: 0 } }],
    })
    await service.applyTransaction({
      id: "tx-b",
      commands: [{ type: "set", payload: { key: "b", value: 2 }, rollbackPayload: { key: "b", value: 0 } }],
    })
    await service.commitBatch(batchId)

    await expect(service.undo()).rejects.toThrow(/undo failed/i)

    expect(state).toEqual({ a: 1, b: 2 })
    expect(service.getSnapshot().undoDepth).toBe(1)
    expect(service.getSnapshot().redoDepth).toBe(0)
    expect(events).toEqual([
      "apply:tx-a:0:a:1",
      "apply:tx-b:0:b:2",
      "undo:tx-b:0:b:0",
      "undo:tx-a:0:a:0",
      "redo:tx-b:0:b:2",
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
