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

  it("buffers rapid typed input while the inline editor is mounting", () => {
    const harness = createHarness()
    harness.api.startInlineEdit(harness.rows[0]!, "owner", { draftValue: "p", openOnMount: true })

    expect(harness.api.appendInlineEditTextInput("l")).toBe(true)
    expect(harness.api.appendInlineEditTextInput("a")).toBe(true)

    expect(harness.api.editingCellValue.value).toBe("pla")
  })

  it("focuses the inline text editor and places the caret at the end even when the editor is outside the body viewport", async () => {
    const rows = [
      { rowId: "r1", kind: "data", data: { owner: "Ada", status: "open", amount: 10 } },
    ] as unknown as DataGridRowNode<DemoRow>[]
    const stageRoot = document.createElement("section")
    stageRoot.className = "grid-stage"
    const bodyViewport = document.createElement("div")
    stageRoot.append(bodyViewport)
    const hostCell = document.createElement("div")
    hostCell.className = "grid-cell"
    hostCell.dataset.rowId = "r1"
    hostCell.dataset.columnKey = "owner"
    const input = document.createElement("input")
    input.className = "cell-editor-control cell-editor-input"
    input.value = "Ada"
    hostCell.append(input)
    stageRoot.append(hostCell)
    document.body.append(stageRoot)

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback): number => {
        callback(0)
        return 1
      })
    const setTimeoutSpy = vi
      .spyOn(window, "setTimeout")
      .mockImplementation(((handler: TimerHandler) => {
        if (typeof handler === "function") {
          handler()
        }
        return 0
      }) as typeof window.setTimeout)

    const api = useDataGridAppInlineEditing<DemoRow, readonly DemoRow[]>({
      mode: ref("base"),
      bodyViewportRef: ref(bodyViewport),
      visibleColumns: ref([
        { key: "owner", column: { key: "owner" } },
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
      readCell: row => String(row.kind === "group" ? "" : row.data.owner),
      resolveRowIndexById: rowId => rows.findIndex(row => row.rowId === rowId),
      applyCellSelection: vi.fn(),
      ensureActiveCellVisible: vi.fn(),
      isCellEditable: () => true,
      captureRowsSnapshot: () => rows.map(row => (row.kind === "group" ? {} as DemoRow : { ...row.data })),
      recordEditTransaction: vi.fn(),
    })

    api.startInlineEdit(rows[0]!, "owner")
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(input.value.length)
    expect(input.selectionEnd).toBe(input.value.length)

    requestAnimationFrameSpy.mockRestore()
    setTimeoutSpy.mockRestore()
    stageRoot.remove()
  })

  it("does not commit the edited draft on blur after Escape cancels editing", () => {
    const harness = createHarness()
    harness.api.startInlineEdit(harness.rows[0]!, "owner")
    harness.api.editingCellValue.value = "Grace"

    harness.api.handleEditorKeydown(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }))
    harness.api.handleEditorBlur()

    expect(harness.applyEdits).not.toHaveBeenCalled()
    expect(harness.rows[0]?.kind === "group" ? null : harness.rows[0]?.data.owner).toBe("Ada")
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

  it("captures history only for the edited row id on commit", () => {
    const harness = createHarness()
    const captureRowsSnapshot = vi.fn(() => [])
    const captureRowsSnapshotForRowIds = vi.fn((rowIds: readonly (string | number)[]) => rowIds)
    const api = useDataGridAppInlineEditing<DemoRow, readonly (string | number)[]>({
      mode: ref("base"),
      bodyViewportRef: ref(null),
      visibleColumns: ref([
        { key: "owner", column: { key: "owner" } },
        { key: "status", column: { key: "status" } },
        { key: "amount", column: { key: "amount", dataType: "number" } },
      ] as unknown as readonly DataGridColumnSnapshot[]),
      totalRows: ref(harness.rows.length),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => harness.rows[rowIndex] ?? null,
            applyEdits: harness.applyEdits,
          },
        },
      } as never,
      readCell: (row, columnKey) => String(row.kind === "group" ? "" : (row.data[columnKey as keyof DemoRow] ?? "")),
      resolveRowIndexById: rowId => harness.rows.findIndex(row => row.rowId === rowId),
      applyCellSelection: harness.applyCellSelection,
      ensureActiveCellVisible: harness.ensureActiveCellVisible,
      isCellEditable: (_row, _rowIndex, columnKey) => columnKey !== "status",
      captureRowsSnapshot,
      captureRowsSnapshotForRowIds,
      recordEditTransaction: harness.recordEditTransaction,
    })

    api.startInlineEdit(harness.rows[0]!, "owner")
    api.editingCellValue.value = "Grace"
    api.commitInlineEdit()

    expect(captureRowsSnapshotForRowIds).toHaveBeenCalledWith(["r1"])
    expect(captureRowsSnapshot).not.toHaveBeenCalled()
  })

  it("commits without restoring selection or focus when the next cell already owns pointer focus", () => {
    const harness = createHarness()

    harness.api.startInlineEdit(harness.rows[0]!, "owner")
    harness.api.editingCellValue.value = "Legacy"
    harness.api.commitInlineEdit("none")

    expect(harness.applyEdits).toHaveBeenCalledWith([
      {
        rowId: "r1",
        data: { owner: "Legacy" },
      },
    ])
    expect(harness.applyCellSelection).not.toHaveBeenCalled()
    expect(harness.ensureActiveCellVisible).not.toHaveBeenCalled()
  })
})
