import type {
  DataGridClientComputeDiagnostics,
  DataGridClientRowModelDerivedCacheDiagnostics,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaExecutionPlanSnapshot,
  DataGridFormulaGraphSnapshot,
  DataGridFormulaFieldSnapshot,
  DataGridProjectionFormulaDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridRowModel,
} from "../models"
import {
  explainDataGridFormulaExpression,
} from "../models"
import type {
  DataGridApiFormulaExplainEntry,
  DataGridApiDiagnosticsSnapshot,
  DataGridApiFormulaExplainSnapshot,
} from "./gridApiContracts"
import type { DataGridComputeCapability } from "./gridApiCapabilities"

type DerivedCacheCapability<TRow = unknown> = {
  getDerivedCacheDiagnostics: () => DataGridClientRowModelDerivedCacheDiagnostics
}

type BackpressureCapability = {
  getBackpressureDiagnostics: () => DataGridDataSourceBackpressureDiagnostics
}

type FormulaPlanCapability = {
  getFormulaExecutionPlan: () => DataGridFormulaExecutionPlanSnapshot | null
}

type FormulaGraphCapability = {
  getFormulaGraph: () => DataGridFormulaGraphSnapshot | null
}

type FormulaComputeDiagnosticsCapability = {
  getFormulaComputeStageDiagnostics: () => DataGridFormulaComputeStageDiagnostics | null
}

type FormulaRowRecomputeDiagnosticsCapability = {
  getFormulaRowRecomputeDiagnostics: () => DataGridFormulaRowRecomputeDiagnostics | null
}

type FormulaFieldsCapability = {
  getFormulaFields: () => readonly DataGridFormulaFieldSnapshot[]
}

export interface DataGridApiDiagnosticsMethods {
  getAllDiagnostics: () => DataGridApiDiagnosticsSnapshot
  getFormulaExplain: () => DataGridApiFormulaExplainSnapshot
}

export interface CreateDataGridApiDiagnosticsMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getComputeCapability: () => DataGridComputeCapability | null
}

function resolveDerivedCacheCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): DerivedCacheCapability<TRow> | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<DerivedCacheCapability<TRow>>
  if (typeof candidate.getDerivedCacheDiagnostics !== "function") {
    return null
  }
  return {
    getDerivedCacheDiagnostics: candidate.getDerivedCacheDiagnostics.bind(rowModel),
  }
}

function resolveBackpressureCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): BackpressureCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<BackpressureCapability>
  if (typeof candidate.getBackpressureDiagnostics !== "function") {
    return null
  }
  return {
    getBackpressureDiagnostics: candidate.getBackpressureDiagnostics.bind(rowModel),
  }
}

function resolveFormulaPlanCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): FormulaPlanCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<FormulaPlanCapability>
  if (typeof candidate.getFormulaExecutionPlan !== "function") {
    return null
  }
  return {
    getFormulaExecutionPlan: candidate.getFormulaExecutionPlan.bind(rowModel),
  }
}

function resolveFormulaComputeDiagnosticsCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): FormulaComputeDiagnosticsCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<FormulaComputeDiagnosticsCapability>
  if (typeof candidate.getFormulaComputeStageDiagnostics !== "function") {
    return null
  }
  return {
    getFormulaComputeStageDiagnostics: candidate.getFormulaComputeStageDiagnostics.bind(rowModel),
  }
}

function resolveFormulaGraphCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): FormulaGraphCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<FormulaGraphCapability>
  if (typeof candidate.getFormulaGraph !== "function") {
    return null
  }
  return {
    getFormulaGraph: candidate.getFormulaGraph.bind(rowModel),
  }
}

function resolveFormulaRowRecomputeDiagnosticsCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): FormulaRowRecomputeDiagnosticsCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<FormulaRowRecomputeDiagnosticsCapability>
  if (typeof candidate.getFormulaRowRecomputeDiagnostics !== "function") {
    return null
  }
  return {
    getFormulaRowRecomputeDiagnostics: candidate.getFormulaRowRecomputeDiagnostics.bind(rowModel),
  }
}

function resolveFormulaFieldsCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): FormulaFieldsCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<FormulaFieldsCapability>
  if (typeof candidate.getFormulaFields !== "function") {
    return null
  }
  return {
    getFormulaFields: candidate.getFormulaFields.bind(rowModel),
  }
}

