/** Builds a deterministic dependency-first schedule for an affected workbook subgraph. */
export function createSpreadsheetWorkbookComponentSchedule(
  sheetIds: readonly string[],
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>,
  sheetOrderById: ReadonlyMap<string, number>,
): readonly (readonly string[])[] {
  const affectedSheetIds = new Set<string>(sheetIds)
  const indexBySheetId = new Map<string, number>()
  const lowLinkBySheetId = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []
  let nextIndex = 0

  const strongConnect = (sheetId: string): void => {
    indexBySheetId.set(sheetId, nextIndex)
    lowLinkBySheetId.set(sheetId, nextIndex)
    nextIndex += 1
    stack.push(sheetId)
    onStack.add(sheetId)

    for (const dependencySheetId of dependencySheetIdsBySheetId.get(sheetId) ?? []) {
      if (!affectedSheetIds.has(dependencySheetId)) continue
      if (!indexBySheetId.has(dependencySheetId)) {
        strongConnect(dependencySheetId)
        lowLinkBySheetId.set(sheetId, Math.min(
          lowLinkBySheetId.get(sheetId) ?? Number.POSITIVE_INFINITY,
          lowLinkBySheetId.get(dependencySheetId) ?? Number.POSITIVE_INFINITY,
        ))
      } else if (onStack.has(dependencySheetId)) {
        lowLinkBySheetId.set(sheetId, Math.min(
          lowLinkBySheetId.get(sheetId) ?? Number.POSITIVE_INFINITY,
          indexBySheetId.get(dependencySheetId) ?? Number.POSITIVE_INFINITY,
        ))
      }
    }

    if (lowLinkBySheetId.get(sheetId) !== indexBySheetId.get(sheetId)) return
    const component: string[] = []
    while (stack.length > 0) {
      const stackSheetId = stack.pop()
      if (typeof stackSheetId === "undefined") break
      onStack.delete(stackSheetId)
      component.push(stackSheetId)
      if (stackSheetId === sheetId) break
    }
    component.sort((left, right) => (sheetOrderById.get(left) ?? 0) - (sheetOrderById.get(right) ?? 0))
    components.push(component)
  }

  for (const sheetId of sheetIds) {
    if (!indexBySheetId.has(sheetId)) strongConnect(sheetId)
  }
  const frozenComponents = Object.freeze(components.map(component => Object.freeze([...component])))
  const componentIndexBySheetId = new Map<string, number>()
  frozenComponents.forEach((component, componentIndex) => {
    for (const sheetId of component) componentIndexBySheetId.set(sheetId, componentIndex)
  })

  const dependencies = new Map<number, Set<number>>()
  const dependents = new Map<number, Set<number>>()
  frozenComponents.forEach((_, index) => {
    dependencies.set(index, new Set())
    dependents.set(index, new Set())
  })
  frozenComponents.forEach((component, index) => {
    for (const sheetId of component) {
      for (const dependencySheetId of dependencySheetIdsBySheetId.get(sheetId) ?? []) {
        if (!affectedSheetIds.has(dependencySheetId)) continue
        const dependencyIndex = componentIndexBySheetId.get(dependencySheetId)
        if (typeof dependencyIndex !== "number" || dependencyIndex === index) continue
        dependencies.get(index)?.add(dependencyIndex)
        dependents.get(dependencyIndex)?.add(index)
      }
    }
  })

  const compareBySheetOrder = (left: number, right: number): number =>
    (sheetOrderById.get(frozenComponents[left]?.[0] ?? "") ?? 0)
    - (sheetOrderById.get(frozenComponents[right]?.[0] ?? "") ?? 0)
  const available = frozenComponents
    .map((_, index) => index)
    .filter(index => dependencies.get(index)?.size === 0)
    .sort(compareBySheetOrder)
  const enqueued = new Set(available)
  const schedule: (readonly string[])[] = []
  while (available.length > 0) {
    const index = available.shift()
    if (typeof index !== "number") break
    schedule.push(frozenComponents[index] ?? Object.freeze([]))
    for (const dependent of dependents.get(index) ?? []) {
      const remaining = dependencies.get(dependent)
      remaining?.delete(index)
      if ((remaining?.size ?? 0) > 0 || enqueued.has(dependent)) continue
      available.push(dependent)
      available.sort(compareBySheetOrder)
      enqueued.add(dependent)
    }
  }

  const result = schedule.length === frozenComponents.length ? schedule : frozenComponents
  return Object.freeze(result.map(component => Object.freeze([...component])))
}
