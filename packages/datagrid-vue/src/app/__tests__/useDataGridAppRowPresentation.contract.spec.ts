import { createDataGridColumnModel } from "@affino/datagrid-core"
import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridAppRowPresentation } from "../useDataGridAppRowPresentation"

function createRuntimeColumnSnapshot(columns: readonly Array<Record<string, unknown>>) {
  const model = createDataGridColumnModel({
    columns: columns as never,
  })
  const snapshot = model.getSnapshot()
  return {
    value: {
      byKey: snapshot.byKey,
      visibleColumns: snapshot.visibleColumns,
    },
  }
}

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
        columnSnapshot: createRuntimeColumnSnapshot([]),
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

  it("formats display values using the canonical column presentation format without changing raw cell reads", () => {
    const presentation = useDataGridAppRowPresentation({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            expandGroup: vi.fn(),
            collapseGroup: vi.fn(),
          },
        },
        columnSnapshot: createRuntimeColumnSnapshot([{
          key: "amount",
          dataType: "currency",
          presentation: {
            format: {
              number: {
                locale: "en-GB",
                style: "currency",
                currency: "GBP",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            },
          },
        }]),
      } as never,
      viewportRowStart: ref(0),
      firstColumnKey: ref("name"),
    })

    const row = {
      kind: "data",
      rowId: 1,
      data: {
        amount: 1234.5,
      },
    } as never

    expect(presentation.readCell(row, "amount")).toBe("1234.5")
    expect(presentation.readDisplayCell(row, "amount")).toBe("£1,234.50")
  })

  it("formats display dates without changing raw cell reads", () => {
    const presentation = useDataGridAppRowPresentation({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            expandGroup: vi.fn(),
            collapseGroup: vi.fn(),
          },
        },
        columnSnapshot: createRuntimeColumnSnapshot([{
          key: "start",
          dataType: "date",
          presentation: {
            format: {
              dateTime: {
                locale: "en-GB",
                timeZone: "UTC",
                year: "numeric",
                month: "short",
                day: "2-digit",
              },
            },
          },
        }]),
      } as never,
      viewportRowStart: ref(0),
      firstColumnKey: ref("name"),
    })

    const date = new Date("2026-03-01T00:00:00.000Z")
    const row = {
      kind: "data",
      rowId: 1,
      data: {
        start: date,
      },
    } as never

    expect(presentation.readCell(row, "start")).toBe(String(date))
    expect(presentation.readDisplayCell(row, "start")).toBe("01 Mar 2026")
  })

  it("renders checkbox cell types through the shared cell engine", () => {
    const presentation = useDataGridAppRowPresentation({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            expandGroup: vi.fn(),
            collapseGroup: vi.fn(),
          },
        },
        columnSnapshot: createRuntimeColumnSnapshot([{
          key: "approved",
          cellType: "checkbox",
        }]),
      } as never,
      viewportRowStart: ref(0),
      firstColumnKey: ref("name"),
    })

    const row = {
      kind: "data",
      rowId: 1,
      data: {
        approved: true,
      },
    } as never

    expect(presentation.readCell(row, "approved")).toBe("true")
    expect(presentation.readDisplayCell(row, "approved")).toBe("☑")
  })
})
