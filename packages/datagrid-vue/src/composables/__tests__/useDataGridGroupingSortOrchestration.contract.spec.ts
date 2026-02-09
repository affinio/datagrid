import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridGroupingSortOrchestration } from "../useDataGridGroupingSortOrchestration"

describe("useDataGridGroupingSortOrchestration contract", () => {
  it("keeps model intact when grouping is disabled", () => {
    const sortState = ref([{ key: "latencyMs", direction: "desc" }] as const)
    const groupBy = ref<"service" | "none">("none")
    const api = useDataGridGroupingSortOrchestration({
      sortState,
      groupBy,
    })

    expect(api.effectiveSortModel.value).toEqual([{ key: "latencyMs", direction: "desc" }])
    expect(api.sortSummary.value).toBe("1:latencyMs:desc")
  })

  it("injects group key with asc when missing", () => {
    const sortState = ref([{ key: "latencyMs", direction: "desc" }] as const)
    const groupBy = ref<"service" | "none">("service")
    const api = useDataGridGroupingSortOrchestration({
      sortState,
      groupBy,
    })

    expect(api.effectiveSortModel.value).toEqual([
      { key: "service", direction: "asc" },
      { key: "latencyMs", direction: "desc" },
    ])
  })

  it("moves existing group key to front and preserves its direction", () => {
    const sortState = ref([
      { key: "latencyMs", direction: "desc" },
      { key: "service", direction: "desc" },
    ] as const)
    const groupBy = ref<"service" | "none">("service")
    const api = useDataGridGroupingSortOrchestration({
      sortState,
      groupBy,
    })

    expect(api.effectiveSortModel.value).toEqual([
      { key: "service", direction: "desc" },
      { key: "latencyMs", direction: "desc" },
    ])
  })

  it("returns none summary when sort state is empty", () => {
    const sortState = ref([] as const)
    const groupBy = ref<"service" | "none">("service")
    const api = useDataGridGroupingSortOrchestration({
      sortState,
      groupBy,
    })

    expect(api.sortSummary.value).toBe("none")
  })
})
