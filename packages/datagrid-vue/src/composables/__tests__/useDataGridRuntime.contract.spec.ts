import { defineComponent, h, nextTick, ref } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { useDataGridRuntime } from "../useDataGridRuntime"

interface RuntimeRow {
  rowId: string
  name: string
  tested_at?: number
}

const COLUMNS = [{ key: "name", label: "Name" }] as const

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
}

describe("useDataGridRuntime contract", () => {
  it("auto-starts lifecycle, syncs rows and disposes on unmount", async () => {
    const rows = ref<RuntimeRow[]>([
      { rowId: "r1", name: "Alpha", tested_at: 100 },
      { rowId: "r2", name: "Bravo", tested_at: 200 },
    ])
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeContractHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rows,
          columns: COLUMNS,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.api.lifecycle.state).toBe("started")
    expect(runtime!.api.rows.getCount()).toBe(2)
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(2)
    expect(runtime!.virtualWindow.value?.colTotal).toBe(1)

    rows.value = [
      { rowId: "r1", name: "Alpha", tested_at: 100 },
      { rowId: "r2", name: "Bravo", tested_at: 200 },
      { rowId: "r3", name: "Charlie", tested_at: 300 },
    ]
    await flushRuntimeTasks()

    expect(runtime!.api.rows.getCount()).toBe(3)
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(3)

    runtime!.setAggregationModel({ columns: [{ key: "name", op: "count" }] })
    expect(runtime!.getAggregationModel()).toEqual({
      columns: [{ key: "name", op: "count" }],
    })
    runtime!.setPivotModel({
      rows: ["name"],
      columns: ["tested_at"],
      values: [{ field: "tested_at", agg: "count" }],
    })
    await flushRuntimeTasks()
    expect(runtime!.getPivotModel()).toEqual({
      rows: ["name"],
      columns: ["tested_at"],
      values: [{ field: "tested_at", agg: "count" }],
    })
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(true)

    const exportedPivotLayout = runtime!.exportPivotLayout()
    expect(exportedPivotLayout.pivotModel).toEqual({
      rows: ["name"],
      columns: ["tested_at"],
      values: [{ field: "tested_at", agg: "count" }],
    })
    const exportedPivotInterop = runtime!.exportPivotInterop()
    expect(exportedPivotInterop).not.toBeNull()
    expect(exportedPivotInterop?.layout.pivotModel).toEqual(exportedPivotLayout.pivotModel)
    expect(Array.isArray(exportedPivotInterop?.rows)).toBe(true)
    const pivotSnapshot = runtime!.api.rows.getSnapshot()
    const firstPivotColumn = pivotSnapshot.pivotColumns?.[0]
    const firstPivotRow = runtime!.api.rows.getRange({ start: 0, end: 10 }).find(row => row.kind === "leaf")
    if (firstPivotColumn && firstPivotRow) {
      const drilldown = runtime!.getPivotCellDrilldown({
        rowId: firstPivotRow.rowId,
        columnId: firstPivotColumn.id,
        limit: 50,
      })
      expect(drilldown).not.toBeNull()
      expect(drilldown?.rows.length).toBeGreaterThan(0)
    }

    runtime!.setPivotModel(null)
    await flushRuntimeTasks()
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(false)
    runtime!.importPivotLayout(exportedPivotLayout)
    await flushRuntimeTasks()
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(true)

    // Return to source-row projection before row patch/sort assertions.
    runtime!.setPivotModel(null)
    await flushRuntimeTasks()
    expect(runtime!.columnSnapshot.value.columns.some(column => column.key.startsWith("pivot|"))).toBe(false)

    runtime!.patchRows(
      [{ rowId: "r2", data: { name: "Bravo-updated" } }],
      { recomputeSort: false, recomputeFilter: false, recomputeGroup: false },
    )
    const patched = runtime!.api.rows.getRange({ start: 0, end: 2 })
    expect((patched[1]?.row as { name?: string })?.name).toBe("Bravo-updated")

    runtime!.api.rows.setSortModel([{ key: "tested_at", direction: "desc" }])
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])

    expect(runtime!.autoReapply.value).toBe(false)
    runtime!.applyEdits([{ rowId: "r1", data: { tested_at: 999 } }])
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])

    runtime!.autoReapply.value = true
    runtime!.applyEdits([{ rowId: "r2", data: { tested_at: 1 } }])
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r3", "r2"])

    runtime!.applyEdits(
      [{ rowId: "r3", data: { tested_at: 5000 } }],
      { freezeView: true, reapplyView: true },
    )
    expect(runtime!.api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    const inRange = runtime!.syncRowsInRange({ start: 1, end: 2 })
    expect(inRange).toHaveLength(2)
    expect(String(inRange[0]?.rowId)).toBe("r1")
    expect(String(inRange[1]?.rowId)).toBe("r2")
    expect(runtime!.virtualWindow.value?.rowStart).toBe(1)
    expect(runtime!.virtualWindow.value?.rowEnd).toBe(2)

    wrapper.unmount()
    await flushRuntimeTasks()
    expect(runtime!.api.lifecycle.state).toBe("disposed")
  })

  it("supports manual start mode when autoStart=false", async () => {
    let runtime: ReturnType<typeof useDataGridRuntime<RuntimeRow>> | null = null

    const Host = defineComponent({
      name: "RuntimeManualStartHost",
      setup() {
        runtime = useDataGridRuntime<RuntimeRow>({
          rows: [{ rowId: "r1", name: "Alpha" }],
          columns: COLUMNS,
          autoStart: false,
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(runtime).not.toBeNull()
    expect(runtime!.api.lifecycle.state).toBe("idle")
    expect(runtime!.virtualWindow.value?.rowTotal).toBe(1)

    await runtime!.start()
    expect(runtime!.api.lifecycle.state).toBe("started")
    expect(runtime!.api.rows.getCount()).toBe(1)

    runtime!.stop()
    await flushRuntimeTasks()
    expect(runtime!.api.lifecycle.state).toBe("disposed")

    wrapper.unmount()
  })
})
