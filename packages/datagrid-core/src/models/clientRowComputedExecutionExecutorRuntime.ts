import type {
  DataGridComputedDependencyToken,
  DataGridComputedFieldComputeContext,
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"
import { applyRowDataPatch } from "./clientRowRuntimeUtils.js"
import type { DataGridFormulaRuntimeErrorsCollector } from "./clientRowFormulaDiagnosticsRuntime.js"
import type {
  DataGridClientComputedExecutionRuntimeContext,
  DataGridComputedColumnReadContext,
  DataGridRegisteredComputedField,
  DataGridRegisteredFormulaField,
  DataGridComputedTokenReader,
} from "./clientRowComputedExecutionRuntime.js"
import type { DataGridComputedDirtyPropagationRuntime } from "./clientRowComputedExecutionDirtyPropagationRuntime.js"

export interface DataGridComputedExecutionFinalizeResult<T> {
  changedRowIds: readonly DataGridRowId[]
  computedUpdatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>
  previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  nextSourceRows: DataGridRowNode<T>[] | null
  touchedRowsCount: number
  touchedComputedFields: ReadonlySet<string>
  recomputedFormulaFieldNames: ReadonlySet<string>
  computeEvaluationCount: number
  skippedByObjectIs: number
  effectiveRuntimeStrategy: "row" | "column-cache"
}

export interface DataGridComputedExecutorRuntime<T> {
  formulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector
  executeNode: (dirtyRuntime: DataGridComputedDirtyPropagationRuntime, options: {
    nodeIndex: number
    computedName: string
    computed: DataGridRegisteredComputedField<T>
    readComputedField: (rowNode: DataGridRowNode<T>) => unknown
    levelNodeIndexSet: ReadonlySet<number>
  }) => boolean
  flushLevelPatches: () => void
  flushQueuedDependents: (dirtyRuntime: DataGridComputedDirtyPropagationRuntime) => void
  finalize: () => DataGridComputedExecutionFinalizeResult<T>
}

export function createDataGridComputedExecutionExecutorRuntime<T>(options: {
  context: DataGridClientComputedExecutionRuntimeContext<T>
  vectorBatchSize: number
  captureRowPatchMaps: boolean
  rowCount: number
  nodeCount: number
  sourceRowsBaseline: readonly DataGridRowNode<T>[]
  computedDependentsByIndex: readonly (readonly number[])[]
  formulaFieldsByName: ReadonlyMap<string, DataGridRegisteredFormulaField>
  valuesDiffer: (left: unknown, right: unknown) => boolean
}) : DataGridComputedExecutorRuntime<T> {
  const {
    context,
    vectorBatchSize,
    captureRowPatchMaps,
    rowCount,
    nodeCount,
    sourceRowsBaseline,
    computedDependentsByIndex,
    formulaFieldsByName,
    valuesDiffer,
  } = options

  let nextSourceRows: DataGridRowNode<T>[] | null = null
  const changedRowMarks = new Uint8Array(rowCount)
  const touchedRowMarks = new Uint8Array(rowCount)
  const changedRowIndexes: number[] = []
  let touchedRowsCount = 0
  const computedPatchByRowIndex = captureRowPatchMaps
    ? new Map<number, Record<string, unknown>>()
    : null
  const previousRowByIndex = captureRowPatchMaps
    ? new Map<number, DataGridRowNode<T>>()
    : null
  const nextRowByIndex = captureRowPatchMaps
    ? new Map<number, DataGridRowNode<T>>()
    : null
  const workingRowByIndex = new Array<DataGridRowNode<T> | undefined>(rowCount)
  const nodeVisitMarks = new Int32Array(rowCount)
  let nodeVisitEpoch = 0
  const recomputedFormulaFieldNames = new Set<string>()
  const touchedComputedFields = new Set<string>()
  const formulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector = {
    runtimeErrorCount: 0,
    runtimeErrors: [],
  }
  let computeEvaluationCount = 0
  let skippedByObjectIs = 0
  let activeComputeRowNode: DataGridRowNode<T> | null = null
  let activeComputeRowIndex = -1
  let activeComputeDependencyReaderByToken: ReadonlyMap<
    DataGridComputedDependencyToken,
    DataGridComputedTokenReader<T>
  > | null = null
  let effectiveRuntimeStrategy: "row" | "column-cache" = "column-cache"
  let forceRowReadFallback = false
  const verifyColumnCacheParity = context.isColumnCacheParityVerificationEnabled()
  const getColumnValuesForField = (fieldInput: string): unknown[] => {
    return context.getSourceColumnValues(fieldInput)
  }
  const columnReadContext: DataGridComputedColumnReadContext<T> = {
    readFieldAtRow: (field, rowIndex, rowNode) => {
      const values = getColumnValuesForField(field)
      const readFieldDirect = context.resolveRowFieldReader(field)
      if (forceRowReadFallback) {
        const directValue = readFieldDirect(rowNode)
        values[rowIndex] = directValue
        return directValue
      }
      if (rowIndex in values) {
        if (verifyColumnCacheParity) {
          const directValue = readFieldDirect(rowNode)
          if (!Object.is(directValue, values[rowIndex])) {
            context.clearSourceColumnValuesCache()
            forceRowReadFallback = true
            effectiveRuntimeStrategy = "row"
            const fallbackValues = getColumnValuesForField(field)
            fallbackValues[rowIndex] = directValue
            return directValue
          }
        }
        return values[rowIndex]
      }
      const value = readFieldDirect(rowNode)
      values[rowIndex] = value
      return value
    },
  }
  const writeFieldAtRow = (field: string, rowIndex: number, value: unknown): void => {
    const values = getColumnValuesForField(field)
    values[rowIndex] = value
  }
  const nextNodeVisitEpoch = (): number => {
    nodeVisitEpoch += 1
    if (nodeVisitEpoch >= 2_000_000_000) {
      nodeVisitMarks.fill(0)
      nodeVisitEpoch = 1
    }
    return nodeVisitEpoch
  }
  const reusableComputeContext = {
    row: undefined as T,
    rowId: 0 as DataGridRowId,
    sourceIndex: 0,
    get: (token: DataGridComputedDependencyToken) => {
      if (!activeComputeRowNode) {
        return undefined
      }
      if (typeof token === "string" && activeComputeDependencyReaderByToken) {
        const dependencyReader = activeComputeDependencyReaderByToken.get(token)
        if (dependencyReader) {
          return dependencyReader(
            activeComputeRowNode,
            activeComputeRowIndex,
            columnReadContext,
          )
        }
      }
      return context.resolveComputedTokenValue(
        activeComputeRowNode,
        token,
        activeComputeRowIndex,
        columnReadContext,
      )
    },
  } satisfies DataGridComputedFieldComputeContext<T>
  const nextDirtyRowIndexesByNode = new Array<number[] | undefined>(nodeCount)
  const levelPatchByRowIndex = new Map<number, Record<string, unknown>>()
  const levelPatchedRowIndexes: number[] = []
  const nextDirtyNodeIndexes: number[] = []

  const executeNodeWithDirtyRuntime = (
    dirtyRuntime: DataGridComputedDirtyPropagationRuntime,
    optionsForNode: {
      nodeIndex: number
      computedName: string
      computed: DataGridRegisteredComputedField<T>
      readComputedField: (rowNode: DataGridRowNode<T>) => unknown
      levelNodeIndexSet: ReadonlySet<number>
    },
  ): boolean => {
    const {
      nodeIndex,
      computedName,
      computed,
      readComputedField,
      levelNodeIndexSet,
    } = optionsForNode
    const nodeDirtyRowIndexes = dirtyRuntime.dirtyRowIndexesByNode[nodeIndex]
    if (!nodeDirtyRowIndexes || nodeDirtyRowIndexes.length === 0) {
      return false
    }
    dirtyRuntime.dirtyRowIndexesByNode[nodeIndex] = undefined
    const dependentIndexes = computedDependentsByIndex[nodeIndex] ?? []
    const dependencyReaders = computed.dependencyReaders ?? []
    const dependencyReaderByToken = computed.dependencyReaderByToken ?? null
    const canUseBatchCompute = typeof computed.computeBatch === "function"
    const canUseColumnarBatchCompute = typeof computed.computeBatchColumnar === "function"
    const visitEpoch = nextNodeVisitEpoch()
    let evaluatedAtLeastOnce = false
    let queuedSameLevelWork = false
    const previousColumnValues = getColumnValuesForField(computed.field)
    const applyComputedValueForRow = (
      rowIndex: number,
      workingRowNode: DataGridRowNode<T>,
      nextValue: unknown,
    ): void => {
      const previousValue = rowIndex in previousColumnValues
        ? previousColumnValues[rowIndex]
        : (() => {
            const value = readComputedField(workingRowNode)
            previousColumnValues[rowIndex] = value
            return value
          })()
      if (!valuesDiffer(nextValue, previousValue)) {
        skippedByObjectIs += 1
        return
      }
      touchedComputedFields.add(computed.field)

      if (computedPatchByRowIndex) {
        let rowPatch = computedPatchByRowIndex.get(rowIndex)
        if (!rowPatch) {
          rowPatch = {}
          computedPatchByRowIndex.set(rowIndex, rowPatch)
        }
        rowPatch[computed.field] = nextValue
      }

      let levelPatch = levelPatchByRowIndex.get(rowIndex)
      if (!levelPatch) {
        levelPatch = {}
        levelPatchByRowIndex.set(rowIndex, levelPatch)
        levelPatchedRowIndexes.push(rowIndex)
      }
      levelPatch[computed.field] = nextValue
      writeFieldAtRow(computed.field, rowIndex, nextValue)

      for (const dependentIndex of dependentIndexes) {
        let dependentDirtyRows = nextDirtyRowIndexesByNode[dependentIndex]
        if (!dependentDirtyRows) {
          dependentDirtyRows = []
          nextDirtyRowIndexesByNode[dependentIndex] = dependentDirtyRows
          nextDirtyNodeIndexes.push(dependentIndex)
        }
        dependentDirtyRows.push(rowIndex)
        dirtyRuntime.markDirtyRowForNode(dependentIndex, rowIndex)
        dirtyRuntime.incrementCauseCount(dirtyRuntime.dirtyComputedCauseCountsByNode, dependentIndex, computedName)
        dirtyRuntime.markDirtyNode(dependentIndex)
        dirtyRuntime.markDirtyRow(rowIndex)
        if (levelNodeIndexSet.has(dependentIndex)) {
          queuedSameLevelWork = true
        }
      }
    }

    const batchRowIndexes: number[] = []
    const batchRowNodes: DataGridRowNode<T>[] = []
    const batchContexts: Array<{ row: T; rowId: DataGridRowId; sourceIndex: number }> = []
    let reusableTokenColumns: Array<unknown[]> | null = null

    for (
      let batchStart = 0;
      batchStart < nodeDirtyRowIndexes.length;
      batchStart += vectorBatchSize
    ) {
      const batchEnd = Math.min(nodeDirtyRowIndexes.length, batchStart + vectorBatchSize)
      batchRowIndexes.length = 0
      batchRowNodes.length = 0
      batchContexts.length = 0

      for (let rowCursor = batchStart; rowCursor < batchEnd; rowCursor += 1) {
        const rowIndex = nodeDirtyRowIndexes[rowCursor]
        if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= rowCount) {
          continue
        }
        if (nodeVisitMarks[rowIndex] === visitEpoch) {
          continue
        }
        nodeVisitMarks[rowIndex] = visitEpoch
        const sourceRow = sourceRowsBaseline[rowIndex]
        if (!sourceRow || !context.isRecord(sourceRow.data)) {
          continue
        }

        const workingRowNode = workingRowByIndex[rowIndex] ?? sourceRow
        evaluatedAtLeastOnce = true
        if (touchedRowMarks[rowIndex] === 0) {
          touchedRowMarks[rowIndex] = 1
          touchedRowsCount += 1
        }
        batchRowIndexes.push(rowIndex)
        batchRowNodes.push(workingRowNode)
        batchContexts.push({
          row: workingRowNode.row,
          rowId: workingRowNode.rowId,
          sourceIndex: workingRowNode.sourceIndex,
        })
      }

      if (batchRowIndexes.length === 0) {
        continue
      }

      computeEvaluationCount += batchRowIndexes.length
      dirtyRuntime.evaluationCountByNode[nodeIndex] = (dirtyRuntime.evaluationCountByNode[nodeIndex] ?? 0) + batchRowIndexes.length

      if (canUseColumnarBatchCompute || canUseBatchCompute) {
        let batchValues: readonly unknown[] = []
        if (canUseColumnarBatchCompute) {
          if (!reusableTokenColumns || reusableTokenColumns.length !== computed.deps.length) {
            reusableTokenColumns = computed.deps.map(() => [])
          }
          for (let tokenIndex = 0; tokenIndex < computed.deps.length; tokenIndex += 1) {
            const dependency = computed.deps[tokenIndex]
            if (!dependency) {
              continue
            }
            let tokenColumn = reusableTokenColumns[tokenIndex]
            if (!tokenColumn) {
              tokenColumn = []
              reusableTokenColumns[tokenIndex] = tokenColumn
            }
            tokenColumn.length = batchRowIndexes.length
            for (let contextIndex = 0; contextIndex < batchRowIndexes.length; contextIndex += 1) {
              const rowIndex = batchRowIndexes[contextIndex]
              const rowNode = batchRowNodes[contextIndex]
              if (typeof rowIndex !== "number" || !rowNode) {
                tokenColumn[contextIndex] = undefined
                continue
              }
              const dependencyReader = dependencyReaders[tokenIndex]
              tokenColumn[contextIndex] = dependencyReader
                ? dependencyReader(rowNode, rowIndex, columnReadContext)
                : context.resolveComputedTokenValue(
                    rowNode,
                    dependency.token,
                    rowIndex,
                    columnReadContext,
                  )
            }
          }
          batchValues = computed.computeBatchColumnar?.(
            batchContexts,
            reusableTokenColumns,
          ) ?? []
        } else {
          batchValues = computed.computeBatch?.(
            batchContexts,
            (contextIndex, tokenIndex) => {
              const rowIndex = batchRowIndexes[contextIndex]
              const rowNode = batchRowNodes[contextIndex]
              const dependency = computed.deps[tokenIndex]
              if (
                typeof rowIndex !== "number"
                || !rowNode
                || !dependency
              ) {
                return undefined
              }
              const dependencyReader = dependencyReaders[tokenIndex]
              return dependencyReader
                ? dependencyReader(rowNode, rowIndex, columnReadContext)
                : context.resolveComputedTokenValue(
                    rowNode,
                    dependency.token,
                    rowIndex,
                    columnReadContext,
                  )
            },
          ) ?? []
        }

        for (let contextIndex = 0; contextIndex < batchRowIndexes.length; contextIndex += 1) {
          const rowIndex = batchRowIndexes[contextIndex]
          const rowNode = batchRowNodes[contextIndex]
          if (typeof rowIndex !== "number" || !rowNode) {
            continue
          }
          const nextValue = contextIndex < batchValues.length
            ? batchValues[contextIndex]
            : 0
          applyComputedValueForRow(rowIndex, rowNode, nextValue)
        }
        continue
      }

      for (let contextIndex = 0; contextIndex < batchRowIndexes.length; contextIndex += 1) {
        const rowIndex = batchRowIndexes[contextIndex]
        const workingRowNode = batchRowNodes[contextIndex]
        if (typeof rowIndex !== "number" || !workingRowNode) {
          continue
        }
        activeComputeRowNode = workingRowNode
        activeComputeRowIndex = rowIndex
        activeComputeDependencyReaderByToken = dependencyReaderByToken
        reusableComputeContext.row = workingRowNode.row
        reusableComputeContext.rowId = workingRowNode.rowId
        reusableComputeContext.sourceIndex = workingRowNode.sourceIndex
        let nextValue: unknown
        try {
          nextValue = computed.compute(reusableComputeContext)
        } finally {
          activeComputeRowNode = null
          activeComputeRowIndex = -1
          activeComputeDependencyReaderByToken = null
        }
        applyComputedValueForRow(rowIndex, workingRowNode, nextValue)
      }
    }

    if (evaluatedAtLeastOnce && formulaFieldsByName.has(computedName)) {
      recomputedFormulaFieldNames.add(computedName)
    }

    return queuedSameLevelWork
  }

  const flushLevelPatches = (): void => {
    if (levelPatchedRowIndexes.length === 0) {
      return
    }
    for (const rowIndex of levelPatchedRowIndexes) {
      const levelPatch = levelPatchByRowIndex.get(rowIndex)
      if (!levelPatch) {
        continue
      }
      const sourceRow = sourceRowsBaseline[rowIndex]
      if (!sourceRow) {
        continue
      }
      const workingRowNode = workingRowByIndex[rowIndex] ?? sourceRow
      const nextData = applyRowDataPatch(
        workingRowNode.data,
        levelPatch as Partial<T>,
      )
      if (nextData === workingRowNode.data) {
        levelPatchByRowIndex.delete(rowIndex)
        continue
      }
      const nextRowNode: DataGridRowNode<T> = {
        ...workingRowNode,
        data: nextData,
        row: nextData,
      }
      workingRowByIndex[rowIndex] = nextRowNode
      if (!nextSourceRows) {
        nextSourceRows = sourceRowsBaseline.slice()
      }
      nextSourceRows[rowIndex] = nextRowNode
      if (previousRowByIndex && nextRowByIndex) {
        if (!previousRowByIndex.has(rowIndex)) {
          previousRowByIndex.set(rowIndex, sourceRow)
        }
        nextRowByIndex.set(rowIndex, nextRowNode)
      }
      if (changedRowMarks[rowIndex] === 0) {
        changedRowMarks[rowIndex] = 1
        changedRowIndexes.push(rowIndex)
      }
      levelPatchByRowIndex.delete(rowIndex)
    }
    levelPatchedRowIndexes.length = 0
  }

  const flushQueuedDependents = (dirtyRuntime: DataGridComputedDirtyPropagationRuntime): void => {
    for (const nodeIndex of nextDirtyNodeIndexes) {
      const dependentRows = nextDirtyRowIndexesByNode[nodeIndex]
      if (!dependentRows || dependentRows.length === 0) {
        nextDirtyRowIndexesByNode[nodeIndex] = undefined
        continue
      }
      const queued = dirtyRuntime.dirtyRowIndexesByNode[nodeIndex]
      if (!queued) {
        dirtyRuntime.dirtyRowIndexesByNode[nodeIndex] = dependentRows
      } else {
        queued.push(...dependentRows)
      }
      nextDirtyRowIndexesByNode[nodeIndex] = undefined
    }
    nextDirtyNodeIndexes.length = 0
  }

  const finalize = (): DataGridComputedExecutionFinalizeResult<T> => {
    const changedRowIds: DataGridRowId[] = []
    for (const rowIndex of changedRowIndexes) {
      const rowNode = sourceRowsBaseline[rowIndex]
      if (!rowNode) {
        continue
      }
      changedRowIds.push(rowNode.rowId)
    }

    const computedUpdatesByRowId = new Map<DataGridRowId, Partial<T>>()
    const previousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    const nextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()

    if (captureRowPatchMaps && computedPatchByRowIndex && previousRowByIndex && nextRowByIndex) {
      for (const rowIndex of changedRowIndexes) {
        const rowNode = sourceRowsBaseline[rowIndex]
        if (!rowNode) {
          continue
        }
        const rowId = rowNode.rowId
        const computedPatch = computedPatchByRowIndex.get(rowIndex)
        if (computedPatch) {
          computedUpdatesByRowId.set(rowId, computedPatch as Partial<T>)
        }
        const previousRow = previousRowByIndex.get(rowIndex)
        if (previousRow) {
          previousRowsById.set(rowId, previousRow)
        }
        const nextRow = nextRowByIndex.get(rowIndex)
        if (nextRow) {
          nextRowsById.set(rowId, nextRow)
        }
      }
    }

    return {
      changedRowIds,
      computedUpdatesByRowId,
      previousRowsById,
      nextRowsById,
      nextSourceRows,
      touchedRowsCount,
      touchedComputedFields,
      recomputedFormulaFieldNames,
      computeEvaluationCount,
      skippedByObjectIs,
      effectiveRuntimeStrategy,
    }
  }

  return {
    formulaRuntimeErrorsCollector,
    executeNode: executeNodeWithDirtyRuntime,
    flushLevelPatches,
    flushQueuedDependents,
    finalize,
  }
}
