import type { DataGridRowNode } from "../rowModel.js"

export type DataGridFilterCellValueReader<T> = (
  rowNode: DataGridRowNode<T>,
  columnKey: string,
) => unknown

export type DataGridFilterCellStyleValueReader<T> = (
  rowNode: DataGridRowNode<T>,
  columnKey: string,
  styleKey: string,
) => unknown

export interface ResolveDataGridFilterCellValueOptions<T> {
  rowNode: DataGridRowNode<T>
  columnKey: string
  field?: string
  readFilterCell?: DataGridFilterCellValueReader<T>
  readField?: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
}

export interface ResolveDataGridFilterCellStyleValueOptions<T> {
  rowNode: DataGridRowNode<T>
  columnKey: string
  styleKey: string
  readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
}

function readByPath(value: unknown, path: string): unknown {
  if (!path || typeof value !== "object" || value === null) {
    return undefined
  }
  const segments = path.split(".").filter(Boolean)
  let current: unknown = value
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined
      }
      current = current[index]
      continue
    }
    if (typeof current !== "object" || current === null || !(segment in (current as Record<string, unknown>))) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

export function readRowField<T>(rowNode: DataGridRowNode<T>, key: string, field?: string): unknown {
  const source = rowNode.data as unknown
  const resolvedField = field && field.trim().length > 0 ? field : key
  if (!resolvedField) {
    return undefined
  }
  const directValue = typeof source === "object" && source !== null
    ? (source as Record<string, unknown>)[resolvedField]
    : undefined
  if (typeof directValue !== "undefined") {
    return directValue
  }
  return readByPath(source, resolvedField)
}

export function resolveDataGridFilterCellValue<T>(
  options: ResolveDataGridFilterCellValueOptions<T>,
): unknown {
  if (typeof options.readFilterCell === "function") {
    const resolved = options.readFilterCell(options.rowNode, options.columnKey)
    if (typeof resolved !== "undefined") {
      return resolved
    }
  }
  const readField = options.readField ?? readRowField
  return readField(options.rowNode, options.columnKey, options.field)
}

export function resolveDataGridFilterCellStyleValue<T>(
  options: ResolveDataGridFilterCellStyleValueOptions<T>,
): unknown {
  if (typeof options.readFilterCellStyle !== "function") {
    return undefined
  }
  return options.readFilterCellStyle(options.rowNode, options.columnKey, options.styleKey)
}

export function normalizeText(value: unknown): string {
  if (value == null) {
    return ""
  }
  return String(value)
}

export function normalizeLeafRow<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
  if (row.kind === "leaf" && row.state.group === false) {
    return row
  }
  return {
    ...row,
    kind: "leaf",
    state: {
      ...row.state,
      group: false,
    },
    groupMeta: undefined,
  }
}

