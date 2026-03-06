import type {
  DataGridClientComputeDiagnostics,
  DataGridClientRowModelDerivedCacheDiagnostics,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaExecutionPlanSnapshot,
  DataGridProjectionFormulaDiagnostics,
  DataGridRowModel,
} from "../models"
import type {
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

type FormulaComputeDiagnosticsCapability = {
  getFormulaComputeStageDiagnostics: () => DataGridFormulaComputeStageDiagnostics | null
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
    })),
  }
}

function cloneProjectionFormulaDiagnostics(
  diagnostics: DataGridProjectionFormulaDiagnostics,
): DataGridProjectionFormulaDiagnostics {
  return {
    recomputedFields: [...diagnostics.recomputedFields],
    runtimeErrorCount: diagnostics.runtimeErrorCount,
    runtimeErrors: diagnostics.runtimeErrors.map(error => ({ ...error })),
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
  }
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
  const getFormulaComputeDiagnostics = resolveFormulaComputeDiagnosticsCapability(rowModel)

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
      const computeStageDiagnostics = getFormulaComputeDiagnostics?.getFormulaComputeStageDiagnostics() ?? null
      return {
        executionPlan: executionPlan ? cloneFormulaExecutionPlanSnapshot(executionPlan) : null,
        projectionFormula: snapshot.projection?.formula
          ? cloneProjectionFormulaDiagnostics(snapshot.projection.formula)
          : null,
        computeStage: computeStageDiagnostics
          ? cloneFormulaComputeStageDiagnostics(computeStageDiagnostics)
          : null,
      }
    },
  }
}
