import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridVirtualRangeMetrics } from "../useDataGridVirtualRangeMetrics"

describe("useDataGridVirtualRangeMetrics contract", () => {
  it("returns empty range and zero spacers for empty dataset", () => {
    const api = useDataGridVirtualRangeMetrics({
      virtualWindow: ref({
        rowStart: 0,
        rowEnd: 0,
        rowTotal: 0,
      }),
      rowHeight: 40,
    })

    expect(api.virtualRange.value).toEqual({ start: 0, end: -1 })
    expect(api.spacerTopHeight.value).toBe(0)
    expect(api.spacerBottomHeight.value).toBe(0)
    expect(api.rangeLabel.value).toBe("0-0")
  })

  it("computes start/end and spacer heights from virtual window", () => {
    const virtualWindow = ref({
      rowStart: 8,
      rowEnd: 19,
      rowTotal: 100,
    })

    const api = useDataGridVirtualRangeMetrics({
      virtualWindow,
      rowHeight: 40,
    })

    expect(api.virtualRange.value).toEqual({ start: 8, end: 19 })
    expect(api.spacerTopHeight.value).toBe(320)
    expect(api.spacerBottomHeight.value).toBe((100 - 20) * 40)
    expect(api.rangeLabel.value).toBe("9-20")
  })

  it("reuses same range object identity when virtual window coordinates are unchanged", () => {
    const virtualWindow = ref({
      rowStart: 1,
      rowEnd: 6,
      rowTotal: 50,
    })

    const api = useDataGridVirtualRangeMetrics({
      virtualWindow,
      rowHeight: 40,
    })

    const first = api.virtualRange.value
    virtualWindow.value = {
      rowStart: 1,
      rowEnd: 6,
      rowTotal: 50,
    }
    const second = api.virtualRange.value

    expect(first).toStrictEqual(second)
  })

  it("uses virtualWindow snapshot as source of truth when provided", () => {
    const api = useDataGridVirtualRangeMetrics({
      virtualWindow: ref({
        rowStart: 5,
        rowEnd: 11,
        rowTotal: 64,
      }),
      rowHeight: 40,
    })

    expect(api.virtualRange.value).toEqual({ start: 5, end: 11 })
    expect(api.spacerTopHeight.value).toBe(200)
    expect(api.spacerBottomHeight.value).toBe((64 - 12) * 40)
    expect(api.rangeLabel.value).toBe("6-12")
  })
})
