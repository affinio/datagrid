import type { DataGridColumnHistogram, DataGridColumnHistogramEntry, DataGridColumnHistogramOptions, DataGridRowNode } from "../rowModel.js"
import { serializeColumnValueToToken } from "../filters/columnFilterUtils.js"
import { normalizeText, readRowField, resolveDataGridFilterCellStyleValue, resolveDataGridFilterCellValue, type DataGridFilterCellStyleValueReader, type DataGridFilterCellValueReader } from "./clientRowProjectionAccessors.js"

export function buildColumnHistogram<T>(
  rows: readonly DataGridRowNode<T>[],
  columnId: string,
  options?: DataGridColumnHistogramOptions,
  valueOptions: {
    readField?: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
    readFilterCell?: DataGridFilterCellValueReader<T>
    readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
  } = {},
): DataGridColumnHistogram {
  const key = String(columnId ?? "").trim()
  const styleKey = String(options?.styleKey ?? "").trim()
  const normalizedSearch = String(options?.search ?? "").trim().toLowerCase()
  const entriesByToken = new Map<string, DataGridColumnHistogramEntry>()
  const readField = valueOptions.readField ?? readRowField

  for (const row of rows) {
    const value = styleKey.length > 0
      ? resolveDataGridFilterCellStyleValue({
        rowNode: row,
        columnKey: key,
        styleKey,
        readFilterCellStyle: valueOptions.readFilterCellStyle,
      })
      : resolveDataGridFilterCellValue({
        rowNode: row,
        columnKey: key,
        readFilterCell: valueOptions.readFilterCell,
        readField,
      })
    const token = serializeColumnValueToToken(value)
    const text = normalizeText(value)
    if (normalizedSearch.length > 0 && !text.toLowerCase().includes(normalizedSearch)) {
      continue
    }
    const current = entriesByToken.get(token)
    if (current) {
      current.count += 1
      continue
    }
    entriesByToken.set(token, {
      token,
      value,
      text,
      count: 1,
    })
  }

  const entries = Array.from(entriesByToken.values())
  if (entries.length === 0) {
    return []
  }

  const orderBy = options?.orderBy ?? "valueAsc"
  if (orderBy === "countDesc") {
    entries.sort((left, right) => right.count - left.count || left.text?.localeCompare(right.text ?? "") || 0)
  } else {
    entries.sort((left, right) => (left.text ?? "").localeCompare(right.text ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    }))
  }

  const limit = Number.isFinite(options?.limit) ? Math.max(0, Math.trunc(options?.limit as number)) : 0
  if (limit > 0 && entries.length > limit) {
    return entries.slice(0, limit)
  }
  return entries
}

