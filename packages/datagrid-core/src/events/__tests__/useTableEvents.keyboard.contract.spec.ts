import { describe, expect, it, vi } from "vitest"
import { useTableEvents } from "../useTableEvents"

function createKeyboardEvent(
  key: string,
  overrides?: Partial<KeyboardEvent>,
): { event: KeyboardEvent; preventDefault: ReturnType<typeof vi.fn> } {
  const preventDefault = vi.fn()
  return {
    event: {
      key,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault,
      ...overrides,
    } as unknown as KeyboardEvent,
    preventDefault,
  }
}

function createHarness() {
  const calls = {
    moveSelection: [] as Array<{ rowDelta: number; colDelta: number; extend: boolean | undefined }>,
    clearSelection: 0,
    scheduleOverlayUpdate: 0,
    requestEdit: [] as Array<{ rowIndex: number; columnKey: string }>,
    cancelCutPreview: 0,
  }

  const api = useTableEvents({
    isEditingCell: { value: false },
    focusContainer: () => {},
    selection: {
      moveSelection: (rowDelta, colDelta, options) => {
        calls.moveSelection.push({ rowDelta, colDelta, extend: options?.extend })
      },
      moveByTab: () => false,
      moveByPage: () => false,
      triggerEditForSelection: () => ({ rowIndex: 7, columnKey: "severity" }),
      clearSelection: () => {
        calls.clearSelection += 1
      },
      clearSelectionValues: () => false,
      selectCell: () => {},
      scheduleOverlayUpdate: () => {
        calls.scheduleOverlayUpdate += 1
      },
      goToRowEdge: () => true,
      goToColumnEdge: () => true,
      goToGridEdge: () => true,
    },
    clipboard: {
      copySelectionToClipboard: () => {},
      pasteClipboardData: () => {},
      cancelCutPreview: () => {
        calls.cancelCutPreview += 1
      },
    },
    history: {
      undo: () => [],
      redo: () => [],
    },
    zoom: {
      handleZoomWheel: () => {},
      adjustZoom: () => {},
      setZoom: () => {},
    },
    requestEdit: (rowIndex, columnKey) => {
      calls.requestEdit.push({ rowIndex, columnKey })
    },
  })

  return { api, calls }
}

describe("useTableEvents keyboard contract", () => {
  it("clears selection on Escape and updates overlay state", async () => {
    const { api, calls } = createHarness()
    const { event, preventDefault } = createKeyboardEvent("Escape")

    await api.handleKeydown(event)

    expect(calls.cancelCutPreview).toBe(1)
    expect(calls.clearSelection).toBe(1)
    expect(calls.scheduleOverlayUpdate).toBe(2)
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it("moves selection down on Enter and up on Shift+Enter", async () => {
    const { api, calls } = createHarness()
    const { event: enterEvent } = createKeyboardEvent("Enter")
    const { event: shiftEnterEvent } = createKeyboardEvent("Enter", { shiftKey: true })

    await api.handleKeydown(enterEvent)
    await api.handleKeydown(shiftEnterEvent)

    expect(calls.moveSelection).toEqual([
      { rowDelta: 1, colDelta: 0, extend: false },
      { rowDelta: -1, colDelta: 0, extend: false },
    ])
  })

  it("starts edit on F2 using active selection target", async () => {
    const { api, calls } = createHarness()
    const { event } = createKeyboardEvent("F2")

    await api.handleKeydown(event)

    expect(calls.requestEdit).toEqual([{ rowIndex: 7, columnKey: "severity" }])
  })
})
