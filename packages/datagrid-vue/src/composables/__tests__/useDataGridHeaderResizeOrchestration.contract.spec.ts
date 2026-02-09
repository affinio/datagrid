import { describe, expect, it, vi } from "vitest"
import { useDataGridHeaderResizeOrchestration } from "../useDataGridHeaderResizeOrchestration"

interface Row {
  value: string
}

describe("useDataGridHeaderResizeOrchestration contract", () => {
  it("auto-sizes, resizes and finalizes pointer resize state", () => {
    const applyColumnWidth = vi.fn()
    const stopFillSelection = vi.fn()
    const stopDragSelection = vi.fn()
    const setLastAction = vi.fn()

    const orchestration = useDataGridHeaderResizeOrchestration<Row>({
      resolveColumnBaseWidth: () => 120,
      resolveColumnLabel: () => "Service",
      resolveRowsForAutoSize: () => [{ value: "API" }, { value: "Longer service name for test" }],
      resolveCellText: row => row.value,
      resolveColumnWidthOverride: () => null,
      resolveColumnMinWidth: columnKey => (columnKey === "select" ? 48 : 110),
      applyColumnWidth,
      isColumnResizable: columnKey => columnKey !== "select",
      isFillDragging: () => true,
      stopFillSelection,
      isDragSelecting: () => true,
      stopDragSelection,
      setLastAction,
      autoSizeSampleLimit: 260,
      autoSizeCharWidth: 7.2,
      autoSizeHorizontalPadding: 28,
      autoSizeMaxWidth: 640,
    })

    const mouseDownEvent = {
      button: 0,
      clientX: 100,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent

    orchestration.onHeaderResizeHandleMouseDown("service", mouseDownEvent)
    expect(stopFillSelection).toHaveBeenCalledWith(false)
    expect(stopDragSelection).toHaveBeenCalledTimes(1)
    expect(orchestration.activeColumnResize.value).toEqual({
      columnKey: "service",
      startClientX: 100,
      startWidth: 120,
      lastWidth: 120,
    })
    expect(orchestration.isColumnResizing.value).toBe(true)

    orchestration.applyColumnResizeFromPointer(170)
    expect(applyColumnWidth).toHaveBeenLastCalledWith("service", 190)
    expect(orchestration.activeColumnResize.value?.lastWidth).toBe(190)

    orchestration.stopColumnResize()
    expect(orchestration.activeColumnResize.value).toBeNull()
    expect(orchestration.isColumnResizing.value).toBe(false)
    expect(setLastAction).toHaveBeenLastCalledWith("Resized service to 190px")
  })

  it("double-click auto-size respects min/max clamp and emits action", () => {
    const applyColumnWidth = vi.fn()
    const setLastAction = vi.fn()
    const orchestration = useDataGridHeaderResizeOrchestration<Row>({
      resolveColumnBaseWidth: () => 120,
      resolveColumnLabel: () => "S",
      resolveRowsForAutoSize: () => [{ value: "x".repeat(1000) }],
      resolveCellText: row => row.value,
      resolveColumnWidthOverride: () => null,
      resolveColumnMinWidth: () => 110,
      applyColumnWidth,
      isColumnResizable: () => true,
      isFillDragging: () => false,
      stopFillSelection: vi.fn(),
      isDragSelecting: () => false,
      stopDragSelection: vi.fn(),
      setLastAction,
      autoSizeSampleLimit: 260,
      autoSizeCharWidth: 7.2,
      autoSizeHorizontalPadding: 28,
      autoSizeMaxWidth: 640,
    })

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent
    orchestration.onHeaderResizeHandleDoubleClick("service", event)

    expect(applyColumnWidth).toHaveBeenCalledWith("service", 640)
    expect(setLastAction).toHaveBeenCalledWith("Auto-sized service to 640px")
  })

  it("setColumnWidth clamps value to minimum for narrow widths", () => {
    const applyColumnWidth = vi.fn()
    const orchestration = useDataGridHeaderResizeOrchestration<Row>({
      resolveColumnBaseWidth: () => 80,
      resolveColumnLabel: () => "S",
      resolveRowsForAutoSize: () => [],
      resolveCellText: () => "",
      resolveColumnWidthOverride: () => null,
      resolveColumnMinWidth: columnKey => (columnKey === "select" ? 48 : 110),
      applyColumnWidth,
      isColumnResizable: () => true,
      isFillDragging: () => false,
      stopFillSelection: vi.fn(),
      isDragSelecting: () => false,
      stopDragSelection: vi.fn(),
      setLastAction: vi.fn(),
      autoSizeSampleLimit: 260,
      autoSizeCharWidth: 7.2,
      autoSizeHorizontalPadding: 28,
      autoSizeMaxWidth: 640,
    })

    orchestration.setColumnWidth("service", 20)
    expect(applyColumnWidth).toHaveBeenCalledWith("service", 110)
  })

  it("ignores non-resizable columns for header-resize handlers", () => {
    const orchestration = useDataGridHeaderResizeOrchestration<Row>({
      resolveColumnBaseWidth: () => 58,
      resolveColumnLabel: () => "Select",
      resolveRowsForAutoSize: () => [],
      resolveCellText: () => "",
      resolveColumnWidthOverride: () => null,
      resolveColumnMinWidth: () => 48,
      applyColumnWidth: vi.fn(),
      isColumnResizable: () => false,
      isFillDragging: () => false,
      stopFillSelection: vi.fn(),
      isDragSelecting: () => false,
      stopDragSelection: vi.fn(),
      setLastAction: vi.fn(),
      autoSizeSampleLimit: 260,
      autoSizeCharWidth: 7.2,
      autoSizeHorizontalPadding: 28,
      autoSizeMaxWidth: 640,
    })
    const event = {
      button: 0,
      clientX: 100,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent
    orchestration.onHeaderResizeHandleMouseDown("select", event)
    expect(orchestration.activeColumnResize.value).toBeNull()
  })
})
