import {
  createClientRowModel,
  type ClientRowModel,
  type CreateClientRowModelOptions,
} from "./clientRowModel.js"
import type {
  DataGridFormulaTableSource,
  DataGridRowNode,
  DataGridRowNodeInput,
} from "./rowModel.js"

export interface DataGridWorkbookSheetInput {
  id?: string
  name: string
  rowModel?: ClientRowModel<unknown>
  rows?: readonly DataGridRowNodeInput<unknown>[]
  rowModelOptions?: CreateClientRowModelOptions<unknown>
  ownRowModel?: boolean
}

export interface CreateClientWorkbookModelOptions {
  sheets?: readonly DataGridWorkbookSheetInput[]
  activeSheetId?: string | null
  formulaTableSyncMaxPasses?: number | null
}

export interface DataGridWorkbookSheetHandle {
  id: string
  name: string
  aliases: readonly string[]
  rowModel: ClientRowModel<unknown>
}

export interface DataGridWorkbookSheetSnapshot extends DataGridWorkbookSheetHandle {
  revision?: number
  visibleRowCount: number
  sourceRowCount: number
}

export interface DataGridWorkbookSyncSnapshot {
  passCount: number
  converged: boolean
  maxPasses: number
}

export interface DataGridWorkbookSnapshot {
  activeSheetId: string | null
  sheets: readonly DataGridWorkbookSheetSnapshot[]
  sync: DataGridWorkbookSyncSnapshot
}

export type DataGridWorkbookListener = (snapshot: DataGridWorkbookSnapshot) => void

export interface ClientWorkbookModel {
  getSnapshot(): DataGridWorkbookSnapshot
  getSheets(): readonly DataGridWorkbookSheetHandle[]
  getSheet(sheetId: string): DataGridWorkbookSheetHandle | null
  getActiveSheetId(): string | null
  getActiveSheet(): DataGridWorkbookSheetHandle | null
  setActiveSheet(sheetId: string): boolean
  addSheet(input: DataGridWorkbookSheetInput): DataGridWorkbookSheetHandle
  removeSheet(sheetId: string): boolean
  renameSheet(sheetId: string, name: string): boolean
  sync(): void
  subscribe(listener: DataGridWorkbookListener): () => void
  dispose(): void
}

type WorkbookTableSource = DataGridFormulaTableSource

interface WorkbookSheetState {
  id: string
  name: string
  aliases: readonly string[]
  rowModel: ClientRowModel<unknown>
  owned: boolean
  unsubscribe: (() => void) | null
  exportedSourceRevision: number
  exportedTableRows: WorkbookTableSource | null
  formulaStructureRevision: number
  formulaUsesAllTables: boolean
  formulaTableDependencyAliases: readonly string[]
  managedTableAliases: Set<string>
  appliedTableRowsByAlias: Map<string, WorkbookTableSource>
}

interface WorkbookDependencyGraph {
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>
  dependentSheetIdsBySheetId: ReadonlyMap<string, readonly string[]>
}

interface WorkbookComponentSyncResult {
  passCount: number
  converged: boolean
}

interface WorkbookSyncOptions {
  dirtySheetIds?: ReadonlySet<string>
  structural?: boolean
}

interface WorkbookGraphState {
  aliasToSheet: ReadonlyMap<string, WorkbookSheetState>
  graph: WorkbookDependencyGraph
  sheetOrderById: ReadonlyMap<string, number>
}

interface WorkbookSheetFormulaDependencyState {
  revision: number
  usesAllTables: boolean
  tableDependencyAliases: readonly string[]
}

function normalizeWorkbookSheetName(value: unknown): string {
  const normalized = String(value ?? "").trim()
  if (normalized.length === 0) {
    throw new Error("[clientWorkbookModel] Sheet name must be non-empty.")
  }
  return normalized
}

function normalizeWorkbookSheetId(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  if (normalized.length === 0) {
    throw new Error("[clientWorkbookModel] Sheet id must contain at least one alphanumeric character.")
  }
  return normalized
}

