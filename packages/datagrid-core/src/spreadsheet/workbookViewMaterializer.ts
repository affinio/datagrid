import type { DataGridSpreadsheetSheetModel } from "./sheet.js"
import type {
  DataGridSpreadsheetDerivedSheetModel,
} from "./derivedSheetModel.js"
import type { DataGridSpreadsheetDerivedSheetRuntime } from "./derivedSheetRuntime.js"
import {
  materializeDataGridSpreadsheetViewRuntimeResult,
  materializeDataGridSpreadsheetViewSheetResult,
  type DataGridSpreadsheetViewGroupStageState,
  type DataGridSpreadsheetViewJoinStageState,
  type DataGridSpreadsheetViewMaterializationDiagnostic,
  type DataGridSpreadsheetViewPivotStageState,
  type DataGridSpreadsheetWorkbookSheetKind,
  type DataGridSpreadsheetWorkbookViewDefinition,
  type DataGridSpreadsheetWorkbookViewSheetModelOptions,
} from "./viewPipeline.js"
import type { CreateDataGridSpreadsheetDerivedSheetModelOptions } from "./derivedSheetModel.js"

export interface SpreadsheetWorkbookViewSheetState {
  id: string
  name: string
  kind: DataGridSpreadsheetWorkbookSheetKind
  viewDefinition: DataGridSpreadsheetWorkbookViewDefinition | null
  viewSheetModelOptions: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  sheetModel: DataGridSpreadsheetSheetModel
  derivedSheetModel: DataGridSpreadsheetDerivedSheetModel | null
  viewDiagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[]
  derivedRuntime: DataGridSpreadsheetDerivedSheetRuntime | null
  viewJoinStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewJoinStageState>
  viewGroupStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewGroupStageState>
  viewPivotStageStatesByKey: ReadonlyMap<string, DataGridSpreadsheetViewPivotStageState>
}

export function materializeSpreadsheetWorkbookViewSheets(
  scheduledComponents: readonly (readonly string[])[],
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>,
  resolveSheet: (sheetId: string) => SpreadsheetWorkbookViewSheetState | null,
  createSheetModelOptions: (
    sheetId: string,
    sheetName: string,
    options: DataGridSpreadsheetWorkbookViewSheetModelOptions | null,
  ) => CreateDataGridSpreadsheetDerivedSheetModelOptions,
  onSheetChanged: (sheet: SpreadsheetWorkbookViewSheetState) => void,
): void {
  for (const componentSheetIds of scheduledComponents) {
    if (componentSheetIds.length === 0) {
      continue
    }
    const componentIsCyclic = componentSheetIds.length > 1 || componentSheetIds.some(sheetId => (
      dependencySheetIdsBySheetId.get(sheetId)?.includes(sheetId) ?? false
    ))
    const cycleMessage = componentIsCyclic
      ? `Circular view dependency detected: ${componentSheetIds
        .map(sheetId => resolveSheet(sheetId)?.name ?? sheetId)
        .join(" -> ")}`
      : null

    for (const sheetId of componentSheetIds) {
      const targetSheet = resolveSheet(sheetId)
      if (!targetSheet || targetSheet.kind !== "view" || !targetSheet.viewDefinition) {
        continue
      }
      let viewSheetChanged = false
      const input = {
        sheetId: targetSheet.id,
        sheetName: targetSheet.name,
        sourceSheetId: targetSheet.viewDefinition.sourceSheetId,
        sourceSheetModel: resolveSheet(targetSheet.viewDefinition.sourceSheetId)?.sheetModel ?? null,
        resolveSheetModel: (sourceSheetId: string) => resolveSheet(sourceSheetId)?.sheetModel ?? null,
        pipeline: targetSheet.viewDefinition.pipeline,
        sheetModelOptions: targetSheet.viewSheetModelOptions,
        errorMessage: cycleMessage,
        previousJoinStageStatesByKey: targetSheet.viewJoinStageStatesByKey,
        previousGroupStageStatesByKey: targetSheet.viewGroupStageStatesByKey,
        previousPivotStageStatesByKey: targetSheet.viewPivotStageStatesByKey,
      }
      if (targetSheet.derivedSheetModel) {
        const nextState = materializeDataGridSpreadsheetViewRuntimeResult(input)
        targetSheet.viewDiagnostics = nextState.diagnostics
        targetSheet.derivedRuntime = nextState.derivedRuntime
        targetSheet.viewJoinStageStatesByKey = nextState.joinStageStatesByKey
        targetSheet.viewGroupStageStatesByKey = nextState.groupStageStatesByKey
        targetSheet.viewPivotStageStatesByKey = nextState.pivotStageStatesByKey
        viewSheetChanged = targetSheet.derivedSheetModel.replaceRuntime(
          nextState.derivedRuntime,
          createSheetModelOptions(
            targetSheet.id,
            targetSheet.name,
            targetSheet.viewSheetModelOptions,
          ),
        )
      } else {
        const nextState = materializeDataGridSpreadsheetViewSheetResult(input)
        targetSheet.viewDiagnostics = nextState.diagnostics
        targetSheet.derivedRuntime = nextState.derivedRuntime
        targetSheet.viewJoinStageStatesByKey = nextState.joinStageStatesByKey
        targetSheet.viewGroupStageStatesByKey = nextState.groupStageStatesByKey
        targetSheet.viewPivotStageStatesByKey = nextState.pivotStageStatesByKey
        viewSheetChanged = targetSheet.sheetModel.restoreState(nextState.sheetState)
      }
      if (viewSheetChanged) {
        onSheetChanged(targetSheet)
      }
    }
  }
}
