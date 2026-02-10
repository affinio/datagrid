import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridVirtualRangeMetrics } from "../useDataGridVirtualRangeMetrics"

describe("useDataGridVirtualRangeMetrics contract", () => {
  it("returns empty range and zero spacers for empty dataset", () => {
    const api = useDataGridVirtualRangeMetrics({
      totalRows: ref(0),
      scrollTop: ref(0),
      viewportHeight: ref(400),
      rowHeight: 40,
      overscan: 4,
    })

    expect(api.virtualRange.value).toEqual({ start: 0, end: -1 })
    expect(api.spacerTopHeight.value).toBe(0)
    expect(api.spacerBottomHeight.value).toBe(0)
    expect(api.rangeLabel.value).toBe("0-0")
  })

  it("computes start/end with overscan and spacer heights", () => {
    const totalRows = ref(100)
    const scrollTop = ref(400)
    const viewportHeight = ref(320)

    const api = useDataGridVirtualRangeMetrics({
      totalRows,
      scrollTop,
      viewportHeight,
      rowHeight: 40,
      overscan: 2,
    })

    expect(api.virtualRange.value).toEqual({ start: 8, end: 19 })
    expect(api.spacerTopHeight.value).toBe(320)
    expect(api.spacerBottomHeight.value).toBe((100 - 20) * 40)
    expect(api.rangeLabel.value).toBe("9-20")
  })

  it("reuses same range object identity when coordinates are unchanged", () => {
    const totalRows = ref(50)
    const scrollTop = ref(80)
    const viewportHeight = ref(200)

    const api = useDataGridVirtualRangeMetrics({
      totalRows,
      scrollTop,
      viewportHeight,
      rowHeight: 40,
      overscan: 1,
    })

    const first = api.virtualRange.value
    scrollTop.value = 85 // same start/end after floor
    const second = api.virtualRange.value

    expect(first).toStrictEqual(second)
  })

  it("uses virtualWindow snapshot as source of truth when provided", () => {
    const api = useDataGridVirtualRangeMetrics({
      totalRows: ref(0),
      scrollTop: ref(0),
      viewportHeight: ref(0),
      rowHeight: 40,
      overscan: 0,
      virtualWindow: ref({
        rowStart: 5,
        rowEnd: 11,
        rowTotal: 64,
      }),
    })

    expect(api.virtualRange.value).toEqual({ start: 5, end: 11 })
    expect(api.spacerTopHeight.value).toBe(200)
    expect(api.spacerBottomHeight.value).toBe((64 - 12) * 40)
    expect(api.rangeLabel.value).toBe("6-12")
  })
})