function normalizeWorkbookSheetAlias(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

function buildWorkbookSheetAliases(id: string, name: string): readonly string[] {
  const aliases = new Set<string>()
  const idAlias = normalizeWorkbookSheetAlias(id)
  const nameAlias = normalizeWorkbookSheetAlias(name)
  if (idAlias.length > 0) {
    aliases.add(idAlias)
  }
  if (nameAlias.length > 0) {
    aliases.add(nameAlias)
  }
  return Object.freeze([...aliases])
}

function createWorkbookSheetId(
  name: string,
  existingIds: ReadonlySet<string>,
): string {
  const baseId = normalizeWorkbookSheetId(name)
  if (!existingIds.has(baseId)) {
    return baseId
  }
  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  return `${baseId}-${suffix}`
}

function resolveWorkbookSyncMaxPasses(
  input: number | null | undefined,
  sheetCount: number,
): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    const normalized = Math.trunc(input)
    if (normalized < 1) {
      throw new Error("[clientWorkbookModel] formulaTableSyncMaxPasses must be >= 1 when provided.")
    }
    return normalized
  }
  return Math.max(4, sheetCount * 2)
}

function areWorkbookStringListsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

function resolveWorkbookSheetFormulaDependencyState(
  rowModel: ClientRowModel<unknown>,
): WorkbookSheetFormulaDependencyState {
  const tableDependencyAliases = new Set<string>()
  let usesAllTables = false

  for (const formulaField of rowModel.getFormulaFields()) {
    for (const contextKey of formulaField.contextKeys) {
      if (contextKey === "tables") {
        usesAllTables = true
        continue
      }
      if (!contextKey.startsWith("table:")) {
        continue
      }
      const normalizedAlias = normalizeWorkbookSheetAlias(contextKey.slice("table:".length))
      if (normalizedAlias.length === 0) {
        continue
      }
      tableDependencyAliases.add(normalizedAlias)
    }
  }

  return {
    revision: rowModel.getFormulaStructureRevision(),
    usesAllTables,
    tableDependencyAliases: Object.freeze([...tableDependencyAliases].sort((left, right) => left.localeCompare(right))),
  }
}

function createWorkbookSheetHandle(sheet: WorkbookSheetState): DataGridWorkbookSheetHandle {
  return {
    id: sheet.id,
    name: sheet.name,
    aliases: sheet.aliases,
    rowModel: sheet.rowModel,
  }
}

function createWorkbookSheetSnapshot(sheet: WorkbookSheetState): DataGridWorkbookSheetSnapshot {
  const snapshot = sheet.rowModel.getSnapshot()
  return {
    ...createWorkbookSheetHandle(sheet),
    revision: snapshot.revision,
    visibleRowCount: snapshot.rowCount,
    sourceRowCount: sheet.rowModel.getSourceRows().length,
  }
}

function resolveWorkbookTableSourceRowValue(row: unknown): unknown {
  return (row as DataGridRowNode<unknown>).data as unknown
}

function computeWorkbookStronglyConnectedComponents(
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
      if (!affectedSheetIds.has(dependencySheetId)) {
        continue
      }
      if (!indexBySheetId.has(dependencySheetId)) {
        strongConnect(dependencySheetId)
        lowLinkBySheetId.set(
          sheetId,
          Math.min(
            lowLinkBySheetId.get(sheetId) ?? Number.POSITIVE_INFINITY,
            lowLinkBySheetId.get(dependencySheetId) ?? Number.POSITIVE_INFINITY,
          ),
        )
        continue
      }
      if (onStack.has(dependencySheetId)) {
        lowLinkBySheetId.set(
          sheetId,
          Math.min(
            lowLinkBySheetId.get(sheetId) ?? Number.POSITIVE_INFINITY,
            indexBySheetId.get(dependencySheetId) ?? Number.POSITIVE_INFINITY,
          ),
        )
      }
    }

    if (lowLinkBySheetId.get(sheetId) !== indexBySheetId.get(sheetId)) {
      return
    }

    const component: string[] = []
    while (stack.length > 0) {
      const stackSheetId = stack.pop()
      if (typeof stackSheetId === "undefined") {
        break
      }
      onStack.delete(stackSheetId)
      component.push(stackSheetId)
      if (stackSheetId === sheetId) {
        break
      }
    }
    component.sort((left, right) => (sheetOrderById.get(left) ?? 0) - (sheetOrderById.get(right) ?? 0))
    components.push(component)
  }

  for (const sheetId of sheetIds) {
    if (!indexBySheetId.has(sheetId)) {
      strongConnect(sheetId)
    }
  }

  return Object.freeze(components.map(component => Object.freeze([...component])))
}

