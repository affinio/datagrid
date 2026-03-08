import type {
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaDirtyCause,
  DataGridFormulaDirtyRowCause,
  DataGridFormulaNodeComputeDiagnostics,
  DataGridProjectionFormulaDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridRowNode,
} from "./rowModel.js"
import type { DataGridFormulaExecutionPlan } from "@affino/datagrid-formula-engine"
import type { DataGridRegisteredComputedField } from "./clientRowComputedExecutionRuntime.js"
import type { DataGridComputedDirtyPropagationRuntime } from "./clientRowComputedExecutionDirtyPropagationRuntime.js"
import type { DataGridComputedExecutionFinalizeResult } from "./clientRowComputedExecutionExecutorRuntime.js"
import type { DataGridFormulaRuntimeErrorsCollector } from "./clientRowFormulaDiagnosticsRuntime.js"

export function createComputedExecutionDiagnostics<T>(options: {
  computedOrder: readonly string[]
  computedEntryByIndex: readonly DataGridRegisteredComputedField<T>[]
  computedExecutionPlan: DataGridFormulaExecutionPlan
  dirtyRuntime: DataGridComputedDirtyPropagationRuntime
  sourceRowsBaseline: readonly DataGridRowNode<T>[]
  iterativeIterationCountByNode: Uint32Array
  iterativeConvergenceStateByNode: Uint8Array
  executionResult: DataGridComputedExecutionFinalizeResult<T>
  formulaCompileCacheDiagnostics: NonNullable<DataGridProjectionFormulaDiagnostics["compileCache"]>
  formulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector
  includeRowRecomputeDiagnostics?: boolean
}): {
  formulaDiagnostics: DataGridProjectionFormulaDiagnostics
  computeStageDiagnostics: DataGridFormulaComputeStageDiagnostics
  rowRecomputeDiagnostics: DataGridFormulaRowRecomputeDiagnostics
} {
  const {
    computedOrder,
    computedEntryByIndex,
    computedExecutionPlan,
    dirtyRuntime,
    sourceRowsBaseline,
    iterativeIterationCountByNode,
    iterativeConvergenceStateByNode,
    executionResult,
    formulaCompileCacheDiagnostics,
    formulaRuntimeErrorsCollector,
    includeRowRecomputeDiagnostics = true,
  } = options

  const decodeRowCauseKey = (causeKey: string): DataGridFormulaDirtyRowCause => {
    const separatorIndex = causeKey.indexOf("\u001f")
    const kind = separatorIndex >= 0 ? causeKey.slice(0, separatorIndex) : causeKey
    const value = separatorIndex >= 0 ? causeKey.slice(separatorIndex + 1) : ""
    return {
      kind: kind === "field" || kind === "computed" || kind === "context" ? kind : "all",
      ...(value.length > 0 ? { value } : {}),
    }
  }

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
      ...(executionResult.nodeRuntimeModeByIndex[index]
        ? { runtimeMode: executionResult.nodeRuntimeModeByIndex[index] }
        : {}),
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

  const rowRecomputeDiagnostics: DataGridFormulaRowRecomputeDiagnostics = includeRowRecomputeDiagnostics
    ? (() => {
      const rowsByIndex = new Map<number, {
        rowId: DataGridRowNode<T>["rowId"]
        sourceIndex: number
        nodes: Array<{
          name: string
          field: string
          causes: readonly DataGridFormulaDirtyRowCause[]
        }>
      }>()
      for (let nodeIndex = 0; nodeIndex < computedOrder.length; nodeIndex += 1) {
        const name = computedOrder[nodeIndex]
        const computed = computedEntryByIndex[nodeIndex]
        const rowCauseKeys = dirtyRuntime.dirtyRowCauseKeysByNode[nodeIndex]
        if (!name || !computed || !rowCauseKeys || rowCauseKeys.size === 0) {
          continue
        }
        const orderedRowIndexes = Array.from(rowCauseKeys.keys()).sort((left, right) => left - right)
        for (const rowIndex of orderedRowIndexes) {
          const rowNode = sourceRowsBaseline[rowIndex]
          if (!rowNode) {
            continue
          }
          const rowEntry = rowsByIndex.get(rowIndex) ?? {
            rowId: rowNode.rowId,
            sourceIndex: rowNode.sourceIndex,
            nodes: [],
          }
          if (!rowsByIndex.has(rowIndex)) {
            rowsByIndex.set(rowIndex, rowEntry)
          }
          const causeKeys = rowCauseKeys.get(rowIndex)
          if (!causeKeys || causeKeys.size === 0) {
            continue
          }
          rowEntry.nodes.push({
            name,
            field: computed.field,
            causes: Array.from(causeKeys)
              .sort((left, right) => left.localeCompare(right))
              .map(decodeRowCauseKey),
          })
        }
      }

      return {
        rows: Array.from(rowsByIndex.entries())
          .sort((left, right) => left[0] - right[0])
          .map(([, row]) => ({
            rowId: row.rowId,
            sourceIndex: row.sourceIndex,
            nodes: row.nodes.sort((left, right) => left.name.localeCompare(right.name)),
          })),
      }
    })()
    : { rows: [] }

  return {
    formulaDiagnostics: {
      recomputedFields,
      runtimeErrorCount: formulaRuntimeErrorsCollector.runtimeErrorCount,
      runtimeErrors: formulaRuntimeErrorsCollector.runtimeErrors,
      compileCache: { ...formulaCompileCacheDiagnostics },
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
    rowRecomputeDiagnostics,
  }
}
