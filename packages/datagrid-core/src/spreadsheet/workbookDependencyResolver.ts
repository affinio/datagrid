export interface SpreadsheetWorkbookDependencySheet<TViewDefinition = unknown> {
  readonly id: string
  readonly viewDefinition: TViewDefinition | null
  readonly formulaUsesAllTables: boolean
  readonly formulaTableDependencyAliases: readonly string[]
  readonly formulaReferenceDependencyAliases: readonly string[]
}

/** Resolves workbook sheet and alias references into the graph's forward edges. */
export function resolveSpreadsheetWorkbookDependencies<TViewDefinition, TSheet extends SpreadsheetWorkbookDependencySheet<TViewDefinition>>(
  sheets: readonly TSheet[],
  aliasToSheet: ReadonlyMap<string, Pick<TSheet, "id">>,
  isKnownSheetId: (sheetId: string) => boolean,
  collectViewDependencySheetIds: (definition: TViewDefinition) => readonly string[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const dependenciesBySheetId = new Map<string, ReadonlySet<string>>()

  for (const targetSheet of sheets) {
    const dependencySheetIds = new Set<string>()
    const addDependency = (sourceSheetId: string | undefined): void => {
      if (sourceSheetId && sourceSheetId !== targetSheet.id && isKnownSheetId(sourceSheetId)) {
        dependencySheetIds.add(sourceSheetId)
      }
    }

    if (targetSheet.viewDefinition !== null) {
      for (const sourceSheetId of collectViewDependencySheetIds(targetSheet.viewDefinition)) {
        addDependency(sourceSheetId)
      }
    }
    if (targetSheet.formulaUsesAllTables) {
      for (const sourceSheet of sheets) {
        addDependency(sourceSheet.id)
      }
    } else {
      for (const alias of targetSheet.formulaTableDependencyAliases) {
        addDependency(aliasToSheet.get(alias)?.id)
      }
      for (const alias of targetSheet.formulaReferenceDependencyAliases) {
        addDependency(aliasToSheet.get(alias)?.id)
      }
    }

    dependenciesBySheetId.set(targetSheet.id, dependencySheetIds)
  }

  return dependenciesBySheetId
}
