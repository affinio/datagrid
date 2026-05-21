import type { DataGridRowId } from "./rowModel.js"

export const DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT = 50
export const DATAGRID_COMPUTE_VECTOR_BATCH_SIZE = 1024

const DATAGRID_COLUMN_CACHE_VERIFY_FLAG = "__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__"
const DATAGRID_FORMULA_COLUMN_CACHE_NO_LIMIT = Number.POSITIVE_INFINITY

export function isDataGridColumnCacheParityVerificationEnabled(): boolean {
  const globalRecord = globalThis as Record<string, unknown>
  return globalRecord[DATAGRID_COLUMN_CACHE_VERIFY_FLAG] === true
}

export function normalizeFormulaColumnCacheMaxColumns(value: number | null | undefined): number {
  if (value === null || typeof value === "undefined") {
    return DATAGRID_FORMULA_COLUMN_CACHE_NO_LIMIT
  }
  const normalized = Math.trunc(value)
  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error("[DataGridFormula] formulaColumnCacheMaxColumns must be >= 1 when provided.")
  }
  return normalized
}

export function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
