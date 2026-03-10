import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridAppRowPresentation } from "../useDataGridAppRowPresentation"

describe("useDataGridAppRowPresentation contract", () => {
  it("renders group labels with an expanded or collapsed caret", () => {
    const presentation = useDataGridAppRowPresentation({
      mode: ref("tree"),
      runtime: {
        api: {
          rows: {
            expandGroup: vi.fn(),
            collapseGroup: vi.fn(),
          },
        },
      } as never,
      viewportRowStart: ref(0),
      firstColumnKey: ref("name"),
    })

    const collapsedLabel = presentation.readCell({
      kind: "group",
      rowId: "group:team=platform",
      data: {},
      state: { expanded: false },
      groupMeta: {
        level: 0,
        groupField: "team",
        groupValue: "Platform",
        childrenCount: 3,
        groupKey: "team:platform",
      },
    } as never, "name")

    const expandedLabel = presentation.readCell({
      kind: "group",
      rowId: "group:team=platform",
      data: {},
      state: { expanded: true },
      groupMeta: {
        level: 0,
        groupField: "team",
        groupValue: "Platform",
        childrenCount: 3,
        groupKey: "team:platform",
      },
    } as never, "name")

    expect(collapsedLabel).toBe("▸ team: Platform (3)")
    expect(expandedLabel).toBe("▾ team: Platform (3)")
  })
})