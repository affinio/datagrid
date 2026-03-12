import type {
  DataGridFormulaTableRowsSource,
  DataGridFormulaTableSource,
} from "../models/formula/formulaContracts.js"
import type { DataGridRowId } from "../models/rowModel.js"
import {
  createDataGridSpreadsheetSheetModel,
  type CreateDataGridSpreadsheetSheetModelOptions,
  type DataGridSpreadsheetFormulaStructuralPatch,
  type DataGridSpreadsheetSheetModel,
  type DataGridSpreadsheetSheetRowMutation,
  type DataGridSpreadsheetSheetState,
} from "./sheetModel.js"
import {
  createDataGridSpreadsheetDerivedSheetModel,
  type CreateDataGridSpreadsheetDerivedSheetModelOptions,
  type DataGridSpreadsheetDerivedSheetModel,
} from "./derivedSheetModel.js"
import {
  createDataGridSpreadsheetCellFormulaModel,
  createDataGridSpreadsheetCellFormulaRuntimeModel,
  mapDataGridSpreadsheetCellFormulaRuntimeModelBindings,
} from "./formulaEditorModel.js"
import {
  materializeDataGridSpreadsheetViewRuntimeResult,
  materializeDataGridSpreadsheetViewSheetResult,
  type DataGridSpreadsheetViewMaterializationDiagnostic,
  type DataGridSpreadsheetWorkbookSheetKind,
  type DataGridSpreadsheetWorkbookViewDefinition,
  type DataGridSpreadsheetWorkbookViewSheetModelOptions,
  type DataGridSpreadsheetViewStep,
} from "./viewPipeline.js"
import {
  createDataGridSpreadsheetDerivedSheetRuntime,
  type DataGridSpreadsheetDerivedSheetRuntime,
} from "./derivedSheetRuntime.js"
import {
  createSpreadsheetWorkbookRestoreDescriptor,
  hydrateSpreadsheetWorkbookDataSheetModel,
  createSpreadsheetWorkbookSheetStateExport,
  normalizeSpreadsheetWorkbookViewSheetModelOptions,
  resolveSpreadsheetWorkbookViewSheetModelOptionsFromState,
  type SpreadsheetWorkbookSheetStateExportPayload,
} from "./workbookPersistence.js"

export interface DataGridSpreadsheetWorkbookDataSheetInput {
  id?: string
  name: string
  kind?: "data"
  sheetModel?: DataGridSpreadsheetSheetModel
  sheetModelOptions?: Omit<CreateDataGridSpreadsheetSheetModelOptions, "sheetId" | "sheetName">
  ownSheetModel?: boolean
}

export interface DataGridSpreadsheetWorkbookViewSheetInput {
  id?: string
  name: string
  kind: "view"
  sourceSheetId: string
  pipeline: readonly DataGridSpreadsheetViewStep[]
  sheetModel?: DataGridSpreadsheetSheetModel
  sheetModelOptions?: DataGridSpreadsheetWorkbookViewSheetModelOptions
  ownSheetModel?: boolean
}

export type DataGridSpreadsheetWorkbookSheetInput =
  | DataGridSpreadsheetWorkbookDataSheetInput
  | DataGridSpreadsheetWorkbookViewSheetInput

export interface CreateDataGridSpreadsheetWorkbookModelOptions {
  sheets?: readonly DataGridSpreadsheetWorkbookSheetInput[]
  activeSheetId?: string | null
  formulaTableSyncMaxPasses?: number | null
}

export interface DataGridSpreadsheetWorkbookSheetHandle {
  id: string
  name: string
  aliases: readonly string[]
  kind: DataGridSpreadsheetWorkbookSheetKind
  readOnly: boolean
  viewDefinition: DataGridSpreadsheetWorkbookViewDefinition | null
  sheetModel: DataGridSpreadsheetSheetModel
}

export interface DataGridSpreadsheetWorkbookSheetSnapshot extends DataGridSpreadsheetWorkbookSheetHandle {
  revision: number
  rowCount: number
  columnCount: number
  formulaCellCount: number
  errorCellCount: number
}

export interface DataGridSpreadsheetWorkbookSyncSnapshot {
  passCount: number
  converged: boolean
  maxPasses: number
}

export type DataGridSpreadsheetWorkbookDiagnosticSeverity = "warning" | "error"

export type DataGridSpreadsheetWorkbookDiagnosticCode =
  | "derived-direct-reference-unstable"
  | "derived-view-cycle"
  | "derived-view-source-missing"
  | "derived-view-join-sheet-missing"
  | "derived-view-join-ambiguous-match"
  | "derived-view-materialization-failed"

export interface DataGridSpreadsheetWorkbookDiagnostic {
  code: DataGridSpreadsheetWorkbookDiagnosticCode
  severity: DataGridSpreadsheetWorkbookDiagnosticSeverity
  sheetId: string
  rowId: DataGridRowId | null
  columnKey: string | null
  relatedSheetId: string | null
  message: string
}

export interface DataGridSpreadsheetWorkbookSnapshot {
  activeSheetId: string | null
  sheets: readonly DataGridSpreadsheetWorkbookSheetSnapshot[]
  sync: DataGridSpreadsheetWorkbookSyncSnapshot
  diagnostics: readonly DataGridSpreadsheetWorkbookDiagnostic[]
}

export interface DataGridSpreadsheetWorkbookSheetStateExport {
  id: string
  name: string
  kind: DataGridSpreadsheetWorkbookSheetKind
  viewDefinition: DataGridSpreadsheetWorkbookViewDefinition | null
  sheetState: DataGridSpreadsheetSheetState
}

export interface DataGridSpreadsheetWorkbookState {
  activeSheetId: string | null
  sheets: readonly DataGridSpreadsheetWorkbookSheetStateExport[]
}

export type DataGridSpreadsheetWorkbookListener = (
  snapshot: DataGridSpreadsheetWorkbookSnapshot,
) => void

export interface DataGridSpreadsheetWorkbookModel {
  getSnapshot(): DataGridSpreadsheetWorkbookSnapshot
  exportState(): DataGridSpreadsheetWorkbookState
  restoreState(state: DataGridSpreadsheetWorkbookState): boolean
  getSheets(): readonly DataGridSpreadsheetWorkbookSheetHandle[]
  getSheet(sheetId: string): DataGridSpreadsheetWorkbookSheetHandle | null
  getActiveSheetId(): string | null
  getActiveSheet(): DataGridSpreadsheetWorkbookSheetHandle | null
  setActiveSheet(sheetId: string): boolean
  addSheet(input: DataGridSpreadsheetWorkbookSheetInput): DataGridSpreadsheetWorkbookSheetHandle
  removeSheet(sheetId: string): boolean
  renameSheet(sheetId: string, name: string): boolean
  sync(): void
  subscribe(listener: DataGridSpreadsheetWorkbookListener): () => void
  dispose(): void
}

type SpreadsheetWorkbookTableSource = DataGridFormulaTableSource

