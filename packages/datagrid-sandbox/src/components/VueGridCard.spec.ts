import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { nextTick } from "vue"
import VueGridCard from "./VueGridCard.vue"

describe("VueGridCard grouping", () => {
  it("renders grouped rows in the label column and restores the source column when cleared", async () => {
    const wrapper = mount(VueGridCard, {
      attachTo: document.body,
      props: { title: "Vue adapter grouping test", mode: "base" },
      global: { stubs: { teleport: true } },
    })

    await flushPromises()
    await nextTick()
    const groupBySelect = wrapper.findAll("label")
      .find(label => label.text().trim().startsWith("Group by"))
      ?.find("select")
    const readVisibleColumnCount = (): number => {
      const text = wrapper.findAll(".meta").map(node => node.text()).find(value => value.includes("Columns:")) ?? ""
      return Number(text.match(/Columns:\s*(\d+)/)?.[1] ?? Number.NaN)
    }
    const visibleColumnCountBeforeGrouping = readVisibleColumnCount()
    await groupBySelect?.setValue("region")
    await flushPromises()
    await nextTick()

    expect(readVisibleColumnCount()).toBe(visibleColumnCountBeforeGrouping - 1)
    expect(wrapper.find('.grid-header-row [data-column-key="region"]').exists()).toBe(false)
    const groupToggle = wrapper.find(".datagrid-hierarchy-group__toggle")
    expect(groupToggle.exists()).toBe(true)
    expect(groupToggle.attributes("aria-expanded")).toBe("true")
    expect(groupToggle.element.closest('.grid-cell[data-column-key="name"]')).not.toBeNull()

    await groupToggle.trigger("click")
    await flushPromises()
    expect(wrapper.find(".datagrid-hierarchy-group__toggle").attributes("aria-expanded")).toBe("false")

    await groupBySelect?.setValue("")
    await flushPromises()
    await nextTick()
    expect(readVisibleColumnCount()).toBe(visibleColumnCountBeforeGrouping)
    expect(wrapper.find(".datagrid-hierarchy-group__toggle").exists()).toBe(false)
    wrapper.unmount()
  })
})
