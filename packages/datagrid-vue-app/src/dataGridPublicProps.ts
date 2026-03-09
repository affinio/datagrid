import type { DataGridGroupBySpec, DataGridPaginationInput } from "@affino/datagrid-vue"

export type DataGridGroupByProp =
  | string
  | readonly string[]
  | DataGridGroupBySpec
  | null

export type DataGridPaginationProp =
  | boolean
  | DataGridPaginationInput
  | null

function normalizePageNumber(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.trunc(value as number))
}

function normalizePageSize(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(1, Math.trunc(value as number))
}

export function resolveDataGridGroupBy(
  input: DataGridGroupByProp | undefined,
): DataGridGroupBySpec | null | undefined {
  if (input === undefined) {
    return undefined
  }
  if (input == null) {
    return null
  }
  if (typeof input === "string") {
    const field = input.trim()
    return field ? { fields: [field], expandedByDefault: true } : null
  }
  if (Array.isArray(input)) {
    const fields = input
      .map(field => field.trim())
      .filter(field => field.length > 0)
    return fields.length > 0 ? { fields: [...fields], expandedByDefault: true } : null
  }
  return input as DataGridGroupBySpec
}

export function resolveDataGridRenderMode(
  renderMode: "virtualization" | "pagination" | undefined,
  pagination: DataGridPaginationProp | undefined,
): "virtualization" | "pagination" {
  if (pagination === true) {
    return "pagination"
  }
  if (pagination && typeof pagination === "object") {
    return "pagination"
  }
  return renderMode ?? "virtualization"
}

export function resolveDataGridPagination(
  pagination: DataGridPaginationProp | undefined,
  renderMode: "virtualization" | "pagination",
  pageSize: number | undefined,
  currentPage: number | undefined,
): DataGridPaginationInput | null {
  if (renderMode !== "pagination") {
    return null
  }

  const fallbackPageSize = 100
  const resolvedPageSize = normalizePageSize(pageSize, fallbackPageSize)
  const resolvedCurrentPage = normalizePageNumber(currentPage, 0)

  if (pagination === true || pagination === false || pagination == null) {
    return {
      pageSize: resolvedPageSize,
      currentPage: resolvedCurrentPage,
    }
  }

  return {
    pageSize: normalizePageSize(pageSize ?? pagination.pageSize, fallbackPageSize),
    currentPage: normalizePageNumber(currentPage ?? pagination.currentPage, 0),
  }
}
