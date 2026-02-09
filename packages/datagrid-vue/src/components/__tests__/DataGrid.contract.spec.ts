import { h, nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { DataGrid } from "../DataGrid"

interface DemoRow {
  rowId: string
  name: string
}

const COLUMNS = [{ key: "name", label: "Name" }] as const

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
}

describe("DataGrid component contract", () => {
  it("exposes runtime API via scoped slot and reflects row prop updates", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: [
          { rowId: "r1", name: "Alpha" },
          { rowId: "r2", name: "Bravo" },
        ] satisfies readonly DemoRow[],
        columns: COLUMNS,
      },
      slots: {
        default: scope => h("div", { class: "row-count" }, String(scope.api.getRowCount())),
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".row-count").text()).toBe("2")

    await wrapper.setProps({
      rows: [
        { rowId: "r1", name: "Alpha" },
        { rowId: "r2", name: "Bravo" },
        { rowId: "r3", name: "Charlie" },
      ] satisfies readonly DemoRow[],
    })
    await flushRuntimeTasks()

    expect(wrapper.find(".row-count").text()).toBe("3")
  })

  it("publishes API/core over component expose contract", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: [{ rowId: "r1", name: "Alpha" }] satisfies readonly DemoRow[],
        columns: COLUMNS,
      },
    })
    await flushRuntimeTasks()

    const exposed = wrapper.vm as unknown as {
      api: { getRowCount(): number }
      core: { lifecycle: { state: string } }
      start(): Promise<void>
      stop(): void
    }

    expect(typeof exposed.api.getRowCount).toBe("function")
    expect(exposed.api.getRowCount()).toBe(1)
    expect(exposed.core.lifecycle.state).toBe("started")
    expect(typeof exposed.start).toBe("function")
    expect(typeof exposed.stop).toBe("function")

    wrapper.unmount()
    await flushRuntimeTasks()
    expect(exposed.core.lifecycle.state).toBe("disposed")
  })
})
