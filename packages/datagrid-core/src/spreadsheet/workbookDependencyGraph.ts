export interface SpreadsheetWorkbookDependencyGraph {
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>
  dependentSheetIdsBySheetId: ReadonlyMap<string, readonly string[]>
}

/** Normalizes workbook dependency edges into stable forward and reverse adjacency maps. */
export function createSpreadsheetWorkbookDependencyGraph(
  sheetIds: readonly string[],
  dependenciesBySheetId: ReadonlyMap<string, ReadonlySet<string>>,
): SpreadsheetWorkbookDependencyGraph {
  const sheetOrder = new Map(sheetIds.map((sheetId, index) => [sheetId, index]))
  const dependencySheetIdsBySheetId = new Map<string, readonly string[]>()
  const dependentSheetIdsBySheetId = new Map<string, Set<string>>()

  for (const sheetId of sheetIds) {
    dependentSheetIdsBySheetId.set(sheetId, new Set())
  }

  for (const sheetId of sheetIds) {
    const dependencies = [...(dependenciesBySheetId.get(sheetId) ?? [])]
      .filter(dependencyId => dependencyId !== sheetId && sheetOrder.has(dependencyId))
      .sort((left, right) => (sheetOrder.get(left) ?? 0) - (sheetOrder.get(right) ?? 0))
    const frozenDependencies = Object.freeze(dependencies)
    dependencySheetIdsBySheetId.set(sheetId, frozenDependencies)
    for (const dependencyId of frozenDependencies) {
      dependentSheetIdsBySheetId.get(dependencyId)?.add(sheetId)
    }
  }

  return {
    dependencySheetIdsBySheetId,
    dependentSheetIdsBySheetId: new Map(
      sheetIds.map(sheetId => [
        sheetId,
        Object.freeze(
          [...(dependentSheetIdsBySheetId.get(sheetId) ?? [])]
            .sort((left, right) => (sheetOrder.get(left) ?? 0) - (sheetOrder.get(right) ?? 0)),
        ),
      ]),
    ),
  }
}
