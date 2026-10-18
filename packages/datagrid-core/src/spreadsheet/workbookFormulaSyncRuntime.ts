import type { SpreadsheetWorkbookManagedTableSheet } from "./workbookFormulaTableSync.js"

export interface SpreadsheetWorkbookFormulaSyncSheet extends SpreadsheetWorkbookManagedTableSheet {
  kind: "data" | "view"
}

export interface SpreadsheetWorkbookComponentSyncResult {
  passCount: number
  converged: boolean
}

export function syncSpreadsheetWorkbookSheetComponent<TSheet extends SpreadsheetWorkbookFormulaSyncSheet>(
  componentSheetIds: readonly string[],
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>,
  maxPasses: number,
  resolveSheet: (sheetId: string) => TSheet | null,
  applyManagedTablePatch: (sheet: TSheet, dependencySheetIds: readonly string[]) => boolean,
  invalidateSheetExportCache: (sheet: TSheet) => void,
): SpreadsheetWorkbookComponentSyncResult {
  if (componentSheetIds.length === 0) {
    return { passCount: 0, converged: true }
  }

  if (componentSheetIds.length === 1) {
    const targetSheet = resolveSheet(componentSheetIds[0] ?? "")
    if (!targetSheet || targetSheet.kind === "view") {
      return { passCount: 0, converged: true }
    }
    applyManagedTablePatch(
      targetSheet,
      dependencySheetIdsBySheetId.get(targetSheet.id) ?? Object.freeze([]),
    )
    if (targetSheet.sheetModel.recompute()) {
      invalidateSheetExportCache(targetSheet)
    }
    return { passCount: 1, converged: true }
  }

  for (let passIndex = 0; passIndex < maxPasses; passIndex += 1) {
    let changed = false
    let mutableSheetVisited = false
    for (const sheetId of componentSheetIds) {
      const targetSheet = resolveSheet(sheetId)
      if (!targetSheet || targetSheet.kind === "view") {
        continue
      }
      mutableSheetVisited = true
      if (applyManagedTablePatch(
        targetSheet,
        dependencySheetIdsBySheetId.get(targetSheet.id) ?? Object.freeze([]),
      )) {
        changed = true
      }
      if (targetSheet.sheetModel.recompute()) {
        invalidateSheetExportCache(targetSheet)
        changed = true
      }
    }
    if (!mutableSheetVisited) {
      return { passCount: 0, converged: true }
    }
    if (!changed) {
      return { passCount: passIndex + 1, converged: true }
    }
  }

  return { passCount: maxPasses, converged: false }
}
