import type {
  DataGridAggOp,
  DataGridColumnPredicateOperator,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridSortDirection,
} from "../models/rowModel.js"
import type {
  CreateDataGridSpreadsheetSheetModelOptions,
  DataGridSpreadsheetSheetState,
  DataGridSpreadsheetViewSourceSheet,
} from "./sheet.js"
import type { DataGridSpreadsheetViewMaterializationDiagnosticCode } from "./viewPipelineMaterializationError.js"
import { applySpreadsheetViewGroupStep } from "./viewPipelineGroupStage.js"
import { applySpreadsheetViewPivotStep } from "./viewPipelinePivotStage.js"
import {
  createSpreadsheetViewErrorDataset,
  EMPTY_SPREADSHEET_VIEW_DIAGNOSTICS,
  spreadsheetViewDatasetToDerivedRuntime,
  spreadsheetViewRuntimeToSheetState,
} from "./viewPipelineOutput.js"
import { applySpreadsheetViewJoinStep } from "./viewPipelineJoinStage.js"
import { DataGridSpreadsheetViewMaterializationError } from "./viewPipelineMaterializationError.js"
import { createSpreadsheetViewDatasetFromSheetModel } from "./viewPipelineDataset.js"
import {
  applySpreadsheetViewFilterStep,
  applySpreadsheetViewProjectStep,
  applySpreadsheetViewSortStep,
} from "./viewPipelineBasicStages.js"
import type { SpreadsheetViewRowState } from "./viewPipelineDataset.js"
import type { DataGridSpreadsheetDerivedSheetRuntime } from "./derivedSheetRuntime.js"

export type DataGridSpreadsheetWorkbookSheetKind = "data" | "view"

export interface DataGridSpreadsheetViewFilterClause {
  key: string
  operator: DataGridColumnPredicateOperator
  value?: unknown
  value2?: unknown
  caseSensitive?: boolean
}

export interface DataGridSpreadsheetViewFilterStep {
  type: "filter"
  mode?: "all" | "any"
  clauses: readonly DataGridSpreadsheetViewFilterClause[]
}

export interface DataGridSpreadsheetViewSortField {
  key: string
  direction?: DataGridSortDirection
}

export interface DataGridSpreadsheetViewSortStep {
  type: "sort"
  fields: readonly (string | DataGridSpreadsheetViewSortField)[]
}

export interface DataGridSpreadsheetViewProjectColumn {
  key: string
  as?: string
  label?: string
}

export interface DataGridSpreadsheetViewProjectStep {
  type: "project"
  columns: readonly (string | DataGridSpreadsheetViewProjectColumn)[]
}

export interface DataGridSpreadsheetViewJoinColumn {
  key: string
  as?: string
  label?: string
}

export interface DataGridSpreadsheetViewJoinStep {
  type: "join"
  sheetId: string
  mode?: "left" | "inner"
  on: {
    leftKey: string
    rightKey: string
  }
  select: readonly (string | DataGridSpreadsheetViewJoinColumn)[]
  multiMatch?: "first" | "error" | "explode"
}

export interface DataGridSpreadsheetViewGroupByField {
  key: string
  as?: string
  label?: string
}

export interface DataGridSpreadsheetViewAggregation {
  key: string
  field?: string | null
  agg: Exclude<DataGridAggOp, "custom">
  label?: string
}

export interface DataGridSpreadsheetViewGroupStep {
  type: "group"
  by: readonly (string | DataGridSpreadsheetViewGroupByField)[]
  aggregations: readonly DataGridSpreadsheetViewAggregation[]
}

export interface DataGridSpreadsheetViewPivotStep {
  type: "pivot"
  spec: DataGridPivotSpec
}

export type DataGridSpreadsheetViewStep =
  | DataGridSpreadsheetViewFilterStep
  | DataGridSpreadsheetViewSortStep
  | DataGridSpreadsheetViewProjectStep
  | DataGridSpreadsheetViewJoinStep
  | DataGridSpreadsheetViewGroupStep
  | DataGridSpreadsheetViewPivotStep