function cloneFormulaExecutionPlanSnapshot(
  snapshot: DataGridFormulaExecutionPlanSnapshot,
): DataGridFormulaExecutionPlanSnapshot {
  return {
    order: [...snapshot.order],
    levels: snapshot.levels.map(level => [...level]),
    nodes: snapshot.nodes.map(node => ({
      name: node.name,
      field: node.field,
      level: node.level,
      fieldDeps: [...node.fieldDeps],
      computedDeps: [...node.computedDeps],
      dependents: [...node.dependents],
      ...(node.iterative ? { iterative: true } : {}),
      ...(node.cycleGroup ? { cycleGroup: [...node.cycleGroup] } : {}),
    })),
    ...(snapshot.iterativeGroups
      ? { iterativeGroups: snapshot.iterativeGroups.map(group => [...group]) }
      : {}),
  }
}

function cloneFormulaGraphSnapshot(
  snapshot: DataGridFormulaGraphSnapshot,
): DataGridFormulaGraphSnapshot {
  return {
    order: [...snapshot.order],
    levels: snapshot.levels.map(level => [...level]),
    levelDetails: snapshot.levelDetails.map(level => ({
      index: level.index,
      nodes: [...level.nodes],
      ...(level.iterative ? { iterative: true } : {}),
      ...(level.cycleGroups
        ? { cycleGroups: level.cycleGroups.map(group => [...group]) }
        : {}),
    })),
    nodes: snapshot.nodes.map(node => ({
      name: node.name,
      field: node.field,
      level: node.level,
      fieldDeps: [...node.fieldDeps],
      computedDeps: [...node.computedDeps],
      dependents: [...node.dependents],
      ...(node.iterative ? { iterative: true } : {}),
      ...(node.cycleGroup ? { cycleGroup: [...node.cycleGroup] } : {}),
    })),
    edges: snapshot.edges.map(edge => ({ ...edge })),
    ...(snapshot.iterativeGroups
      ? { iterativeGroups: snapshot.iterativeGroups.map(group => [...group]) }
      : {}),
  }
}

function cloneProjectionFormulaDiagnostics(
  diagnostics: DataGridProjectionFormulaDiagnostics,
): DataGridProjectionFormulaDiagnostics {
  return {
    recomputedFields: [...diagnostics.recomputedFields],
    runtimeErrorCount: diagnostics.runtimeErrorCount,
    runtimeErrors: diagnostics.runtimeErrors.map(error => ({ ...error })),
    ...(diagnostics.compileCache
      ? {
        compileCache: { ...diagnostics.compileCache },
      }
      : {}),
  }
}

function cloneFormulaComputeStageDiagnostics(
  diagnostics: DataGridFormulaComputeStageDiagnostics,
): DataGridFormulaComputeStageDiagnostics {
  return {
    strategy: diagnostics.strategy,
    rowsTouched: diagnostics.rowsTouched,
    changedRows: diagnostics.changedRows,
    fieldsTouched: [...diagnostics.fieldsTouched],
    evaluations: diagnostics.evaluations,
    skippedByObjectIs: diagnostics.skippedByObjectIs,
    dirtyRows: diagnostics.dirtyRows,
    dirtyNodes: [...diagnostics.dirtyNodes],
    ...(diagnostics.nodes
      ? {
        nodes: diagnostics.nodes.map(node => ({
          name: node.name,
          field: node.field,
          dirty: node.dirty,
          touched: node.touched,
          ...(node.runtimeMode ? { runtimeMode: node.runtimeMode } : {}),
          evaluations: node.evaluations,
          dirtyRows: node.dirtyRows,
          dirtyCauses: node.dirtyCauses.map(cause => ({ ...cause })),
          ...(node.iterative ? { iterative: true } : {}),
          ...(typeof node.converged === "boolean" ? { converged: node.converged } : {}),
          ...(typeof node.iterationCount === "number" ? { iterationCount: node.iterationCount } : {}),
          ...(node.cycleGroup ? { cycleGroup: [...node.cycleGroup] } : {}),
        })),
      }
      : {}),
  }
}

