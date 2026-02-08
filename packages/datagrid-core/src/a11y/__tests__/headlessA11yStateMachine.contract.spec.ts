import { describe, expect, it } from "vitest"
import {
  createDataGridA11yStateMachine,
  type DataGridA11yKeyboardCommand,
} from "../headlessA11yStateMachine"

function executeCommands(commands: readonly DataGridA11yKeyboardCommand[]) {
  const machine = createDataGridA11yStateMachine({
    rowCount: 40,
    colCount: 8,
    idPrefix: "grid-a11y",
    initialGridFocused: true,
    initialFocusCell: {
      rowIndex: 2,
      colIndex: 3,
    },
  })
  for (const command of commands) {
    machine.dispatchKeyboard(command)
  }
  return machine.snapshot()
}

describe("headlessA11yStateMachine contract", () => {
  it("tracks deterministic focus and active descendant in core snapshot", () => {
    const machine = createDataGridA11yStateMachine({
      rowCount: 12,
      colCount: 6,
      idPrefix: "incidents-grid",
    })

    machine.focusGrid(true)

    const snapshot = machine.snapshot()
    expect(snapshot.gridFocused).toBe(true)
    expect(snapshot.focusCell).toEqual({
      rowIndex: 0,
      colIndex: 0,
    })
    expect(snapshot.activeDescendantId).toBe("incidents-grid-cell-r0-c0")
  })

  it("applies keyboard navigation semantics with clamped bounds", () => {
    const machine = createDataGridA11yStateMachine({
      rowCount: 10,
      colCount: 5,
      idPrefix: "kpi-grid",
      initialGridFocused: true,
      initialFocusCell: {
        rowIndex: 2,
        colIndex: 2,
      },
    })

    machine.dispatchKeyboard({ key: "ArrowDown" })
    machine.dispatchKeyboard({ key: "ArrowRight" })
    machine.dispatchKeyboard({ key: "End" })
    machine.dispatchKeyboard({ key: "PageDown", pageSize: 4 })
    machine.dispatchKeyboard({ key: "Home", ctrlKey: true })
    machine.dispatchKeyboard({ key: "ArrowUp" })

    const snapshot = machine.snapshot()
    expect(snapshot.focusCell).toEqual({
      rowIndex: 0,
      colIndex: 4,
    })
    expect(snapshot.activeDescendantId).toBe("kpi-grid-cell-r0-c4")

    machine.dispatchKeyboard({ key: "Escape" })
    expect(machine.snapshot().gridFocused).toBe(false)
    expect(machine.snapshot().activeDescendantId).toBeNull()
  })

  it("keeps aria state stable for active and inactive cells", () => {
    const machine = createDataGridA11yStateMachine({
      rowCount: 20,
      colCount: 10,
      initialGridFocused: true,
      initialFocusCell: {
        rowIndex: 5,
        colIndex: 4,
      },
      idPrefix: "ops-grid",
    })

    const gridAria = machine.getGridAria()
    expect(gridAria).toEqual({
      role: "grid",
      tabIndex: 0,
      ariaRowCount: 20,
      ariaColCount: 10,
      ariaActiveDescendant: "ops-grid-cell-r5-c4",
      ariaMultiselectable: true,
    })

    const activeCellAria = machine.getCellAria({ rowIndex: 5, colIndex: 4 })
    const passiveCellAria = machine.getCellAria({ rowIndex: 5, colIndex: 3 })

    expect(activeCellAria.tabIndex).toBe(0)
    expect(activeCellAria.ariaSelected).toBe(true)
    expect(passiveCellAria.tabIndex).toBe(-1)
    expect(passiveCellAria.ariaSelected).toBe(false)
  })

  it("clamps focus on resize and clears focus for empty dimensions", () => {
    const machine = createDataGridA11yStateMachine({
      rowCount: 50,
      colCount: 9,
      initialGridFocused: true,
      initialFocusCell: {
        rowIndex: 25,
        colIndex: 7,
      },
      idPrefix: "resize-grid",
    })

    machine.setDimensions(8, 3)
    expect(machine.snapshot().focusCell).toEqual({
      rowIndex: 7,
      colIndex: 2,
    })

    machine.setDimensions(0, 0)
    const snapshot = machine.snapshot()
    expect(snapshot.gridFocused).toBe(false)
    expect(snapshot.focusCell).toBeNull()
    expect(snapshot.activeDescendantId).toBeNull()
  })

  it("is deterministic for equal command sequences", () => {
    const commands: readonly DataGridA11yKeyboardCommand[] = [
      { key: "ArrowDown" },
      { key: "ArrowRight" },
      { key: "ArrowRight" },
      { key: "PageDown", pageSize: 6 },
      { key: "Home" },
      { key: "End", ctrlKey: true },
      { key: "Tab", shiftKey: true },
    ]

    const first = executeCommands(commands)
    const second = executeCommands(commands)
    expect(first).toEqual(second)
  })
})
