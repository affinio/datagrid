import { describe, expect, it, vi } from "vitest"
import { useDataGridColumnFilterOrchestration } from "../useDataGridColumnFilterOrchestration"

interface Row {
  rowId: string
  service: string
  region: string
  latencyMs: number
}

describe("useDataGridColumnFilterOrchestration contract", () => {
  function createRows(): Row[] {
    return [
      { rowId: "r1", service: "api", region: "us-east", latencyMs: 120 },
      { rowId: "r2", service: "worker", region: "eu-west", latencyMs: 45 },
    ]
  }

  it("opens filter draft with kind-specific defaults", () => {
    const rows = createRows()
    const api = useDataGridColumnFilterOrchestration<Row>({
      resolveColumnFilterKind: key => (key === "latencyMs" ? "number" : key === "region" ? "enum" : "text"),
      resolveEnumFilterOptions: key => (key === "region" ? ["eu-west", "us-east"] : []),
      resolveColumnLabel: key => key,
      resolveCellValue: (row, key) => row[key as keyof Row],
      isFilterableColumn: key => key !== "select",
    })

    api.openColumnFilter("region")
    expect(api.activeFilterColumnKey.value).toBe("region")
    expect(api.columnFilterDraft.value).toEqual({
      columnKey: "region",
      kind: "enum",
      operator: "is",
      value: "eu-west",
      value2: "",
    })

    api.openColumnFilter("latencyMs")
    expect(api.columnFilterDraft.value?.kind).toBe("number")
    expect(api.columnFilterDraft.value?.operator).toBe("equals")
    expect(api.columnFilterOperatorOptions.value.map(option => option.value)).toContain("between")
    expect(rows).toHaveLength(2)
  })

  it("applies and clears filters with action messages", () => {
    const setLastAction = vi.fn()
    const api = useDataGridColumnFilterOrchestration<Row>({
      resolveColumnFilterKind: key => (key === "latencyMs" ? "number" : "text"),
      resolveEnumFilterOptions: () => [],
      resolveColumnLabel: key => key,
      resolveCellValue: (row, key) => row[key as keyof Row],
      setLastAction,
    })

    api.openColumnFilter("service")
    api.onFilterValueInput("api")
    api.applyActiveColumnFilter()
    expect(api.appliedColumnFilters.value.service).toEqual({
      kind: "text",
      operator: "contains",
      value: "api",
      value2: undefined,
    })
    expect(setLastAction).toHaveBeenCalledWith("Filter applied: service")

    api.openColumnFilter("service")
    api.resetActiveColumnFilter()
    expect(api.appliedColumnFilters.value.service).toBeUndefined()
    expect(setLastAction).toHaveBeenCalledWith("Filter reset: service")
  })

  it("matches rows and builds DataGrid filter snapshot", () => {
    const rows = createRows()
    const api = useDataGridColumnFilterOrchestration<Row>({
      resolveColumnFilterKind: key => (key === "latencyMs" ? "number" : "text"),
      resolveEnumFilterOptions: () => [],
      resolveColumnLabel: key => key,
      resolveCellValue: (row, key) => row[key as keyof Row],
    })

    const filters = {
      service: { kind: "text" as const, operator: "contains", value: "api" },
      latencyMs: { kind: "number" as const, operator: "gte", value: "100" },
    }

    expect(api.rowMatchesColumnFilters(rows[0], filters)).toBe(true)
    expect(api.rowMatchesColumnFilters(rows[1], filters)).toBe(false)

    expect(api.buildFilterSnapshot(filters)).toEqual({
      columnFilters: {},
      advancedFilters: {
        service: {
          type: "text",
          clauses: [{ operator: "contains", value: "api", value2: undefined }],
        },
        latencyMs: {
          type: "number",
          clauses: [{ operator: "gte", value: "100", value2: undefined }],
        },
      },
    })
  })
})
