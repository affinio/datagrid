import type {
  DataGridAggregationFieldReader,
  DataGridRowNode,
} from "./coreTypes.js"

export interface DataGridPivotFieldResolver<T> {
  field: string
  read: (rowNode: DataGridRowNode<T>) => unknown
}

export function readPivotValueByPathSegments(
  value: unknown,
  segments: readonly string[],
): unknown {
  if (segments.length === 0 || typeof value !== "object" || value === null) {
    return undefined
  }
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

export function createPivotFieldResolver<T>(
  field: string,
  readRowField?: DataGridAggregationFieldReader<T>,
): DataGridPivotFieldResolver<T> | null {
  const normalizedField = field.trim()
  if (normalizedField.length === 0) {
    return null
  }
  if (typeof readRowField === "function") {
    return {
      field: normalizedField,
      read: (rowNode: DataGridRowNode<T>): unknown => readRowField(rowNode, normalizedField, normalizedField),
    }
  }
  const segments = normalizedField.includes(".")
    ? normalizedField.split(".").filter(Boolean)
    : []
  return {
    field: normalizedField,
    read: (rowNode: DataGridRowNode<T>): unknown => {
      const source = rowNode.data as unknown
      const directValue = typeof source === "object" && source !== null
        ? (source as Record<string, unknown>)[normalizedField]
        : undefined
      if (typeof directValue !== "undefined") {
        return directValue
      }
      if (segments.length === 0) {
        return undefined
      }
      return readPivotValueByPathSegments(source, segments)
    },
  }
}
