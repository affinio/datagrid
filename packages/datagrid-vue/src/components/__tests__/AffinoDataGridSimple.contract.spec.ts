import { nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoDataGridSimple } from "../AffinoDataGridSimple"

interface DemoRow {
  rowId: string
  service: string
  owner: string
}

const COLUMNS = [
  { key: "service", label: "Service", width: 220 },
  { key: "owner", label: "Owner", width: 180 },
] as const

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
}

describe("AffinoDataGridSimple contract", () => {
  it("renders default sugar surface with toolbar, metrics, and table rows", async () => {
    const wrapper = mount(AffinoDataGridSimple, {
      props: {
        rows: [
          { rowId: "r1", service: "edge-gateway", owner: "NOC" },
          { rowId: "r2", service: "billing-api", owner: "Payments" },
        ] satisfies readonly DemoRow[],
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".affino-datagrid-simple__toolbar").exists()).toBe(true)
    expect(wrapper.find(".affino-datagrid-simple__metrics").text()).toContain("Rows: 2")
    expect(wrapper.findAll("tbody .affino-datagrid-simple__row")).toHaveLength(2)

    await wrapper.get(".affino-datagrid-simple__toolbar-action").trigger("click")
    await flushRuntimeTasks()

    wrapper.unmount()
  })

  it("commits inline edit and emits update:rows", async () => {
    const wrapper = mount(AffinoDataGridSimple, {
      props: {
        rows: [
          { rowId: "r1", service: "edge-gateway", owner: "NOC" },
          { rowId: "r2", service: "billing-api", owner: "Payments" },
        ] satisfies readonly DemoRow[],
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const ownerCell = wrapper.get('td[data-column-key="owner"]')
    await ownerCell.trigger("dblclick")
    await flushRuntimeTasks()

    const editor = wrapper.get('input[data-inline-editor-column-key="owner"]')
    await editor.setValue("qa-owner-demo")
    await editor.trigger("keydown", { key: "Enter" })
    await flushRuntimeTasks()

    const emissions = wrapper.emitted("update:rows") ?? []
    expect(emissions.length).toBeGreaterThan(0)

    const latestRows = emissions[emissions.length - 1]?.[0] as readonly DemoRow[]
    expect(latestRows[0]?.owner).toBe("qa-owner-demo")

    wrapper.unmount()
  })
})
