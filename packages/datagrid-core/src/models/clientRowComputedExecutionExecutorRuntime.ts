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
  nodeRuntimeModeByIndex: readonly ("row" | "batch" | "columnar-ast" | "columnar-jit" | "columnar-fused" | "columnar-vector" | undefined)[]
}

export interface DataGridComputedExecutorRuntime<T> {
  formulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector
  executeLevel: (dirtyRuntime: DataGridComputedDirtyPropagationRuntime, options: {
    levelNodeIndexes: readonly number[]
    levelNodeIndexSet: ReadonlySet<number>
    computedOrder: readonly string[]
    computedEntryByIndex: readonly DataGridRegisteredComputedField<T>[]
    computedFieldReaderByIndex: readonly ((rowNode: DataGridRowNode<T>) => unknown)[]
  }) => boolean
  finalize: () => DataGridComputedExecutionFinalizeResult<T>
}

interface DataGridPreparedComputedBatchInput<T> {
  rowIndexes: readonly number[]
  rowNodes: readonly DataGridRowNode<T>[]
  contexts: readonly ({
    row: T
    rowId: DataGridRowId
    sourceIndex: number
  })[]
  tokenColumns?: readonly (readonly unknown[])[]
}

interface DataGridScheduledNodeBatch<T> {
  nodeIndex: number
  computedName: string
  computed: DataGridRegisteredComputedField<T>
  readComputedField: (rowNode: DataGridRowNode<T>) => unknown
  batchDirtyRowIndexes: readonly number[]
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
  const nodeRuntimeModeByIndex = new Array<"row" | "batch" | "columnar-ast" | "columnar-jit" | "columnar-fused" | "columnar-vector" | undefined>(nodeCount)
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
  const sharedDependencySignatureByNodeIndex = new Array<string | null>(nodeCount)
  const levelPatchByRowIndex = new Map<number, Record<string, unknown>>()
  const levelPatchedRowIndexes: number[] = []
  const nextDirtyNodeIndexes: number[] = []
  const levelDirtyRowMarks = new Int32Array(rowCount)
  const levelDirtyRowBatchIndexByRow = new Int32Array(rowCount)
  let levelDirtyRowEpoch = 0

  const nextLevelDirtyRowEpoch = (): number => {
    levelDirtyRowEpoch += 1
    if (levelDirtyRowEpoch >= 2_000_000_000) {
      levelDirtyRowMarks.fill(0)
      levelDirtyRowEpoch = 1
    }
    return levelDirtyRowEpoch
  }

  const createSharedDependencySignature = (
    computed: DataGridRegisteredComputedField<T>,
  ): string | null => {
    const canUseBatchCompute = typeof computed.computeBatch === "function"
    const canUseColumnarBatchCompute = typeof computed.computeBatchColumnar === "function"
    if ((!canUseBatchCompute && !canUseColumnarBatchCompute) || computed.deps.length === 0) {
      return null
    }
    return computed.deps.map(dependency => dependency.token).join("\u001f")
  }

