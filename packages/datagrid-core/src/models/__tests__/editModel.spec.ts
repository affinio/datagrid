import { describe, expect, it } from "vitest"
import { createDataGridEditModel } from "../index"

describe("createDataGridEditModel", () => {
  it("stores, updates and clears edits deterministically", () => {
    const model = createDataGridEditModel()
    const snapshots: number[] = []
    model.subscribe(snapshot => snapshots.push(snapshot.revision))

    model.setEdit({ rowId: "r-2", columnKey: "status", value: "open" })
    model.setEdit({ rowId: "r-1", columnKey: "owner", value: "alice" })
    model.setEdit({ rowId: "r-1", columnKey: "owner", value: "alice" }) // no-op

    const snapshot = model.getSnapshot()
    expect(snapshot.revision).toBe(2)
    expect(snapshot.edits.map(entry => `${entry.rowId}:${entry.columnKey}`)).toEqual([
      "r-1:owner",
      "r-2:status",
    ])
    expect(model.getEdit("r-1", "owner")?.value).toBe("alice")

    model.clearEdit("r-2", "status")
    expect(model.getEdit("r-2", "status")).toBeUndefined()
    expect(model.getSnapshot().revision).toBe(3)
    expect(snapshots).toEqual([1, 2, 3])
    model.dispose()
  })

  it("applies batch patches and clearAll in single revision steps", () => {
    const model = createDataGridEditModel()
    const revisions: number[] = []
    model.subscribe(snapshot => revisions.push(snapshot.revision))

    model.setEdits([
      { rowId: 1, columnKey: "value", value: "a" },
      { rowId: 2, columnKey: "value", value: "b" },
    ])
    expect(model.getSnapshot().revision).toBe(1)

    model.clearAll()
    expect(model.getSnapshot().revision).toBe(2)
    expect(model.getSnapshot().edits).toHaveLength(0)
    expect(revisions).toEqual([1, 2])
    model.dispose()
  })

  it("throws for invalid edit identity inputs", () => {
    const model = createDataGridEditModel()
    expect(() =>
      model.setEdit({ rowId: null as unknown as string, columnKey: "value", value: 1 }),
    ).toThrowError(/rowId/)
    expect(() =>
      model.setEdit({ rowId: "row", columnKey: "", value: 1 }),
    ).toThrowError(/columnKey/)
    model.dispose()
  })
})
