import { describe, expect, it } from "vitest"
import { useDataGridInlineEditorSchema } from "../useDataGridInlineEditorSchema"

describe("useDataGridInlineEditorSchema contract", () => {
  const schema = useDataGridInlineEditorSchema({
    enumOptionsByColumn: {
      severity: ["critical", "high", "medium", "low"],
      status: ["stable", "watch", "degraded"],
    },
  })

  it("returns enum column keys and options", () => {
    expect(schema.enumColumnKeys).toEqual(["severity", "status"])
    expect(schema.getEditorOptions("severity")).toEqual(["critical", "high", "medium", "low"])
  })

  it("detects enum columns and option membership", () => {
    expect(schema.isEnumColumn("severity")).toBe(true)
    expect(schema.isEnumColumn("owner")).toBe(false)
    expect(schema.hasEditorOption("status", "watch")).toBe(true)
    expect(schema.hasEditorOption("status", "unknown")).toBe(false)
  })

  it("returns null for non-enum columns", () => {
    expect(schema.getEditorOptions("owner")).toBeNull()
  })
})
