export type DataGridLayoutMode = "fill" | "auto-height"

export interface DataGridResolvedLayoutOptions {
  layoutMode: DataGridLayoutMode
  minRows: number | null
  maxRows: number | null
}

function normalizeOptionalRowLimit(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }
  const normalized = Math.max(0, Math.trunc(value))
  return normalized > 0 ? normalized : null
}

export function resolveDataGridLayoutOptions(
  layoutMode: DataGridLayoutMode | undefined,
  minRows?: number | null,
  maxRows?: number | null,
): DataGridResolvedLayoutOptions {
  const normalizedLayoutMode: DataGridLayoutMode =
    layoutMode === "auto-height" ? "auto-height" : "fill"

  if (normalizedLayoutMode !== "auto-height") {
    return {
      layoutMode: normalizedLayoutMode,
      minRows: null,
      maxRows: null,
    }
  }

  const normalizedMinRows = normalizeOptionalRowLimit(minRows)
  let normalizedMaxRows = normalizeOptionalRowLimit(maxRows)

  if (normalizedMinRows !== null && normalizedMaxRows !== null && normalizedMaxRows < normalizedMinRows) {
    normalizedMaxRows = normalizedMinRows
  }

  return {
    layoutMode: normalizedLayoutMode,
    minRows: normalizedMinRows,
    maxRows: normalizedMaxRows,
  }
}
