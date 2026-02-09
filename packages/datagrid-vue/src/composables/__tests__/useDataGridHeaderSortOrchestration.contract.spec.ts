import { describe, expect, it } from "vitest"
import { ref } from "vue"
import { useDataGridHeaderSortOrchestration } from "../useDataGridHeaderSortOrchestration"

describe("useDataGridHeaderSortOrchestration contract", () => {
  it("returns sort entry metadata and aria mapping", () => {
    const sortState = ref([{ key: "service", direction: "asc" }] as const)
    const sort = useDataGridHeaderSortOrchestration({
      sortState,
      isSortableColumn: columnKey => columnKey !== "select",
    })

    expect(sort.getSortEntry("service")).toEqual({
      entry: { key: "service", direction: "asc" },
      index: 0,
    })
    expect(sort.getHeaderSortDirection("service")).toBe("asc")
    expect(sort.getHeaderSortPriority("service")).toBe(1)
    expect(sort.getHeaderAriaSort("service")).toBe("ascending")
    expect(sort.getHeaderAriaSort("owner")).toBe("none")
  })

  it("cycles header sort direction on repeated clicks", () => {
    const sortState = ref([] as const)
    const sort = useDataGridHeaderSortOrchestration({
      sortState,
      isSortableColumn: () => true,
    })

    sort.applySortFromHeader("service", false)
    expect(sortState.value).toEqual([{ key: "service", direction: "asc" }])

    sort.applySortFromHeader("service", false)
    expect(sortState.value).toEqual([{ key: "service", direction: "desc" }])

    sort.applySortFromHeader("service", false)
    expect(sortState.value).toEqual([])
  })

  it("keeps existing sort entries when keepExisting is enabled", () => {
    const sortState = ref([
      { key: "service", direction: "asc" },
    ] as const)
    const sort = useDataGridHeaderSortOrchestration({
      sortState,
      isSortableColumn: () => true,
    })

    sort.applySortFromHeader("owner", true)
    expect(sortState.value).toEqual([
      { key: "service", direction: "asc" },
      { key: "owner", direction: "asc" },
    ])
  })

  it("applies explicit sort and clear actions", () => {
    const sortState = ref([
      { key: "service", direction: "asc" },
      { key: "owner", direction: "desc" },
    ] as const)
    const sort = useDataGridHeaderSortOrchestration({
      sortState,
      isSortableColumn: columnKey => columnKey !== "select",
    })

    sort.applyExplicitSort("owner", "asc")
    expect(sortState.value).toEqual([{ key: "owner", direction: "asc" }])

    sort.applyExplicitSort("owner", null)
    expect(sortState.value).toEqual([])
  })

  it("ignores non-sortable columns", () => {
    const sortState = ref([{ key: "service", direction: "asc" }] as const)
    const sort = useDataGridHeaderSortOrchestration({
      sortState,
      isSortableColumn: columnKey => columnKey !== "select",
    })

    sort.applySortFromHeader("select", false)
    sort.applyExplicitSort("select", "asc")
    expect(sortState.value).toEqual([{ key: "service", direction: "asc" }])
  })
})
