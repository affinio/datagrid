import type { DataGridRowNode } from "@affino/datagrid-core"

export const DATA_GRID_ROW_SELECTION_DEFAULT_COLUMN_WIDTH = 108
export const DATA_GRID_ROW_SELECTION_MIN_COLUMN_WIDTH = 40

export interface DataGridRowSelectionOptions {
  enabled?: boolean
  columnWidth?: number | null
  isSelectable?: (row: DataGridRowNode<unknown>) => boolean
}
export type DataGridRowSelectionProp = boolean | DataGridRowSelectionOptions | null | undefined

export interface DataGridResolvedRowSelectionOptions {
  enabled: boolean
  columnWidth: number
  isSelectable?: (row: DataGridRowNode<unknown>) => boolean
}
export type DataGridRowHeaderAction = "select-cells" | "select-records" | "none"
export interface DataGridRowHeaderOptions {
  action?: DataGridRowHeaderAction
}
export type DataGridRowHeaderProp = DataGridRowHeaderOptions | null | undefined
export interface DataGridResolvedRowHeaderOptions {
  action: DataGridRowHeaderAction
}

export function resolveDataGridRowHeader(input: DataGridRowHeaderProp): DataGridResolvedRowHeaderOptions {
  const action = input?.action
  return {
    action: action === "select-records" || action === "none" ? action : "select-cells",
  }
}

function normalizeRowSelectionColumnWidth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DATA_GRID_ROW_SELECTION_DEFAULT_COLUMN_WIDTH
  }
  return Math.max(DATA_GRID_ROW_SELECTION_MIN_COLUMN_WIDTH, Math.trunc(value))
}

export function resolveDataGridRowSelection(input: DataGridRowSelectionProp): DataGridResolvedRowSelectionOptions {
  if (input === false || input === null) {
    return {
      enabled: false,
      columnWidth: DATA_GRID_ROW_SELECTION_DEFAULT_COLUMN_WIDTH,
    }
  }
  if (typeof input === "object" && input) {
    return {
      enabled: input.enabled !== false,
      columnWidth: normalizeRowSelectionColumnWidth(input.columnWidth),
      ...(input.isSelectable ? { isSelectable: input.isSelectable } : {}),
    }
  }
  return {
    enabled: true,
    columnWidth: DATA_GRID_ROW_SELECTION_DEFAULT_COLUMN_WIDTH,
  }
}
