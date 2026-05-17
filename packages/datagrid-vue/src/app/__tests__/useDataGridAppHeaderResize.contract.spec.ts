import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"
import { useDataGridAppHeaderResize } from "../useDataGridAppHeaderResize"

function createHeaderResize(options: {
  isFillDragging?: () => boolean
  stopFillSelection?: () => void
  isDragSelecting?: () => boolean
  stopDragSelection?: () => void
} = {}) {
  const persistColumnWidth = vi.fn()
  const stopFillSelection = options.stopFillSelection ?? vi.fn()
  const stopDragSelection = options.stopDragSelection ?? vi.fn()
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
    isFillDragging: options.isFillDragging ?? (() => false),
    stopFillSelection,
    isDragSelecting: options.isDragSelecting ?? (() => false),
    stopDragSelection,
    readCellText: (row, columnKey) => String(row[columnKey] ?? ""),
  })
  return { headerResize, persistColumnWidth, stopFillSelection, stopDragSelection }
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
    expect(headerResize.interactionOwnerSnapshot.value).toEqual({
      owner: "column-resize",
      activeOwners: ["column-resize"],
      hasConflict: false,
    })
  })

  it("lets column resize take owner after stopping active fill and drag selection", () => {
    const { headerResize, stopFillSelection, stopDragSelection } = createHeaderResize({
      isFillDragging: () => true,
      isDragSelecting: () => true,
    })
    const event = new MouseEvent("mousedown", { cancelable: true, button: 0, clientX: 120 })

    headerResize.startResize(event, "service")

    expect(stopFillSelection).toHaveBeenCalledTimes(1)
    expect(stopDragSelection).toHaveBeenCalledTimes(1)
    expect(headerResize.interactionOwnerSnapshot.value).toEqual({
      owner: "column-resize",
      activeOwners: ["column-resize"],
      hasConflict: false,
    })
    headerResize.stopColumnResize()
    expect(headerResize.interactionOwnerSnapshot.value.activeOwners).toEqual([])
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
