import { describe, expect, it } from "vitest"
import { useDataGridColumnUiPolicy } from "../useDataGridColumnUiPolicy"

interface Row {
  status: string
  latencyMs: number
  service: string
}

describe("useDataGridColumnUiPolicy contract", () => {
  const rows: Row[] = [
    { status: "degraded", latencyMs: 210, service: "api" },
    { status: "stable", latencyMs: 95, service: "billing" },
    { status: "watch", latencyMs: 140, service: "search" },
  ]

  const policy = useDataGridColumnUiPolicy<Row>({
    resolveCurrentGroupBy: () => "status",
    isEnumColumn: columnKey => columnKey === "status",
    resolveEnumEditorOptions: columnKey => (columnKey === "status" ? ["stable", "watch", "degraded"] : null),
    resolveRows: () => rows,
    resolveCellValue: (row, columnKey) => (row as Record<string, unknown>)[columnKey],
    numericColumnKeys: new Set(["latencyMs"]),
  })

  it("returns grouped/sortable/resizable capability flags", () => {
    expect(policy.isGroupedByColumn("status")).toBe(true)
    expect(policy.isGroupedByColumn("service")).toBe(false)
    expect(policy.isSortableColumn("select")).toBe(false)
    expect(policy.isSortableColumn("service")).toBe(true)
    expect(policy.isColumnResizable("select")).toBe(false)
    expect(policy.isColumnResizable("service")).toBe(true)
  })

  it("resolves filter kind by enum/number/text policy", () => {
    expect(policy.resolveColumnFilterKind("status")).toBe("enum")
    expect(policy.resolveColumnFilterKind("latencyMs")).toBe("number")
    expect(policy.resolveColumnFilterKind("service")).toBe("text")
  })

  it("uses editor options first, then falls back to distinct row values", () => {
    expect(policy.resolveEnumFilterOptions("status")).toEqual(["stable", "watch", "degraded"])
    expect(policy.resolveEnumFilterOptions("service")).toEqual(["api", "billing", "search"])
  })

  it("applies width thresholds for select and regular columns", () => {
    expect(policy.resolveColumnWidth({ key: "select", width: 30 } as never)).toBe(48)
    expect(policy.resolveColumnWidth({ key: "service", width: 80 } as never)).toBe(110)
    expect(policy.resolveColumnWidth({ key: "service", width: 190 } as never)).toBe(190)
  })
})
