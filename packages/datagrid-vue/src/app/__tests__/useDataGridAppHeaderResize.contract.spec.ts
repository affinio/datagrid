import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"
import { useDataGridAppHeaderResize } from "../useDataGridAppHeaderResize"

function createHeaderResize() {
  const persistColumnWidth = vi.fn()
  const headerResize = useDataGridAppHeaderResize({
    visibleColumns: ref([
      {
        key: "service",
        width: 120,
        column: {
          key: "service",
          label: "Service",
        },
      } as DataGridColumnSnapshot,
    ]),
    rows: ref<Array<Record<string, string>>>([{ service: "API" }, { service: "Longer service name" }]),
    persistColumnWidth,
    isFillDragging: () => false,
    stopFillSelection: vi.fn(),
    isDragSelecting: () => false,
    stopDragSelection: vi.fn(),
    readCellText: (row, columnKey) => String(row[columnKey] ?? ""),
  })
  return { headerResize, persistColumnWidth }
}

describe("useDataGridAppHeaderResize contract", () => {
  it("ignores touch-generated column resize mousedown events", () => {
    const { headerResize } = createHeaderResize()
    const event = new MouseEvent("mousedown", { cancelable: true, button: 0, clientX: 120 })
    Object.defineProperty(event, "sourceCapabilities", {
      configurable: true,
      value: { firesTouchEvents: true },
    })

    headerResize.startResize(event, "service")

    expect(event.defaultPrevented).toBe(false)
    expect(headerResize.isColumnResizing.value).toBe(false)
  })

  it("keeps desktop column resize mousedown behavior", () => {
    const { headerResize } = createHeaderResize()
    const event = new MouseEvent("mousedown", { cancelable: true, button: 0, clientX: 120 })

    headerResize.startResize(event, "service")

    expect(event.defaultPrevented).toBe(true)
    expect(headerResize.isColumnResizing.value).toBe(true)
  })

  it("ignores touch-generated column autosize double-click events", () => {
    const { headerResize, persistColumnWidth } = createHeaderResize()
    const event = new MouseEvent("dblclick", { cancelable: true })
    Object.defineProperty(event, "sourceCapabilities", {
      configurable: true,
      value: { firesTouchEvents: true },
    })

    headerResize.handleResizeDoubleClick(event, "service")

    expect(event.defaultPrevented).toBe(false)
    expect(persistColumnWidth).not.toHaveBeenCalled()
  })

  it("keeps desktop column autosize double-click behavior", () => {
    const { headerResize, persistColumnWidth } = createHeaderResize()
    const event = new MouseEvent("dblclick", { cancelable: true })

    headerResize.handleResizeDoubleClick(event, "service")

    expect(event.defaultPrevented).toBe(true)
    expect(persistColumnWidth).toHaveBeenCalledWith("service", expect.any(Number))
  })
})
