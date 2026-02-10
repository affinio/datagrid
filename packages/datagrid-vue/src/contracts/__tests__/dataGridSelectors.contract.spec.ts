import { describe, expect, it } from "vitest"
import {
  DATA_GRID_CLASS_NAMES,
  DATA_GRID_DATA_ATTRS,
  DATA_GRID_SELECTORS,
  dataGridCellSelector,
  dataGridHeaderCellSelector,
  dataGridResizeHandleSelector,
} from "../dataGridSelectors"

describe("dataGridSelectors contract", () => {
  it("keeps canonical class selectors stable", () => {
    expect(DATA_GRID_CLASS_NAMES.viewport).toBe("datagrid-stage__viewport")
    expect(DATA_GRID_CLASS_NAMES.row).toBe("datagrid-stage__row")
    expect(DATA_GRID_CLASS_NAMES.cell).toBe("datagrid-stage__cell")
    expect(DATA_GRID_CLASS_NAMES.selectionOverlay).toBe("datagrid-stage__selection-overlay")
    expect(DATA_GRID_CLASS_NAMES.selectionHandleCell).toBe("datagrid-stage__selection-handle--cell")
    expect(DATA_GRID_CLASS_NAMES.inlineEditor).toBe("datagrid-stage__editor")
    expect(DATA_GRID_CLASS_NAMES.metrics).toBe("datagrid-metrics")
  })

  it("keeps canonical selector strings stable", () => {
    expect(DATA_GRID_SELECTORS.viewport).toBe(".datagrid-stage__viewport")
    expect(DATA_GRID_SELECTORS.row).toBe(".datagrid-stage__row")
    expect(DATA_GRID_SELECTORS.cell).toBe(".datagrid-stage__cell")
    expect(DATA_GRID_SELECTORS.selectionOverlay).toBe(".datagrid-stage__selection-overlay")
    expect(DATA_GRID_SELECTORS.selectionHandleCell).toBe(".datagrid-stage__selection-handle--cell")
    expect(DATA_GRID_SELECTORS.inlineEditor).toBe(".datagrid-stage__editor")
    expect(DATA_GRID_SELECTORS.metrics).toBe(".datagrid-metrics")
    expect(DATA_GRID_SELECTORS.menuAction).toBe("[data-datagrid-menu-action]")
  })

  it("builds scoped selectors using stable data attrs", () => {
    expect(DATA_GRID_DATA_ATTRS.columnKey).toBe("data-column-key")
    expect(dataGridCellSelector("owner")).toBe('.datagrid-stage__cell[data-column-key="owner"]')
    expect(dataGridHeaderCellSelector("owner")).toBe('.datagrid-stage__cell--header[data-column-key="owner"]')
    expect(dataGridResizeHandleSelector("owner")).toBe('[data-datagrid-resize-handle][data-column-key="owner"]')
  })
})
