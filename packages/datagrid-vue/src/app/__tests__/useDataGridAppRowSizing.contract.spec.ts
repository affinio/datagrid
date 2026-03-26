import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridRowNode } from "@affino/datagrid-core"
import { useDataGridAppRowSizing } from "../useDataGridAppRowSizing"

type DemoRow = Record<string, unknown>

function createRuntime() {
  return {
    api: {
      view: {
        getRowHeightOverride: vi.fn<(rowIndex: number) => number | null>(() => null),
        setRowHeightOverride: vi.fn(),
        measureRowHeight: vi.fn(),
      },
    },
  } as const
}

function createRow(rowId = "row-1"): DataGridRowNode<DemoRow> {
  return {
    rowId,
    kind: "data",
    data: {},
    state: {},
  } as unknown as DataGridRowNode<DemoRow>
}

describe("useDataGridAppRowSizing contract", () => {
  it("keeps fixed row height in tree mode", () => {
    const runtime = createRuntime()
    runtime.api.view.getRowHeightOverride.mockReturnValueOnce(42)
    const sizing = useDataGridAppRowSizing<DemoRow>({
      mode: ref("tree"),
      rowHeightMode: ref("fixed"),
      normalizedBaseRowHeight: ref(31),
      viewportRowStart: ref(0),
      runtime: runtime as never,
    })

    expect(sizing.rowStyle(createRow(), 0)).toEqual({
      height: "42px",
      minHeight: "42px",
    })
  })

  it("applies the base row height as an auto-mode floor", () => {
    const runtime = createRuntime()
    const sizing = useDataGridAppRowSizing<DemoRow>({
      mode: ref("tree"),
      rowHeightMode: ref("auto"),
      normalizedBaseRowHeight: ref(31),
      viewportRowStart: ref(0),
      runtime: runtime as never,
    })

    expect(sizing.rowStyle(createRow(), 0)).toEqual({
      minHeight: "31px",
    })
  })

  it("keeps auto mode active during manual row resize", () => {
    const runtime = createRuntime()
    const rowHeightMode = ref<"fixed" | "auto">("auto")
    const sizing = useDataGridAppRowSizing<DemoRow>({
      mode: ref("base"),
      rowHeightMode,
      normalizedBaseRowHeight: ref(31),
      viewportRowStart: ref(0),
      runtime: runtime as never,
    })

    sizing.startRowResize(new MouseEvent("mousedown", { clientY: 40 }), createRow(), 0)
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 70 }))
    window.dispatchEvent(new MouseEvent("mouseup", { clientY: 70 }))

    expect(rowHeightMode.value).toBe("auto")
    expect(runtime.api.view.setRowHeightOverride).toHaveBeenCalledWith(0, 61)
  })

  it("measures the maximum visible height for a row across rendered lanes in auto mode", () => {
    const runtime = createRuntime()
    const viewport = document.createElement("div")
    const bodyShell = document.createElement("div")
    bodyShell.className = "grid-body-shell"
    bodyShell.appendChild(viewport)

    const centerRow = document.createElement("div")
    centerRow.className = "grid-row"
    centerRow.setAttribute("data-row-index", "0")
    centerRow.getBoundingClientRect = () => ({ height: 44 } as DOMRect)

    const pinnedRow = document.createElement("div")
    pinnedRow.className = "grid-row"
    pinnedRow.setAttribute("data-row-index", "0")
    pinnedRow.getBoundingClientRect = () => ({ height: 68 } as DOMRect)

    bodyShell.appendChild(centerRow)
    bodyShell.appendChild(pinnedRow)

    const sizing = useDataGridAppRowSizing<DemoRow>({
      mode: ref("base"),
      rowHeightMode: ref("auto"),
      normalizedBaseRowHeight: ref(31),
      viewportRowStart: ref(0),
      bodyViewportRef: ref(viewport),
      runtime: runtime as never,
    })

    sizing.measureVisibleRowHeights()

    expect(runtime.api.view.setRowHeightOverride).toHaveBeenCalledWith(0, 68)
  })
})
