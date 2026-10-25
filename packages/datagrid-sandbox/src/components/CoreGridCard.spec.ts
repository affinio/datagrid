import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import CoreGridCard from "./CoreGridCard.vue"

describe("CoreGridCard grouping", () => {
  it("hides grouped fields, shows group labels and sums, and exposes expansion controls", async () => {
    const wrapper = mount(CoreGridCard, {
      attachTo: document.body,
      props: { title: "Core grouping test" },
    })

    const groupBy = wrapper.findAll("label")
      .find(label => label.text().trim().startsWith("Group by"))
      ?.find("select")
    expect(groupBy?.exists()).toBe(true)
    await groupBy!.setValue("owner")
    await flushPromises()

    expect(wrapper.find('.grid-header-row [data-column-key="owner"]').exists()).toBe(false)
    expect(wrapper.findAll(".grid-row.row--group").length).toBeGreaterThan(0)
    expect(wrapper.find(".core-group-cell").attributes("aria-expanded")).toBe("true")
    expect(wrapper.find(".grid-row.row--group [data-column-key=\"amount\"]").text()).not.toBe("")

    await wrapper.find(".core-group-cell").trigger("click")
    await flushPromises()
    expect(wrapper.find(".core-group-cell").attributes("aria-expanded")).toBe("false")

    await wrapper.findAll(".group-actions button")[0]?.trigger("click")
    await flushPromises()
    expect(wrapper.find(".core-group-cell").attributes("aria-expanded")).toBe("true")

    await groupBy!.setValue("")
    await flushPromises()
    expect(wrapper.find('.grid-header-row [data-column-key="owner"]').exists()).toBe(true)
    expect(wrapper.find(".grid-row.row--group").exists()).toBe(false)

    await groupBy!.setValue("owner,source")
    await flushPromises()
    expect(wrapper.find('.grid-header-row [data-column-key="owner"]').exists()).toBe(false)
    expect(wrapper.find('.grid-header-row [data-column-key="source"]').exists()).toBe(false)
    expect(wrapper.find(".core-group-cell__field").exists()).toBe(true)
    wrapper.unmount()
  })
})
