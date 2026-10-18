import type {
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridFilterSnapshot,
} from "./rowModel.js"
import { cloneDataGridFilterSnapshot } from "./filters/advancedFilter.js"

export function normalizeColumnHistogramOptions(
  options: DataGridColumnHistogramOptions | undefined,
): DataGridColumnHistogramOptions {
  const search = String(options?.search ?? "").trim()
  return {
    ...(options ?? {}),
    ...(search.length > 0 ? { search } : {}),
  }
}

export function cloneFilterSnapshotForHistogram(
  filterModel: DataGridFilterSnapshot | null,
  columnId: string,
  options: DataGridColumnHistogramOptions,
): DataGridFilterSnapshot | null {
  const cloned = cloneDataGridFilterSnapshot(filterModel)
  if (!cloned || options.ignoreSelfFilter !== true) {
    return cloned
  }
  const ignoredColumnId = columnId.trim()
  if (ignoredColumnId.length === 0) {
    return cloned
  }
  const columnFilters: NonNullable<DataGridFilterSnapshot["columnFilters"]> = {}
  for (const [rawKey, entry] of Object.entries(cloned.columnFilters ?? {})) {
    if (rawKey.trim() !== ignoredColumnId) {
      columnFilters[rawKey] = entry
    }
  }
  const columnStyleFilters: NonNullable<DataGridFilterSnapshot["columnStyleFilters"]> = {}
  for (const [rawKey, entry] of Object.entries(cloned.columnStyleFilters ?? {})) {
    if (rawKey.trim() !== ignoredColumnId) {
      columnStyleFilters[rawKey] = entry
    }
  }
  return {
    columnFilters,
    columnStyleFilters,
    advancedExpression: cloned.advancedExpression ?? null,
    ...(cloned.quickFilter ? { quickFilter: cloned.quickFilter } : {}),
  }
}

export function normalizeColumnHistogramResult(entries: readonly unknown[]): DataGridColumnHistogram {
  const normalized = entries
    .map(entry => {
      const candidate = entry as { token?: unknown; value?: unknown; count?: unknown; text?: unknown }
      const token = String(candidate?.token ?? "").trim()
      if (token.length === 0) {
        return null
      }
      const count = Number.isFinite(candidate.count)
        ? Math.max(0, Math.trunc(candidate.count as number))
        : 0
      return {
        token,
        value: candidate.value,
        count,
        ...(typeof candidate.text === "string" ? { text: candidate.text } : {}),
      }
    })
    .filter((entry): entry is DataGridColumnHistogram[number] => entry !== null)
  return Object.freeze(normalized)
}
