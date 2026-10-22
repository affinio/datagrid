import type { DataGridAppColumnInput } from "./dataGridFormulaOptions"

export type DataGridColumnId = DataGridAppColumnInput["key"]

export interface HierarchyColumnOptions {
  headerName?: string
  leafColumnId?: DataGridColumnId
  hideLeafSourceColumn?: boolean
  showCount?: boolean
  showGroupFieldLabel?: "auto" | "always" | "never"
}

export interface GroupingPresentationOptions {
  display: "hierarchy-column"
  hierarchyColumn?: HierarchyColumnOptions
}

export const DATA_GRID_HIERARCHY_COLUMN_ID = "__affino_hierarchy__"
