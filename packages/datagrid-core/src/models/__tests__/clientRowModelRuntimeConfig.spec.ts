import { describe, expect, it } from "vitest"
import {
  DATAGRID_COMPUTE_VECTOR_BATCH_SIZE,
  DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT,
  isDataGridColumnCacheParityVerificationEnabled,
  isDataGridRowId,
  isRecord,
  normalizeFormulaColumnCacheMaxColumns,
} from "../clientRowModelRuntimeConfig.js"

describe("clientRowModelRuntimeConfig", () => {
  it("normalizes formula column-cache limits", () => {
    expect(normalizeFormulaColumnCacheMaxColumns(null)).toBe(Number.POSITIVE_INFINITY)
    expect(normalizeFormulaColumnCacheMaxColumns(undefined)).toBe(Number.POSITIVE_INFINITY)
    expect(normalizeFormulaColumnCacheMaxColumns(3.8)).toBe(3)
    expect(() => normalizeFormulaColumnCacheMaxColumns(0)).toThrow(
      "[DataGridFormula] formulaColumnCacheMaxColumns must be >= 1 when provided.",
    )
  })

  it("exposes stable compute defaults and guards", () => {
    expect(DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT).toBe(50)
    expect(DATAGRID_COMPUTE_VECTOR_BATCH_SIZE).toBe(1024)
    expect(isDataGridRowId("row-1")).toBe(true)
    expect(isDataGridRowId(1)).toBe(true)
    expect(isDataGridRowId(null)).toBe(false)
    expect(isRecord({})).toBe(true)
    expect(isRecord(null)).toBe(false)
  })

  it("reads column-cache parity verification from the global flag", () => {
    const globalRecord = globalThis as Record<string, unknown>
    const previous = globalRecord.__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__
    try {
      globalRecord.__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__ = true
      expect(isDataGridColumnCacheParityVerificationEnabled()).toBe(true)
      globalRecord.__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__ = false
      expect(isDataGridColumnCacheParityVerificationEnabled()).toBe(false)
    } finally {
      if (typeof previous === "undefined") {
        delete globalRecord.__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__
      } else {
        globalRecord.__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__ = previous
      }
    }
  })
})
