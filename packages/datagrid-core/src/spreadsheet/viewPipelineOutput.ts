import type {
  DataGridSpreadsheetColumnSnapshot,
  DataGridSpreadsheetSheetState,
} from "./sheet.js"
import type { DataGridSpreadsheetDerivedSheetRuntime } from "./derivedSheetRuntime.js"
import type {
  DataGridSpreadsheetViewMaterializationDiagnostic,
  DataGridSpreadsheetWorkbookViewSheetModelOptions,
} from "./viewPipeline.js"
import type { SpreadsheetViewDataset } from "./viewPipelineDataset.js"
import { createDataGridSpreadsheetDerivedSheetRuntime } from "./derivedSheetRuntime.js"
import { normalizeSpreadsheetViewOutputValue } from "./viewPipelineValueUtils.js"

export const EMPTY_SPREADSHEET_VIEW_DIAGNOSTICS = Object.freeze([]) as readonly DataGridSpreadsheetViewMaterializationDiagnostic[]

function normalizeSheetModelOptions(
  options: DataGridSpreadsheetWorkbookViewSheetModelOptions | null | undefined,
): DataGridSpreadsheetWorkbookViewSheetModelOptions {
  return {
    sheetStyle: options?.sheetStyle ?? null,
    functionRegistry: options?.functionRegistry,
    referenceParserOptions: options?.referenceParserOptions,
    runtimeErrorPolicy: options?.runtimeErrorPolicy ?? "error-value",
    resolveContextValue: options?.resolveContextValue,
  }
}

function createMaterializedCellRawInput(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trimStart().startsWith("=") ? normalizeSpreadsheetViewOutputValue(value) : ""
}

export function spreadsheetViewDatasetToSheetState(
  dataset: SpreadsheetViewDataset,
  options: {
    sheetId: string
    sheetName: string
    sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  },
): DataGridSpreadsheetSheetState {
  if (dataset.columns.length === 0) {
    throw new Error("[DataGridSpreadsheetView] materialized view must expose at least one column.")
  }
  const sheetOptions = normalizeSheetModelOptions(options.sheetModelOptions)
  return {
    sheetId: options.sheetId,
    sheetName: options.sheetName,
    columns: Object.freeze(dataset.columns.map(column => ({
      key: column.key,
      title: column.title,
      formulaAlias: column.formulaAlias,
      style: column.style,
    } satisfies DataGridSpreadsheetColumnSnapshot))),
    rows: Object.freeze(dataset.rows.map(row => ({
      id: row.id,
      style: null,
      cells: Object.freeze(dataset.columns.map(column => ({
        columnKey: column.key,
        rawInput: createMaterializedCellRawInput(row.values[column.key]),
        resolvedValue: row.values[column.key],
        style: null,
      }))),
    }))),
    sheetStyle: sheetOptions.sheetStyle ?? null,
    formulaTables: Object.freeze([]),
    functionRegistry: sheetOptions.functionRegistry,
    referenceParserOptions: sheetOptions.referenceParserOptions,
    runtimeErrorPolicy: sheetOptions.runtimeErrorPolicy ?? "error-value",
    resolveContextValue: sheetOptions.resolveContextValue,
  }
}

export function spreadsheetViewRuntimeToSheetState(
  runtime: DataGridSpreadsheetDerivedSheetRuntime,
  options: {
    sheetId: string
    sheetName: string
    sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  },
): DataGridSpreadsheetSheetState {
  return spreadsheetViewDatasetToSheetState({
    columns: runtime.columns,
    rows: runtime.rows.map(row => {
      const values: Record<string, unknown> = {}
      for (let index = 0; index < runtime.columns.length; index += 1) {
        const column = runtime.columns[index]
        if (column) values[column.key] = row.values[index]
      }
      return { id: row.id, values }
    }),
  }, options)
}

export function spreadsheetViewDatasetToDerivedRuntime(
  dataset: SpreadsheetViewDataset,
  diagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[] = EMPTY_SPREADSHEET_VIEW_DIAGNOSTICS,
): DataGridSpreadsheetDerivedSheetRuntime {
  return createDataGridSpreadsheetDerivedSheetRuntime({
    columns: dataset.columns.map(column => ({
      key: column.key,
      title: column.title,
      formulaAlias: column.formulaAlias,
      style: column.style,
    })),
    rows: dataset.rows.map(row => ({
      id: row.id,
      values: dataset.columns.map(column => row.values[column.key]),
    })),
    diagnostics,
  })
}

export function createSpreadsheetViewErrorDataset(options: {
  sheetId: string
  message: string
}): SpreadsheetViewDataset {
  return {
    columns: Object.freeze([
      { key: "status", title: "Status", formulaAlias: "Status", style: Object.freeze({ fontWeight: 700 }) },
      { key: "message", title: "Message", formulaAlias: "Message", style: null },
    ]),
    rows: Object.freeze([{
      id: `${options.sheetId}-error`,
      values: { status: "Error", message: options.message },
    }]),
  }
}
