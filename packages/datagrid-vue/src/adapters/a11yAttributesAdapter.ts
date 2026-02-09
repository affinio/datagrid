import type {
  DataGridA11yCellAriaState,
  DataGridA11yGridAriaState,
} from "@affino/datagrid-core/advanced"

export interface DataGridA11yGridAttributeMap {
  role: "grid"
  tabindex: number
  "aria-rowcount": number
  "aria-colcount": number
  "aria-activedescendant"?: string
  "aria-multiselectable": "true" | "false"
}

export interface DataGridA11yCellAttributeMap {
  id: string
  role: "gridcell"
  tabindex: number
  "aria-rowindex": number
  "aria-colindex": number
  "aria-selected": "true" | "false"
}

export function mapDataGridA11yGridAttributes(
  state: DataGridA11yGridAriaState,
): DataGridA11yGridAttributeMap {
  const attributes: DataGridA11yGridAttributeMap = {
    role: state.role,
    tabindex: state.tabIndex,
    "aria-rowcount": state.ariaRowCount,
    "aria-colcount": state.ariaColCount,
    "aria-multiselectable": state.ariaMultiselectable ? "true" : "false",
  }
  if (state.ariaActiveDescendant) {
    attributes["aria-activedescendant"] = state.ariaActiveDescendant
  }
  return attributes
}

export function mapDataGridA11yCellAttributes(
  state: DataGridA11yCellAriaState,
): DataGridA11yCellAttributeMap {
  return {
    id: state.id,
    role: state.role,
    tabindex: state.tabIndex,
    "aria-rowindex": state.ariaRowIndex,
    "aria-colindex": state.ariaColIndex,
    "aria-selected": state.ariaSelected ? "true" : "false",
  }
}