function createWorkbookComponentSchedule(
  sheetIds: readonly string[],
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>,
  sheetOrderById: ReadonlyMap<string, number>,
): readonly (readonly string[])[] {
  const components = computeWorkbookStronglyConnectedComponents(
    sheetIds,
    dependencySheetIdsBySheetId,
    sheetOrderById,
  )
  const affectedSheetIds = new Set<string>(sheetIds)
  const componentIndexBySheetId = new Map<string, number>()
  components.forEach((component, componentIndex) => {
    for (const sheetId of component) {
      componentIndexBySheetId.set(sheetId, componentIndex)
    }
  })

  const dependencyComponentIndexesByIndex = new Map<number, Set<number>>()
  const dependentComponentIndexesByIndex = new Map<number, Set<number>>()
  components.forEach((_, componentIndex) => {
    dependencyComponentIndexesByIndex.set(componentIndex, new Set<number>())
    dependentComponentIndexesByIndex.set(componentIndex, new Set<number>())
  })

  components.forEach((component, componentIndex) => {
    for (const sheetId of component) {
      for (const dependencySheetId of dependencySheetIdsBySheetId.get(sheetId) ?? []) {
        if (!affectedSheetIds.has(dependencySheetId)) {
          continue
        }
        const dependencyComponentIndex = componentIndexBySheetId.get(dependencySheetId)
        if (
          typeof dependencyComponentIndex !== "number"
          || dependencyComponentIndex === componentIndex
        ) {
          continue
        }
        dependencyComponentIndexesByIndex.get(componentIndex)?.add(dependencyComponentIndex)
        dependentComponentIndexesByIndex.get(dependencyComponentIndex)?.add(componentIndex)
      }
    }
  })

  const availableComponentIndexes = components
    .map((_, componentIndex) => componentIndex)
    .filter(componentIndex => (dependencyComponentIndexesByIndex.get(componentIndex)?.size ?? 0) === 0)
    .sort((left, right) => {
      const leftOrder = sheetOrderById.get(components[left]?.[0] ?? "") ?? 0
      const rightOrder = sheetOrderById.get(components[right]?.[0] ?? "") ?? 0
      return leftOrder - rightOrder
    })

  const scheduledComponents: (readonly string[])[] = []
  const enqueuedComponentIndexes = new Set<number>(availableComponentIndexes)

  while (availableComponentIndexes.length > 0) {
    const componentIndex = availableComponentIndexes.shift()
    if (typeof componentIndex !== "number") {
      break
    }
    scheduledComponents.push(components[componentIndex] ?? Object.freeze([]))
    for (const dependentComponentIndex of dependentComponentIndexesByIndex.get(componentIndex) ?? []) {
      const dependencyIndexes = dependencyComponentIndexesByIndex.get(dependentComponentIndex)
      dependencyIndexes?.delete(componentIndex)
      if ((dependencyIndexes?.size ?? 0) > 0 || enqueuedComponentIndexes.has(dependentComponentIndex)) {
        continue
      }
      availableComponentIndexes.push(dependentComponentIndex)
      availableComponentIndexes.sort((left, right) => {
        const leftOrder = sheetOrderById.get(components[left]?.[0] ?? "") ?? 0
        const rightOrder = sheetOrderById.get(components[right]?.[0] ?? "") ?? 0
        return leftOrder - rightOrder
      })
      enqueuedComponentIndexes.add(dependentComponentIndex)
    }
  }

  if (scheduledComponents.length === components.length) {
    return Object.freeze(scheduledComponents.map(component => Object.freeze([...component])))
  }

  return Object.freeze(components.map(component => Object.freeze([...component])))
}