  const computedEntryByIndex = context.getComputedEntryByIndex()
  for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
    const computed = computedEntryByIndex[nodeIndex]
    sharedDependencySignatureByNodeIndex[nodeIndex] = computed
      ? createSharedDependencySignature(computed)
      : null
  }

  const createPreparedBatchInput = (
    rowIndexes: readonly number[],
  ): DataGridPreparedComputedBatchInput<T> => {
    const batchRowIndexes: number[] = []
    const batchRowNodes: DataGridRowNode<T>[] = []
    const batchContexts: Array<{ row: T; rowId: DataGridRowId; sourceIndex: number }> = []

    for (const rowIndex of rowIndexes) {
      if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= rowCount) {
        continue
      }
      const sourceRow = sourceRowsBaseline[rowIndex]
      if (!sourceRow || !context.isRecord(sourceRow.data)) {
        continue
      }
      const workingRowNode = workingRowByIndex[rowIndex] ?? sourceRow
      batchRowIndexes.push(rowIndex)
      batchRowNodes.push(workingRowNode)
      batchContexts.push({
        row: workingRowNode.row,
        rowId: workingRowNode.rowId,
        sourceIndex: workingRowNode.sourceIndex,
      })
    }

    return {
      rowIndexes: batchRowIndexes,
      rowNodes: batchRowNodes,
      contexts: batchContexts,
    }
  }

  const createPreparedTokenColumns = (
    computed: DataGridRegisteredComputedField<T>,
    dependencyReaders: readonly DataGridComputedTokenReader<T>[],
    preparedBatchInput: DataGridPreparedComputedBatchInput<T>,
  ): readonly unknown[][] => {
    const tokenColumns = computed.deps.map<unknown[]>(() => [])
    for (let tokenIndex = 0; tokenIndex < computed.deps.length; tokenIndex += 1) {
      const dependency = computed.deps[tokenIndex]
      const tokenColumn = tokenColumns[tokenIndex]
      if (!dependency) {
        continue
      }
      if (!tokenColumn) {
        continue
      }
      tokenColumn.length = preparedBatchInput.rowIndexes.length
      for (let contextIndex = 0; contextIndex < preparedBatchInput.rowIndexes.length; contextIndex += 1) {
        const rowIndex = preparedBatchInput.rowIndexes[contextIndex]
        const rowNode = preparedBatchInput.rowNodes[contextIndex]
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
    return tokenColumns
  }

  const createSubsetPreparedBatchInput = (
    sharedPreparedInput: DataGridPreparedComputedBatchInput<T>,
    sharedTokenColumns: readonly (readonly unknown[])[],
    rowIndexes: readonly number[],
  ): DataGridPreparedComputedBatchInput<T> => {
    const rowPositionByIndex = new Map<number, number>()
    for (let index = 0; index < sharedPreparedInput.rowIndexes.length; index += 1) {
      const rowIndex = sharedPreparedInput.rowIndexes[index]
      if (typeof rowIndex === "number") {
        rowPositionByIndex.set(rowIndex, index)
      }
    }

    const subsetRowIndexes: number[] = []
    const subsetRowNodes: DataGridRowNode<T>[] = []
    const subsetContexts: Array<{ row: T; rowId: DataGridRowId; sourceIndex: number }> = []
    const subsetTokenColumns = sharedTokenColumns.map<unknown[]>(() => [])
    for (const rowIndex of rowIndexes) {
      const rowPosition = rowPositionByIndex.get(rowIndex)
      if (typeof rowPosition !== "number") {
        continue
      }
      const rowNode = sharedPreparedInput.rowNodes[rowPosition]
      const rowContext = sharedPreparedInput.contexts[rowPosition]
      if (!rowNode || !rowContext) {
        continue
      }
      subsetRowIndexes.push(rowIndex)
      subsetRowNodes.push(rowNode)
      subsetContexts.push(rowContext)
      for (let tokenIndex = 0; tokenIndex < subsetTokenColumns.length; tokenIndex += 1) {
        subsetTokenColumns[tokenIndex]?.push(sharedTokenColumns[tokenIndex]?.[rowPosition])
      }
    }

    return {
      rowIndexes: subsetRowIndexes,
      rowNodes: subsetRowNodes,
      contexts: subsetContexts,
      tokenColumns: subsetTokenColumns,
    }
  }

  const executeNodeDirtyRows = (
    dirtyRuntime: DataGridComputedDirtyPropagationRuntime,
    optionsForNode: {
      nodeIndex: number
      computedName: string
      computed: DataGridRegisteredComputedField<T>
      readComputedField: (rowNode: DataGridRowNode<T>) => unknown
      levelNodeIndexSet: ReadonlySet<number>
      nodeDirtyRowIndexes: readonly number[]
      preparedBatchInput?: DataGridPreparedComputedBatchInput<T>
    },
  ): boolean => {
    const {
      nodeIndex,
      computedName,
      computed,
      readComputedField,
      levelNodeIndexSet,
      nodeDirtyRowIndexes,
      preparedBatchInput,
    } = optionsForNode
    if (!nodeDirtyRowIndexes || nodeDirtyRowIndexes.length === 0) {
      return false
    }
    const dependentIndexes = computedDependentsByIndex[nodeIndex] ?? []
    const dependencyReaders = computed.dependencyReaders ?? []
    const dependencyReaderByToken = computed.dependencyReaderByToken ?? null
    const canUseBatchCompute = typeof computed.computeBatch === "function"
    const canUseColumnarBatchCompute = typeof computed.computeBatchColumnar === "function"
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
        dirtyRuntime.recordDirtyCauseForNodeRow(dependentIndex, rowIndex, "computed", computedName)
        dirtyRuntime.markDirtyNode(dependentIndex)
        dirtyRuntime.markDirtyRow(rowIndex)
        if (levelNodeIndexSet.has(dependentIndex)) {
          queuedSameLevelWork = true
        }
      }
    }

    const batchInput = preparedBatchInput ?? createPreparedBatchInput(nodeDirtyRowIndexes)
    const batchRowIndexes = batchInput.rowIndexes
    const batchRowNodes = batchInput.rowNodes
    const batchContexts = batchInput.contexts

    if (batchRowIndexes.length === 0) {
      return false
    }

    evaluatedAtLeastOnce = true
    for (const rowIndex of batchRowIndexes) {
      if (touchedRowMarks[rowIndex] === 0) {
        touchedRowMarks[rowIndex] = 1
        touchedRowsCount += 1
      }
    }

    computeEvaluationCount += batchRowIndexes.length
    dirtyRuntime.evaluationCountByNode[nodeIndex] = (dirtyRuntime.evaluationCountByNode[nodeIndex] ?? 0) + batchRowIndexes.length

    if (canUseColumnarBatchCompute || canUseBatchCompute) {
      let batchValues: readonly unknown[] = []
      const preparedTokenColumns = batchInput.tokenColumns
      if (canUseColumnarBatchCompute) {
        nodeRuntimeModeByIndex[nodeIndex] = computed.batchExecutionMode ?? "columnar-ast"
        const reusableTokenColumns = preparedTokenColumns
          ?? createPreparedTokenColumns(computed, dependencyReaders, batchInput)
        batchValues = computed.computeBatchColumnar?.(
          batchContexts,
          reusableTokenColumns,
        ) ?? []
      } else {
        batchValues = computed.computeBatch?.(
          batchContexts,
          (contextIndex, tokenIndex) => {
            if (preparedTokenColumns) {
              return preparedTokenColumns[tokenIndex]?.[contextIndex]
            }
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
        nodeRuntimeModeByIndex[nodeIndex] = "batch"
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
    } else {
      for (let contextIndex = 0; contextIndex < batchRowIndexes.length; contextIndex += 1) {
        const rowIndex = batchRowIndexes[contextIndex]
        const workingRowNode = batchRowNodes[contextIndex]
        if (typeof rowIndex !== "number" || !workingRowNode) {
          continue
        }
        activeComputeRowNode = workingRowNode
        activeComputeRowIndex = rowIndex
        nodeRuntimeModeByIndex[nodeIndex] = "row"
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

  const executeLevel = (
    dirtyRuntime: DataGridComputedDirtyPropagationRuntime,
    levelOptions: {
      levelNodeIndexes: readonly number[]
      levelNodeIndexSet: ReadonlySet<number>
      computedOrder: readonly string[]
      computedEntryByIndex: readonly DataGridRegisteredComputedField<T>[]
      computedFieldReaderByIndex: readonly ((rowNode: DataGridRowNode<T>) => unknown)[]
    },
  ): boolean => {
    const {
      levelNodeIndexes,
      levelNodeIndexSet,
      computedOrder,
      computedEntryByIndex,
      computedFieldReaderByIndex,
    } = levelOptions
    if (levelNodeIndexes.length === 0) {
      return false
    }

    const levelEpoch = nextLevelDirtyRowEpoch()
    const levelDirtyRowIndexes: number[] = []
    const levelDirtyRowIndexesByNodePosition = new Array<readonly number[] | undefined>(levelNodeIndexes.length)

    for (let levelNodePosition = 0; levelNodePosition < levelNodeIndexes.length; levelNodePosition += 1) {
      const nodeIndex = levelNodeIndexes[levelNodePosition]
      if (typeof nodeIndex !== "number") {
        continue
      }
      const nodeDirtyRowIndexes = dirtyRuntime.dirtyRowIndexesByNode[nodeIndex]
      if (!nodeDirtyRowIndexes || nodeDirtyRowIndexes.length === 0) {
        continue
      }
      levelDirtyRowIndexesByNodePosition[levelNodePosition] = nodeDirtyRowIndexes
      dirtyRuntime.dirtyRowIndexesByNode[nodeIndex] = undefined
      for (const rowIndex of nodeDirtyRowIndexes) {
        if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= rowCount) {
          continue
        }
        if (levelDirtyRowMarks[rowIndex] === levelEpoch) {
          continue
        }
        levelDirtyRowMarks[rowIndex] = levelEpoch
        levelDirtyRowIndexes.push(rowIndex)
      }
    }

    if (levelDirtyRowIndexes.length === 0) {
      return false
    }

    const batchCount = Math.ceil(levelDirtyRowIndexes.length / vectorBatchSize)
    for (let index = 0; index < levelDirtyRowIndexes.length; index += 1) {
      const rowIndex = levelDirtyRowIndexes[index]
      if (typeof rowIndex !== "number") {
        continue
      }
      levelDirtyRowBatchIndexByRow[rowIndex] = Math.trunc(index / vectorBatchSize)
    }

    const nodeDirtyRowIndexesByBatchPosition = new Array<Array<number[] | undefined> | undefined>(levelNodeIndexes.length)
    for (let levelNodePosition = 0; levelNodePosition < levelNodeIndexes.length; levelNodePosition += 1) {
      const nodeDirtyRowIndexes = levelDirtyRowIndexesByNodePosition[levelNodePosition]
      if (!nodeDirtyRowIndexes || nodeDirtyRowIndexes.length === 0) {
        continue
      }
      const visitEpoch = nextNodeVisitEpoch()
      const batchesForNode = new Array<number[] | undefined>(batchCount)
      let hasBatchRows = false
      for (const rowIndex of nodeDirtyRowIndexes) {
        if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= rowCount) {
          continue
        }
        if (levelDirtyRowMarks[rowIndex] !== levelEpoch) {
          continue
        }
        if (nodeVisitMarks[rowIndex] === visitEpoch) {
          continue
        }
        nodeVisitMarks[rowIndex] = visitEpoch
        const batchIndex = levelDirtyRowBatchIndexByRow[rowIndex]
        if (typeof batchIndex !== "number" || batchIndex < 0) {
          continue
        }
        let batchRows = batchesForNode[batchIndex]
        if (!batchRows) {
          batchRows = []
          batchesForNode[batchIndex] = batchRows
        }
        batchRows.push(rowIndex)
        hasBatchRows = true
      }
      if (hasBatchRows) {
        nodeDirtyRowIndexesByBatchPosition[levelNodePosition] = batchesForNode
      }
    }

    let queuedSameLevelWork = false
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const scheduledNodeBatches: DataGridScheduledNodeBatch<T>[] = []
      for (let levelNodePosition = 0; levelNodePosition < levelNodeIndexes.length; levelNodePosition += 1) {
        const nodeIndex = levelNodeIndexes[levelNodePosition]
        if (typeof nodeIndex !== "number") {
          continue
        }
        const batchDirtyRowIndexes = nodeDirtyRowIndexesByBatchPosition[levelNodePosition]?.[batchIndex]
        if (!batchDirtyRowIndexes || batchDirtyRowIndexes.length === 0) {
          continue
        }
        const computedName = computedOrder[nodeIndex]
        const computed = computedEntryByIndex[nodeIndex]
        const readComputedField = computedFieldReaderByIndex[nodeIndex]
        if (!computedName || !computed || !readComputedField) {
          continue
        }
        scheduledNodeBatches.push({
          nodeIndex,
          computedName,
          computed,
          readComputedField,
          batchDirtyRowIndexes,
        })
      }

      if (scheduledNodeBatches.length <= 1) {
        for (const scheduledNodeBatch of scheduledNodeBatches) {
          if (executeNodeDirtyRows(dirtyRuntime, {
            nodeIndex: scheduledNodeBatch.nodeIndex,
            computedName: scheduledNodeBatch.computedName,
            computed: scheduledNodeBatch.computed,
            readComputedField: scheduledNodeBatch.readComputedField,
            levelNodeIndexSet,
            nodeDirtyRowIndexes: scheduledNodeBatch.batchDirtyRowIndexes,
          })) {
            queuedSameLevelWork = true
          }
        }
        flushLevelPatches()
        continue
      }

      const scheduledNodeBatchesBySignature = new Map<string, DataGridScheduledNodeBatch<T>[]>()
      let hasSharedSignatureGroup = false
      for (const scheduledNodeBatch of scheduledNodeBatches) {
        const signature = sharedDependencySignatureByNodeIndex[scheduledNodeBatch.nodeIndex]
        if (!signature) {
          continue
        }
        const batchGroup = scheduledNodeBatchesBySignature.get(signature)
        if (batchGroup) {
          batchGroup.push(scheduledNodeBatch)
          hasSharedSignatureGroup = true
          continue
        }
        scheduledNodeBatchesBySignature.set(signature, [scheduledNodeBatch])
      }

      if (!hasSharedSignatureGroup) {
        for (const scheduledNodeBatch of scheduledNodeBatches) {
          if (executeNodeDirtyRows(dirtyRuntime, {
            nodeIndex: scheduledNodeBatch.nodeIndex,
            computedName: scheduledNodeBatch.computedName,
            computed: scheduledNodeBatch.computed,
            readComputedField: scheduledNodeBatch.readComputedField,
            levelNodeIndexSet,
            nodeDirtyRowIndexes: scheduledNodeBatch.batchDirtyRowIndexes,
          })) {
            queuedSameLevelWork = true
          }
        }
        flushLevelPatches()
        continue
      }

      const processedSharedSignatures = new Set<string>()
      for (const scheduledNodeBatch of scheduledNodeBatches) {
        const signature = sharedDependencySignatureByNodeIndex[scheduledNodeBatch.nodeIndex]
        const scheduledBatchGroup = signature
          ? scheduledNodeBatchesBySignature.get(signature)
          : null
        if (!signature || !scheduledBatchGroup || scheduledBatchGroup.length <= 1) {
          if (executeNodeDirtyRows(dirtyRuntime, {
            nodeIndex: scheduledNodeBatch.nodeIndex,
            computedName: scheduledNodeBatch.computedName,
            computed: scheduledNodeBatch.computed,
            readComputedField: scheduledNodeBatch.readComputedField,
            levelNodeIndexSet,
            nodeDirtyRowIndexes: scheduledNodeBatch.batchDirtyRowIndexes,
          })) {
            queuedSameLevelWork = true
          }
          continue
        }
        if (processedSharedSignatures.has(signature)) {
          continue
        }
        processedSharedSignatures.add(signature)

        const sharedGroupRowIndexes: number[] = []
        const seenGroupRowIndexes = new Set<number>()
        for (const groupedNodeBatch of scheduledBatchGroup) {
          for (const rowIndex of groupedNodeBatch.batchDirtyRowIndexes) {
            if (seenGroupRowIndexes.has(rowIndex)) {
              continue
            }
            seenGroupRowIndexes.add(rowIndex)
            sharedGroupRowIndexes.push(rowIndex)
          }
        }

        const sharedPreparedBatchInput = createPreparedBatchInput(sharedGroupRowIndexes)
        const sharedDependencyReaders = scheduledBatchGroup[0]?.computed.dependencyReaders ?? []
        const sharedTokenColumns = createPreparedTokenColumns(
          scheduledBatchGroup[0]?.computed ?? scheduledNodeBatch.computed,
          sharedDependencyReaders,
          sharedPreparedBatchInput,
        )

        for (const groupedNodeBatch of scheduledBatchGroup) {
          const preparedBatchInput = groupedNodeBatch.batchDirtyRowIndexes.length === sharedPreparedBatchInput.rowIndexes.length
            && groupedNodeBatch.batchDirtyRowIndexes.every((rowIndex, rowIndexPosition) => rowIndex === sharedPreparedBatchInput.rowIndexes[rowIndexPosition])
            ? {
                ...sharedPreparedBatchInput,
                tokenColumns: sharedTokenColumns,
              }
            : createSubsetPreparedBatchInput(
                sharedPreparedBatchInput,
                sharedTokenColumns,
                groupedNodeBatch.batchDirtyRowIndexes,
              )
          if (executeNodeDirtyRows(dirtyRuntime, {
            nodeIndex: groupedNodeBatch.nodeIndex,
            computedName: groupedNodeBatch.computedName,
            computed: groupedNodeBatch.computed,
            readComputedField: groupedNodeBatch.readComputedField,
            levelNodeIndexSet,
            nodeDirtyRowIndexes: groupedNodeBatch.batchDirtyRowIndexes,
            preparedBatchInput,
          })) {
            queuedSameLevelWork = true
          }
        }
      }
      flushLevelPatches()
    }

    flushQueuedDependents(dirtyRuntime)
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
      nodeRuntimeModeByIndex,
    }
  }

  return {
    formulaRuntimeErrorsCollector,
    executeLevel,
    finalize,
  }
}
