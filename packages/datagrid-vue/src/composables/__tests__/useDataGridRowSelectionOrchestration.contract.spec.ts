import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridRowSelectionOrchestration } from "../useDataGridRowSelectionOrchestration"

interface Row {
  rowId: string
}

describe("useDataGridRowSelectionOrchestration contract", () => {
  it("tracks single-row toggles and derived counters", () => {
    const allRows = ref<readonly Row[]>([
      { rowId: "r1" },
      { rowId: "r2" },
      { rowId: "r3" },
    ])
    const visibleRows = ref<readonly Row[]>([
      { rowId: "r1" },
      { rowId: "r2" },
    ])
    const api = useDataGridRowSelectionOrchestration({
      allRows,
      visibleRows,
      resolveRowId: row => row.rowId,
    })

    expect(api.selectedCount.value).toBe(0)
    expect(api.allVisibleSelected.value).toBe(false)
    expect(api.someVisibleSelected.value).toBe(false)

    api.toggleRowSelection("r1", true)
    expect(api.isRowSelected("r1")).toBe(true)
    expect(api.selectedCount.value).toBe(1)
    expect(api.allVisibleSelected.value).toBe(false)
    expect(api.someVisibleSelected.value).toBe(true)
  })

  it("supports select-all for the visible window only", () => {
    const allRows = ref<readonly Row[]>([
      { rowId: "r1" },
      { rowId: "r2" },
      { rowId: "r3" },
    ])
    const visibleRows = ref<readonly Row[]>([
      { rowId: "r1" },
      { rowId: "r2" },
    ])
    const api = useDataGridRowSelectionOrchestration({
      allRows,
      visibleRows,
      resolveRowId: row => row.rowId,
    })

    api.toggleSelectAllVisible(true)
    expect(api.isRowSelected("r1")).toBe(true)
    expect(api.isRowSelected("r2")).toBe(true)
    expect(api.isRowSelected("r3")).toBe(false)
    expect(api.allVisibleSelected.value).toBe(true)

    api.toggleSelectAllVisible(false)
    expect(api.selectedCount.value).toBe(0)
    expect(api.someVisibleSelected.value).toBe(false)
  })

  it("reconciles stale selected row ids against all rows", () => {
    const allRows = ref<readonly Row[]>([
      { rowId: "r1" },
      { rowId: "r2" },
      { rowId: "r3" },
    ])
    const visibleRows = ref<readonly Row[]>([
      { rowId: "r1" },
      { rowId: "r2" },
    ])
    const api = useDataGridRowSelectionOrchestration({
      allRows,
      visibleRows,
      resolveRowId: row => row.rowId,
      initialSelectedRowIds: ["r1", "r999"],
    })

    expect(api.selectedCount.value).toBe(2)
    allRows.value = [
      { rowId: "r1" },
      { rowId: "r4" },
    ]
    api.reconcileSelection()
    expect([...api.selectedRowIds.value]).toEqual(["r1"])
  })
})
