import type {
  AnalyticsFieldType,
  AnalyticsRow,
  AnalyticsSchema,
} from "./types"

export function inferAnalyticsSchema(rows: AnalyticsRow[]): AnalyticsSchema {
  const fields: string[] = []
  const fieldTypes = new Map<string, AnalyticsFieldType>()

  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      if (!fieldTypes.has(field)) {
        fields.push(field)
        fieldTypes.set(field, "unknown")
      }

      const valueType = inferValueType(value)
      if (valueType === null) {
        continue
      }

      fieldTypes.set(field, mergeFieldTypes(fieldTypes.get(field) ?? "unknown", valueType))
    }
  }

  return {
    fields: fields.map((id) => ({
      id,
      type: fieldTypes.get(id) ?? "unknown",
    })),
  }
}

function inferValueType(value: unknown): AnalyticsFieldType | null {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return "datetime"
  }

  switch (typeof value) {
    case "string":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    default:
      return "unknown"
  }
}

function mergeFieldTypes(
  currentType: AnalyticsFieldType,
  nextType: AnalyticsFieldType,
): AnalyticsFieldType {
  if (currentType === "unknown") {
    return nextType
  }

  if (nextType === "unknown") {
    return "unknown"
  }

  return currentType === nextType ? currentType : "unknown"
}
