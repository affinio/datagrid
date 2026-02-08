import type { ColumnMetric as CoreColumnMetric } from "../virtualization/columnSnapshot"

/**
 * Column related structural types live in this dedicated module so that runtime utilities
 * like `core/columns/columnGroup.ts` can consume them without re-importing the full table types.
 */
export type DataGridColumnAlignment = "left" | "center" | "right"

export type DataGridColumnEditor = "text" | "select" | "number" | "checkbox" | "none"

export type DataGridColumnPin = "left" | "right" | "none"

export type DataGridColumnSticky = "left" | "right"

export interface DataGridColumn {
  key: string
  label: string
  width?: number
  minWidth?: number
  maxWidth?: number
  autoWidth?: boolean
  resizable?: boolean
  sortable?: boolean
  visible?: boolean
  editor?: DataGridColumnEditor | string
  align?: DataGridColumnAlignment | string
  headerAlign?: DataGridColumnAlignment | string
  options?: { label: string; value: any }[] | ((row: any) => { label: string; value: any }[])
  placeholder?: string
  editable?: boolean
  validator?: (value: unknown, row: any) => boolean | string
  filterType?: "set" | "text" | "number" | "date"
  /**
   * Canonical pin state contract used by runtime and adapters.
   */
  pin?: DataGridColumnPin
  /**
   * Marks a column as a system column (row index, selection checkbox, etc).
   * System columns never participate in filtering or sorting.
   */
  isSystem?: boolean
  /**
   * @deprecated Legacy compatibility field. Normalize into `pin` in adapters.
   */
  stickyLeft?: boolean | number
  /**
   * @deprecated Legacy compatibility field. Normalize into `pin` in adapters.
   */
  stickyRight?: boolean | number
  /**
   * @deprecated Legacy compatibility field. Normalize into `pin` in adapters.
   */
  sticky?: DataGridColumnSticky
  userResized?: boolean
}

export interface DataGridColumnGroupDef {
  groupId: string
  headerName: string
  children: (DataGridColumn | DataGridColumnGroupDef)[]
  expandable?: boolean
  expanded?: boolean
  paddingLevel?: number
}

export type DataGridColumnMetric = CoreColumnMetric<DataGridColumn>

export interface HeaderRenderableEntry<TColumn = DataGridColumn> {
  metric: CoreColumnMetric<TColumn>
  showLeftFiller: boolean
  showRightFiller: boolean
}
