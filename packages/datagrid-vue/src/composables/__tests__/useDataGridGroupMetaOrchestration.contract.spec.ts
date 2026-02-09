import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridGroupMetaOrchestration } from "../useDataGridGroupMetaOrchestration"

interface Row {
  rowId: string
  region: string
}

describe("useDataGridGroupMetaOrchestration contract", () => {
  it("builds group start rows and counts for grouped dataset", () => {
    const rows = ref<readonly Row[]>([
      { rowId: "r1", region: "eu" },
      { rowId: "r2", region: "eu" },
      { rowId: "r3", region: "us" },
    ])
    const groupBy = ref<"region" | "none">("region")
    const api = useDataGridGroupMetaOrchestration<Row, "region">({
      rows,
      groupBy,
      resolveRowId: row => row.rowId,
      resolveGroupValue: row => row.region,
    })

    expect(api.groupCount.value).toBe(2)
    expect(api.groupMeta.value.starts.has("r1")).toBe(true)
    expect(api.groupMeta.value.starts.has("r3")).toBe(true)
    expect(api.groupMeta.value.counts.get("r1")).toBe(2)
    expect(api.groupMeta.value.counts.get("r3")).toBe(1)
    expect(api.resolveGroupBadgeText("r1")).toBe("eu (2)")
    expect(api.resolveGroupBadgeText("r3")).toBe("us (1)")
  })

  it("returns empty meta when grouping is disabled", () => {
    const rows = ref<readonly Row[]>([
      { rowId: "r1", region: "eu" },
      { rowId: "r2", region: "us" },
    ])
    const groupBy = ref<"region" | "none">("none")
    const api = useDataGridGroupMetaOrchestration<Row, "region">({
      rows,
      groupBy,
      resolveRowId: row => row.rowId,
      resolveGroupValue: row => row.region,
    })

    expect(api.groupCount.value).toBe(0)
    expect(api.groupBySummary.value).toBe("none")
    expect(api.isGroupStartRow("r1")).toBe(false)
    expect(api.groupMeta.value.starts.size).toBe(0)
  })

  it("normalizes empty group values to (empty)", () => {
    const rows = ref<readonly Row[]>([
      { rowId: "r1", region: "" },
      { rowId: "r2", region: "" },
    ])
    const groupBy = ref<"region" | "none">("region")
    const api = useDataGridGroupMetaOrchestration<Row, "region">({
      rows,
      groupBy,
      resolveRowId: row => row.rowId,
      resolveGroupValue: row => row.region,
    })

    expect(api.resolveGroupBadgeText("r1")).toBe("(empty) (2)")
    expect(api.groupCount.value).toBe(1)
  })
})
