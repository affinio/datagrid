export const DATA_GRID_ROW_SELECTION_DEFAULT_COLUMN_WIDTH = 108
export const DATA_GRID_ROW_SELECTION_MIN_COLUMN_WIDTH = 40

export interface DataGridRowSelectionOptions {
  enabled?: boolean
  columnWidth?: number | null
}

export type DataGridRowSelectionProp = boolean | DataGridRowSelectionOptions | null | undefined

export interface DataGridResolvedRowSelectionOptions {
  enabled: boolean
  columnWidth: number
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
    }
  }
  return {
    enabled: true,
    columnWidth: DATA_GRID_ROW_SELECTION_DEFAULT_COLUMN_WIDTH,
  }
}
