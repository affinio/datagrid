import type { DataGridPaginationInput, DataGridPaginationSnapshot } from "./rowModel.js"

function normalizePaginationPageSize(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value as number)) : 0
}

function normalizePaginationPage(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value as number)) : 0
}

export function normalizePaginationInput(
  input: DataGridPaginationInput | null | undefined,
): DataGridPaginationInput {
  return {
    pageSize: normalizePaginationPageSize(input?.pageSize),
    currentPage: normalizePaginationPage(input?.currentPage),
  }
}

export function buildPaginationSnapshot(
  totalRowCount: number,
  input: DataGridPaginationInput | null | undefined,
): DataGridPaginationSnapshot {
  const normalizedTotal = Number.isFinite(totalRowCount) ? Math.max(0, Math.trunc(totalRowCount)) : 0
  const normalizedInput = normalizePaginationInput(input)
  const enabled = normalizedInput.pageSize > 0
  if (!enabled) {
    return {
      enabled: false,
      pageSize: 0,
      currentPage: 0,
      pageCount: normalizedTotal > 0 ? 1 : 0,
      totalRowCount: normalizedTotal,
      startIndex: normalizedTotal > 0 ? 0 : -1,
      endIndex: normalizedTotal > 0 ? normalizedTotal - 1 : -1,
    }
  }

  const pageCount = Math.ceil(normalizedTotal / normalizedInput.pageSize)
  const currentPage = Math.min(normalizedInput.currentPage, Math.max(0, pageCount - 1))
  const startIndex = normalizedTotal > 0 ? currentPage * normalizedInput.pageSize : -1
  const endIndex = normalizedTotal > 0
    ? Math.min(normalizedTotal - 1, startIndex + normalizedInput.pageSize - 1)
    : -1
  return {
    enabled: true,
    pageSize: normalizedInput.pageSize,
    currentPage,
    pageCount,
    totalRowCount: normalizedTotal,
    startIndex,
    endIndex,
  }
}
