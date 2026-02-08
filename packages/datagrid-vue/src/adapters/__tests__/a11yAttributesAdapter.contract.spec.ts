import { describe, expect, it } from "vitest"
import { createDataGridA11yStateMachine } from "@affino/datagrid-core/advanced"
import {
  mapDataGridA11yCellAttributes,
  mapDataGridA11yGridAttributes,
} from "../a11yAttributesAdapter"

describe("a11yAttributesAdapter contract", () => {
  it("maps headless grid a11y state to DOM/ARIA attributes", () => {
    const machine = createDataGridA11yStateMachine({
      rowCount: 120,
      colCount: 12,
      idPrefix: "alerts-grid",
      initialGridFocused: true,
      initialFocusCell: {
        rowIndex: 4,
        colIndex: 7,
      },
    })

    const attributes = mapDataGridA11yGridAttributes(machine.getGridAria())
    expect(attributes).toEqual({
      role: "grid",
      tabindex: 0,
      "aria-rowcount": 120,
      "aria-colcount": 12,
      "aria-multiselectable": "true",
      "aria-activedescendant": "alerts-grid-cell-r4-c7",
    })
  })

  it("maps active and passive cells with roving tabindex semantics", () => {
    const machine = createDataGridA11yStateMachine({
      rowCount: 12,
      colCount: 6,
      idPrefix: "incidents-grid",
      initialGridFocused: true,
      initialFocusCell: {
        rowIndex: 2,
        colIndex: 1,
      },
    })

    const active = mapDataGridA11yCellAttributes(machine.getCellAria({ rowIndex: 2, colIndex: 1 }))
    const passive = mapDataGridA11yCellAttributes(machine.getCellAria({ rowIndex: 2, colIndex: 2 }))

    expect(active).toEqual({
      id: "incidents-grid-cell-r2-c1",
      role: "gridcell",
      tabindex: 0,
      "aria-rowindex": 3,
      "aria-colindex": 2,
      "aria-selected": "true",
    })

    expect(passive).toEqual({
      id: "incidents-grid-cell-r2-c2",
      role: "gridcell",
      tabindex: -1,
      "aria-rowindex": 3,
      "aria-colindex": 3,
      "aria-selected": "false",
    })
  })

  it("drops aria-activedescendant after blur", () => {
    const machine = createDataGridA11yStateMachine({
      rowCount: 5,
      colCount: 4,
      idPrefix: "health-grid",
      initialGridFocused: true,
      initialFocusCell: {
        rowIndex: 1,
        colIndex: 1,
      },
    })

    machine.focusGrid(false)
    const attributes = mapDataGridA11yGridAttributes(machine.getGridAria())
    expect(attributes["aria-activedescendant"]).toBeUndefined()
    expect(attributes["aria-rowcount"]).toBe(5)
    expect(attributes["aria-colcount"]).toBe(4)
  })
})
