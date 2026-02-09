import { describe, expect, it } from "vitest"
import { useDataGridEditableValuePolicy } from "../useDataGridEditableValuePolicy"

interface Row {
  owner: string
  severity: "critical" | "high" | "medium" | "low"
  latencyMs: number
}

type ColumnKey = "owner" | "severity" | "latencyMs"

describe("useDataGridEditableValuePolicy contract", () => {
  it("applies text/enum/number edits by strategy", () => {
    const policy = useDataGridEditableValuePolicy<Row, ColumnKey>({
      strategies: {
        owner: {
          kind: "text",
          apply(row, draft) {
            row.owner = draft || row.owner
          },
        },
        severity: {
          kind: "enum",
          isAllowed: draft => ["critical", "high", "medium", "low"].includes(draft),
          apply(row, draft) {
            row.severity = draft as Row["severity"]
          },
          clearable: false,
        },
        latencyMs: {
          kind: "number",
          apply(row, value) {
            row.latencyMs = Math.max(1, Math.round(value))
          },
        },
      },
    })

    const row: Row = { owner: "alice", severity: "medium", latencyMs: 30 }
    policy.applyEditedValue(row, "owner", "bob")
    policy.applyEditedValue(row, "severity", "high")
    policy.applyEditedValue(row, "latencyMs", "12.7")
    expect(row).toEqual({ owner: "bob", severity: "high", latencyMs: 13 })
  })

  it("validates paste values per strategy", () => {
    const policy = useDataGridEditableValuePolicy<Row, ColumnKey>({
      strategies: {
        owner: {
          kind: "text",
          apply: () => undefined,
          canPaste: draft => draft.trim().length > 0,
        },
        severity: {
          kind: "enum",
          isAllowed: draft => ["critical", "high", "medium", "low"].includes(draft),
          apply: () => undefined,
          clearable: false,
        },
        latencyMs: {
          kind: "number",
          apply: () => undefined,
        },
      },
      defaultClearable: true,
    })

    expect(policy.canApplyPastedValue("owner", "   ")).toBe(false)
    expect(policy.canApplyPastedValue("severity", "critical")).toBe(true)
    expect(policy.canApplyPastedValue("severity", "unknown")).toBe(false)
    expect(policy.canApplyPastedValue("latencyMs", "42")).toBe(true)
    expect(policy.canApplyPastedValue("latencyMs", "NaN")).toBe(false)
  })

  it("respects clearability flags", () => {
    const policy = useDataGridEditableValuePolicy<Row, ColumnKey>({
      strategies: {
        owner: { kind: "text", apply: () => undefined },
        severity: {
          kind: "enum",
          isAllowed: () => true,
          apply: () => undefined,
          clearable: false,
        },
        latencyMs: { kind: "number", apply: () => undefined },
      },
    })

    expect(policy.isColumnClearableForCut("owner")).toBe(true)
    expect(policy.isColumnClearableForCut("severity")).toBe(false)
    expect(policy.isColumnClearableForCut("latencyMs")).toBe(true)
  })

  it("clears editable values using policy defaults and clearability", () => {
    const policy = useDataGridEditableValuePolicy<Row, ColumnKey>({
      strategies: {
        owner: { kind: "text", apply: () => undefined },
        severity: {
          kind: "enum",
          isAllowed: () => true,
          apply: () => undefined,
          clearable: false,
        },
        latencyMs: { kind: "number", apply: () => undefined },
      },
    })

    const row: Row = { owner: "alice", severity: "medium", latencyMs: 12 }
    expect(policy.clearEditedValue(row, "owner")).toBe(true)
    expect(row.owner).toBe("")
    expect(policy.clearEditedValue(row, "severity")).toBe(false)
    expect(row.severity).toBe("medium")
    expect(policy.clearEditedValue(row, "latencyMs")).toBe(true)
    expect(row.latencyMs).toBe(0)
  })
})
