import { defineComponent, h, nextTick, ref } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import type { DataGridRowNodeInput } from "@affino/datagrid-core"
import { useDataGridAppRuntime } from "../useDataGridAppRuntime"

interface RuntimeRow {
  rowId: string
  name: string
}

const COLUMNS = [{ key: "name", label: "Name" }] as const

function buildRows(count: number): RuntimeRow[] {
  return Array.from({ length: count }, (_, index) => ({
    rowId: `r${index}`,
    name: `Row ${index}`,
  }))
}

function buildRowInputs(count: number): DataGridRowNodeInput<RuntimeRow>[] {
  return buildRows(count).map((row, index) => ({
    row,
    rowId: row.rowId,
    originalIndex: index,
    displayIndex: index,
  }))
}

async function flushRuntimeTasks(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

async function waitForRuntimeRows(
  readRows: () => readonly unknown[],
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (readRows().length > 0) {
      return
    }
    await flushRuntimeTasks()
  }
}

describe("useDataGridAppRuntime worker contract", () => {
  it("does not replace worker-owned rows with the app-layer rows ref", async () => {
    const appRows = ref<RuntimeRow[]>(buildRows(512))

    let result: ReturnType<typeof useDataGridAppRuntime<RuntimeRow>> | null = null
    const Host = defineComponent({
      name: "WorkerAppRuntimeHost",
      setup() {
        result = useDataGridAppRuntime<RuntimeRow>({
          mode: ref("worker" as const),
          rows: appRows,
          columns: ref(COLUMNS),
          worker: {
            resolveRowInputsOnDemand: () => buildRowInputs(10_000),
            rowInputsUpdateKey: ref("initial"),
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()
    await flushRuntimeTasks()

    expect(result).not.toBeNull()
    expect(result!.runtime.api.rows.getCount()).toBe(10_000)
    expect(result!.runtime.rowPartition.value.bodyRowCount).toBe(10_000)
    result!.runtime.syncBodyRowsInRange({ start: 208, end: 212 })
    await waitForRuntimeRows(() => result!.runtime.syncBodyRowsInRange({ start: 208, end: 212 }))

    expect(result!.runtime.syncBodyRowsInRange({ start: 208, end: 212 }).map(row => String(row.rowId))).toEqual([
      "r208",
      "r209",
      "r210",
      "r211",
      "r212",
    ])

    appRows.value = buildRows(128)
    await flushRuntimeTasks()

    expect(result!.runtime.api.rows.getCount()).toBe(10_000)

    wrapper.unmount()
    await flushRuntimeTasks()
  })
})
