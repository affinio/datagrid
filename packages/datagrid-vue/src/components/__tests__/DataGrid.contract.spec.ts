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
        default: scope => h("div", { class: "row-count" }, [
          h("span", { class: "rows" }, String(scope.api.getRowCount())),
          h("span", { class: "window-total" }, String(scope.virtualWindow?.rowTotal ?? 0)),
        ]),
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".row-count .rows").text()).toBe("2")
    expect(wrapper.find(".row-count .window-total").text()).toBe("2")

    await wrapper.setProps({
      rows: [
        { rowId: "r1", name: "Alpha" },
        { rowId: "r2", name: "Bravo" },
        { rowId: "r3", name: "Charlie" },
      ] satisfies readonly DemoRow[],
    })
    await flushRuntimeTasks()

    expect(wrapper.find(".row-count .rows").text()).toBe("3")
    expect(wrapper.find(".row-count .window-total").text()).toBe("3")
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
      virtualWindow: { value: { rowTotal: number; colTotal: number } | null }
      start(): Promise<void>
      stop(): void
    }

    expect(typeof exposed.api.getRowCount).toBe("function")
    expect(exposed.api.getRowCount()).toBe(1)
    const exposedWindow = (exposed.virtualWindow as { value?: { rowTotal: number; colTotal: number } | null })?.value ??
      (exposed.virtualWindow as { rowTotal?: number; colTotal?: number } | null)
    expect(exposedWindow?.rowTotal).toBe(1)
    expect(exposedWindow?.colTotal).toBe(1)
    expect(exposed.core.lifecycle.state).toBe("started")
    expect(typeof exposed.start).toBe("function")
    expect(typeof exposed.stop).toBe("function")

    wrapper.unmount()
    await flushRuntimeTasks()
    expect(exposed.core.lifecycle.state).toBe("disposed")
  })
})
