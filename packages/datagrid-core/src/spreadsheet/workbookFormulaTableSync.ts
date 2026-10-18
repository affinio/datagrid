import type { DataGridFormulaTableSource } from "../models/formula/formulaContracts.js"
import type { DataGridSpreadsheetSheetModel } from "./sheet.js"

export interface SpreadsheetWorkbookManagedTableSheet {
  id: string
  aliases: readonly string[]
  sheetModel: DataGridSpreadsheetSheetModel
  managedTableAliases: Set<string>
  appliedTableRowsByAlias: Map<string, DataGridFormulaTableSource>
}

export function applySpreadsheetWorkbookManagedTablePatch<TSheet extends SpreadsheetWorkbookManagedTableSheet>(
  targetSheet: TSheet,
  dependencySheetIds: readonly string[],
  resolveSheet: (sheetId: string) => TSheet | null,
  getSheetExportTableSource: (sheet: TSheet) => DataGridFormulaTableSource,
  invalidateSheetExportCache: (sheet: TSheet) => void,
): boolean {
  const desiredTableRowsByAlias = new Map<string, DataGridFormulaTableSource>()
  for (const dependencySheetId of dependencySheetIds) {
    const sourceSheet = resolveSheet(dependencySheetId)
    if (!sourceSheet || sourceSheet.id === targetSheet.id) {
      continue
    }
    const exportedRows = getSheetExportTableSource(sourceSheet)
    for (const alias of sourceSheet.aliases) {
      desiredTableRowsByAlias.set(alias, exportedRows)
    }
  }

  const removedAliases: string[] = []
  for (const alias of targetSheet.managedTableAliases) {
    if (!desiredTableRowsByAlias.has(alias)) {
      removedAliases.push(alias)
    }
  }

  const setEntries: { name: string; source: DataGridFormulaTableSource }[] = []
  for (const [alias, exportedRows] of desiredTableRowsByAlias.entries()) {
    if (
      targetSheet.managedTableAliases.has(alias)
      && targetSheet.appliedTableRowsByAlias.get(alias) === exportedRows
    ) {
      continue
    }
    setEntries.push({ name: alias, source: exportedRows })
  }

  if (removedAliases.length === 0 && setEntries.length === 0) {
    return false
  }

  const previousTableRevision = targetSheet.sheetModel.getTableSourceRevision()
  targetSheet.sheetModel.patchFormulaTables({
    remove: removedAliases,
    set: setEntries,
  })

  for (const alias of removedAliases) {
    targetSheet.managedTableAliases.delete(alias)
    targetSheet.appliedTableRowsByAlias.delete(alias)
  }
  for (const entry of setEntries) {
    targetSheet.managedTableAliases.add(entry.name)
    targetSheet.appliedTableRowsByAlias.set(entry.name, entry.source)
  }

  if (targetSheet.sheetModel.getTableSourceRevision() !== previousTableRevision) {
    invalidateSheetExportCache(targetSheet)
  }
  return true
}