interface SpreadsheetWorkbookSheetState {
  id: string
  name: string
  aliases: readonly string[]
  kind: DataGridSpreadsheetWorkbookSheetKind
  viewDefinition: DataGridSpreadsheetWorkbookViewDefinition | null
  viewSheetModelOptions: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  sheetModel: DataGridSpreadsheetSheetModel
  owned: boolean
  unsubscribe: (() => void) | null
  exportedTableRevision: number
  exportedTableSource: SpreadsheetWorkbookTableSource | null
  formulaStructureRevision: number
  formulaUsesAllTables: boolean
  formulaTableDependencyAliases: readonly string[]
  formulaReferenceDependencyAliases: readonly string[]
  managedTableAliases: Set<string>
  appliedTableRowsByAlias: Map<string, SpreadsheetWorkbookTableSource>
  lastHandledRowMutationRevision: number
  viewDiagnostics: readonly DataGridSpreadsheetViewMaterializationDiagnostic[]
  derivedRuntime: DataGridSpreadsheetDerivedSheetRuntime | null
  derivedSheetModel: DataGridSpreadsheetDerivedSheetModel | null
}

interface SpreadsheetWorkbookDependencyGraph {
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>
  dependentSheetIdsBySheetId: ReadonlyMap<string, readonly string[]>
}

interface SpreadsheetWorkbookGraphState {
  aliasToSheet: ReadonlyMap<string, SpreadsheetWorkbookSheetState>
  graph: SpreadsheetWorkbookDependencyGraph
  sheetOrderById: ReadonlyMap<string, number>
}

interface SpreadsheetWorkbookSyncOptions {
  dirtySheetIds?: ReadonlySet<string>
  structural?: boolean
}

interface SpreadsheetWorkbookSheetFormulaDependencyState {
  revision: number
  usesAllTables: boolean
  tableDependencyAliases: readonly string[]
  referenceDependencyAliases: readonly string[]
}

interface SpreadsheetWorkbookComponentSyncResult {
  passCount: number
  converged: boolean
}

function isSpreadsheetWorkbookTableRowsSource(
  source: DataGridFormulaTableSource,
): source is DataGridFormulaTableRowsSource {
  return !Array.isArray(source) && typeof source === "object" && source !== null && "rows" in source
}

function normalizeSpreadsheetWorkbookSheetName(value: unknown): string {
  const normalized = String(value ?? "").trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridSpreadsheetWorkbook] sheet name must be non-empty.")
  }
  return normalized
}

function normalizeSpreadsheetWorkbookSheetId(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  if (normalized.length === 0) {
    throw new Error("[DataGridSpreadsheetWorkbook] sheet id must contain at least one alphanumeric character.")
  }
  return normalized
}

function normalizeSpreadsheetWorkbookAlias(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

function buildSpreadsheetWorkbookSheetAliases(id: string, name: string): readonly string[] {
  const aliases = new Set<string>()
  const idAlias = normalizeSpreadsheetWorkbookAlias(id)
  const nameAlias = normalizeSpreadsheetWorkbookAlias(name)
  if (idAlias.length > 0) {
    aliases.add(idAlias)
  }
  if (nameAlias.length > 0) {
    aliases.add(nameAlias)
  }
  return Object.freeze([...aliases])
}

function createSpreadsheetWorkbookSheetId(
  name: string,
  existingIds: ReadonlySet<string>,
): string {
  const baseId = normalizeSpreadsheetWorkbookSheetId(name)
  if (!existingIds.has(baseId)) {
    return baseId
  }
  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  return `${baseId}-${suffix}`
}

function resolveSpreadsheetWorkbookSyncMaxPasses(
  input: number | null | undefined,
  sheetCount: number,
): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    const normalized = Math.trunc(input)
    if (normalized < 1) {
      throw new Error("[DataGridSpreadsheetWorkbook] formulaTableSyncMaxPasses must be >= 1 when provided.")
    }
    return normalized
  }
  return Math.max(4, sheetCount * 2)
}

function cloneSpreadsheetWorkbookViewStep(
  step: DataGridSpreadsheetViewStep,
): DataGridSpreadsheetViewStep {
  switch (step.type) {
    case "filter":
      return Object.freeze({
        type: "filter",
        mode: step.mode,
        clauses: Object.freeze(step.clauses.map(clause => Object.freeze({ ...clause }))),
      })
    case "sort":
      return Object.freeze({
        type: "sort",
        fields: Object.freeze(step.fields.map(field => (
          typeof field === "string" ? field : Object.freeze({ ...field })
        ))),
      })
    case "project":
      return Object.freeze({
        type: "project",
        columns: Object.freeze(step.columns.map(column => (
          typeof column === "string" ? column : Object.freeze({ ...column })
        ))),
      })
    case "join":
      return Object.freeze({
        type: "join",
        sheetId: normalizeSpreadsheetWorkbookSheetId(step.sheetId),
        mode: step.mode === "inner" ? "inner" : "left",
        on: Object.freeze({
          leftKey: String(step.on.leftKey ?? ""),
          rightKey: String(step.on.rightKey ?? ""),
        }),
        select: Object.freeze(step.select.map(column => (
          typeof column === "string" ? column : Object.freeze({ ...column })
        ))),
        ...(step.multiMatch === "explode" ? { multiMatch: "explode" } : {}),
        ...(step.multiMatch === "error" ? { multiMatch: "error" } : {}),
      })
    case "group":
      return Object.freeze({
        type: "group",
        by: Object.freeze(step.by.map(field => (
          typeof field === "string" ? field : Object.freeze({ ...field })
        ))),
        aggregations: Object.freeze(step.aggregations.map(aggregation => Object.freeze({ ...aggregation }))),
      })
    case "pivot":
      return {
        type: "pivot",
        spec: {
          rows: [...step.spec.rows],
          columns: [...step.spec.columns],
          values: step.spec.values.map(value => ({ ...value })),
          ...(step.spec.rowSubtotals ? { rowSubtotals: true } : {}),
          ...(step.spec.columnSubtotals ? { columnSubtotals: true } : {}),
          ...(step.spec.columnGrandTotal ? { columnGrandTotal: true } : {}),
          ...(step.spec.columnSubtotalPosition
            ? { columnSubtotalPosition: step.spec.columnSubtotalPosition }
            : {}),
          ...(step.spec.columnGrandTotalPosition
            ? { columnGrandTotalPosition: step.spec.columnGrandTotalPosition }
            : {}),
          ...(step.spec.grandTotal ? { grandTotal: true } : {}),
        },
      }
    default:
      return step
  }
}

function collectSpreadsheetWorkbookViewDependencySheetIds(
  viewDefinition: DataGridSpreadsheetWorkbookViewDefinition,
): readonly string[] {
  const dependencySheetIds = new Set<string>([viewDefinition.sourceSheetId])
  for (const step of viewDefinition.pipeline) {
    if (step.type !== "join") {
      continue
    }
    dependencySheetIds.add(normalizeSpreadsheetWorkbookSheetId(step.sheetId))
  }
  return Object.freeze(
    sheetsOrderStableDependencyIds([...dependencySheetIds]),
  )
}

function sheetsOrderStableDependencyIds(
  sheetIds: readonly string[],
): readonly string[] {
  return Object.freeze(
    [...new Set(sheetIds)].sort((left, right) => left.localeCompare(right)),
  )
}

