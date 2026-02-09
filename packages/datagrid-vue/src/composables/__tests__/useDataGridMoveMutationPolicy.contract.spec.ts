import { describe, expect, it } from "vitest"
import { useDataGridMoveMutationPolicy } from "../useDataGridMoveMutationPolicy"

interface Row {
  rowId: string
  owner: string
  latencyMs: number
  archived: boolean
  note: string
}

type EditableColumnKey = "owner" | "latencyMs"

describe("useDataGridMoveMutationPolicy contract", () => {
  it("applies editable and record-backed move values", () => {
    const policy = useDataGridMoveMutationPolicy<Row, EditableColumnKey>({
      isEditableColumn: (key): key is EditableColumnKey => key === "owner" || key === "latencyMs",
      applyEditedValue(row, key, value) {
        if (key === "owner") {
          row.owner = value
        }
        if (key === "latencyMs") {
          row.latencyMs = Number(value)
        }
      },
      clearEditedValue() {
        return false
      },
      isBlockedColumn: key => key === "select",
    })

    const row: Row = {
      rowId: "r1",
      owner: "alice",
      latencyMs: 10,
      archived: false,
      note: "hello",
    }

    expect(policy.applyValueForMove(row, "owner", "bob")).toBe(true)
    expect(policy.applyValueForMove(row, "note", "next")).toBe(false)
    expect(policy.applyValueForMove(row, "archived", "true")).toBe(false)
    expect(policy.applyValueForMove(row, "latencyMs", "42")).toBe(true)

    expect(row.owner).toBe("bob")
    expect(row.note).toBe("hello")
    expect(row.archived).toBe(false)
    expect(row.latencyMs).toBe(42)
  })

  it("clears editable and record-backed move values", () => {
    const policy = useDataGridMoveMutationPolicy<Row, EditableColumnKey>({
      isEditableColumn: (key): key is EditableColumnKey => key === "owner" || key === "latencyMs",
      applyEditedValue() {
        return
      },
      clearEditedValue(row, key) {
        if (key === "owner") {
          if (row.owner === "") return false
          row.owner = ""
          return true
        }
        if (key === "latencyMs") {
          if (row.latencyMs === 0) return false
          row.latencyMs = 0
          return true
        }
        return false
      },
      isBlockedColumn: key => key === "select",
    })

    const row: Row = {
      rowId: "r1",
      owner: "alice",
      latencyMs: 10,
      archived: true,
      note: "hello",
    }

    expect(policy.clearValueForMove(row, "owner")).toBe(true)
    expect(policy.clearValueForMove(row, "latencyMs")).toBe(true)
    expect(policy.clearValueForMove(row, "archived")).toBe(false)
    expect(policy.clearValueForMove(row, "note")).toBe(false)

    expect(row.owner).toBe("")
    expect(row.latencyMs).toBe(0)
    expect(row.archived).toBe(true)
    expect(row.note).toBe("hello")
  })
})
