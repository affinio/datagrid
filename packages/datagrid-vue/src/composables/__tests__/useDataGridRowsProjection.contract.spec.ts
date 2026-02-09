import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridRowsProjection } from "../useDataGridRowsProjection"

interface Row {
  rowId: string
  service: string
  owner: string
  latencyMs: number
}

interface Filters {
  minLatency?: number
}

describe("useDataGridRowsProjection contract", () => {
  const rows: Row[] = [
    { rowId: "r1", service: "api", owner: "ops", latencyMs: 200 },
    { rowId: "r2", service: "worker", owner: "platform", latencyMs: 80 },
    { rowId: "r3", service: "api", owner: "platform", latencyMs: 120 },
  ]

  it("normalizes query and filters rows by searchable columns", () => {
    const api = useDataGridRowsProjection<Row, Filters>({
      rows: ref(rows),
      query: ref("  API "),
      searchableColumnKeys: ref(["service"]),
      hasColumnFilters: ref(false),
      appliedColumnFilters: ref({}),
      sortModel: ref([]),
      resolveCellValue: (row, key) => row[key as keyof Row],
      rowMatchesColumnFilters: () => true,
      fallbackQueryColumnKeys: ["owner"],
    })

    expect(api.normalizedQuickFilter.value).toBe("api")
    expect(api.filteredAndSortedRows.value.map(row => row.rowId)).toEqual(["r1", "r3"])
  })

  it("applies column filters and stable sort", () => {
    const api = useDataGridRowsProjection<Row, Filters>({
      rows: ref(rows),
      query: ref(""),
      searchableColumnKeys: ref(["service", "owner"]),
      hasColumnFilters: ref(true),
      appliedColumnFilters: ref({ minLatency: 100 }),
      sortModel: ref([{ key: "service", direction: "asc" }]),
      resolveCellValue: (row, key) => row[key as keyof Row],
      rowMatchesColumnFilters: (row, filters) => row.latencyMs >= (filters.minLatency ?? 0),
    })

    expect(api.filteredAndSortedRows.value.map(row => row.rowId)).toEqual(["r1", "r3"])
  })

  it("uses fallback query columns when searchable keys are empty", () => {
    const api = useDataGridRowsProjection<Row, Filters>({
      rows: ref(rows),
      query: ref("platform"),
      searchableColumnKeys: ref([]),
      hasColumnFilters: ref(false),
      appliedColumnFilters: ref({}),
      sortModel: ref([]),
      resolveCellValue: (row, key) => row[key as keyof Row],
      rowMatchesColumnFilters: () => true,
      fallbackQueryColumnKeys: ["owner"],
    })

    expect(api.filteredAndSortedRows.value.map(row => row.rowId)).toEqual(["r2", "r3"])
  })
})
