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

  it("formats display values using the column presentation number format without changing raw cell reads", () => {
    const presentation = useDataGridAppRowPresentation({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            expandGroup: vi.fn(),
            collapseGroup: vi.fn(),
          },
          columns: {
            getColumn: vi.fn(() => ({
              column: {
                key: "amount",
                dataType: "currency",
                presentation: {
                  numberFormat: {
                    locale: "en-GB",
                    style: "currency",
                    currency: "GBP",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  },
                },
              },
            })),
          },
        },
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
          columns: {
            getColumn: vi.fn(() => ({
              column: {
                key: "start",
                dataType: "date",
                presentation: {
                  dateTimeFormat: {
                    locale: "en-GB",
                    timeZone: "UTC",
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  },
                },
              },
            })),
          },
        },
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
})