function normalizeSpreadsheetWorkbookViewDefinition(
  input: Pick<DataGridSpreadsheetWorkbookViewSheetInput, "sourceSheetId" | "pipeline">,
): DataGridSpreadsheetWorkbookViewDefinition {
  return Object.freeze({
    sourceSheetId: normalizeSpreadsheetWorkbookSheetId(input.sourceSheetId),
    pipeline: Object.freeze((input.pipeline ?? []).map(cloneSpreadsheetWorkbookViewStep)),
  })
}

function areSpreadsheetWorkbookStringListsEqual(
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

function resolveSpreadsheetWorkbookSheetFormulaDependencyState(
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

function createSpreadsheetWorkbookSheetHandle(
  sheet: SpreadsheetWorkbookSheetState,
): DataGridSpreadsheetWorkbookSheetHandle {
  return {
    id: sheet.id,
    name: sheet.name,
    aliases: sheet.aliases,
    kind: sheet.kind,
    readOnly: sheet.kind === "view",
    viewDefinition: sheet.viewDefinition,
    sheetModel: sheet.sheetModel,
  }
}

function createSpreadsheetWorkbookSheetSnapshot(
  sheet: SpreadsheetWorkbookSheetState,
): DataGridSpreadsheetWorkbookSheetSnapshot {
  const snapshot = sheet.sheetModel.getSnapshot()
  return {
    ...createSpreadsheetWorkbookSheetHandle(sheet),
    revision: snapshot.revision,
    rowCount: snapshot.rowCount,
    columnCount: snapshot.columnCount,
    formulaCellCount: snapshot.formulaCellCount,
    errorCellCount: snapshot.errorCellCount,
  }
}

function collectSpreadsheetWorkbookDerivedInstabilityReasons(
  viewDefinition: DataGridSpreadsheetWorkbookViewDefinition | null,
): readonly string[] {
  if (!viewDefinition) {
    return Object.freeze([])
  }
  const reasons = new Set<string>()
  for (const step of viewDefinition.pipeline) {
    if (step.type === "pivot") {
      reasons.add("pivot materialization")
    }
    if (step.type === "join") {
      reasons.add("join enrichment")
    }
  }
  return Object.freeze([...reasons])
}

function collectSpreadsheetWorkbookDiagnostics(
  sheets: readonly SpreadsheetWorkbookSheetState[],
  aliasToSheet: ReadonlyMap<string, SpreadsheetWorkbookSheetState>,
): readonly DataGridSpreadsheetWorkbookDiagnostic[] {
  const diagnostics: DataGridSpreadsheetWorkbookDiagnostic[] = []
  const seenKeys = new Set<string>()

  const materializationCodeMap = new Map<string, DataGridSpreadsheetWorkbookDiagnosticCode>([
    ["cycle", "derived-view-cycle"],
    ["source-missing", "derived-view-source-missing"],
    ["join-sheet-missing", "derived-view-join-sheet-missing"],
    ["join-ambiguous-match", "derived-view-join-ambiguous-match"],
    ["materialization-failed", "derived-view-materialization-failed"],
  ])

  for (const sheet of sheets) {
    for (const diagnostic of sheet.viewDiagnostics) {
      const workbookCode = materializationCodeMap.get(diagnostic.code) ?? "derived-view-materialization-failed"
      const diagnosticKey = [
        sheet.id,
        workbookCode,
        diagnostic.relatedSheetId ?? "",
        diagnostic.message,
      ].join("|")
      if (seenKeys.has(diagnosticKey)) {
        continue
      }
      seenKeys.add(diagnosticKey)
      diagnostics.push({
        code: workbookCode,
        severity: "error",
        sheetId: sheet.id,
        rowId: null,
        columnKey: null,
        relatedSheetId: diagnostic.relatedSheetId ?? null,
        message: diagnostic.message,
      })
    }
  }

  for (const sheet of sheets) {
    for (const formulaCell of sheet.sheetModel.getFormulaCells()) {
      const cellSnapshot = sheet.sheetModel.getCell(formulaCell.address)
      for (const reference of cellSnapshot?.analysis.references ?? []) {
        const normalizedAlias = normalizeSpreadsheetWorkbookAlias(reference.sheetReference)
        if (normalizedAlias.length === 0) {
          continue
        }
        const relatedSheet = aliasToSheet.get(normalizedAlias)
        if (!relatedSheet || relatedSheet.id === sheet.id) {
          continue
        }
        const instabilityReasons = collectSpreadsheetWorkbookDerivedInstabilityReasons(
          relatedSheet.viewDefinition,
        )
        if (instabilityReasons.length === 0) {
          continue
        }
        const diagnosticKey = [
          sheet.id,
          formulaCell.address.rowId,
          formulaCell.address.columnKey,
          relatedSheet.id,
          "derived-direct-reference-unstable",
        ].join("|")
        if (seenKeys.has(diagnosticKey)) {
          continue
        }
        seenKeys.add(diagnosticKey)
        diagnostics.push({
          code: "derived-direct-reference-unstable",
          severity: "warning",
          sheetId: sheet.id,
          rowId: formulaCell.address.rowId ?? null,
          columnKey: formulaCell.address.columnKey ?? null,
          relatedSheetId: relatedSheet.id,
          message: `Direct reference to derived sheet '${relatedSheet.name}' is address-based and may shift after ${instabilityReasons.join(" + ")}. Prefer TABLE('${relatedSheet.id}', ...) for scans over the full derived result.`,
        })
      }
    }
  }

  diagnostics.sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "error" ? -1 : 1
    }
    if (left.sheetId !== right.sheetId) {
      return left.sheetId.localeCompare(right.sheetId)
    }
    if (left.rowId !== right.rowId) {
      return String(left.rowId).localeCompare(String(right.rowId))
    }
    if (left.columnKey !== right.columnKey) {
      return (left.columnKey ?? "").localeCompare(right.columnKey ?? "")
    }
    return (left.relatedSheetId ?? "").localeCompare(right.relatedSheetId ?? "")
  })
  return Object.freeze(diagnostics)
}

