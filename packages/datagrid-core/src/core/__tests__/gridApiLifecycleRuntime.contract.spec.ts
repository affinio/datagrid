import { describe, expect, it } from "vitest"
import { createDataGridApiLifecycleRuntime } from "../gridApiLifecycleRuntime"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(nextResolve => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe("DataGrid API lifecycle queue disposal", () => {
  it("rejects accepted queued work after terminal disposal", async () => {
    let state: "initialized" | "disposed" = "initialized"
    const runtime = createDataGridApiLifecycleRuntime({
      coreLifecycle: {
        get state() { return state },
        startupOrder: [],
      } as never,
    })
    const gate = deferred()
    const entered = deferred()
    const started: string[] = []
    const active = runtime.namespace.runExclusive(async () => {
      started.push("active")
      entered.resolve()
      await gate.promise
    })
    await entered.promise
    const queued = runtime.namespace.runExclusive(() => {
      started.push("queued")
    })
    const queuedOutcome = queued.then(() => null, error => error)

    state = "disposed"
    runtime.dispose()
    expect(await queuedOutcome).toMatchObject({ message: expect.stringMatching(/after disposal/i) })
    expect(started).toEqual(["active"])
    gate.resolve()
    await active

    await runtime.namespace.whenIdle()
    expect(started).toEqual(["active"])
    expect(runtime.namespace.isBusy()).toBe(false)
    await expect(runtime.namespace.runExclusive(() => started.push("late"))).rejects.toThrow(/after disposal/i)
    expect(started).toEqual(["active"])
  })
})
