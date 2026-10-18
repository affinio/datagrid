import type {
  DataGridSpreadsheetViewFilterClause,
  DataGridSpreadsheetViewFilterStep,
  DataGridSpreadsheetViewSortField,
  DataGridSpreadsheetViewSortStep,
} from "./viewPipeline.js"
import type { SpreadsheetViewDataset, SpreadsheetViewRowState } from "./viewPipelineDataset.js"
import {
  areSpreadsheetViewValuesEquivalent,
  compareSpreadsheetViewValues,
  isSpreadsheetViewValueEmpty,
  normalizeSpreadsheetViewText,
} from "./viewPipelineValueUtils.js"

function normalizeColumnKey(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim()
  if (normalized.length === 0) {
    throw new Error(`[DataGridSpreadsheetView] ${label} must be non-empty.`)
  }
  return normalized
}

function matchesFilterClause(row: SpreadsheetViewRowState, clause: DataGridSpreadsheetViewFilterClause): boolean {
  const value = row.values[clause.key]
  switch (clause.operator) {
    case "contains":
      return normalizeSpreadsheetViewText(value, clause.caseSensitive).includes(
        normalizeSpreadsheetViewText(clause.value, clause.caseSensitive),
      )
    case "startsWith":
      return normalizeSpreadsheetViewText(value, clause.caseSensitive).startsWith(
        normalizeSpreadsheetViewText(clause.value, clause.caseSensitive),
      )
    case "endsWith":
      return normalizeSpreadsheetViewText(value, clause.caseSensitive).endsWith(
        normalizeSpreadsheetViewText(clause.value, clause.caseSensitive),
      )
    case "equals":
      return areSpreadsheetViewValuesEquivalent(value, clause.value, clause.caseSensitive)
    case "notEquals":
      return !areSpreadsheetViewValuesEquivalent(value, clause.value, clause.caseSensitive)
    case "gt":
      return compareSpreadsheetViewValues(value, clause.value) > 0
    case "gte":
      return compareSpreadsheetViewValues(value, clause.value) >= 0
    case "lt":
      return compareSpreadsheetViewValues(value, clause.value) < 0
    case "lte":
      return compareSpreadsheetViewValues(value, clause.value) <= 0
    case "between":
      return compareSpreadsheetViewValues(value, clause.value) >= 0
        && compareSpreadsheetViewValues(value, clause.value2) <= 0
    case "isEmpty":
      return isSpreadsheetViewValueEmpty(value)
    case "notEmpty":
      return !isSpreadsheetViewValueEmpty(value)
    case "isNull":
      return value == null
    case "notNull":
      return value != null
    default:
      return false
  }
}

export function applySpreadsheetViewFilterStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewFilterStep,
): SpreadsheetViewDataset {
  if (step.clauses.length === 0) return dataset
  const mode = step.mode ?? "all"
  return {
    columns: dataset.columns,
    rows: dataset.rows.filter(row => {
      const matches = step.clauses.map(clause => matchesFilterClause(row, clause))
      return mode === "any" ? matches.some(Boolean) : matches.every(Boolean)
    }),
  }
}

function normalizeSortFields(
  fields: readonly (string | DataGridSpreadsheetViewSortField)[],
): readonly DataGridSpreadsheetViewSortField[] {
  return fields.map(field => (
    typeof field === "string"
      ? { key: normalizeColumnKey(field, "sort field"), direction: "asc" }
      : {
        key: normalizeColumnKey(field.key, "sort field"),
        direction: field.direction ?? "asc",
      }
  ))
}

export function applySpreadsheetViewSortStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewSortStep,
): SpreadsheetViewDataset {
  const fields = normalizeSortFields(step.fields)
  if (fields.length === 0) return dataset
  const rows = [...dataset.rows]
  rows.sort((left, right) => {
    for (const field of fields) {
      const comparison = compareSpreadsheetViewValues(left.values[field.key], right.values[field.key])
      if (comparison !== 0) return field.direction === "desc" ? -comparison : comparison
    }
    return String(left.id).localeCompare(String(right.id))
  })
  return { columns: dataset.columns, rows }
}