function cloneFormulaRowRecomputeDiagnostics(
  diagnostics: DataGridFormulaRowRecomputeDiagnostics,
): DataGridFormulaRowRecomputeDiagnostics {
  return {
    rows: diagnostics.rows.map(row => ({
      rowId: row.rowId,
      sourceIndex: row.sourceIndex,
      nodes: row.nodes.map(node => ({
        name: node.name,
        field: node.field,
        causes: node.causes.map(cause => ({ ...cause })),
      })),
    })),
  }
}

function buildFormulaExplainEntries(
  formulaFields: readonly DataGridFormulaFieldSnapshot[],
  executionPlan: DataGridFormulaExecutionPlanSnapshot | null,
  projectionFormula: DataGridProjectionFormulaDiagnostics | null,
  computeStage: DataGridFormulaComputeStageDiagnostics | null,
): readonly DataGridApiFormulaExplainEntry[] {
  if (formulaFields.length === 0) {
    return []
  }
  const planNodeByName = new Map((executionPlan?.nodes ?? []).map(node => [node.name, node] as const))
  const runtimeNodeByName = new Map((computeStage?.nodes ?? []).map(node => [node.name, node] as const))
  const recomputedFields = new Set(projectionFormula?.recomputedFields ?? [])

  return formulaFields.map((formulaField) => {
    const explained = explainDataGridFormulaExpression(formulaField.formula)
    const dependencies = explained.identifiers.map((identifier, index) => {
      const token = formulaField.deps[index] ?? `field:${identifier}`
      const normalizedToken = typeof token === "string" ? token.trim() : ""
      if (normalizedToken.startsWith("field:")) {
        return {
          identifier,
          token,
          domain: "field" as const,
          value: normalizedToken.slice("field:".length),
        }
      }
      if (normalizedToken.startsWith("computed:")) {
        return {
          identifier,
          token,
          domain: "computed" as const,
          value: normalizedToken.slice("computed:".length),
        }
      }
      if (normalizedToken.startsWith("meta:")) {
        return {
          identifier,
          token,
          domain: "meta" as const,
          value: normalizedToken.slice("meta:".length),
        }
      }
      return {
        identifier,
        token,
        domain: "unknown" as const,
        value: normalizedToken.length > 0 ? normalizedToken : String(token),
      }
    })
    const planNode = planNodeByName.get(formulaField.name) ?? null
    const runtimeNode = runtimeNodeByName.get(formulaField.name) ?? null
    return {
      name: formulaField.name,
      field: formulaField.field,
      formula: formulaField.formula,
      level: planNode?.level ?? null,
      identifiers: [...explained.identifiers],
      dependencies,
      contextKeys: [...formulaField.contextKeys],
      dependents: [...(planNode?.dependents ?? [])],
      tree: explained.tree,
      runtime: runtimeNode
        ? {
          name: runtimeNode.name,
          field: runtimeNode.field,
          dirty: runtimeNode.dirty,
          touched: runtimeNode.touched,
          ...(runtimeNode.runtimeMode ? { runtimeMode: runtimeNode.runtimeMode } : {}),
          evaluations: runtimeNode.evaluations,
          dirtyRows: runtimeNode.dirtyRows,
          dirtyCauses: runtimeNode.dirtyCauses.map(cause => ({ ...cause })),
          ...(runtimeNode.iterative ? { iterative: true } : {}),
          ...(typeof runtimeNode.converged === "boolean" ? { converged: runtimeNode.converged } : {}),
          ...(typeof runtimeNode.iterationCount === "number" ? { iterationCount: runtimeNode.iterationCount } : {}),
          ...(runtimeNode.cycleGroup ? { cycleGroup: [...runtimeNode.cycleGroup] } : {}),
        }
        : null,
      dirty: runtimeNode?.dirty === true,
      recomputed: recomputedFields.has(formulaField.name),
      touched: runtimeNode?.touched === true,
      dirtyCauses: runtimeNode?.dirtyCauses.map(cause => ({ ...cause })) ?? [],
    }
  })
}

