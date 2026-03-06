import type {
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaDirtyCause,
  DataGridFormulaNodeComputeDiagnostics,
  DataGridProjectionFormulaDiagnostics,
} from "./rowModel.js"
import type { DataGridFormulaExecutionPlan } from "./formulaExecutionPlan.js"
import type { DataGridRegisteredComputedField } from "./clientRowComputedExecutionRuntime.js"
import type { DataGridComputedDirtyPropagationRuntime } from "./clientRowComputedExecutionDirtyPropagationRuntime.js"
import type { DataGridComputedExecutionFinalizeResult } from "./clientRowComputedExecutionExecutorRuntime.js"
import type { DataGridFormulaRuntimeErrorsCollector } from "./clientRowFormulaDiagnosticsRuntime.js"

export function createComputedExecutionDiagnostics<T>(options: {
  computedOrder: readonly string[]
  computedEntryByIndex: readonly DataGridRegisteredComputedField<T>[]
  computedExecutionPlan: DataGridFormulaExecutionPlan
  dirtyRuntime: DataGridComputedDirtyPropagationRuntime
  iterativeIterationCountByNode: Uint32Array
  iterativeConvergenceStateByNode: Uint8Array
  executionResult: DataGridComputedExecutionFinalizeResult<T>
  formulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector
}): {
  formulaDiagnostics: DataGridProjectionFormulaDiagnostics
  computeStageDiagnostics: DataGridFormulaComputeStageDiagnostics
} {
  const {
    computedOrder,
    computedEntryByIndex,
    computedExecutionPlan,
    dirtyRuntime,
    iterativeIterationCountByNode,
    iterativeConvergenceStateByNode,
    executionResult,
    formulaRuntimeErrorsCollector,
  } = options

  const recomputedFields = computedOrder.filter(name => executionResult.recomputedFormulaFieldNames.has(name))
  const nodeCount = computedOrder.length
  const nodeDiagnostics: DataGridFormulaNodeComputeDiagnostics[] = computedOrder.map((name, index) => {
    const computed = computedEntryByIndex[index]
    const planNode = computedExecutionPlan.nodes.get(name)
    const dirtyCauses: DataGridFormulaDirtyCause[] = []
    const fullRecomputeRows = dirtyRuntime.dirtyAllRowsByNode[index] ?? 0
    if (fullRecomputeRows > 0) {
      dirtyCauses.push({ kind: "all", rows: fullRecomputeRows })
    }
    const fieldCauses = Array.from(dirtyRuntime.dirtyFieldCauseCountsByNode[index]?.entries() ?? [])
      .sort((left, right) => left[0].localeCompare(right[0]))
    for (const [value, rows] of fieldCauses) {
      dirtyCauses.push({ kind: "field", value, rows })
    }
    const contextCauses = Array.from(dirtyRuntime.dirtyContextCauseCountsByNode[index]?.entries() ?? [])
      .sort((left, right) => left[0].localeCompare(right[0]))
    for (const [value, rows] of contextCauses) {
      dirtyCauses.push({ kind: "context", value, rows })
    }
    const computedCauses = Array.from(dirtyRuntime.dirtyComputedCauseCountsByNode[index]?.entries() ?? [])
      .sort((left, right) => left[0].localeCompare(right[0]))
    for (const [value, rows] of computedCauses) {
      dirtyCauses.push({ kind: "computed", value, rows })
    }
    return {
      name,
      field: computed?.field ?? name,
      dirty: dirtyRuntime.dirtyNodeMarks[index] !== 0,
      touched: computed ? executionResult.touchedComputedFields.has(computed.field) : false,
      evaluations: dirtyRuntime.evaluationCountByNode[index] ?? 0,
      dirtyRows: dirtyRuntime.dirtyRowCountByNode[index] ?? 0,
      dirtyCauses,
      ...(planNode?.iterative
        ? {
          iterative: true,
          converged: iterativeConvergenceStateByNode[index] !== 2,
          iterationCount: iterativeIterationCountByNode[index] ?? 0,
          cycleGroup: planNode.cycleGroup,
        }
        : {}),
    }
  })

  return {
    formulaDiagnostics: {
      recomputedFields,
      runtimeErrorCount: formulaRuntimeErrorsCollector.runtimeErrorCount,
      runtimeErrors: formulaRuntimeErrorsCollector.runtimeErrors,
    },
    computeStageDiagnostics: {
      strategy: executionResult.effectiveRuntimeStrategy,
      rowsTouched: executionResult.touchedRowsCount,
      changedRows: executionResult.changedRowIds.length,
      fieldsTouched: Array.from(executionResult.touchedComputedFields).sort((left, right) => left.localeCompare(right)),
      evaluations: executionResult.computeEvaluationCount,
      skippedByObjectIs: executionResult.skippedByObjectIs,
      dirtyRows: dirtyRuntime.getDirtyRowsCount(),
      nodes: nodeDiagnostics,
      dirtyNodes: (() => {
        if (dirtyRuntime.getDirtyNodeCount() === 0) {
          return [] as string[]
        }
        const dirtyNodes: string[] = []
        for (let index = 0; index < nodeCount; index += 1) {
          if (dirtyRuntime.dirtyNodeMarks[index] === 0) {
            continue
          }
          const name = computedOrder[index]
          if (typeof name === "string") {
            dirtyNodes.push(name)
          }
        }
        dirtyNodes.sort((left, right) => left.localeCompare(right))
        return dirtyNodes
      })(),
    },
  }
}
