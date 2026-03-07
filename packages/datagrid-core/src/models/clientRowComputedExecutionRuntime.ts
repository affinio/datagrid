import type {
  DataGridComputedDependencyToken,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldComputeContext,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaIterativeCalculationOptions,
  DataGridProjectionFormulaDiagnostics,
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"
import type { DataGridCompiledFormulaField } from "./formulaEngine.js"
import type { DataGridFormulaRuntimeErrorsCollector } from "./clientRowFormulaDiagnosticsRuntime.js"
import type { DataGridFormulaExecutionPlan } from "./formulaExecutionPlan.js"
import { createDataGridComputedDirtyPropagationRuntime } from "./clientRowComputedExecutionDirtyPropagationRuntime.js"
import { createDataGridComputedExecutionExecutorRuntime } from "./clientRowComputedExecutionExecutorRuntime.js"
import { createComputedExecutionDiagnostics } from "./clientRowComputedExecutionDiagnosticsRuntime.js"

export type ComputedDependencyDomain = "field" | "computed" | "meta"

export interface DataGridResolvedComputedDependency {
  token: DataGridComputedDependencyToken
  domain: ComputedDependencyDomain
  value: string
}

export interface DataGridRegisteredComputedField<T> {
  name: string
  field: string
  deps: readonly DataGridResolvedComputedDependency[]
  compute: DataGridComputedFieldDefinition<T>["compute"]
  computeBatch?: DataGridCompiledFormulaField<T>["computeBatch"]
  computeBatchColumnar?: DataGridCompiledFormulaField<T>["computeBatchColumnar"]
  dependencyReaders?: readonly DataGridComputedTokenReader<T>[]
  dependencyReaderByToken?: ReadonlyMap<DataGridComputedDependencyToken, DataGridComputedTokenReader<T>>
}

export interface DataGridRegisteredFormulaField {
  name: string
  field: string
  formula: string
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
}

export interface ApplyComputedFieldsToSourceRowsOptions {
  rowIds?: ReadonlySet<DataGridRowId>
  changedFieldsByRowId?: ReadonlyMap<DataGridRowId, ReadonlySet<string>>
  changedContextKeys?: ReadonlySet<string>
  captureRowPatchMaps?: boolean
}

export interface ApplyComputedFieldsToSourceRowsResult<T> {
  changed: boolean
  changedRowIds: readonly DataGridRowId[]
  computedUpdatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>
  previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  formulaDiagnostics: DataGridProjectionFormulaDiagnostics
  computeStageDiagnostics: DataGridFormulaComputeStageDiagnostics
}

export interface DataGridComputedColumnReadContext<T> {
  readFieldAtRow: (
    field: string,
    rowIndex: number,
    rowNode: DataGridRowNode<T>,
  ) => unknown
}

export type DataGridComputedTokenReader<T> = (
  rowNode: DataGridRowNode<T>,
  rowIndex?: number,
  columnReadContext?: DataGridComputedColumnReadContext<T>,
) => unknown

export interface DataGridClientComputedExecutionRuntimeContext<T> {
  vectorBatchSize?: number
  isRecord: (value: unknown) => value is Record<string, unknown>
  isColumnCacheParityVerificationEnabled: () => boolean

  getSourceRows: () => readonly DataGridRowNode<T>[]
  setSourceRows: (rows: DataGridRowNode<T>[]) => void
  resolveRowFieldReader: (fieldInput: string) => ((rowNode: DataGridRowNode<T>) => unknown)

  getComputedExecutionPlan: () => DataGridFormulaExecutionPlan
  getComputedOrder: () => readonly string[]
  getComputedEntryByIndex: () => readonly DataGridRegisteredComputedField<T>[]
  getComputedFieldReaderByIndex: () => readonly ((rowNode: DataGridRowNode<T>) => unknown)[]
  getComputedLevelIndexes: () => readonly (readonly number[])[]
  getComputedDependentsByIndex: () => readonly (readonly number[])[]
  getFormulaIterativeCalculationOptions: () => DataGridFormulaIterativeCalculationOptions | null
  getFormulaFieldsByName: () => ReadonlyMap<string, DataGridRegisteredFormulaField>
  getFormulaCompileCacheDiagnostics: () => NonNullable<DataGridProjectionFormulaDiagnostics["compileCache"]>

  resolveComputedRootIndexes: (changedFields: ReadonlySet<string>) => readonly number[]
  resolveComputedRootIndexesForField: (changedField: string) => readonly number[]
  resolveComputedRootIndexesForContext: (contextKey: string) => readonly number[]
  resolveComputedRootIndexesForContextKeys: (contextKeys: ReadonlySet<string>) => readonly number[]
  resolveComputedTokenValue: (
    rowNode: DataGridRowNode<T>,
    token: DataGridComputedDependencyToken,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ) => unknown

  getSourceColumnValues: (fieldInput: string) => unknown[]
  clearSourceColumnValuesCache: () => void

  createEmptyFormulaDiagnostics: () => DataGridProjectionFormulaDiagnostics
  createEmptyFormulaComputeStageDiagnostics: () => DataGridFormulaComputeStageDiagnostics

  withRuntimeErrorsCollector: <TResult>(collector: DataGridFormulaRuntimeErrorsCollector, run: () => TResult) => TResult
}

export interface DataGridClientComputedExecutionRuntime<T> {
  applyComputedFieldsToSourceRows: (
    options?: ApplyComputedFieldsToSourceRowsOptions,
  ) => ApplyComputedFieldsToSourceRowsResult<T>
}

export function createClientRowComputedExecutionRuntime<T>(
  context: DataGridClientComputedExecutionRuntimeContext<T>,
): DataGridClientComputedExecutionRuntime<T> {
  const vectorBatchSize = Math.max(1, Math.trunc(context.vectorBatchSize ?? 1024))
  const resolveIterativeCalculationOptions = (): Required<DataGridFormulaIterativeCalculationOptions> => {
    const options = context.getFormulaIterativeCalculationOptions() ?? null
    const maxIterations = Math.max(1, Math.trunc(options?.maxIterations ?? 16))
    const epsilon = typeof options?.epsilon === "number" && Number.isFinite(options.epsilon) && options.epsilon >= 0
      ? options.epsilon
      : 1e-9
    return {
      maxIterations,
      epsilon,
    }
  }
  const valuesDiffer = (left: unknown, right: unknown, epsilon: number): boolean => {
    if (Object.is(left, right)) {
      return false
    }
    if (
      typeof left === "number"
      && typeof right === "number"
      && Number.isFinite(left)
      && Number.isFinite(right)
    ) {
      return Math.abs(left - right) > epsilon
    }
    return true
  }

  const applyComputedFieldsToSourceRows = (
    options: ApplyComputedFieldsToSourceRowsOptions = {},
  ): ApplyComputedFieldsToSourceRowsResult<T> => {
    const computedOrder = context.getComputedOrder()
    if (computedOrder.length === 0 || context.getSourceRows().length === 0) {
      return {
        changed: false,
        changedRowIds: [],
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<T>>(),
        previousRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        nextRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        formulaDiagnostics: context.createEmptyFormulaDiagnostics(),
        computeStageDiagnostics: context.createEmptyFormulaComputeStageDiagnostics(),
      }
    }

    const sourceRowsBaseline = context.getSourceRows()
    const captureRowPatchMaps = options.captureRowPatchMaps === true
    const rowCount = sourceRowsBaseline.length
    const rowIds = options.rowIds
    const hasExplicitChangedFields = Boolean(options.changedFieldsByRowId)
    const normalizedChangedContextKeys = Array.from(options.changedContextKeys ?? [])
      .map(key => key.trim())
      .filter(key => key.length > 0)
    const hasExplicitChangedContexts = normalizedChangedContextKeys.length > 0
    const selectedRowIndexes: number[] = []
    const nodeCount = computedOrder.length
    const dirtyRuntime = createDataGridComputedDirtyPropagationRuntime(nodeCount, rowCount)

    const rootIndexesByContextKey = new Map<string, readonly number[]>()
    if (hasExplicitChangedContexts) {
      for (const contextKey of normalizedChangedContextKeys) {
        rootIndexesByContextKey.set(contextKey, context.resolveComputedRootIndexesForContext(contextKey))
      }
    }

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = sourceRowsBaseline[rowIndex]
      if (!row) {
        continue
      }
      if (rowIds && !rowIds.has(row.rowId)) {
        continue
      }
      if (!context.isRecord(row.data)) {
        continue
      }

      if (!hasExplicitChangedFields && !hasExplicitChangedContexts) {
        selectedRowIndexes.push(rowIndex)
        continue
      }

      let selected = false
      const seenRootIndexes = new Set<number>()

      if (hasExplicitChangedContexts) {
        for (const contextKey of normalizedChangedContextKeys) {
          const rootIndexesForContext = rootIndexesByContextKey.get(contextKey) ?? []
          if (rootIndexesForContext.length === 0) {
            continue
          }
          selected = true
          for (const nodeIndex of rootIndexesForContext) {
            if (!seenRootIndexes.has(nodeIndex)) {
              seenRootIndexes.add(nodeIndex)
              dirtyRuntime.enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
            }
            dirtyRuntime.incrementCauseCount(dirtyRuntime.dirtyContextCauseCountsByNode, nodeIndex, contextKey)
          }
        }
      }

      if (!hasExplicitChangedFields) {
        if (selected) {
          selectedRowIndexes.push(rowIndex)
        }
        continue
      }

      const rawChangedFields = options.changedFieldsByRowId?.get(row.rowId) ?? null
      if (!rawChangedFields || rawChangedFields.size === 0) {
        if (selected) {
          selectedRowIndexes.push(rowIndex)
        }
        continue
      }
      const normalizedChangedFields = new Set<string>()
      for (const field of rawChangedFields) {
        const normalized = field.trim()
        if (normalized.length > 0) {
          normalizedChangedFields.add(normalized)
        }
      }
      if (normalizedChangedFields.size === 0) {
        if (selected) {
          selectedRowIndexes.push(rowIndex)
        }
        continue
      }
      const rootOrderIndexes = context.resolveComputedRootIndexes(normalizedChangedFields)
      if (rootOrderIndexes.length === 0) {
        if (selected) {
          selectedRowIndexes.push(rowIndex)
        }
        continue
      }

      selected = true
      for (const field of normalizedChangedFields) {
        const rootIndexesForField = context.resolveComputedRootIndexesForField(field)
        for (const nodeIndex of rootIndexesForField) {
          if (!seenRootIndexes.has(nodeIndex)) {
            seenRootIndexes.add(nodeIndex)
              dirtyRuntime.enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
          }
          dirtyRuntime.incrementCauseCount(dirtyRuntime.dirtyFieldCauseCountsByNode, nodeIndex, field)
        }
      }
      if (selected) {
        selectedRowIndexes.push(rowIndex)
      }
    }

    if (selectedRowIndexes.length === 0) {
      return {
        changed: false,
        changedRowIds: [],
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<T>>(),
        previousRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        nextRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        formulaDiagnostics: context.createEmptyFormulaDiagnostics(),
        computeStageDiagnostics: context.createEmptyFormulaComputeStageDiagnostics(),
      }
    }

    const computedExecutionPlan = context.getComputedExecutionPlan()
    const iterativeCalculation = resolveIterativeCalculationOptions()
    const levelsToRun = context.getComputedLevelIndexes()

    if (levelsToRun.length === 0) {
      return {
        changed: false,
        changedRowIds: [],
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<T>>(),
        previousRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        nextRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        formulaDiagnostics: context.createEmptyFormulaDiagnostics(),
        computeStageDiagnostics: context.createEmptyFormulaComputeStageDiagnostics(),
      }
    }

    const computedEntryByIndex = context.getComputedEntryByIndex()
    const computedFieldReaderByIndex = context.getComputedFieldReaderByIndex()
    const computedDependentsByIndex = context.getComputedDependentsByIndex()
    const formulaFieldsByName = context.getFormulaFieldsByName()
    const iterativeIterationCountByNode = new Uint32Array(nodeCount)
    const iterativeConvergenceStateByNode = new Uint8Array(nodeCount)
    const executorRuntime = createDataGridComputedExecutionExecutorRuntime({
      context,
      vectorBatchSize,
      captureRowPatchMaps,
      rowCount,
      nodeCount,
      sourceRowsBaseline,
      computedDependentsByIndex,
      formulaFieldsByName,
      valuesDiffer: (left, right) => valuesDiffer(left, right, iterativeCalculation.epsilon),
    })

    if (!hasExplicitChangedFields && !hasExplicitChangedContexts) {
      for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
        dirtyRuntime.dirtyAllRowsByNode[nodeIndex] = selectedRowIndexes.length
        for (const rowIndex of selectedRowIndexes) {
          dirtyRuntime.enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
        }
      }
    }
    context.withRuntimeErrorsCollector(executorRuntime.formulaRuntimeErrorsCollector, () => {
      for (const level of levelsToRun) {
        const levelNodeIndexSet = new Set(level)
        const iterativeNodeIndexes = level.filter((nodeIndex) => {
          const computedName = computedOrder[nodeIndex]
          if (typeof computedName !== "string") {
            return false
          }
          return computedExecutionPlan.nodes.get(computedName)?.iterative === true
        })
        let levelIterationCount = 0
        let levelConverged = true

        while (true) {
          levelIterationCount += 1
          let queuedSameLevelWork = false

          for (const nodeIndex of level) {
            const computedName = computedOrder[nodeIndex]
            const computed = computedEntryByIndex[nodeIndex]
            const readComputedField = computedFieldReaderByIndex[nodeIndex]
            if (!computedName || !computed || !readComputedField) {
              continue
            }
            if (executorRuntime.executeNode(dirtyRuntime, {
              nodeIndex,
              computedName,
              computed,
              readComputedField,
              levelNodeIndexSet,
            })) {
              queuedSameLevelWork = true
            }
          }

          executorRuntime.flushLevelPatches()
          executorRuntime.flushQueuedDependents(dirtyRuntime)

          if (iterativeNodeIndexes.length === 0) {
            break
          }

          if (!queuedSameLevelWork) {
            break
          }

          if (levelIterationCount >= iterativeCalculation.maxIterations) {
            levelConverged = false
            for (const nodeIndex of level) {
              if (!levelNodeIndexSet.has(nodeIndex)) {
                continue
              }
              dirtyRuntime.dirtyRowIndexesByNode[nodeIndex] = undefined
            }
            break
          }
        }

        if (iterativeNodeIndexes.length > 0) {
          for (const nodeIndex of iterativeNodeIndexes) {
            iterativeIterationCountByNode[nodeIndex] = levelIterationCount
            iterativeConvergenceStateByNode[nodeIndex] = levelConverged ? 1 : 2
          }
        }
      }
    })
    const executionResult = executorRuntime.finalize()
    if (executionResult.nextSourceRows && executionResult.changedRowIds.length > 0) {
      context.setSourceRows(executionResult.nextSourceRows)
    }
    const diagnostics = createComputedExecutionDiagnostics({
      computedOrder,
      computedEntryByIndex,
      computedExecutionPlan,
      dirtyRuntime,
      iterativeIterationCountByNode,
      iterativeConvergenceStateByNode,
      executionResult,
      formulaCompileCacheDiagnostics: context.getFormulaCompileCacheDiagnostics(),
      formulaRuntimeErrorsCollector: executorRuntime.formulaRuntimeErrorsCollector,
    })

    return {
      changed: executionResult.changedRowIds.length > 0,
      changedRowIds: executionResult.changedRowIds,
      computedUpdatesByRowId: executionResult.computedUpdatesByRowId,
      previousRowsById: executionResult.previousRowsById,
      nextRowsById: executionResult.nextRowsById,
      formulaDiagnostics: diagnostics.formulaDiagnostics,
      computeStageDiagnostics: diagnostics.computeStageDiagnostics,
    }
  }

  return {
    applyComputedFieldsToSourceRows,
  }
}
