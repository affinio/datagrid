import type { DataGridSpreadsheetSheetModel } from "./sheet.js"

export interface SpreadsheetWorkbookSheetFormulaDependencyState {
  revision: number
  usesAllTables: boolean
  tableDependencyAliases: readonly string[]
  referenceDependencyAliases: readonly string[]
}

export function normalizeSpreadsheetWorkbookAlias(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

export function resolveSpreadsheetWorkbookSheetFormulaDependencyState(
  sheetModel: DataGridSpreadsheetSheetModel,
): SpreadsheetWorkbookSheetFormulaDependencyState {
  const snapshot = sheetModel.getSnapshot()
  const tableDependencyAliases = new Set<string>()
  const referenceDependencyAliases = new Set<string>()
  let usesAllTables = false

  for (const formulaCell of sheetModel.getFormulaCells()) {
    for (const contextKey of formulaCell.contextKeys) {
      if (contextKey === "tables") {
        usesAllTables = true
        continue
      }
      if (!contextKey.startsWith("table:")) {
        continue
      }
      const normalizedAlias = normalizeSpreadsheetWorkbookAlias(contextKey.slice("table:".length))
      if (normalizedAlias.length === 0) {
        continue
      }
      tableDependencyAliases.add(normalizedAlias)
    }
    const cellSnapshot = sheetModel.getCell(formulaCell.address)
    for (const reference of cellSnapshot?.analysis.references ?? []) {
      const normalizedAlias = normalizeSpreadsheetWorkbookAlias(reference.sheetReference)
      if (normalizedAlias.length === 0) {
        continue
      }
      referenceDependencyAliases.add(normalizedAlias)
    }
  }

  return {
    revision: snapshot.formulaStructureRevision,
    usesAllTables,
    tableDependencyAliases: Object.freeze(
      [...tableDependencyAliases].sort((left, right) => left.localeCompare(right)),
    ),
    referenceDependencyAliases: Object.freeze(
      [...referenceDependencyAliases].sort((left, right) => left.localeCompare(right)),
    ),
  }
}