function cloneDerivedCacheDiagnostics(
  diagnostics: DataGridClientRowModelDerivedCacheDiagnostics,
): DataGridClientRowModelDerivedCacheDiagnostics {
  return {
    revisions: { ...diagnostics.revisions },
    filterPredicateHits: diagnostics.filterPredicateHits,
    filterPredicateMisses: diagnostics.filterPredicateMisses,
    sortValueHits: diagnostics.sortValueHits,
    sortValueMisses: diagnostics.sortValueMisses,
    groupValueHits: diagnostics.groupValueHits,
    groupValueMisses: diagnostics.groupValueMisses,
    sourceColumnCacheSize: diagnostics.sourceColumnCacheSize,
    sourceColumnCacheLimit: diagnostics.sourceColumnCacheLimit,
    sourceColumnCacheEvictions: diagnostics.sourceColumnCacheEvictions,
  }
}

export function createDataGridApiDiagnosticsMethods<TRow = unknown>(
  input: CreateDataGridApiDiagnosticsMethodsInput<TRow>,
): DataGridApiDiagnosticsMethods {
  const { rowModel, getComputeCapability } = input
  const getDerivedCacheDiagnostics = resolveDerivedCacheCapability(rowModel)
  const getBackpressureDiagnostics = resolveBackpressureCapability(rowModel)
  const getFormulaPlan = resolveFormulaPlanCapability(rowModel)
  const getFormulaGraph = resolveFormulaGraphCapability(rowModel)
  const getFormulaComputeDiagnostics = resolveFormulaComputeDiagnosticsCapability(rowModel)
  const getFormulaRowRecomputeDiagnostics = resolveFormulaRowRecomputeDiagnosticsCapability(rowModel)
  const getFormulaFields = resolveFormulaFieldsCapability(rowModel)

  const resolveComputeDiagnostics = (): DataGridClientComputeDiagnostics | null => {
    const capability = getComputeCapability()
    if (!capability) {
      return null
    }
    return capability.getComputeDiagnostics()
  }

  return {
    getAllDiagnostics() {
      const snapshot = rowModel.getSnapshot()
      return {
        rowModel: {
          kind: snapshot.kind,
          revision: typeof snapshot.revision === "number" ? snapshot.revision : null,
          rowCount: snapshot.rowCount,
          loading: snapshot.loading,
          warming: snapshot.warming === true,
          projection: snapshot.projection ?? null,
          treeData: snapshot.treeDataDiagnostics ?? null,
        },
        compute: resolveComputeDiagnostics(),
        derivedCache: (() => {
          const diagnostics = getDerivedCacheDiagnostics?.getDerivedCacheDiagnostics() ?? null
          return diagnostics ? cloneDerivedCacheDiagnostics(diagnostics) : null
        })(),
        backpressure: getBackpressureDiagnostics?.getBackpressureDiagnostics() ?? null,
      }
    },
    getFormulaExplain() {
      const snapshot = rowModel.getSnapshot()
      const executionPlan = getFormulaPlan?.getFormulaExecutionPlan() ?? null
      const graph = getFormulaGraph?.getFormulaGraph() ?? null
      const computeStageDiagnostics = getFormulaComputeDiagnostics?.getFormulaComputeStageDiagnostics() ?? null
      const rowRecomputeDiagnostics = getFormulaRowRecomputeDiagnostics?.getFormulaRowRecomputeDiagnostics() ?? null
      const projectionFormula = snapshot.projection?.formula
        ? cloneProjectionFormulaDiagnostics(snapshot.projection.formula)
        : null
      const computeStage = computeStageDiagnostics
        ? cloneFormulaComputeStageDiagnostics(computeStageDiagnostics)
        : null
      const rowRecompute = rowRecomputeDiagnostics
        ? cloneFormulaRowRecomputeDiagnostics(rowRecomputeDiagnostics)
        : null
      const formulaFields = getFormulaFields?.getFormulaFields() ?? []
      const formulas = buildFormulaExplainEntries(
        formulaFields,
        executionPlan,
        projectionFormula,
        computeStage,
      )
      return {
        executionPlan: executionPlan ? cloneFormulaExecutionPlanSnapshot(executionPlan) : null,
        ...(graph ? { graph: cloneFormulaGraphSnapshot(graph) } : {}),
        projectionFormula,
        computeStage,
        ...(rowRecompute ? { rowRecompute } : {}),
        ...(formulas.length > 0 ? { formulas } : {}),
      }
    },
  }
}
