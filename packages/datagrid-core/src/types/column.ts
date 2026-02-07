import type { ColumnMetric as CoreColumnMetric } from "../virtualization/columnSnapshot"

/**
 * Column related structural types live in this dedicated module so that runtime utilities
 * like `core/columns/columnGroup.ts` can consume them without re-importing the full table types.
 */
export type UiTableColumnAlignment = "left" | "center" | "right"

export type UiTableColumnEditor = "text" | "select" | "number" | "checkbox" | "none"

export type UiTableColumnPin = "left" | "right" | "none"

export type UiTableColumnSticky = "left" | "right"

export interface UiTableColumn {
  key: string
  label: string
  width?: number
  minWidth?: number
  maxWidth?: number
  autoWidth?: boolean
  resizable?: boolean
  sortable?: boolean
  visible?: boolean
  editor?: UiTableColumnEditor | string
  align?: UiTableColumnAlignment | string
  headerAlign?: UiTableColumnAlignment | string
  options?: { label: string; value: any }[] | ((row: any) => { label: string; value: any }[])
  placeholder?: string
  editable?: boolean
  validator?: (value: unknown, row: any) => boolean | string
  filterType?: "set" | "text" | "number" | "date"
  /**
   * Canonical pin state contract used by runtime and adapters.
   */
  pin?: UiTableColumnPin
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
  sticky?: UiTableColumnSticky
  userResized?: boolean
}

export interface UiTableColumnGroupDef {
  groupId: string
  headerName: string
  children: (UiTableColumn | UiTableColumnGroupDef)[]
  expandable?: boolean
  expanded?: boolean
  paddingLevel?: number
}

export type UiTableColumnMetric = CoreColumnMetric<UiTableColumn>

export interface HeaderRenderableEntry<TColumn = UiTableColumn> {
  metric: CoreColumnMetric<TColumn>
  showLeftFiller: boolean
  showRightFiller: boolean
}