export interface DataGridSpreadsheetWorkbookViewDefinition {
  sourceSheetId: string
  pipeline: readonly DataGridSpreadsheetViewStep[]
}

export type DataGridSpreadsheetWorkbookViewSheetModelOptions = Omit<
  CreateDataGridSpreadsheetSheetModelOptions,
  "sheetId" | "sheetName" | "columns" | "rows" | "formulaTables" | "resolveSheetReference"
>

export interface MaterializeDataGridSpreadsheetViewSheetOptions {
  sheetId: string
  sheetName: string
  sourceSheetId: string
  sourceSheetModel: DataGridSpreadsheetViewSourceSheet | null
  resolveSheetModel?: (sheetId: string) => DataGridSpreadsheetViewSourceSheet | null
  pipeline: readonly DataGridSpreadsheetViewStep[]
  sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  errorMessage?: string | null
  previousJoinStageStatesByKey?: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
  previousGroupStageStatesByKey?: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState>
  previousPivotStageStatesByKey?: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState>
}

export type { DataGridSpreadsheetViewMaterializationDiagnosticCode } from "./viewPipelineMaterializationError.js"

export interface DataGridSpreadsheetViewMaterializationDiagnostic {
  code: DataGridSpreadsheetViewMaterializationDiagnosticCode
  message: string
  relatedSheetId?: string | null
}

export interface MaterializeDataGridSpreadsheetViewSheetResult {
  sheetState: DataGridSpreadsheetSheetState
  derivedRuntime: DataGridSpreadsheetDerivedSheetRuntime
  diagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[]
  joinStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
  groupStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState>
  pivotStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState>
}

export interface MaterializeDataGridSpreadsheetViewRuntimeResult {
  derivedRuntime: DataGridSpreadsheetDerivedSheetRuntime
  diagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[]
  joinStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
  groupStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState>
  pivotStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState>
}

export interface DataGridSpreadsheetViewJoinStageState {
  stageKey: string
  rightSheetId: string
  rightSheetRevision: number
  selectedColumnKeys: readonly string[]
  rowsByLookupKey: ReadonlyMap<string, readonly SpreadsheetViewRowState[]>
  sourceRowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  outputRowsBySourceRowId: ReadonlyMap<DataGridRowId, readonly SpreadsheetViewRowState[]>
}

export interface DataGridSpreadsheetViewGroupStageStateBucket {
  groupId: string
  rowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  outputRow: SpreadsheetViewRowState
}

export interface DataGridSpreadsheetViewGroupStageState {
  stageKey: string
  sourceRowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  bucketsByGroupId: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageStateBucket>
}

export interface DataGridSpreadsheetViewPivotStageState {
  stageKey: string
  sourceRowsById: ReadonlyMap<DataGridRowId, SpreadsheetViewRowState>
  leafRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<Record<string, unknown>>>
}

export function materializeDataGridSpreadsheetViewSheetResult(
  options: MaterializeDataGridSpreadsheetViewSheetOptions,
): MaterializeDataGridSpreadsheetViewSheetResult {
  const runtimeResult = materializeDataGridSpreadsheetViewRuntimeResult(options)
  return {
    sheetState: spreadsheetViewRuntimeToSheetState(runtimeResult.derivedRuntime, options),
    derivedRuntime: runtimeResult.derivedRuntime,
    diagnostics: runtimeResult.diagnostics,
    joinStageStatesByKey: runtimeResult.joinStageStatesByKey,
    groupStageStatesByKey: runtimeResult.groupStageStatesByKey,
    pivotStageStatesByKey: runtimeResult.pivotStageStatesByKey,
  }
}

