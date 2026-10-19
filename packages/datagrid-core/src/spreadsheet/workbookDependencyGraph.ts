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

/** Returns dirty sheets and all of their downstream dependents in workbook order. */
export function resolveSpreadsheetWorkbookAffectedSheetIds(
  sheetIds: readonly string[],
  dependentSheetIdsBySheetId: ReadonlyMap<string, readonly string[]>,
  dirtySheetIds?: ReadonlySet<string>,
  structural = false,
): readonly string[] {
  if (structural || !dirtySheetIds || dirtySheetIds.size === 0) {
    return Object.freeze([...sheetIds])
  }

  const affectedSheetIds = new Set<string>()
  const queue: string[] = []
  for (const dirtySheetId of dirtySheetIds) {
    if (dependentSheetIdsBySheetId.has(dirtySheetId) && !affectedSheetIds.has(dirtySheetId)) {
      affectedSheetIds.add(dirtySheetId)
      queue.push(dirtySheetId)
    }
  }

  while (queue.length > 0) {
    const producerSheetId = queue.shift()
    if (typeof producerSheetId !== "string") {
      break
    }
    for (const dependentSheetId of dependentSheetIdsBySheetId.get(producerSheetId) ?? []) {
      if (affectedSheetIds.has(dependentSheetId)) {
        continue
      }
      affectedSheetIds.add(dependentSheetId)
      queue.push(dependentSheetId)
    }
  }

  return Object.freeze(sheetIds.filter(sheetId => affectedSheetIds.has(sheetId)))
}
