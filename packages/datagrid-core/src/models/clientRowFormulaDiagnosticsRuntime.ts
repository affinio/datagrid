import type {
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaRuntimeError,
  DataGridProjectionFormulaDiagnostics,
} from "./rowModel.js"

export interface DataGridFormulaRuntimeErrorsCollector {
  runtimeErrorCount: number
  runtimeErrors: DataGridFormulaRuntimeError[]
}

export interface ClientRowFormulaDiagnosticsRuntimeContext {
  hasFormulaFields: () => boolean
  hasComputedFields: () => boolean
  setProjectionFormulaDiagnostics: (diagnostics: DataGridProjectionFormulaDiagnostics | null) => void
  runtimeErrorsPreviewLimit?: number
}

export interface ClientRowFormulaDiagnosticsRuntime {
  createEmptyFormulaDiagnostics: () => DataGridProjectionFormulaDiagnostics
  createEmptyFormulaComputeStageDiagnostics: () => DataGridFormulaComputeStageDiagnostics
  pushFormulaRuntimeError: (runtimeError: DataGridFormulaRuntimeError) => void
  commitFormulaDiagnostics: (diagnostics: DataGridProjectionFormulaDiagnostics) => void
  commitFormulaComputeStageDiagnostics: (diagnostics: DataGridFormulaComputeStageDiagnostics) => void
  getFormulaComputeStageDiagnosticsSnapshot: () => DataGridFormulaComputeStageDiagnostics | null
  withRuntimeErrorsCollector: <TResult>(collector: DataGridFormulaRuntimeErrorsCollector, run: () => TResult) => TResult
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

export function createClientRowFormulaDiagnosticsRuntime(
  context: ClientRowFormulaDiagnosticsRuntimeContext,
): ClientRowFormulaDiagnosticsRuntime {
  const runtimeErrorsPreviewLimit = context.runtimeErrorsPreviewLimit ?? 50
  let activeFormulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector | null = null
  let latestFormulaComputeStageDiagnostics: DataGridFormulaComputeStageDiagnostics | null = null

  const createEmptyFormulaDiagnostics = (): DataGridProjectionFormulaDiagnostics => ({
    recomputedFields: [],
    runtimeErrorCount: 0,
    runtimeErrors: [],
  })

  const createEmptyFormulaComputeStageDiagnostics = (): DataGridFormulaComputeStageDiagnostics => ({
    strategy: "row",
    rowsTouched: 0,
    changedRows: 0,
    fieldsTouched: [],
    evaluations: 0,
    skippedByObjectIs: 0,
    dirtyRows: 0,
    dirtyNodes: [],
  })

  const pushFormulaRuntimeError = (runtimeError: DataGridFormulaRuntimeError): void => {
    if (!activeFormulaRuntimeErrorsCollector) {
      return
    }
    activeFormulaRuntimeErrorsCollector.runtimeErrorCount += 1
    if (activeFormulaRuntimeErrorsCollector.runtimeErrors.length >= runtimeErrorsPreviewLimit) {
      return
    }
    activeFormulaRuntimeErrorsCollector.runtimeErrors.push({ ...runtimeError })
  }

  const commitFormulaDiagnostics = (diagnostics: DataGridProjectionFormulaDiagnostics): void => {
    if (
      !context.hasFormulaFields()
      && diagnostics.recomputedFields.length === 0
      && diagnostics.runtimeErrorCount === 0
      && diagnostics.runtimeErrors.length === 0
    ) {
      context.setProjectionFormulaDiagnostics(null)
      return
    }
    context.setProjectionFormulaDiagnostics(diagnostics)
  }

  const commitFormulaComputeStageDiagnostics = (
    diagnostics: DataGridFormulaComputeStageDiagnostics,
  ): void => {
    latestFormulaComputeStageDiagnostics = context.hasComputedFields()
      ? cloneFormulaComputeStageDiagnostics(diagnostics)
      : null
  }

  const getFormulaComputeStageDiagnosticsSnapshot = (): DataGridFormulaComputeStageDiagnostics | null => {
    if (!latestFormulaComputeStageDiagnostics) {
      return null
    }
    return cloneFormulaComputeStageDiagnostics(latestFormulaComputeStageDiagnostics)
  }

  const withRuntimeErrorsCollector = <TResult>(
    collector: DataGridFormulaRuntimeErrorsCollector,
    run: () => TResult,
  ): TResult => {
    const previousCollector = activeFormulaRuntimeErrorsCollector
    activeFormulaRuntimeErrorsCollector = collector
    try {
      return run()
    } finally {
      activeFormulaRuntimeErrorsCollector = previousCollector
    }
  }

  return {
    createEmptyFormulaDiagnostics,
    createEmptyFormulaComputeStageDiagnostics,
    pushFormulaRuntimeError,
    commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics,
    getFormulaComputeStageDiagnosticsSnapshot,
    withRuntimeErrorsCollector,
  }
}