export function materializeDataGridSpreadsheetViewRuntimeResult(
  options: MaterializeDataGridSpreadsheetViewSheetOptions,
): MaterializeDataGridSpreadsheetViewRuntimeResult {
  if (options.errorMessage) {
    const diagnostics = Object.freeze([
      {
        code: "cycle" as const,
        message: options.errorMessage,
        relatedSheetId: null,
      },
    ])
    const errorDataset = createSpreadsheetViewErrorDataset({
      sheetId: options.sheetId,
      message: options.errorMessage,
    })
    return {
      derivedRuntime: spreadsheetViewDatasetToDerivedRuntime(errorDataset, diagnostics),
      diagnostics,
      joinStageStatesByKey: new Map(),
      groupStageStatesByKey: new Map(),
      pivotStageStatesByKey: new Map(),
    }
  }
  if (!options.sourceSheetModel) {
    const diagnostics = Object.freeze([
      {
        code: "source-missing" as const,
        message: `Source sheet '${options.sourceSheetId}' is missing.`,
        relatedSheetId: options.sourceSheetId,
      },
    ])
    const errorDataset = createSpreadsheetViewErrorDataset({
      sheetId: options.sheetId,
      message: `Source sheet '${options.sourceSheetId}' is missing.`,
    })
    return {
      derivedRuntime: spreadsheetViewDatasetToDerivedRuntime(errorDataset, diagnostics),
      diagnostics,
      joinStageStatesByKey: new Map(),
      groupStageStatesByKey: new Map(),
      pivotStageStatesByKey: new Map(),
    }
  }

  try {
    let dataset = createSpreadsheetViewDatasetFromSheetModel(options.sourceSheetModel)
    const nextJoinStageStatesByKey = new Map<string, DataGridSpreadsheetViewJoinStageState>()
    const nextGroupStageStatesByKey = new Map<string, DataGridSpreadsheetViewGroupStageState>()
    const nextPivotStageStatesByKey = new Map<string, DataGridSpreadsheetViewPivotStageState>()
    for (const step of options.pipeline) {
      switch (step.type) {
        case "filter":
          dataset = applySpreadsheetViewFilterStep(dataset, step)
          break
        case "sort":
          dataset = applySpreadsheetViewSortStep(dataset, step)
          break
        case "project":
          dataset = applySpreadsheetViewProjectStep(dataset, step)
          break
        case "join":
          dataset = applySpreadsheetViewJoinStep(dataset, step, {
            resolveSheetModel: options.resolveSheetModel,
            previousStageStates: options.previousJoinStageStatesByKey,
            nextStageStates: nextJoinStageStatesByKey,
          })
          break
        case "group":
          dataset = applySpreadsheetViewGroupStep(
            dataset,
            step,
            options.previousGroupStageStatesByKey,
            nextGroupStageStatesByKey,
          )
          break
        case "pivot":
          dataset = applySpreadsheetViewPivotStep(
            dataset,
            step,
            options.previousPivotStageStatesByKey,
            nextPivotStageStatesByKey,
          )
          break
        default:
          throw new Error("[DataGridSpreadsheetView] unsupported pipeline step.")
      }
    }
    return {
      derivedRuntime: spreadsheetViewDatasetToDerivedRuntime(dataset),
      diagnostics: EMPTY_SPREADSHEET_VIEW_DIAGNOSTICS,
      joinStageStatesByKey: nextJoinStageStatesByKey,
      groupStageStatesByKey: nextGroupStageStatesByKey,
      pivotStageStatesByKey: nextPivotStageStatesByKey,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "[DataGridSpreadsheetView] materialization failed."
    const diagnostic = error instanceof DataGridSpreadsheetViewMaterializationError
      ? {
        code: error.code,
        message,
        relatedSheetId: error.relatedSheetId,
      }
      : {
        code: "materialization-failed" as const,
        message,
        relatedSheetId: null,
      }
    const diagnostics = Object.freeze([diagnostic])
    const errorDataset = createSpreadsheetViewErrorDataset({
      sheetId: options.sheetId,
      message,
    })
    return {
      derivedRuntime: spreadsheetViewDatasetToDerivedRuntime(errorDataset, diagnostics),
      diagnostics,
      joinStageStatesByKey: new Map(),
      groupStageStatesByKey: new Map(),
      pivotStageStatesByKey: new Map(),
    }
  }
}
