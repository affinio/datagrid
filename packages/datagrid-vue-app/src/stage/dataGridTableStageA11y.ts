const DATA_GRID_STAGE_A11Y_ID_PREFIX = "datagrid-stage"

export function sanitizeDataGridStageA11yIdPart(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "-")
  return sanitized.length > 0 ? sanitized : "empty"
}

export function resolveDataGridStageCellId(rowId: string | number | null | undefined, columnKey: string): string {
  return [
    DATA_GRID_STAGE_A11Y_ID_PREFIX,
    "cell",
    sanitizeDataGridStageA11yIdPart(String(rowId ?? "row")),
    sanitizeDataGridStageA11yIdPart(columnKey),
  ].join("-")
}

export function resolveDataGridStageHeaderId(columnKey: string): string {
  return [
    DATA_GRID_STAGE_A11Y_ID_PREFIX,
    "header",
    sanitizeDataGridStageA11yIdPart(columnKey),
  ].join("-")
}

export const DATA_GRID_STAGE_ROW_INDEX_HEADER_ID = `${DATA_GRID_STAGE_A11Y_ID_PREFIX}-header-row-index`
