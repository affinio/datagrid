import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import type { DataGridChromePaneModel } from "@affino/datagrid-chrome"
import DataGridTableStageChromeLayer from "../DataGridTableStageChromeLayer.vue"

function createModel(): DataGridChromePaneModel {
  return {
    width: 160,
    height: 96,
    bands: [],
    horizontalLines: [{ position: 31 }],
    verticalLines: [{ position: 80 }],
  }
}

describe("DataGridTableStageChromeLayer", () => {
  it("aligns horizontal divider paint with canvas chrome boundaries", () => {
    const wrapper = mount(DataGridTableStageChromeLayer, {
      props: { model: createModel() },
    })

    const horizontalLine = wrapper.find(".grid-chrome-layer__line--horizontal")

    expect(horizontalLine.attributes("style")).toContain("top: calc(31px - var(--datagrid-row-divider-size))")
  })
})
