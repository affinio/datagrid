import type {
  DataGridSpreadsheetViewAggregation,
  DataGridSpreadsheetViewGroupByField,
  DataGridSpreadsheetViewGroupStageState,
  DataGridSpreadsheetViewGroupStageStateBucket,
  DataGridSpreadsheetViewGroupStep,
} from "./viewPipeline.js"
import type { DataGridRowId } from "../models/rowModel.js"
import type { SpreadsheetViewColumnState, SpreadsheetViewDataset, SpreadsheetViewRowState } from "./viewPipelineDataset.js"
import {
  coerceSpreadsheetViewNumber,
  compareSpreadsheetViewValues,
  isNumericSpreadsheetViewAggregation,
  isSpreadsheetViewValueEmpty,
  normalizeSpreadsheetViewOutputValue,
  spreadsheetViewValuesEqual,
} from "./viewPipelineValueUtils.js"

function normalizeColumnKey(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim()
  if (normalized.length === 0) throw new Error(`[DataGridSpreadsheetView] ${label} must be non-empty.`)
  return normalized
}

function normalizeColumnTitle(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : fallback
}

function createSpreadsheetViewValues(): Record<string, unknown> {
  return {}
}

function normalizeGroupByFields(
  fields: readonly (string | DataGridSpreadsheetViewGroupByField)[],
): readonly DataGridSpreadsheetViewGroupByField[] {
  return fields.map(field => (
    typeof field === "string"
      ? { key: normalizeColumnKey(field, "group field") }
      : {
        key: normalizeColumnKey(field.key, "group field"),
        as: field.as ? normalizeColumnKey(field.as, "group alias") : undefined,
        label: field.label,
      }
  ))
}

function buildGroupRowId(fields: readonly DataGridSpreadsheetViewGroupByField[], row: SpreadsheetViewRowState): string {
  if (fields.length === 0) return "group:all"
  return `group:${fields.map(field => `${field.as ?? field.key}=${normalizeSpreadsheetViewOutputValue(row.values[field.key])}`).join("\u001f")}`
}

function createGroupStageKey(
  fields: readonly DataGridSpreadsheetViewGroupByField[],
  aggregations: readonly DataGridSpreadsheetViewAggregation[],
): string {
  return [
    fields.map(field => `${field.key}->${field.as ?? field.key}`).join("\u001f"),
    aggregations.map(aggregation => (
      `${normalizeColumnKey(aggregation.key, "aggregation key")}:${aggregation.agg}:${aggregation.field ?? ""}`
    )).join("\u001f"),
  ].join("|")
}

function aggregateGroupValues(
  rows: readonly SpreadsheetViewRowState[],
  aggregation: DataGridSpreadsheetViewAggregation,
): unknown {
  const field = aggregation.field ?? null
  switch (aggregation.agg) {
    case "count": return rows.length
    case "countNonNull":
      return rows.reduce((count, row) => (
        row.values[field ?? ""] == null || isSpreadsheetViewValueEmpty(row.values[field ?? ""]) ? count : count + 1
      ), 0)
    case "sum": return rows.reduce((sum, row) => sum + (coerceSpreadsheetViewNumber(row.values[field ?? ""]) ?? 0), 0)
    case "avg": {
      let sum = 0
      let count = 0
      for (const row of rows) {
        const value = coerceSpreadsheetViewNumber(row.values[field ?? ""])
        if (value == null) continue
        sum += value
        count += 1
      }
      return count > 0 ? sum / count : null
    }
    case "min": {
      let current: unknown = null
      for (const row of rows) {
        const value = row.values[field ?? ""]
        if (current == null || compareSpreadsheetViewValues(value, current) < 0) current = value
      }
      return current
    }
    case "max": {
      let current: unknown = null
      for (const row of rows) {
        const value = row.values[field ?? ""]
        if (current == null || compareSpreadsheetViewValues(value, current) > 0) current = value
      }
      return current
    }
    case "first": return rows[0]?.values[field ?? ""] ?? null
    case "last": return rows[rows.length - 1]?.values[field ?? ""] ?? null
    default: return null
  }
}

function createGroupOutputRow(
  groupId: string,
  anchorValues: Record<string, unknown>,
  groupRows: readonly SpreadsheetViewRowState[],
  groupFields: readonly DataGridSpreadsheetViewGroupByField[],
  aggregations: readonly DataGridSpreadsheetViewAggregation[],
): SpreadsheetViewRowState {
  const values = createSpreadsheetViewValues()
  for (const field of groupFields) values[field.as ?? field.key] = anchorValues[field.key] ?? null
  for (const aggregation of aggregations) {
    values[normalizeColumnKey(aggregation.key, "aggregation key")] = aggregateGroupValues(groupRows, aggregation)
  }
  return { id: groupId, values }
}

export function applySpreadsheetViewGroupStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewGroupStep,
  previousGroupStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState> | undefined,
  nextGroupStageStatesByKey: Map<string, DataGridSpreadsheetViewGroupStageState>,
): SpreadsheetViewDataset {
  const groupFields = normalizeGroupByFields(step.by)
  if (groupFields.length === 0 && step.aggregations.length === 0) {
    throw new Error("[DataGridSpreadsheetView] group step must include fields or aggregations.")
  }
  const sourceColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const stageKey = createGroupStageKey(groupFields, step.aggregations)
  const columns: SpreadsheetViewColumnState[] = []
  for (const field of groupFields) {
    const sourceColumn = sourceColumnsByKey.get(field.key)
    const key = field.as ?? field.key
    columns.push({
      key,
      title: normalizeColumnTitle(field.label, sourceColumn?.title ?? key),
      formulaAlias: sourceColumn?.formulaAlias ?? normalizeColumnTitle(field.label, sourceColumn?.title ?? key),
      style: sourceColumn?.style ?? null,
    })
  }
  for (const aggregation of step.aggregations) {
    const key = normalizeColumnKey(aggregation.key, "aggregation key")
    columns.push({
      key,
      title: normalizeColumnTitle(aggregation.label, key),
      formulaAlias: normalizeColumnTitle(aggregation.label, key),
      style: isNumericSpreadsheetViewAggregation(aggregation.agg)
        ? Object.freeze({ textAlign: "right", ...(aggregation.agg === "sum" ? { fontWeight: 600 } : {}) })
        : null,
    })
  }

  const previousState = previousGroupStageStatesByKey?.get(stageKey)
  const nextSourceRowsById = new Map<DataGridRowId, SpreadsheetViewRowState>()
  type MutableGroupBucketState = {
    groupId: string
    rowsById: Map<DataGridRowId, SpreadsheetViewRowState>
    outputRow: SpreadsheetViewRowState | null
  }
  const nextBucketsByGroupId = previousState
    ? new Map([...previousState.bucketsByGroupId.entries()].map(([groupId, bucket]) => [groupId, {
      groupId: bucket.groupId,
      rowsById: new Map(bucket.rowsById),
      outputRow: bucket.outputRow,
    }]))
    : new Map<string, MutableGroupBucketState>()
  const affectedGroupIds = new Set<string>()
  for (const row of dataset.rows) nextSourceRowsById.set(row.id, row)

  if (previousState) {
    for (const [rowId, previousRow] of previousState.sourceRowsById.entries()) {
      const nextRow = nextSourceRowsById.get(rowId)
      if (nextRow && spreadsheetViewValuesEqual(nextRow.values, previousRow.values)) continue
      const previousGroupId = buildGroupRowId(groupFields, previousRow)
      nextBucketsByGroupId.get(previousGroupId)?.rowsById.delete(rowId)
      affectedGroupIds.add(previousGroupId)
    }
  }
  for (const row of dataset.rows) {
    const previousRow = previousState?.sourceRowsById.get(row.id)
    if (previousRow && spreadsheetViewValuesEqual(previousRow.values, row.values)) continue
    const groupId = buildGroupRowId(groupFields, row)
    const bucket = nextBucketsByGroupId.get(groupId) ?? {
      groupId,
      rowsById: new Map<DataGridRowId, SpreadsheetViewRowState>(),
      outputRow: null,
    }
    bucket.rowsById.set(row.id, row)
    nextBucketsByGroupId.set(groupId, bucket)
    affectedGroupIds.add(groupId)
  }
  for (const groupId of affectedGroupIds) {
    const bucket = nextBucketsByGroupId.get(groupId)
    if (!bucket || bucket.rowsById.size === 0) {
      nextBucketsByGroupId.delete(groupId)
      continue
    }
    let anchorValues: Record<string, unknown> | null = null
    for (const row of dataset.rows) {
      if (bucket.rowsById.has(row.id)) {
        anchorValues = bucket.rowsById.get(row.id)?.values ?? null
        break
      }
    }
    if (!anchorValues) {
      nextBucketsByGroupId.delete(groupId)
      continue
    }
    bucket.outputRow = createGroupOutputRow(groupId, anchorValues, [...bucket.rowsById.values()], groupFields, step.aggregations)
  }

  const rows: SpreadsheetViewRowState[] = []
  const finalizedBucketsByGroupId = new Map<string, DataGridSpreadsheetViewGroupStageStateBucket>()
  const seenGroupIds = new Set<string>()
  for (const row of dataset.rows) {
    const groupId = buildGroupRowId(groupFields, row)
    if (seenGroupIds.has(groupId)) continue
    seenGroupIds.add(groupId)
    const bucket = nextBucketsByGroupId.get(groupId)
    if (!bucket?.outputRow) continue
    rows.push(bucket.outputRow)
    finalizedBucketsByGroupId.set(groupId, {
      groupId: bucket.groupId,
      rowsById: bucket.rowsById,
      outputRow: bucket.outputRow,
    })
  }
  nextGroupStageStatesByKey.set(stageKey, {
    stageKey,
    sourceRowsById: nextSourceRowsById,
    bucketsByGroupId: finalizedBucketsByGroupId,
  })
  return { columns, rows }
}
