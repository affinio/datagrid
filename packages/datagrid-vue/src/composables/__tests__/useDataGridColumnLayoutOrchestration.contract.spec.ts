import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridColumnLayoutOrchestration } from "../useDataGridColumnLayoutOrchestration"

interface Column {
  key: string
  pin?: "left" | "right" | "none"
  width: number
}

describe("useDataGridColumnLayoutOrchestration contract", () => {
  it("orders columns by left/center/right pinning and computes metrics", () => {
    const columns = ref<readonly Column[]>([
      { key: "center-a", pin: "none", width: 120 },
      { key: "left-a", pin: "left", width: 60 },
      { key: "right-a", pin: "right", width: 80 },
      { key: "center-b", pin: "none", width: 90 },
    ])
    const viewportWidth = ref(200)
    const scrollLeft = ref(0)

    const api = useDataGridColumnLayoutOrchestration({
      columns,
      resolveColumnWidth: column => column.width,
      viewportWidth,
      scrollLeft,
    })

    expect(api.orderedColumns.value.map(column => column.key)).toEqual([
      "left-a",
      "center-a",
      "center-b",
      "right-a",
    ])
    expect(api.orderedColumnMetrics.value).toEqual([
      { key: "left-a", columnIndex: 0, start: 0, width: 60, end: 60 },
      { key: "center-a", columnIndex: 1, start: 60, width: 120, end: 180 },
      { key: "center-b", columnIndex: 2, start: 180, width: 90, end: 270 },
      { key: "right-a", columnIndex: 3, start: 270, width: 80, end: 350 },
    ])
    expect(api.templateColumns.value).toBe("60px 120px 90px 80px")
  })

  it("exposes sticky styles and sticky detection", () => {
    const columns = ref<readonly Column[]>([
      { key: "left-a", pin: "left", width: 50 },
      { key: "left-b", pin: "left", width: 70 },
      { key: "center-a", pin: "none", width: 100 },
      { key: "right-a", pin: "right", width: 90 },
    ])
    const api = useDataGridColumnLayoutOrchestration({
      columns,
      resolveColumnWidth: column => column.width,
      viewportWidth: ref(260),
      scrollLeft: ref(0),
    })

    expect(api.stickyLeftOffsets.value.get("left-a")).toBe(0)
    expect(api.stickyLeftOffsets.value.get("left-b")).toBe(50)
    expect(api.stickyRightOffsets.value.get("right-a")).toBe(0)
    expect(api.getCellStyle("left-b")).toEqual({ left: "50px" })
    expect(api.getCellStyle("right-a")).toEqual({ right: "0px" })
    expect(api.getCellStyle("center-a")).toEqual({})
    expect(api.isStickyColumn("left-a")).toBe(true)
    expect(api.isStickyColumn("right-a")).toBe(true)
    expect(api.isStickyColumn("center-a")).toBe(false)
  })

  it("computes visible columns window based on scroll position", () => {
    const columns = ref<readonly Column[]>([
      { key: "a", pin: "none", width: 100 },
      { key: "b", pin: "none", width: 100 },
      { key: "c", pin: "none", width: 100 },
      { key: "d", pin: "none", width: 100 },
    ])
    const viewportWidth = ref(180)
    const scrollLeft = ref(110)

    const api = useDataGridColumnLayoutOrchestration({
      columns,
      resolveColumnWidth: column => column.width,
      viewportWidth,
      scrollLeft,
    })

    expect(api.visibleColumnsWindow.value.start).toBe(2)
    expect(api.visibleColumnsWindow.value.end).toBe(3)
    expect(api.visibleColumnsWindow.value.total).toBe(4)
    expect(api.visibleColumnsWindow.value.keys).toBe("b • c")
  })

  it("uses virtualWindow snapshot for visible columns window when provided", () => {
    const columns = ref<readonly Column[]>([
      { key: "a", pin: "none", width: 100 },
      { key: "b", pin: "none", width: 100 },
      { key: "c", pin: "none", width: 100 },
      { key: "d", pin: "none", width: 100 },
    ])

    const api = useDataGridColumnLayoutOrchestration({
      columns,
      resolveColumnWidth: column => column.width,
      viewportWidth: ref(180),
      scrollLeft: ref(0),
      virtualWindow: ref({
        colStart: 2,
        colEnd: 3,
        colTotal: 4,
      }),
    })

    expect(api.visibleColumnsWindow.value.start).toBe(3)
    expect(api.visibleColumnsWindow.value.end).toBe(4)
    expect(api.visibleColumnsWindow.value.total).toBe(4)
    expect(api.visibleColumnsWindow.value.keys).toBe("c • d")
  })
})
