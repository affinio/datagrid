import type {
  DataGridA11yCellAriaState,
  DataGridA11yGridAriaState,
} from "@affino/datagrid-core/advanced"

export type DataGridDomAttributeValue = string | number | boolean
export type DataGridDomAttributes = Record<string, DataGridDomAttributeValue>

export function mapDataGridA11yGridAttributes(
  aria: DataGridA11yGridAriaState,
): DataGridDomAttributes {
  const attributes: DataGridDomAttributes = {
    role: aria.role,
    tabindex: aria.tabIndex,
    "aria-rowcount": aria.ariaRowCount,
    "aria-colcount": aria.ariaColCount,
    "aria-multiselectable": aria.ariaMultiselectable ? "true" : "false",
  }

  if (aria.ariaActiveDescendant) {
    attributes["aria-activedescendant"] = aria.ariaActiveDescendant
  }

  return attributes
}

export function mapDataGridA11yCellAttributes(
  aria: DataGridA11yCellAriaState,
): DataGridDomAttributes {
  return {
    id: aria.id,
    role: aria.role,
    tabindex: aria.tabIndex,
    "aria-rowindex": aria.ariaRowIndex,
    "aria-colindex": aria.ariaColIndex,
    "aria-selected": aria.ariaSelected ? "true" : "false",
  }
}