export function createClientWorkbookModel(
  options: CreateClientWorkbookModelOptions = {},
): ClientWorkbookModel {
  let disposed = false
  const listeners = new Set<DataGridWorkbookListener>()
  const sheets: WorkbookSheetState[] = []
  const sheetsById = new Map<string, WorkbookSheetState>()
  let graphState: WorkbookGraphState | null = null
  let activeSheetId: string | null = null
  let syncInProgress = false
  let lastSync: DataGridWorkbookSyncSnapshot = {
    passCount: 0,
    converged: true,
    maxPasses: 0,
  }

  const ensureActive = (): void => {
    if (disposed) {
      throw new Error("ClientWorkbookModel has been disposed")
    }
  }

  const emit = (): void => {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = getSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const invalidateSheetExportCache = (sheet: WorkbookSheetState): void => {
    sheet.exportedSourceRevision = -1
    sheet.exportedTableRows = null
  }

  const reconcileSheetExportCache = (sheet: WorkbookSheetState): void => {
    if (sheet.exportedSourceRevision !== sheet.rowModel.getSourceRowsRevision()) {
      invalidateSheetExportCache(sheet)
    }
  }

  const getSheetExportRows = (sheet: WorkbookSheetState): WorkbookTableSource => {
    const sourceRevision = sheet.rowModel.getSourceRowsRevision()
    if (sheet.exportedSourceRevision === sourceRevision && sheet.exportedTableRows) {
      return sheet.exportedTableRows
    }
    const sourceRows = sheet.rowModel.getSourceRows()
    const exportedRows: WorkbookTableSource = {
      rows: sourceRows,
      resolveRow: resolveWorkbookTableSourceRowValue,
    }
    sheet.exportedSourceRevision = sourceRevision
    sheet.exportedTableRows = exportedRows
    return exportedRows
  }

  const invalidateWorkbookGraphState = (): void => {
    graphState = null
  }

  const createAliasToSheetMap = (): Map<string, WorkbookSheetState> => {
    const aliasToSheet = new Map<string, WorkbookSheetState>()
    for (const sheet of sheets) {
      for (const alias of sheet.aliases) {
        const existing = aliasToSheet.get(alias)
        if (existing && existing.id !== sheet.id) {
          throw new Error(
            `[clientWorkbookModel] Sheet alias '${alias}' collides between '${existing.name}' (${existing.id}) and '${sheet.name}' (${sheet.id}).`,
          )
        }
        aliasToSheet.set(alias, sheet)
      }
    }
    return aliasToSheet
  }

  const assertSheetAliasesAvailable = (
    sheetId: string,
    aliases: readonly string[],
  ): void => {
    for (const existingSheet of sheets) {
      if (existingSheet.id === sheetId) {
        continue
      }
      for (const alias of aliases) {
        if (!existingSheet.aliases.includes(alias)) {
          continue
        }
        throw new Error(
          `[clientWorkbookModel] Sheet alias '${alias}' collides between '${existingSheet.name}' (${existingSheet.id}) and '${sheetId}'.`,
        )
      }
    }
  }

  const refreshWorkbookSheetFormulaDependencies = (
    sheet: WorkbookSheetState,
  ): boolean => {
    const currentRevision = sheet.rowModel.getFormulaStructureRevision()
    if (currentRevision === sheet.formulaStructureRevision) {
      return false
    }
    const nextState = resolveWorkbookSheetFormulaDependencyState(sheet.rowModel)
    const changed = sheet.formulaUsesAllTables !== nextState.usesAllTables
      || !areWorkbookStringListsEqual(sheet.formulaTableDependencyAliases, nextState.tableDependencyAliases)
    sheet.formulaStructureRevision = nextState.revision
    sheet.formulaUsesAllTables = nextState.usesAllTables
    sheet.formulaTableDependencyAliases = nextState.tableDependencyAliases
    return changed
  }

  const buildDependencyGraph = (
    aliasToSheet: ReadonlyMap<string, WorkbookSheetState>,
  ): WorkbookDependencyGraph => {
    const dependencySheetIdsBySheetId = new Map<string, readonly string[]>()
    const dependentSheetIdsBySheetId = new Map<string, Set<string>>()

    for (const sheet of sheets) {
      dependentSheetIdsBySheetId.set(sheet.id, new Set<string>())
    }

    for (const targetSheet of sheets) {
      const dependencySheetIds = new Set<string>()

      if (targetSheet.formulaUsesAllTables) {
        for (const sourceSheet of sheets) {
          if (sourceSheet.id !== targetSheet.id) {
            dependencySheetIds.add(sourceSheet.id)
          }
        }
      } else {
        for (const alias of targetSheet.formulaTableDependencyAliases) {
          const sourceSheet = aliasToSheet.get(alias)
          if (!sourceSheet || sourceSheet.id === targetSheet.id) {
            continue
          }
          dependencySheetIds.add(sourceSheet.id)
        }
      }

      const orderedDependencySheetIds = Object.freeze(
        sheets
          .map(sheet => sheet.id)
          .filter(sheetId => dependencySheetIds.has(sheetId)),
      )
      dependencySheetIdsBySheetId.set(targetSheet.id, orderedDependencySheetIds)
      for (const dependencySheetId of orderedDependencySheetIds) {
        dependentSheetIdsBySheetId.get(dependencySheetId)?.add(targetSheet.id)
      }
    }

    return {
      dependencySheetIdsBySheetId,
      dependentSheetIdsBySheetId: new Map(
        sheets.map(sheet => [
          sheet.id,
          Object.freeze(
            sheets
              .map(candidate => candidate.id)
              .filter(sheetId => dependentSheetIdsBySheetId.get(sheet.id)?.has(sheetId) ?? false),
          ),
        ]),
      ),
    }
  }

  const createWorkbookGraphState = (): WorkbookGraphState => {
    const aliasToSheet = createAliasToSheetMap()
    return {
      aliasToSheet,
      graph: buildDependencyGraph(aliasToSheet),
      sheetOrderById: new Map<string, number>(sheets.map((sheet, index) => [sheet.id, index])),
    }
  }

  const resolveWorkbookGraphState = (
    syncOptions: WorkbookSyncOptions,
  ): WorkbookGraphState => {
    if (syncOptions.structural !== true && syncOptions.dirtySheetIds) {
      let graphChanged = false
      for (const dirtySheetId of syncOptions.dirtySheetIds) {
        const sheet = sheetsById.get(dirtySheetId)
        if (!sheet) {
          continue
        }
        if (refreshWorkbookSheetFormulaDependencies(sheet)) {
          graphChanged = true
        }
      }
      if (graphChanged) {
        invalidateWorkbookGraphState()
      }
    }

    if (!graphState) {
      graphState = createWorkbookGraphState()
    }

    return graphState
  }

  const resolveAffectedSheetIds = (
    graph: WorkbookDependencyGraph,
    syncOptions: WorkbookSyncOptions,
  ): readonly string[] => {
    if (syncOptions.structural === true || !syncOptions.dirtySheetIds || syncOptions.dirtySheetIds.size === 0) {
      return Object.freeze(sheets.map(sheet => sheet.id))
    }

    const affectedSheetIds = new Set<string>()
    const queue: string[] = []
    for (const dirtySheetId of syncOptions.dirtySheetIds) {
      if (!sheetsById.has(dirtySheetId) || affectedSheetIds.has(dirtySheetId)) {
        continue
      }
      affectedSheetIds.add(dirtySheetId)
      queue.push(dirtySheetId)
    }

    while (queue.length > 0) {
      const producerSheetId = queue.shift()
      if (typeof producerSheetId !== "string") {
        break
      }
      for (const dependentSheetId of graph.dependentSheetIdsBySheetId.get(producerSheetId) ?? []) {
        if (affectedSheetIds.has(dependentSheetId)) {
          continue
        }
        affectedSheetIds.add(dependentSheetId)
        queue.push(dependentSheetId)
      }
    }

    return Object.freeze(
      sheets
        .map(sheet => sheet.id)
        .filter(sheetId => affectedSheetIds.has(sheetId)),
    )
  }

  const applyManagedTablePatch = (
    targetSheet: WorkbookSheetState,
    dependencySheetIds: readonly string[],
  ): boolean => {
    const desiredTableRowsByAlias = new Map<string, WorkbookTableSource>()
    for (const dependencySheetId of dependencySheetIds) {
      const sourceSheet = sheetsById.get(dependencySheetId)
      if (!sourceSheet || sourceSheet.id === targetSheet.id) {
        continue
      }
      const exportedRows = getSheetExportRows(sourceSheet)
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

    const setEntries: { name: string; rows: WorkbookTableSource }[] = []
    for (const [alias, exportedRows] of desiredTableRowsByAlias.entries()) {
      if (
        targetSheet.managedTableAliases.has(alias)
        && targetSheet.appliedTableRowsByAlias.get(alias) === exportedRows
      ) {
        continue
      }
      setEntries.push({ name: alias, rows: exportedRows })
    }

    if (removedAliases.length === 0 && setEntries.length === 0) {
      return false
    }

    const previousSourceRevision = targetSheet.rowModel.getSourceRowsRevision()
    targetSheet.rowModel.patchFormulaTables({
      remove: removedAliases,
      set: setEntries,
    })

    for (const alias of removedAliases) {
      targetSheet.managedTableAliases.delete(alias)
      targetSheet.appliedTableRowsByAlias.delete(alias)
    }
    for (const entry of setEntries) {
      targetSheet.managedTableAliases.add(entry.name)
      targetSheet.appliedTableRowsByAlias.set(entry.name, entry.rows)
    }

    if (targetSheet.rowModel.getSourceRowsRevision() !== previousSourceRevision) {
      invalidateSheetExportCache(targetSheet)
    }
    return true
  }

  const syncSheetComponent = (
    componentSheetIds: readonly string[],
    graph: WorkbookDependencyGraph,
    maxPasses: number,
  ): WorkbookComponentSyncResult => {
    if (componentSheetIds.length === 0) {
      return { passCount: 0, converged: true }
    }

    if (componentSheetIds.length === 1) {
      const sheetId = componentSheetIds[0]
      const targetSheet = typeof sheetId === "string" ? sheetsById.get(sheetId) : null
      if (!targetSheet) {
        return { passCount: 0, converged: true }
      }
      applyManagedTablePatch(
        targetSheet,
        graph.dependencySheetIdsBySheetId.get(targetSheet.id) ?? Object.freeze([]),
      )
      return { passCount: 1, converged: true }
    }

    for (let passIndex = 0; passIndex < maxPasses; passIndex += 1) {
      let changed = false
      for (const sheetId of componentSheetIds) {
        const targetSheet = sheetsById.get(sheetId)
        if (!targetSheet) {
          continue
        }
        if (
          applyManagedTablePatch(
            targetSheet,
            graph.dependencySheetIdsBySheetId.get(targetSheet.id) ?? Object.freeze([]),
          )
        ) {
          changed = true
        }
      }
      if (!changed) {
        return {
          passCount: passIndex + 1,
          converged: true,
        }
      }
    }

    return {
      passCount: maxPasses,
      converged: false,
    }
  }

  const applyWorkbookSync = (syncOptions: WorkbookSyncOptions = {}): void => {
    if (sheets.length === 0) {
      lastSync = {
        passCount: 0,
        converged: true,
        maxPasses: 0,
      }
      return
    }

    const maxPasses = resolveWorkbookSyncMaxPasses(options.formulaTableSyncMaxPasses, sheets.length)
    const resolvedGraphState = resolveWorkbookGraphState(syncOptions)
    const affectedSheetIds = resolveAffectedSheetIds(resolvedGraphState.graph, syncOptions)
    if (affectedSheetIds.length === 0) {
      lastSync = {
        passCount: 0,
        converged: true,
        maxPasses,
      }
      return
    }

    const scheduledComponents = createWorkbookComponentSchedule(
      affectedSheetIds,
      resolvedGraphState.graph.dependencySheetIdsBySheetId,
      resolvedGraphState.sheetOrderById,
    )

    let passCount = 0
    let converged = true

    for (const componentSheetIds of scheduledComponents) {
      const componentResult = syncSheetComponent(componentSheetIds, resolvedGraphState.graph, maxPasses)
      passCount += componentResult.passCount
      if (!componentResult.converged) {
        converged = false
      }
    }

    lastSync = {
      passCount,
      converged,
      maxPasses,
    }
  }

  const runSync = (syncOptions: WorkbookSyncOptions = {}): void => {
    ensureActive()
    if (syncInProgress) {
      return
    }
    syncInProgress = true
    try {
      applyWorkbookSync(syncOptions)
    } finally {
      syncInProgress = false
    }
    emit()
  }

  const subscribeToSheet = (sheet: WorkbookSheetState): void => {
    sheet.unsubscribe = sheet.rowModel.subscribe(() => {
      reconcileSheetExportCache(sheet)
      if (disposed || syncInProgress) {
        return
      }
      runSync({
        dirtySheetIds: new Set<string>([sheet.id]),
      })
    })
  }

  const createSheetState = (
    input: DataGridWorkbookSheetInput,
  ): WorkbookSheetState => {
    const existingIds = new Set<string>(sheets.map(sheet => sheet.id))
    const name = normalizeWorkbookSheetName(input.name)
    const id = typeof input.id === "string" && input.id.trim().length > 0
      ? normalizeWorkbookSheetId(input.id)
      : createWorkbookSheetId(name, existingIds)
    if (existingIds.has(id)) {
      throw new Error(`[clientWorkbookModel] Sheet id '${id}' already exists.`)
    }
    const aliases = buildWorkbookSheetAliases(id, name)
    assertSheetAliasesAvailable(id, aliases)

    const rowModel = input.rowModel
      ?? createClientRowModel<unknown>({
        ...(input.rowModelOptions ?? {}),
        rows: input.rows ?? input.rowModelOptions?.rows ?? [],
      })
    const formulaDependencyState = resolveWorkbookSheetFormulaDependencyState(rowModel)

    return {
      id,
      name,
      aliases,
      rowModel,
      owned: input.rowModel ? input.ownRowModel === true : true,
      unsubscribe: null,
      exportedSourceRevision: -1,
      exportedTableRows: null,
      formulaStructureRevision: formulaDependencyState.revision,
      formulaUsesAllTables: formulaDependencyState.usesAllTables,
      formulaTableDependencyAliases: formulaDependencyState.tableDependencyAliases,
      managedTableAliases: new Set<string>(),
      appliedTableRowsByAlias: new Map<string, WorkbookTableSource>(),
    }
  }

  function getSnapshot(): DataGridWorkbookSnapshot {
    ensureActive()
    return {
      activeSheetId,
      sheets: Object.freeze(sheets.map(createWorkbookSheetSnapshot)),
      sync: { ...lastSync },
    }
  }

  const attachSheet = (sheet: WorkbookSheetState): void => {
    sheets.push(sheet)
    sheetsById.set(sheet.id, sheet)
    invalidateWorkbookGraphState()
    subscribeToSheet(sheet)
    if (!activeSheetId) {
      activeSheetId = sheet.id
    }
  }

  if (options.sheets) {
    for (const sheetInput of options.sheets) {
      const sheet = createSheetState(sheetInput)
      attachSheet(sheet)
    }
  }

  const normalizedActiveSheetId = typeof options.activeSheetId === "string" && options.activeSheetId.trim().length > 0
    ? normalizeWorkbookSheetId(options.activeSheetId)
    : null

  if (normalizedActiveSheetId && sheetsById.has(normalizedActiveSheetId)) {
    activeSheetId = normalizedActiveSheetId
  } else if (!activeSheetId && sheets.length > 0) {
    activeSheetId = sheets[0]?.id ?? null
  }

  if (sheets.length > 0) {
    runSync({ structural: true })
  }

  return {
    getSnapshot,
    getSheets() {
      ensureActive()
      return Object.freeze(sheets.map(createWorkbookSheetHandle))
    },
    getSheet(sheetId: string) {
      ensureActive()
      const sheet = sheetsById.get(sheetId)
      return sheet ? createWorkbookSheetHandle(sheet) : null
    },
    getActiveSheetId() {
      ensureActive()
      return activeSheetId
    },
    getActiveSheet() {
      ensureActive()
      if (!activeSheetId) {
        return null
      }
      const sheet = sheetsById.get(activeSheetId)
      return sheet ? createWorkbookSheetHandle(sheet) : null
    },
    setActiveSheet(sheetId: string) {
      ensureActive()
      if (!sheetsById.has(sheetId) || activeSheetId === sheetId) {
        return false
      }
      activeSheetId = sheetId
      emit()
      return true
    },
    addSheet(input: DataGridWorkbookSheetInput) {
      ensureActive()
      const sheet = createSheetState(input)
      attachSheet(sheet)
      runSync({ structural: true })
      return createWorkbookSheetHandle(sheet)
    },
    removeSheet(sheetId: string) {
      ensureActive()
      const sheet = sheetsById.get(sheetId)
      if (!sheet) {
        return false
      }
      sheet.unsubscribe?.()
      sheet.unsubscribe = null
      sheetsById.delete(sheetId)
      const index = sheets.findIndex(entry => entry.id === sheetId)
      if (index >= 0) {
        sheets.splice(index, 1)
      }
      if (activeSheetId === sheetId) {
        activeSheetId = sheets[0]?.id ?? null
      }
      if (sheet.owned) {
        sheet.rowModel.dispose()
      }
      invalidateWorkbookGraphState()
      runSync({ structural: true })
      return true
    },
    renameSheet(sheetId: string, name: string) {
      ensureActive()
      const sheet = sheetsById.get(sheetId)
      if (!sheet) {
        return false
      }
      const nextName = normalizeWorkbookSheetName(name)
      if (sheet.name === nextName) {
        return false
      }
      const previousName = sheet.name
      const previousAliases = sheet.aliases
      const nextAliases = buildWorkbookSheetAliases(sheet.id, nextName)
      assertSheetAliasesAvailable(sheet.id, nextAliases)
      sheet.name = nextName
      sheet.aliases = nextAliases
      try {
        createAliasToSheetMap()
      } catch (error) {
        sheet.name = previousName
        sheet.aliases = previousAliases
        throw error
      }
      invalidateWorkbookGraphState()
      runSync({ structural: true })
      return true
    },
    sync() {
      runSync({ structural: true })
    },
    subscribe(listener: DataGridWorkbookListener) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      listeners.clear()
      for (const sheet of sheets) {
        sheet.unsubscribe?.()
        sheet.unsubscribe = null
        if (sheet.owned) {
          sheet.rowModel.dispose()
        }
      }
      sheets.length = 0
      sheetsById.clear()
      activeSheetId = null
      lastSync = {
        passCount: 0,
        converged: true,
        maxPasses: 0,
      }
    },
  }
}
