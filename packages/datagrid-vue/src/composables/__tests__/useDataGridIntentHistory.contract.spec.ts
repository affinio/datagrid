import { describe, expect, it } from "vitest"
import { ref } from "vue"
import { useDataGridIntentHistory } from "../useDataGridIntentHistory"

interface TestSnapshot {
  value: number
}

describe("useDataGridIntentHistory contract", () => {
  it("records intent transactions and replays undo/redo deterministically", async () => {
    const state = ref(0)

    const history = useDataGridIntentHistory<TestSnapshot>({
      maxHistoryDepth: 16,
      captureSnapshot() {
        return { value: state.value }
      },
      applySnapshot(snapshot) {
        state.value = snapshot.value
      },
    })

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)

    const beforeSnapshot = { value: state.value }
    state.value = 42
    const committedId = await history.recordIntentTransaction(
      { intent: "edit", label: "Set value", affectedRange: null },
      beforeSnapshot,
    )

    expect(committedId).toBeTruthy()
    expect(history.transactionSnapshot.value.undoDepth).toBe(1)
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)

    const committedBatchId = history.transactionSnapshot.value.lastCommittedId
    const undoId = await history.runHistoryAction("undo")
    expect(undoId).toBe(committedBatchId)
    expect(state.value).toBe(0)
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)

    const redoId = await history.runHistoryAction("redo")
    expect(redoId).toBe(committedBatchId)
    expect(state.value).toBe(42)
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)

    history.dispose()
  })

  it("awaits async snapshot replay before resolving undo and redo", async () => {
    const state = ref(1)
    let pendingResolve: () => void = () => undefined
    const appliedSnapshots: number[] = []

    const history = useDataGridIntentHistory<TestSnapshot>({
      captureSnapshot() {
        return { value: state.value }
      },
      applySnapshot(snapshot) {
        appliedSnapshots.push(snapshot.value)
        return new Promise<void>((resolve: (value: void | PromiseLike<void>) => void) => {
          pendingResolve = resolve
        }).then(() => {
          state.value = snapshot.value
        })
      },
    })

    const beforeSnapshot = { value: state.value }
    state.value = 2
    await history.recordIntentTransaction(
      { intent: "edit", label: "Set value", affectedRange: null },
      beforeSnapshot,
    )

    const undoPromise = history.runHistoryAction("undo")
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)
    expect(state.value).toBe(2)
    pendingResolve()
    await undoPromise
    expect(state.value).toBe(1)
    expect(appliedSnapshots).toEqual([1])

    const redoPromise = history.runHistoryAction("redo")
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)
    pendingResolve()
    await redoPromise
    expect(state.value).toBe(2)
    expect(appliedSnapshots).toEqual([1, 2])

    history.dispose()
  })

  it("returns null when recording after disposal", async () => {
    const state = ref(3)
    const history = useDataGridIntentHistory<TestSnapshot>({
      captureSnapshot() {
        return { value: state.value }
      },
      applySnapshot(snapshot) {
        state.value = snapshot.value
      },
    })

    history.dispose()
    const committedId = await history.recordIntentTransaction(
      { intent: "edit", label: "No-op after dispose" },
      { value: 3 },
    )
    expect(committedId).toBeNull()
  })
})