function computeSpreadsheetWorkbookStronglyConnectedComponents(
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

function createSpreadsheetWorkbookComponentSchedule(
  sheetIds: readonly string[],
  dependencySheetIdsBySheetId: ReadonlyMap<string, readonly string[]>,
  sheetOrderById: ReadonlyMap<string, number>,
): readonly (readonly string[])[] {
  const components = computeSpreadsheetWorkbookStronglyConnectedComponents(
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

export function createDataGridSpreadsheetWorkbookModel(
  options: CreateDataGridSpreadsheetWorkbookModelOptions = {},
): DataGridSpreadsheetWorkbookModel {
  let disposed = false
  let syncInProgress = false
  let referenceRewriteInProgress = false
  let activeSheetId: string | null = null
  let graphState: SpreadsheetWorkbookGraphState | null = null
  let lastSync: DataGridSpreadsheetWorkbookSyncSnapshot = {
    passCount: 0,
    converged: true,
    maxPasses: 0,
  }

  const listeners = new Set<DataGridSpreadsheetWorkbookListener>()
  const sheets: SpreadsheetWorkbookSheetState[] = []
  const sheetsById = new Map<string, SpreadsheetWorkbookSheetState>()

  const ensureActive = (): void => {
    if (disposed) {
      throw new Error("DataGridSpreadsheetWorkbookModel has been disposed")
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

  const invalidateSheetExportCache = (sheet: SpreadsheetWorkbookSheetState): void => {
    sheet.exportedTableRevision = -1
    sheet.exportedTableSource = null
  }

  const reconcileSheetExportCache = (sheet: SpreadsheetWorkbookSheetState): void => {
    if (sheet.exportedTableRevision !== sheet.sheetModel.getTableSourceRevision()) {
      invalidateSheetExportCache(sheet)
    }
  }

  const wrapSheetTableSource = (
    source: DataGridFormulaTableSource,
  ): SpreadsheetWorkbookTableSource => {
    if (Array.isArray(source)) {
      return {
        rows: source,
      }
    }
    if (!isSpreadsheetWorkbookTableRowsSource(source)) {
      return {
        rows: [],
      }
    }
    return {
      rows: source.rows,
      resolveRow: typeof source.resolveRow === "function"
        ? source.resolveRow
        : undefined,
    }
  }

  const getSheetExportTableSource = (
    sheet: SpreadsheetWorkbookSheetState,
  ): SpreadsheetWorkbookTableSource => {
    const tableSourceRevision = sheet.kind === "view"
      ? (sheet.derivedRuntime?.revision ?? sheet.sheetModel.getTableSourceRevision())
      : sheet.sheetModel.getTableSourceRevision()
    if (sheet.exportedTableRevision === tableSourceRevision && sheet.exportedTableSource) {
      return sheet.exportedTableSource
    }
    const exportedTableSource = sheet.kind === "view" && sheet.derivedRuntime
      ? {
        rows: sheet.derivedRuntime.rows,
        resolveRow: (row: unknown) => {
          const runtimeRow = row as DataGridSpreadsheetDerivedSheetRuntime["rows"][number]
          const values: Record<string, unknown> = {}
          for (let columnIndex = 0; columnIndex < sheet.derivedRuntime!.columns.length; columnIndex += 1) {
            const column = sheet.derivedRuntime!.columns[columnIndex]
            if (!column) {
              continue
            }
            values[column.key] = runtimeRow.values[columnIndex]
          }
          return values
        },
      }
      : wrapSheetTableSource(sheet.sheetModel.getTableSource())
    sheet.exportedTableRevision = tableSourceRevision
    sheet.exportedTableSource = exportedTableSource
    return exportedTableSource
  }

  const createDerivedSheetModelOptions = (
    sheetId: string,
    sheetName: string,
    sheetModelOptions: DataGridSpreadsheetWorkbookViewSheetModelOptions | null,
  ): CreateDataGridSpreadsheetDerivedSheetModelOptions => ({
    sheetId,
    sheetName,
    sheetStyle: sheetModelOptions?.sheetStyle ?? null,
    referenceParserOptions: sheetModelOptions?.referenceParserOptions,
    runtimeErrorPolicy: sheetModelOptions?.runtimeErrorPolicy ?? "error-value",
    functionRegistry: sheetModelOptions?.functionRegistry,
    resolveContextValue: sheetModelOptions?.resolveContextValue,
  })

  const invalidateWorkbookGraphState = (): void => {
    graphState = null
  }

  const createAliasToSheetMap = (): Map<string, SpreadsheetWorkbookSheetState> => {
    const aliasToSheet = new Map<string, SpreadsheetWorkbookSheetState>()
    for (const sheet of sheets) {
      for (const alias of sheet.aliases) {
        const existing = aliasToSheet.get(alias)
        if (existing && existing.id !== sheet.id) {
          throw new Error(
            `[DataGridSpreadsheetWorkbook] sheet alias '${alias}' collides between '${existing.name}' (${existing.id}) and '${sheet.name}' (${sheet.id}).`,
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
          `[DataGridSpreadsheetWorkbook] sheet alias '${alias}' collides between '${existingSheet.name}' (${existingSheet.id}) and '${sheetId}'.`,
        )
      }
    }
  }

  const refreshWorkbookSheetFormulaDependencies = (
    sheet: SpreadsheetWorkbookSheetState,
  ): boolean => {
    const currentRevision = sheet.sheetModel.getSnapshot().formulaStructureRevision
    if (currentRevision === sheet.formulaStructureRevision) {
      return false
    }
    const nextState = resolveSpreadsheetWorkbookSheetFormulaDependencyState(sheet.sheetModel)
    const changed = sheet.formulaUsesAllTables !== nextState.usesAllTables
      || !areSpreadsheetWorkbookStringListsEqual(
        sheet.formulaTableDependencyAliases,
        nextState.tableDependencyAliases,
      )
      || !areSpreadsheetWorkbookStringListsEqual(
        sheet.formulaReferenceDependencyAliases,
        nextState.referenceDependencyAliases,
      )
    sheet.formulaStructureRevision = nextState.revision
    sheet.formulaUsesAllTables = nextState.usesAllTables
    sheet.formulaTableDependencyAliases = nextState.tableDependencyAliases
    sheet.formulaReferenceDependencyAliases = nextState.referenceDependencyAliases
    return changed
  }

  const buildDependencyGraph = (
    aliasToSheet: ReadonlyMap<string, SpreadsheetWorkbookSheetState>,
  ): SpreadsheetWorkbookDependencyGraph => {
    const dependencySheetIdsBySheetId = new Map<string, readonly string[]>()
    const dependentSheetIdsBySheetId = new Map<string, Set<string>>()

    for (const sheet of sheets) {
      dependentSheetIdsBySheetId.set(sheet.id, new Set<string>())
    }

    for (const targetSheet of sheets) {
      const dependencySheetIds = new Set<string>()
      if (targetSheet.viewDefinition) {
        for (const dependencySheetId of collectSpreadsheetWorkbookViewDependencySheetIds(targetSheet.viewDefinition)) {
          const sourceSheet = sheetsById.get(dependencySheetId)
          if (sourceSheet && sourceSheet.id !== targetSheet.id) {
            dependencySheetIds.add(sourceSheet.id)
          }
        }
      }
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
        for (const alias of targetSheet.formulaReferenceDependencyAliases) {
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

  const createWorkbookGraphState = (): SpreadsheetWorkbookGraphState => {
    const aliasToSheet = createAliasToSheetMap()
    return {
      aliasToSheet,
      graph: buildDependencyGraph(aliasToSheet),
      sheetOrderById: new Map<string, number>(sheets.map((sheet, index) => [sheet.id, index])),
    }
  }

  const resolveWorkbookGraphState = (
    syncOptions: SpreadsheetWorkbookSyncOptions,
  ): SpreadsheetWorkbookGraphState => {
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
    graph: SpreadsheetWorkbookDependencyGraph,
    syncOptions: SpreadsheetWorkbookSyncOptions,
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
    targetSheet: SpreadsheetWorkbookSheetState,
    dependencySheetIds: readonly string[],
  ): boolean => {
    const desiredTableRowsByAlias = new Map<string, SpreadsheetWorkbookTableSource>()
    for (const dependencySheetId of dependencySheetIds) {
      const sourceSheet = sheetsById.get(dependencySheetId)
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

    const setEntries: { name: string; source: SpreadsheetWorkbookTableSource }[] = []
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

  const materializeWorkbookViewSheets = (
    scheduledComponents: readonly (readonly string[])[],
    graph: SpreadsheetWorkbookDependencyGraph,
  ): void => {
    for (const componentSheetIds of scheduledComponents) {
      if (componentSheetIds.length === 0) {
        continue
      }
      const componentIsCyclic = componentSheetIds.length > 1 || componentSheetIds.some(sheetId => (
        graph.dependencySheetIdsBySheetId.get(sheetId)?.includes(sheetId) ?? false
      ))
      const cycleMessage = componentIsCyclic
        ? `Circular view dependency detected: ${componentSheetIds
          .map(sheetId => sheetsById.get(sheetId)?.name ?? sheetId)
          .join(" -> ")}`
        : null

      for (const sheetId of componentSheetIds) {
        const targetSheet = sheetsById.get(sheetId)
        if (!targetSheet || targetSheet.kind !== "view" || !targetSheet.viewDefinition) {
          continue
        }
        let viewSheetChanged = false
        if (targetSheet.derivedSheetModel) {
          const nextState = materializeDataGridSpreadsheetViewRuntimeResult({
            sheetId: targetSheet.id,
            sheetName: targetSheet.name,
            sourceSheetId: targetSheet.viewDefinition.sourceSheetId,
            sourceSheetModel: sheetsById.get(targetSheet.viewDefinition.sourceSheetId)?.sheetModel ?? null,
            resolveSheetModel: (sheetId) => sheetsById.get(sheetId)?.sheetModel ?? null,
            pipeline: targetSheet.viewDefinition.pipeline,
            sheetModelOptions: targetSheet.viewSheetModelOptions,
            errorMessage: cycleMessage,
          })
          targetSheet.viewDiagnostics = nextState.diagnostics
          targetSheet.derivedRuntime = nextState.derivedRuntime
          viewSheetChanged = targetSheet.derivedSheetModel.replaceRuntime(
            nextState.derivedRuntime,
            createDerivedSheetModelOptions(
              targetSheet.id,
              targetSheet.name,
              targetSheet.viewSheetModelOptions,
            ),
          )
        } else {
          const nextState = materializeDataGridSpreadsheetViewSheetResult({
            sheetId: targetSheet.id,
            sheetName: targetSheet.name,
            sourceSheetId: targetSheet.viewDefinition.sourceSheetId,
            sourceSheetModel: sheetsById.get(targetSheet.viewDefinition.sourceSheetId)?.sheetModel ?? null,
            resolveSheetModel: (sheetId) => sheetsById.get(sheetId)?.sheetModel ?? null,
            pipeline: targetSheet.viewDefinition.pipeline,
            sheetModelOptions: targetSheet.viewSheetModelOptions,
            errorMessage: cycleMessage,
          })
          targetSheet.viewDiagnostics = nextState.diagnostics
          targetSheet.derivedRuntime = nextState.derivedRuntime
          viewSheetChanged = targetSheet.sheetModel.restoreState(nextState.sheetState)
        }
        if (viewSheetChanged) {
          invalidateSheetExportCache(targetSheet)
        }
      }
    }
  }

  const syncSheetComponent = (
    componentSheetIds: readonly string[],
    graph: SpreadsheetWorkbookDependencyGraph,
    maxPasses: number,
  ): SpreadsheetWorkbookComponentSyncResult => {
    if (componentSheetIds.length === 0) {
      return { passCount: 0, converged: true }
    }

    if (componentSheetIds.length === 1) {
      const targetSheet = sheetsById.get(componentSheetIds[0] ?? "")
      if (!targetSheet) {
        return { passCount: 0, converged: true }
      }
      if (targetSheet.kind === "view") {
        return { passCount: 0, converged: true }
      }
      applyManagedTablePatch(
        targetSheet,
        graph.dependencySheetIdsBySheetId.get(targetSheet.id) ?? Object.freeze([]),
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
        const targetSheet = sheetsById.get(sheetId)
        if (!targetSheet || targetSheet.kind === "view") {
          continue
        }
        mutableSheetVisited = true
        if (
          applyManagedTablePatch(
            targetSheet,
            graph.dependencySheetIdsBySheetId.get(targetSheet.id) ?? Object.freeze([]),
          )
        ) {
          changed = true
        }
        if (targetSheet.sheetModel.recompute()) {
          invalidateSheetExportCache(targetSheet)
          changed = true
        }
      }
      if (!mutableSheetVisited) {
        return {
          passCount: 0,
          converged: true,
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

  const applyWorkbookSync = (syncOptions: SpreadsheetWorkbookSyncOptions = {}): void => {
    if (sheets.length === 0) {
      lastSync = {
        passCount: 0,
        converged: true,
        maxPasses: 0,
      }
      return
    }

    const maxPasses = resolveSpreadsheetWorkbookSyncMaxPasses(
      options.formulaTableSyncMaxPasses,
      sheets.length,
    )
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

    const scheduledComponents = createSpreadsheetWorkbookComponentSchedule(
      affectedSheetIds,
      resolvedGraphState.graph.dependencySheetIdsBySheetId,
      resolvedGraphState.sheetOrderById,
    )
    materializeWorkbookViewSheets(scheduledComponents, resolvedGraphState.graph)
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

  const runSync = (syncOptions: SpreadsheetWorkbookSyncOptions = {}): void => {
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

  const subscribeToSheet = (sheet: SpreadsheetWorkbookSheetState): void => {
    sheet.unsubscribe = sheet.sheetModel.subscribe(snapshot => {
      reconcileSheetExportCache(sheet)
      if (disposed || syncInProgress || referenceRewriteInProgress) {
        return
      }
      const dirtySheetIds = new Set<string>([sheet.id])
      const rowMutation = snapshot.lastRowMutation
      if (rowMutation && rowMutation.revision > sheet.lastHandledRowMutationRevision) {
        referenceRewriteInProgress = true
        try {
          const rewrittenSheetIds = rewriteWorkbookSheetRowMutation(sheet, rowMutation)
          for (const rewrittenSheetId of rewrittenSheetIds) {
            dirtySheetIds.add(rewrittenSheetId)
          }
        } finally {
          referenceRewriteInProgress = false
        }
        sheet.lastHandledRowMutationRevision = rowMutation.revision
      }
      runSync({
        dirtySheetIds,
      })
    })
  }

  const createSheetState = (
    input: DataGridSpreadsheetWorkbookSheetInput,
    options: {
      initialDerivedRuntime?: DataGridSpreadsheetDerivedSheetRuntime | null
      deferInitialViewMaterialization?: boolean
    } = {},
  ): SpreadsheetWorkbookSheetState => {
    const existingIds = new Set<string>(sheets.map(sheet => sheet.id))
    const name = normalizeSpreadsheetWorkbookSheetName(input.name)
    const id = typeof input.id === "string" && input.id.trim().length > 0
      ? normalizeSpreadsheetWorkbookSheetId(input.id)
      : createSpreadsheetWorkbookSheetId(name, existingIds)

    if (existingIds.has(id)) {
      throw new Error(`[DataGridSpreadsheetWorkbook] sheet id '${id}' already exists.`)
    }

    const aliases = buildSpreadsheetWorkbookSheetAliases(id, name)
    assertSheetAliasesAvailable(id, aliases)
    const kind: DataGridSpreadsheetWorkbookSheetKind = input.kind === "view" ? "view" : "data"
    const dataSheetInput = kind === "data" ? input as DataGridSpreadsheetWorkbookDataSheetInput : null
    const viewSheetInput = kind === "view" ? input as DataGridSpreadsheetWorkbookViewSheetInput : null
    const viewDefinition = viewSheetInput
      ? normalizeSpreadsheetWorkbookViewDefinition(viewSheetInput)
      : null

    const providedSheetModel = input.sheetModel
    if (providedSheetModel) {
      const providedSheetId = providedSheetModel.getSheetId()
      const providedSheetName = providedSheetModel.getSheetName()
      if (providedSheetId !== null && providedSheetId !== id) {
        throw new Error(
          `[DataGridSpreadsheetWorkbook] provided sheetModel id '${providedSheetId}' does not match workbook sheet id '${id}'.`,
        )
      }
      if (providedSheetName !== null && providedSheetName !== name) {
        throw new Error(
          `[DataGridSpreadsheetWorkbook] provided sheetModel name '${providedSheetName}' does not match workbook sheet name '${name}'.`,
        )
      }
    }

    if (!providedSheetModel && !input.sheetModelOptions && kind !== "view") {
      throw new Error(
        `[DataGridSpreadsheetWorkbook] sheet '${name}' must provide sheetModel or sheetModelOptions.`,
      )
    }

    const viewSheetModelOptions = kind === "view"
      ? normalizeSpreadsheetWorkbookViewSheetModelOptions(
        viewSheetInput?.sheetModelOptions
          ?? (providedSheetModel ? resolveSpreadsheetWorkbookViewSheetModelOptionsFromState(providedSheetModel.exportState()) : null),
      )
      : null

    const initialViewResult = kind === "view" && !providedSheetModel && !options.deferInitialViewMaterialization
      ? materializeDataGridSpreadsheetViewRuntimeResult({
        sheetId: id,
        sheetName: name,
        sourceSheetId: viewDefinition?.sourceSheetId ?? "",
        sourceSheetModel: viewDefinition ? (sheetsById.get(viewDefinition.sourceSheetId)?.sheetModel ?? null) : null,
        resolveSheetModel: (sheetId) => sheetsById.get(sheetId)?.sheetModel ?? null,
        pipeline: viewDefinition?.pipeline ?? Object.freeze([]),
        sheetModelOptions: viewSheetModelOptions,
      })
      : null

    const initialDerivedRuntime = kind === "view"
      ? (
        options.initialDerivedRuntime
          ?? initialViewResult?.derivedRuntime
          ?? createDataGridSpreadsheetDerivedSheetRuntime({
            columns: Object.freeze([]),
            rows: Object.freeze([]),
          })
      )
      : null

    const derivedSheetModel = kind === "view" && !providedSheetModel
      ? createDataGridSpreadsheetDerivedSheetModel(
        initialDerivedRuntime!,
        createDerivedSheetModelOptions(id, name, viewSheetModelOptions),
      )
      : null

    const sheetModel = providedSheetModel ?? derivedSheetModel ?? (
      createDataGridSpreadsheetSheetModel({
          ...dataSheetInput!.sheetModelOptions!,
          sheetId: id,
          sheetName: name,
          resolveSheetReference: (sheetReference) => {
            const normalizedAlias = normalizeSpreadsheetWorkbookAlias(sheetReference)
            if (normalizedAlias.length === 0) {
              return null
            }
            return resolveWorkbookGraphState({}).aliasToSheet.get(normalizedAlias)?.sheetModel ?? null
          },
      })
    )

    const formulaDependencyState = resolveSpreadsheetWorkbookSheetFormulaDependencyState(sheetModel)
    const sheetSnapshot = sheetModel.getSnapshot()
    return {
      id,
      name,
      aliases,
      kind,
      viewDefinition,
      viewSheetModelOptions,
      sheetModel,
      owned: providedSheetModel ? input.ownSheetModel === true : true,
      unsubscribe: null,
      exportedTableRevision: -1,
      exportedTableSource: null,
      formulaStructureRevision: sheetSnapshot.formulaStructureRevision,
      formulaUsesAllTables: formulaDependencyState.usesAllTables,
      formulaTableDependencyAliases: formulaDependencyState.tableDependencyAliases,
      formulaReferenceDependencyAliases: formulaDependencyState.referenceDependencyAliases,
      managedTableAliases: new Set<string>(),
      appliedTableRowsByAlias: new Map<string, SpreadsheetWorkbookTableSource>(),
      lastHandledRowMutationRevision: sheetSnapshot.lastRowMutation?.revision ?? 0,
      viewDiagnostics: initialViewResult?.diagnostics ?? Object.freeze([]),
      derivedRuntime: initialDerivedRuntime,
      derivedSheetModel,
    }
  }

  function getSnapshot(): DataGridSpreadsheetWorkbookSnapshot {
    ensureActive()
    const aliasToSheet = graphState?.aliasToSheet ?? createAliasToSheetMap()
    return {
      activeSheetId,
      sheets: Object.freeze(sheets.map(createSpreadsheetWorkbookSheetSnapshot)),
      sync: { ...lastSync },
      diagnostics: collectSpreadsheetWorkbookDiagnostics(sheets, aliasToSheet),
    }
  }

  function exportState(): DataGridSpreadsheetWorkbookState {
    ensureActive()
    return {
      activeSheetId,
      sheets: Object.freeze(sheets.map((sheet): SpreadsheetWorkbookSheetStateExportPayload => (
        sheet.kind === "view"
          ? createSpreadsheetWorkbookSheetStateExport({
            id: sheet.id,
            name: sheet.name,
            kind: "view",
            viewDefinition: sheet.viewDefinition!,
            viewSheetModelOptions: sheet.viewSheetModelOptions,
            derivedRuntime: sheet.derivedRuntime!,
            sheetState: null,
            runtimeManagedFormulaTableAliases: new Set(
              [...sheet.managedTableAliases].map(alias => normalizeSpreadsheetWorkbookAlias(alias)),
            ),
          })
          : createSpreadsheetWorkbookSheetStateExport({
            id: sheet.id,
            name: sheet.name,
            kind: "data",
            viewDefinition: null,
            viewSheetModelOptions: null,
            derivedRuntime: null,
            sheetState: sheet.sheetModel.exportState(),
            runtimeManagedFormulaTableAliases: new Set(
              [...sheet.managedTableAliases].map(alias => normalizeSpreadsheetWorkbookAlias(alias)),
            ),
          })
      ))),
    }
  }

  const attachSheet = (sheet: SpreadsheetWorkbookSheetState): void => {
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
      attachSheet(createSheetState(sheetInput))
    }
  }

  const normalizedActiveSheetId = typeof options.activeSheetId === "string" && options.activeSheetId.trim().length > 0
    ? normalizeSpreadsheetWorkbookSheetId(options.activeSheetId)
    : null

  if (normalizedActiveSheetId && sheetsById.has(normalizedActiveSheetId)) {
    activeSheetId = normalizedActiveSheetId
  } else if (!activeSheetId && sheets.length > 0) {
    activeSheetId = sheets[0]?.id ?? null
  }

  if (sheets.length > 0) {
    runSync({ structural: true })
  }

  const rewriteWorkbookSheetReferenceAlias = (
    previousAlias: string,
    nextAlias: string,
  ): boolean => {
    if (
      previousAlias.length === 0
      || nextAlias.length === 0
      || previousAlias === nextAlias
    ) {
      return false
    }
    let changed = false
    for (const sheet of sheets) {
      const patches: DataGridSpreadsheetFormulaStructuralPatch[] = []
      for (const formulaCell of sheet.sheetModel.getFormulaCells()) {
        const cellSnapshot = sheet.sheetModel.getCell(formulaCell.address)
        if (!cellSnapshot || cellSnapshot.analysis.references.length === 0) {
          continue
        }
        const formulaModel = createDataGridSpreadsheetCellFormulaModel(cellSnapshot.analysis)
        const formulaRuntime = createDataGridSpreadsheetCellFormulaRuntimeModel(cellSnapshot.analysis)
        if (!formulaModel || !formulaRuntime) {
          continue
        }
        const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(formulaRuntime, (binding) => {
          if (binding.kind !== "reference") {
            return null
          }
          const reference = binding
          if (normalizeSpreadsheetWorkbookAlias(reference.sheetReference) !== previousAlias) {
            return null
          }
          return {
            sheetReference: nextAlias,
            referenceName: reference.referenceName,
            rangeReferenceName: reference.rangeReferenceName,
            rowSelector: reference.rowSelector,
          }
        }, {
          currentRowIndex: formulaCell.address.rowIndex,
        })
        if (nextRuntimeModel === formulaRuntime) {
          continue
        }
        patches.push({
          cell: formulaCell.address,
          formulaModel,
          formulaRuntime: nextRuntimeModel,
        })
      }
      if (patches.length === 0) {
        continue
      }
      if (sheet.sheetModel.applyFormulaStructuralPatches(patches)) {
        changed = true
      }
    }
    return changed
  }

  const rewriteWorkbookSheetRowMutation = (
    sourceSheet: SpreadsheetWorkbookSheetState,
    mutation: DataGridSpreadsheetSheetRowMutation,
  ): ReadonlySet<string> => {
    if (mutation.count < 1) {
      return new Set<string>()
    }
    const changedSheetIds = new Set<string>()
    const sourceAliases = new Set(sourceSheet.aliases.map(alias => normalizeSpreadsheetWorkbookAlias(alias)))

    for (const targetSheet of sheets) {
      if (targetSheet.id === sourceSheet.id) {
        continue
      }
      const patches: DataGridSpreadsheetFormulaStructuralPatch[] = []
      for (const formulaCell of targetSheet.sheetModel.getFormulaCells()) {
        const cellSnapshot = targetSheet.sheetModel.getCell(formulaCell.address)
        if (!cellSnapshot || cellSnapshot.analysis.references.length === 0) {
          continue
        }
        const formulaModel = createDataGridSpreadsheetCellFormulaModel(cellSnapshot.analysis)
        const formulaRuntime = createDataGridSpreadsheetCellFormulaRuntimeModel(cellSnapshot.analysis)
        if (!formulaModel || !formulaRuntime) {
          continue
        }
        const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(formulaRuntime, (binding) => {
          if (binding.kind !== "reference") {
            return null
          }
          const reference = binding
          if (!sourceAliases.has(normalizeSpreadsheetWorkbookAlias(reference.sheetReference))) {
            return null
          }
          if (mutation.kind === "insert") {
            if (reference.rowSelector.kind === "absolute") {
              if (reference.rowSelector.rowIndex < mutation.index) {
                return null
              }
              return {
                sheetReference: reference.sheetReference,
                referenceName: reference.referenceName,
                rangeReferenceName: reference.rangeReferenceName,
                rowSelector: {
                  kind: "absolute",
                  rowIndex: reference.rowSelector.rowIndex + mutation.count,
                },
              }
            }
            if (reference.rowSelector.kind !== "absolute-window") {
              return null
            }
            if (reference.rowSelector.endRowIndex < mutation.index) {
              return null
            }
            const shiftWholeRange = reference.rowSelector.startRowIndex >= mutation.index
            return {
              sheetReference: reference.sheetReference,
              referenceName: reference.referenceName,
              rangeReferenceName: reference.rangeReferenceName,
              rowSelector: {
                kind: "absolute-window",
                startRowIndex: shiftWholeRange
                  ? reference.rowSelector.startRowIndex + mutation.count
                  : reference.rowSelector.startRowIndex,
                endRowIndex: reference.rowSelector.endRowIndex + mutation.count,
              },
            }
          }
          if (reference.rowSelector.kind === "absolute") {
            if (reference.rowSelector.rowIndex < mutation.index) {
              return null
            }
            if (reference.rowSelector.rowIndex >= mutation.index + mutation.count) {
              return {
                sheetReference: reference.sheetReference,
                referenceName: reference.referenceName,
                rangeReferenceName: reference.rangeReferenceName,
                rowSelector: {
                  kind: "absolute",
                  rowIndex: reference.rowSelector.rowIndex - mutation.count,
                },
              }
            }
            return {
              kind: "invalid",
            }
          }
          if (reference.rowSelector.kind !== "absolute-window") {
            return null
          }
          const survivingIndexes: number[] = []
          for (
            let targetRowIndex = reference.rowSelector.startRowIndex;
            targetRowIndex <= reference.rowSelector.endRowIndex;
            targetRowIndex += 1
          ) {
            if (targetRowIndex < mutation.index) {
              survivingIndexes.push(targetRowIndex)
              continue
            }
            if (targetRowIndex >= mutation.index + mutation.count) {
              survivingIndexes.push(targetRowIndex - mutation.count)
            }
          }
          if (survivingIndexes.length === 0) {
            return {
              kind: "invalid",
            }
          }
          if (survivingIndexes.length === 1) {
            return {
              sheetReference: reference.sheetReference,
              referenceName: reference.referenceName,
              rangeReferenceName: reference.rangeReferenceName,
              rowSelector: {
                kind: "absolute",
                rowIndex: survivingIndexes[0]!,
              },
            }
          }
          return {
            sheetReference: reference.sheetReference,
            referenceName: reference.referenceName,
            rangeReferenceName: reference.rangeReferenceName,
            rowSelector: {
              kind: "absolute-window",
              startRowIndex: survivingIndexes[0]!,
              endRowIndex: survivingIndexes[survivingIndexes.length - 1]!,
            },
          }
        }, {
          currentRowIndex: formulaCell.address.rowIndex,
        })
        if (nextRuntimeModel === formulaRuntime) {
          continue
        }
        patches.push({
          cell: formulaCell.address,
          formulaModel,
          formulaRuntime: nextRuntimeModel,
        })
      }
      if (patches.length === 0) {
        continue
      }
      if (targetSheet.sheetModel.applyFormulaStructuralPatches(patches)) {
        changedSheetIds.add(targetSheet.id)
      }
    }

    return changedSheetIds
  }

  const invalidateWorkbookSheetReferences = (
    removedAliases: readonly string[],
  ): ReadonlySet<string> => {
    const normalizedRemovedAliases = new Set(
      removedAliases
        .map(alias => normalizeSpreadsheetWorkbookAlias(alias))
        .filter(alias => alias.length > 0),
    )
    if (normalizedRemovedAliases.size === 0) {
      return new Set<string>()
    }

    const changedSheetIds = new Set<string>()
    for (const targetSheet of sheets) {
      const patches: Array<{
        cell: Parameters<DataGridSpreadsheetSheetModel["setCellInput"]>[0]
        rawInput: string
      }> = []
      for (const formulaCell of targetSheet.sheetModel.getFormulaCells()) {
        const cellSnapshot = targetSheet.sheetModel.getCell(formulaCell.address)
        if (!cellSnapshot || cellSnapshot.analysis.references.length === 0) {
          continue
        }
        let nextRawInput = cellSnapshot.rawInput
        let cellChanged = false
        const references = [...cellSnapshot.analysis.references].sort((left, right) => right.span.start - left.span.start)
        for (const reference of references) {
          if (!normalizedRemovedAliases.has(normalizeSpreadsheetWorkbookAlias(reference.sheetReference))) {
            continue
          }
          nextRawInput = `${nextRawInput.slice(0, reference.span.start)}#REF!${nextRawInput.slice(reference.span.end)}`
          cellChanged = true
        }
        if (!cellChanged || nextRawInput === cellSnapshot.rawInput) {
          continue
        }
        patches.push({
          cell: formulaCell.address,
          rawInput: nextRawInput,
        })
      }
      if (patches.length === 0) {
        continue
      }
      if (targetSheet.sheetModel.setCellInputs(patches)) {
        changedSheetIds.add(targetSheet.id)
      }
    }
    return changedSheetIds
  }

  return {
    getSnapshot,
    exportState,
    restoreState(state) {
      ensureActive()
      const nextSheets = Array.isArray(state.sheets) ? state.sheets : []
      const restoreDescriptors = nextSheets.map(nextSheet => createSpreadsheetWorkbookRestoreDescriptor(
        nextSheet,
        {
          normalizeSheetId: normalizeSpreadsheetWorkbookSheetId,
          normalizeSheetName: normalizeSpreadsheetWorkbookSheetName,
        },
      ))

      for (const sheet of sheets) {
        sheet.unsubscribe?.()
        sheet.unsubscribe = null
        if (sheet.owned) {
          sheet.sheetModel.dispose()
        }
      }
      sheets.length = 0
      sheetsById.clear()
      invalidateWorkbookGraphState()
      activeSheetId = null
      lastSync = {
        passCount: 0,
        converged: true,
        maxPasses: 0,
      }

      for (const nextSheet of restoreDescriptors) {
        if (nextSheet.kind === "view") {
          attachSheet(createSheetState({
            id: nextSheet.id,
            name: nextSheet.name,
            kind: "view",
            sourceSheetId: nextSheet.viewDefinition!.sourceSheetId,
            pipeline: nextSheet.viewDefinition!.pipeline,
            sheetModelOptions: nextSheet.viewSheetModelOptions!,
          }, {
            deferInitialViewMaterialization: true,
            initialDerivedRuntime: nextSheet.initialDerivedRuntime!,
          }))
          continue
        }
        const restoredSheetModel = hydrateSpreadsheetWorkbookDataSheetModel({
          sheetState: nextSheet.sheetState,
          sheetModelOptions: null,
          sheetId: nextSheet.id,
          sheetName: nextSheet.name,
          resolveSheetReference: (sheetReference) => {
            const normalizedAlias = normalizeSpreadsheetWorkbookAlias(sheetReference)
            if (normalizedAlias.length === 0) {
              return null
            }
            return resolveWorkbookGraphState({}).aliasToSheet.get(normalizedAlias)?.sheetModel ?? null
          },
        })
        attachSheet(createSheetState({
          id: nextSheet.id,
          name: nextSheet.name,
          kind: "data",
          sheetModel: restoredSheetModel,
          ownSheetModel: true,
        }))
      }

      const normalizedActiveSheetId = typeof state.activeSheetId === "string" && state.activeSheetId.trim().length > 0
        ? normalizeSpreadsheetWorkbookSheetId(state.activeSheetId)
        : null

      if (normalizedActiveSheetId && sheetsById.has(normalizedActiveSheetId)) {
        activeSheetId = normalizedActiveSheetId
      } else {
        activeSheetId = sheets[0]?.id ?? null
      }

      runSync({ structural: true })
      return true
    },
    getSheets() {
      ensureActive()
      return Object.freeze(sheets.map(createSpreadsheetWorkbookSheetHandle))
    },
    getSheet(sheetId) {
      ensureActive()
      const sheet = sheetsById.get(sheetId)
      return sheet ? createSpreadsheetWorkbookSheetHandle(sheet) : null
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
      return sheet ? createSpreadsheetWorkbookSheetHandle(sheet) : null
    },
    setActiveSheet(sheetId) {
      ensureActive()
      if (!sheetsById.has(sheetId) || activeSheetId === sheetId) {
        return false
      }
      activeSheetId = sheetId
      emit()
      return true
    },
    addSheet(input) {
      ensureActive()
      const sheet = createSheetState(input)
      attachSheet(sheet)
      runSync({ structural: true })
      return createSpreadsheetWorkbookSheetHandle(sheet)
    },
    removeSheet(sheetId) {
      ensureActive()
      const sheet = sheetsById.get(sheetId)
      if (!sheet) {
        return false
      }
      const removedAliases = sheet.aliases
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
      invalidateWorkbookGraphState()
      referenceRewriteInProgress = true
      try {
        invalidateWorkbookSheetReferences(removedAliases)
      } finally {
        referenceRewriteInProgress = false
      }
      if (sheet.owned) {
        sheet.sheetModel.dispose()
      }
      runSync({ structural: true })
      return true
    },
    renameSheet(sheetId, name) {
      ensureActive()
      const sheet = sheetsById.get(sheetId)
      if (!sheet) {
        return false
      }
      const nextName = normalizeSpreadsheetWorkbookSheetName(name)
      if (sheet.name === nextName) {
        return false
      }
      const previousName = sheet.name
      const previousAliases = sheet.aliases
      const nextAliases = buildSpreadsheetWorkbookSheetAliases(sheet.id, nextName)
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
      rewriteWorkbookSheetReferenceAlias(
        normalizeSpreadsheetWorkbookAlias(previousName),
        normalizeSpreadsheetWorkbookAlias(nextName),
      )
      invalidateWorkbookGraphState()
      runSync({ structural: true })
      return true
    },
    sync() {
      runSync({ structural: true })
    },
    subscribe(listener) {
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
          sheet.sheetModel.dispose()
        }
      }
      sheets.length = 0
      sheetsById.clear()
      graphState = null
      activeSheetId = null
      lastSync = {
        passCount: 0,
        converged: true,
        maxPasses: 0,
      }
    },
  }
}
