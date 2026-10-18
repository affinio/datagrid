import { describe, expect, it } from "vitest"
import { createClientRowStore } from "../client-row-store.js"

describe("client row store contract", () => {
  it("normalizes raw rows and preserves canonical identities", () => {
    const store = createClientRowStore({ rows: [{ id: "a", value: 1 }, { value: 2 }] })

    expect(store.getRows().map(row => row.rowId)).toEqual(["a", 1])
    expect(store.getRowById("a")?.data).toEqual({ id: "a", value: 1 })
  })

  it("applies a resolver and rejects duplicate identities atomically", () => {
    const store = createClientRowStore({ rows: [{ value: 1 }], resolveRowId: row => `row-${row.value}` })
    const before = store.getSnapshot()

    expect(() => store.setRows([{ value: 2 }, { value: 2 }])).toThrow("Duplicate row id")
    expect(store.getSnapshot().revision).toBe(before.revision)
    expect(store.getSnapshot().rows).toBe(before.rows)
    expect(store.getRow(0)?.rowId).toBe("row-1")
  })

  it("publishes mutations and removes rows by identity", () => {
    const store = createClientRowStore({ rows: [{ id: 1 }] })
    const revisions: number[] = []
    store.subscribe(snapshot => revisions.push(snapshot.revision))

    store.appendRows([{ id: 2 }])
    expect(store.removeRows([1])).toBe(true)
    expect(store.removeRows([99])).toBe(false)
    expect(revisions).toEqual([1, 2])
    expect(store.getRows().map(row => row.rowId)).toEqual([2])
  })

  it("invalidates subscriptions after disposal", () => {
    const store = createClientRowStore()
    let notified = false
    store.subscribe(() => { notified = true })
    store.dispose()

    expect(() => store.setRows([{ id: 1 }])).toThrow("disposed")
    expect(notified).toBe(false)
  })
})
