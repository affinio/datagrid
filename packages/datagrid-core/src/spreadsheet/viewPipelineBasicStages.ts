import type {
  DataGridSpreadsheetViewFilterClause,
  DataGridSpreadsheetViewFilterStep,
  DataGridSpreadsheetViewProjectColumn,
  DataGridSpreadsheetViewProjectStep,
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

function normalizeColumnTitle(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : fallback
}

function createSpreadsheetViewValues(): Record<string, unknown> {
  return {}
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

function normalizeProjectColumns(
  columns: readonly (string | DataGridSpreadsheetViewProjectColumn)[],
): readonly DataGridSpreadsheetViewProjectColumn[] {
  return columns.map(column => (
    typeof column === "string"
      ? { key: normalizeColumnKey(column, "projection column") }
      : {
        key: normalizeColumnKey(column.key, "projection column"),
        as: column.as ? normalizeColumnKey(column.as, "projection alias") : undefined,
        label: column.label,
      }
  ))
}

export function applySpreadsheetViewProjectStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewProjectStep,
): SpreadsheetViewDataset {
  const projections = normalizeProjectColumns(step.columns)
  if (projections.length === 0) {
    throw new Error("[DataGridSpreadsheetView] project step must include at least one column.")
  }
  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const columns = projections.map(projection => {
    const sourceColumn = sourceColumnsByKey.get(projection.key)
    const nextKey = projection.as ?? projection.key
    return {
      key: nextKey,
      title: normalizeColumnTitle(projection.label, sourceColumn?.title ?? nextKey),
      formulaAlias: sourceColumn?.formulaAlias ?? normalizeColumnTitle(projection.label, sourceColumn?.title ?? nextKey),
      style: sourceColumn?.style ?? null,
    }
  })
  const rows = dataset.rows.map(row => {
    const values = createSpreadsheetViewValues()
    for (const projection of projections) {
      values[projection.as ?? projection.key] = row.values[projection.key] ?? null
    }
    return { id: row.id, values }
  })
  return { columns, rows }
}
