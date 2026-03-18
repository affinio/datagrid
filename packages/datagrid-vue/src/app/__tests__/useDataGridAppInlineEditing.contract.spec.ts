import { nextTick, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot, DataGridRowNode } from "@affino/datagrid-core"
import { useDataGridAppInlineEditing } from "../useDataGridAppInlineEditing"

type DemoRow = { owner: string; status: string; amount: number }

function createHarness() {
  const rows = [
    { rowId: "r1", kind: "data", data: { owner: "Ada", status: "open", amount: 10 } },
    { rowId: "r2", kind: "data", data: { owner: "Lin", status: "closed", amount: 20 } },
  ] as unknown as DataGridRowNode<DemoRow>[]
  const applyEdits = vi.fn((edits: ReadonlyArray<{ rowId: string | number; data: Partial<DemoRow> }>) => {
    for (const edit of edits) {
      const row = rows.find(entry => entry.rowId === edit.rowId)
      if (row && row.kind !== "group") {
        row.data = { ...row.data, ...edit.data }
      }
    }
  })
  const applyCellSelection = vi.fn()
  const ensureActiveCellVisible = vi.fn()
  const recordEditTransaction = vi.fn()
  const api = useDataGridAppInlineEditing<DemoRow, readonly DemoRow[]>({
    mode: ref("base"),
    bodyViewportRef: ref(null),
    visibleColumns: ref([
      { key: "owner", column: { key: "owner" } },
      { key: "status", column: { key: "status" } },
      { key: "amount", column: { key: "amount", dataType: "number" } },
    ] as unknown as readonly DataGridColumnSnapshot[]),
    totalRows: ref(rows.length),
    runtime: {
      api: {
        rows: {
          get: (rowIndex: number) => rows[rowIndex] ?? null,
          applyEdits,
        },
      },
    } as never,
    readCell: (row, columnKey) => String(row.kind === "group" ? "" : (row.data[columnKey as keyof DemoRow] ?? "")),
    resolveRowIndexById: rowId => rows.findIndex(row => row.rowId === rowId),
    applyCellSelection,
    ensureActiveCellVisible,
    isCellEditable: (_row, _rowIndex, columnKey) => columnKey !== "status",
    captureRowsSnapshot: () => rows.map(row => (row.kind === "group" ? {} as DemoRow : { ...row.data })),
    recordEditTransaction,
  })

  return {
    rows,
    applyEdits,
    applyCellSelection,
    ensureActiveCellVisible,
    recordEditTransaction,
    api,
  }
}

describe("useDataGridAppInlineEditing contract", () => {
  it("commits Tab to the next editable cell instead of leaving the grid", async () => {
    const harness = createHarness()
    harness.api.startInlineEdit(harness.rows[0]!, "owner")
    harness.api.editingCellValue.value = "Grace"

    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
    harness.api.handleEditorKeydown(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(harness.applyEdits).toHaveBeenCalledWith([
      {
        rowId: "r1",
        data: { owner: "Grace" },
      },
    ])
    expect(harness.applyCellSelection).toHaveBeenCalledWith({
      rowIndex: 0,
      columnIndex: 2,
      rowId: "r1",
    })
    expect(harness.ensureActiveCellVisible).toHaveBeenCalledWith(0, 2)
  })

  it("commits Shift+Tab to the previous editable cell with row wrap", async () => {
    const harness = createHarness()
    harness.api.startInlineEdit(harness.rows[1]!, "owner")

    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true })
    harness.api.handleEditorKeydown(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(harness.applyCellSelection).toHaveBeenCalledWith({
      rowIndex: 0,
      columnIndex: 2,
      rowId: "r1",
    })
    expect(harness.ensureActiveCellVisible).toHaveBeenCalledWith(0, 2)
  })

  it("keeps Enter on vertical same-column navigation", async () => {
    const harness = createHarness()
    harness.api.startInlineEdit(harness.rows[0]!, "owner")

    const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true })
    harness.api.handleEditorKeydown(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(harness.applyCellSelection).toHaveBeenCalledWith({
      rowIndex: 1,
      columnIndex: 0,
      rowId: "r2",
    })
    expect(harness.ensureActiveCellVisible).toHaveBeenCalledWith(1, 0)
  })

  it("swallows NotAllowedError when date editor showPicker requires a user gesture", async () => {
    const rows = [
      { rowId: "r1", kind: "data", data: { createdAt: new Date("2026-03-18T00:00:00.000Z") } },
    ] as unknown as DataGridRowNode<{ createdAt: Date }>[]
    const dateInput = document.createElement("input")
    dateInput.className = "cell-editor-control"
    dateInput.type = "date"
    const showPicker = vi.fn(() => {
      throw new DOMException("User activation required", "NotAllowedError")
    })
    Object.defineProperty(dateInput, "showPicker", {
      configurable: true,
      value: showPicker,
    })
    const bodyViewport = document.createElement("div")
    bodyViewport.append(dateInput)

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback): number => {
        callback(0)
        return 1
      })

    const api = useDataGridAppInlineEditing<{ createdAt: Date }, readonly { createdAt: Date }[]>({
      mode: ref("base"),
      bodyViewportRef: ref(bodyViewport),
      visibleColumns: ref([
        { key: "createdAt", column: { key: "createdAt", dataType: "date" } },
      ] as unknown as readonly DataGridColumnSnapshot[]),
      totalRows: ref(rows.length),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => rows[rowIndex] ?? null,
            applyEdits: vi.fn(),
          },
        },
      } as never,
      readCell: () => "2026-03-18",
      resolveRowIndexById: rowId => rows.findIndex(row => row.rowId === rowId),
      applyCellSelection: vi.fn(),
      ensureActiveCellVisible: vi.fn(),
      isCellEditable: () => true,
      captureRowsSnapshot: () => rows.map(row => (row.kind === "group" ? { createdAt: new Date(0) } : { ...row.data })),
      recordEditTransaction: vi.fn(),
    })

    expect(() => {
      api.startInlineEdit(rows[0]!, "createdAt", { openOnMount: true })
    }).not.toThrow()

    await nextTick()
    await nextTick()

    expect(showPicker).toHaveBeenCalled()

    requestAnimationFrameSpy.mockRestore()
  })
})