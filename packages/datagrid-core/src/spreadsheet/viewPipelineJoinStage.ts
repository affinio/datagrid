import type {
  DataGridSpreadsheetViewJoinColumn,
  DataGridSpreadsheetViewJoinStageState,
  DataGridSpreadsheetViewJoinStep,
} from "./viewPipeline.js"
import type { DataGridRowId } from "../models/rowModel.js"
import type { DataGridSpreadsheetViewSourceSheet } from "./sheet.js"
import type { SpreadsheetViewDataset, SpreadsheetViewRowState } from "./viewPipelineDataset.js"
import { createSpreadsheetViewDatasetFromSheetModel } from "./viewPipelineDataset.js"
import { DataGridSpreadsheetViewMaterializationError } from "./viewPipelineMaterializationError.js"
import {
  cloneSpreadsheetViewValues,
  createSpreadsheetViewExplodedRowId,
  createSpreadsheetViewJoinLookupKey,
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

function normalizeJoinColumns(
  columns: readonly (string | DataGridSpreadsheetViewJoinColumn)[],
): readonly DataGridSpreadsheetViewJoinColumn[] {
  return columns.map(column => (
    typeof column === "string"
      ? { key: normalizeColumnKey(column, "join select column") }
      : {
        key: normalizeColumnKey(column.key, "join select column"),
        as: column.as ? normalizeColumnKey(column.as, "join select alias") : undefined,
        label: column.label,
      }
  ))
}

function createJoinStageKey(
  step: DataGridSpreadsheetViewJoinStep,
  selections: readonly DataGridSpreadsheetViewJoinColumn[],
): string {
  const encodedSelections = selections.map(selection => `${selection.key}->${selection.as ?? selection.key}`).join("\u001f")
  return [
    normalizeColumnKey(step.sheetId, "join sheet id"),
    normalizeColumnKey(step.on.leftKey, "join left key"),
    normalizeColumnKey(step.on.rightKey, "join right key"),
    step.mode === "inner" ? "inner" : "left",
    step.multiMatch === "error" ? "error" : step.multiMatch === "explode" ? "explode" : "first",
    encodedSelections,
  ].join("|")
}

function createJoinStageState(
  rightSheetId: string,
  rightSheetModel: DataGridSpreadsheetViewSourceSheet,
  rightKey: string,
  selections: readonly DataGridSpreadsheetViewJoinColumn[],
  stageKey: string,
): DataGridSpreadsheetViewJoinStageState {
  const rightDataset = createSpreadsheetViewDatasetFromSheetModel(rightSheetModel)
  const rowsByLookupKey = new Map<string, SpreadsheetViewRowState[]>()
  const selectedColumnKeys = selections.map(selection => selection.key)
  for (const row of rightDataset.rows) {
    const lookupKey = createSpreadsheetViewJoinLookupKey(row.values[rightKey])
    const matchValues: Record<string, unknown> = {}
    for (const columnKey of selectedColumnKeys) matchValues[columnKey] = row.values[columnKey] ?? null
    const matchRow: SpreadsheetViewRowState = { id: row.id, values: matchValues }
    const matches = rowsByLookupKey.get(lookupKey)
    if (matches) matches.push(matchRow)
    else rowsByLookupKey.set(lookupKey, [matchRow])
  }
  return {
    stageKey,
    rightSheetId,
    rightSheetRevision: rightSheetModel.getSnapshot().revision,
    selectedColumnKeys: Object.freeze([...selectedColumnKeys]),
    rowsByLookupKey,
    sourceRowsById: new Map(),
    outputRowsBySourceRowId: new Map(),
  }
}

export function applySpreadsheetViewJoinStep(
  dataset: SpreadsheetViewDataset,
  step: DataGridSpreadsheetViewJoinStep,
  options: {
    resolveSheetModel?: (sheetId: string) => DataGridSpreadsheetViewSourceSheet | null
    previousStageStates?: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
    nextStageStates: Map<string, DataGridSpreadsheetViewJoinStageState>
  },
): SpreadsheetViewDataset {
  if (typeof options.resolveSheetModel !== "function") {
    throw new DataGridSpreadsheetViewMaterializationError(
      "materialization-failed",
      "[DataGridSpreadsheetView] join step requires a workbook sheet resolver.",
    )
  }
  const rightSheetId = normalizeColumnKey(step.sheetId, "join sheet id")
  const rightSheetModel = options.resolveSheetModel(rightSheetId)
  if (!rightSheetModel) {
    throw new DataGridSpreadsheetViewMaterializationError(
      "join-sheet-missing",
      `[DataGridSpreadsheetView] join sheet '${rightSheetId}' is missing.`,
      rightSheetId,
    )
  }
  const leftKey = normalizeColumnKey(step.on.leftKey, "join left key")
  const rightKey = normalizeColumnKey(step.on.rightKey, "join right key")
  const mode = step.mode === "inner" ? "inner" : "left"
  const multiMatch = step.multiMatch === "error" ? "error" : step.multiMatch === "explode" ? "explode" : "first"
  const selections = normalizeJoinColumns(step.select)
  const joinStageKey = createJoinStageKey(step, selections)
  if (selections.length === 0) {
    throw new Error("[DataGridSpreadsheetView] join step must select at least one right-side column.")
  }

  const leftColumnsByKey = new Map(dataset.columns.map(column => [column.key, column]))
  const rightColumnsByKey = new Map(rightSheetModel.getColumns().map(column => [column.key, column]))
  const outputColumns = [...dataset.columns]
  const joinOutputKeys = new Set<string>(dataset.columns.map(column => column.key))
  for (const selection of selections) {
    const key = selection.as ?? selection.key
    if (joinOutputKeys.has(key)) {
      throw new Error(`[DataGridSpreadsheetView] join output column '${key}' collides with an existing column.`)
    }
    const rightColumn = rightColumnsByKey.get(selection.key)
    outputColumns.push({
      key,
      title: normalizeColumnTitle(selection.label, rightColumn?.title ?? key),
      formulaAlias: rightColumn?.formulaAlias ?? normalizeColumnTitle(selection.label, rightColumn?.title ?? key),
      style: rightColumn?.style ?? null,
    })
    joinOutputKeys.add(key)
  }
  if (!leftColumnsByKey.has(leftKey)) throw new Error(`[DataGridSpreadsheetView] join left key '${leftKey}' does not exist.`)
  if (!rightColumnsByKey.has(rightKey)) {
    throw new Error(`[DataGridSpreadsheetView] join right key '${rightKey}' does not exist on '${rightSheetId}'.`)
  }

  const cachedJoinStageState = options.previousStageStates?.get(joinStageKey)
  const rightSheetRevision = rightSheetModel.getSnapshot().revision
  const reusableJoinStageState = cachedJoinStageState
    && cachedJoinStageState.rightSheetId === rightSheetId
    && cachedJoinStageState.rightSheetRevision === rightSheetRevision
    ? cachedJoinStageState
    : null
  const nextJoinStageState = reusableJoinStageState
    ?? createJoinStageState(rightSheetId, rightSheetModel, rightKey, selections, joinStageKey)
  const nextSourceRowsById = new Map<DataGridRowId, SpreadsheetViewRowState>()
  const nextOutputRowsBySourceRowId = new Map<DataGridRowId, readonly SpreadsheetViewRowState[]>()
  const rows: SpreadsheetViewRowState[] = []

  for (const row of dataset.rows) {
    nextSourceRowsById.set(row.id, row)
    const previousRow = reusableJoinStageState?.sourceRowsById.get(row.id)
    const cachedOutputRows = reusableJoinStageState?.outputRowsBySourceRowId.get(row.id)
    if (previousRow && cachedOutputRows && spreadsheetViewValuesEqual(previousRow.values, row.values)) {
      nextOutputRowsBySourceRowId.set(row.id, cachedOutputRows)
      rows.push(...cachedOutputRows)
      continue
    }
    const matches = nextJoinStageState.rowsByLookupKey.get(createSpreadsheetViewJoinLookupKey(row.values[leftKey])) ?? []
    if (matches.length > 1 && multiMatch === "error") {
      throw new DataGridSpreadsheetViewMaterializationError(
        "join-ambiguous-match",
        `[DataGridSpreadsheetView] join '${rightSheetId}' produced multiple matches for ${leftKey}=${normalizeSpreadsheetViewOutputValue(row.values[leftKey])}.`,
        rightSheetId,
      )
    }
    if (multiMatch === "explode") {
      const fanoutMatches = matches.length > 0 ? matches : (mode === "left" ? [null] : [])
      const outputRows: SpreadsheetViewRowState[] = []
      for (let matchIndex = 0; matchIndex < fanoutMatches.length; matchIndex += 1) {
        const match = fanoutMatches[matchIndex]
        const values = cloneSpreadsheetViewValues(row.values)
        for (const selection of selections) values[selection.as ?? selection.key] = match?.values[selection.key] ?? null
        outputRows.push({
          id: createSpreadsheetViewExplodedRowId(row.id, match?.id ?? null, matchIndex),
          values,
        })
      }
      const frozenOutputRows = Object.freeze(outputRows)
      nextOutputRowsBySourceRowId.set(row.id, frozenOutputRows)
      rows.push(...frozenOutputRows)
      continue
    }
    const match = matches[0] ?? null
    if (!match && mode === "inner") {
      nextOutputRowsBySourceRowId.set(row.id, Object.freeze([]))
      continue
    }
    const values = cloneSpreadsheetViewValues(row.values)
    for (const selection of selections) values[selection.as ?? selection.key] = match?.values[selection.key] ?? null
    const outputRows = Object.freeze([{ id: row.id, values }])
    nextOutputRowsBySourceRowId.set(row.id, outputRows)
    rows.push(...outputRows)
  }

  options.nextStageStates.set(joinStageKey, {
    ...nextJoinStageState,
    sourceRowsById: nextSourceRowsById,
    outputRowsBySourceRowId: nextOutputRowsBySourceRowId,
  })
  return { columns: outputColumns, rows }
}
