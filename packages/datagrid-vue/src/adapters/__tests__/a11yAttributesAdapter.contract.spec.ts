import { describe, expect, it } from "vitest"
import {
  mapDataGridA11yCellAttributes,
  mapDataGridA11yGridAttributes,
} from "../a11yAttributesAdapter"

describe("a11y attributes adapter contract", () => {
  it("maps virtualized grid counts and active descendant to DOM attributes", () => {
    expect(mapDataGridA11yGridAttributes({
      role: "grid",
      tabIndex: 0,
      ariaRowCount: 100_000,
      ariaColCount: 1_000,
      ariaActiveDescendant: "datagrid-cell-row-500-col-50",
      ariaMultiselectable: true,
    })).toEqual({
      role: "grid",
      tabindex: 0,
      "aria-rowcount": 100_000,
      "aria-colcount": 1_000,
      "aria-activedescendant": "datagrid-cell-row-500-col-50",
      "aria-multiselectable": "true",
    })
  })

  it("maps virtualized cell indexes as one-based aria coordinates", () => {
    expect(mapDataGridA11yCellAttributes({
      id: "datagrid-cell-row-500-col-50",
      role: "gridcell",
      tabIndex: -1,
      ariaRowIndex: 501,
      ariaColIndex: 51,
      ariaSelected: false,
    })).toEqual({
      id: "datagrid-cell-row-500-col-50",
      role: "gridcell",
      tabindex: -1,
      "aria-rowindex": 501,
      "aria-colindex": 51,
      "aria-selected": "false",
    })
  })
})
