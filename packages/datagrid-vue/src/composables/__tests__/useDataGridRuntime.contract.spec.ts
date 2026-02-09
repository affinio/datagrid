import { defineComponent, h, nextTick, ref } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { useDataGridRuntime } from "../useDataGridRuntime"

interface RuntimeRow {
  rowId: string
  name: string
}

const COLUMNS = [{ key: "name", label: "Name" }] as const

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
}

describe("useDataGridRuntime contract", () => {
  it("auto-starts lifecycle, syncs rows and disposes on unmount", async () => {
    const rows = ref<RuntimeRow[]>([
      { rowId: "r1", name: "Alpha" },
      { rowId: "r2", name: "Bravo" },
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
    expect(runtime!.api.getRowCount()).toBe(2)

    rows.value = [
      { rowId: "r1", name: "Alpha" },
      { rowId: "r2", name: "Bravo" },
      { rowId: "r3", name: "Charlie" },
    ]
    await flushRuntimeTasks()

    expect(runtime!.api.getRowCount()).toBe(3)

    const inRange = runtime!.syncRowsInRange({ start: 1, end: 2 })
    expect(inRange).toHaveLength(2)
    expect(String(inRange[0]?.rowId)).toBe("r2")
    expect(String(inRange[1]?.rowId)).toBe("r3")

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

    await runtime!.start()
    expect(runtime!.api.lifecycle.state).toBe("started")
    expect(runtime!.api.getRowCount()).toBe(1)

    runtime!.stop()
    await flushRuntimeTasks()
    expect(runtime!.api.lifecycle.state).toBe("disposed")

    wrapper.unmount()
  })
})
