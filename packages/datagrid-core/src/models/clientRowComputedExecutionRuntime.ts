import type {
  DataGridComputedDependencyToken,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldComputeContext,
  DataGridFormulaComputeStageDiagnostics,
  DataGridProjectionFormulaDiagnostics,
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"
import type { DataGridCompiledFormulaField } from "./formulaEngine.js"
import { applyRowDataPatch } from "./clientRowRuntimeUtils.js"
import type { DataGridFormulaRuntimeErrorsCollector } from "./clientRowFormulaDiagnosticsRuntime.js"

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
}

export interface DataGridRegisteredFormulaField {
  name: string
  field: string
  formula: string
  deps: readonly DataGridComputedDependencyToken[]
}

export interface ApplyComputedFieldsToSourceRowsOptions {
  rowIds?: ReadonlySet<DataGridRowId>
  changedFieldsByRowId?: ReadonlyMap<DataGridRowId, ReadonlySet<string>>
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

export interface DataGridClientComputedExecutionRuntimeContext<T> {
  vectorBatchSize?: number
  isRecord: (value: unknown) => value is Record<string, unknown>
  isColumnCacheParityVerificationEnabled: () => boolean

  getSourceRows: () => readonly DataGridRowNode<T>[]
  setSourceRows: (rows: DataGridRowNode<T>[]) => void
  resolveRowFieldReader: (fieldInput: string) => ((rowNode: DataGridRowNode<T>) => unknown)

  getComputedOrder: () => readonly string[]
  getComputedEntryByIndex: () => readonly DataGridRegisteredComputedField<T>[]
  getComputedFieldReaderByIndex: () => readonly ((rowNode: DataGridRowNode<T>) => unknown)[]
  getComputedLevelIndexes: () => readonly (readonly number[])[]
  getComputedDependentsByIndex: () => readonly (readonly number[])[]
  getFormulaFieldsByName: () => ReadonlyMap<string, DataGridRegisteredFormulaField>

  resolveComputedRootIndexes: (changedFields: ReadonlySet<string>) => readonly number[]
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
    const selectedRowIndexes: number[] = []
    const nodeCount = computedOrder.length
    const dirtyRowIndexesByNode = new Array<number[] | undefined>(nodeCount)
    const dirtyNodeMarks = new Uint8Array(nodeCount)
    let dirtyNodeCount = 0
    const dirtyRowMarks = new Uint8Array(rowCount)
    let dirtyRowsCount = 0

    const markDirtyRow = (rowIndex: number): void => {
      if (dirtyRowMarks[rowIndex] !== 0) {
        return
      }
      dirtyRowMarks[rowIndex] = 1
      dirtyRowsCount += 1
    }

    const markDirtyNode = (nodeIndex: number): void => {
      if (dirtyNodeMarks[nodeIndex] !== 0) {
        return
      }
      dirtyNodeMarks[nodeIndex] = 1
      dirtyNodeCount += 1
    }

    const enqueueDirtyNodeRowIndex = (nodeIndex: number, rowIndex: number): void => {
      let nodeDirtyRows = dirtyRowIndexesByNode[nodeIndex]
      if (!nodeDirtyRows) {
        nodeDirtyRows = []
        dirtyRowIndexesByNode[nodeIndex] = nodeDirtyRows
      }
      nodeDirtyRows.push(rowIndex)
      markDirtyNode(nodeIndex)
      markDirtyRow(rowIndex)
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

      if (!hasExplicitChangedFields) {
        selectedRowIndexes.push(rowIndex)
        continue
      }

      const rawChangedFields = options.changedFieldsByRowId?.get(row.rowId) ?? null
      if (!rawChangedFields || rawChangedFields.size === 0) {
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
        continue
      }
      const rootOrderIndexes = context.resolveComputedRootIndexes(normalizedChangedFields)
      if (rootOrderIndexes.length === 0) {
        continue
      }

      selectedRowIndexes.push(rowIndex)
      for (const nodeIndex of rootOrderIndexes) {
        enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
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

    const formulaComputeStrategy: "row" | "column-cache" = "column-cache"

    if (!hasExplicitChangedFields) {
      for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
        for (const rowIndex of selectedRowIndexes) {
          enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
        }
      }
    }

    let nextSourceRows: DataGridRowNode<T>[] | null = null
    const changedRowMarks = new Uint8Array(rowCount)
    const touchedRowMarks = new Uint8Array(rowCount)
    let touchedRowsCount = 0
    const computedPatchByRowIndex = captureRowPatchMaps
      ? new Array<Record<string, unknown> | undefined>(rowCount)
      : null
    const previousRowByIndex = captureRowPatchMaps
      ? new Array<DataGridRowNode<T> | undefined>(rowCount)
      : null
    const nextRowByIndex = captureRowPatchMaps
      ? new Array<DataGridRowNode<T> | undefined>(rowCount)
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
    let effectiveRuntimeStrategy: "row" | "column-cache" = formulaComputeStrategy
    let forceRowReadFallback = false
    const verifyColumnCacheParity = (
      formulaComputeStrategy === "column-cache"
      && context.isColumnCacheParityVerificationEnabled()
    )
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
        return context.resolveComputedTokenValue(
          activeComputeRowNode,
          token,
          activeComputeRowIndex,
          columnReadContext,
        )
      },
    } satisfies DataGridComputedFieldComputeContext<T>
    const nextDirtyRowIndexesByNode = new Array<number[] | undefined>(nodeCount)
    const levelPatchByRowIndex = new Array<Record<string, unknown> | undefined>(rowCount)
    const levelPatchedRowIndexes: number[] = []
    const nextDirtyNodeIndexes: number[] = []

    context.withRuntimeErrorsCollector(formulaRuntimeErrorsCollector, () => {
      for (const level of levelsToRun) {
        levelPatchedRowIndexes.length = 0
        nextDirtyNodeIndexes.length = 0

        for (const nodeIndex of level) {
          const computedName = computedOrder[nodeIndex]
          const computed = computedEntryByIndex[nodeIndex]
          const readComputedField = computedFieldReaderByIndex[nodeIndex]
          if (!computedName || !computed || !readComputedField) {
            continue
          }
          const nodeDirtyRowIndexes = dirtyRowIndexesByNode[nodeIndex]
          if (!nodeDirtyRowIndexes || nodeDirtyRowIndexes.length === 0) {
            continue
          }
          dirtyRowIndexesByNode[nodeIndex] = undefined
          const dependentIndexes = computedDependentsByIndex[nodeIndex] ?? []
          const canUseBatchCompute = typeof computed.computeBatch === "function"
          const canUseColumnarBatchCompute = typeof computed.computeBatchColumnar === "function"
          const visitEpoch = nextNodeVisitEpoch()
          let evaluatedAtLeastOnce = false
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
            if (Object.is(nextValue, previousValue)) {
              skippedByObjectIs += 1
              return
            }
            touchedComputedFields.add(computed.field)

            if (computedPatchByRowIndex) {
              let rowPatch = computedPatchByRowIndex[rowIndex]
              if (!rowPatch) {
                rowPatch = {}
                computedPatchByRowIndex[rowIndex] = rowPatch
              }
              rowPatch[computed.field] = nextValue
            }

            let levelPatch = levelPatchByRowIndex[rowIndex]
            if (!levelPatch) {
              levelPatch = {}
              levelPatchByRowIndex[rowIndex] = levelPatch
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
              markDirtyNode(dependentIndex)
              markDirtyRow(rowIndex)
            }
          }

          const dirtyRowIndexesForNode = nodeDirtyRowIndexes
          const batchRowIndexes: number[] = []
          const batchRowNodes: DataGridRowNode<T>[] = []
          const batchContexts: Array<{ row: T; rowId: DataGridRowId; sourceIndex: number }> = []
          let reusableTokenColumns: Array<unknown[]> | null = null

          for (
            let batchStart = 0;
            batchStart < dirtyRowIndexesForNode.length;
            batchStart += vectorBatchSize
          ) {
            const batchEnd = Math.min(
              dirtyRowIndexesForNode.length,
              batchStart + vectorBatchSize,
            )
            batchRowIndexes.length = 0
            batchRowNodes.length = 0
            batchContexts.length = 0

            for (let rowCursor = batchStart; rowCursor < batchEnd; rowCursor += 1) {
              const rowIndex = dirtyRowIndexesForNode[rowCursor]
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
                    tokenColumn[contextIndex] = context.resolveComputedTokenValue(
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
                    return context.resolveComputedTokenValue(
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
              reusableComputeContext.row = workingRowNode.row
              reusableComputeContext.rowId = workingRowNode.rowId
              reusableComputeContext.sourceIndex = workingRowNode.sourceIndex
              let nextValue: unknown
              try {
                nextValue = computed.compute(reusableComputeContext)
              } finally {
                activeComputeRowNode = null
                activeComputeRowIndex = -1
              }
              applyComputedValueForRow(rowIndex, workingRowNode, nextValue)
            }
          }

          if (evaluatedAtLeastOnce && formulaFieldsByName.has(computedName)) {
            recomputedFormulaFieldNames.add(computedName)
          }
        }

        if (levelPatchedRowIndexes.length > 0) {
          for (const rowIndex of levelPatchedRowIndexes) {
            const levelPatch = levelPatchByRowIndex[rowIndex]
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
              if (!previousRowByIndex[rowIndex]) {
                previousRowByIndex[rowIndex] = sourceRow
              }
              nextRowByIndex[rowIndex] = nextRowNode
            }
            changedRowMarks[rowIndex] = 1
            levelPatchByRowIndex[rowIndex] = undefined
          }
        }

        for (const nodeIndex of nextDirtyNodeIndexes) {
          const dependentRows = nextDirtyRowIndexesByNode[nodeIndex]
          if (!dependentRows || dependentRows.length === 0) {
            nextDirtyRowIndexesByNode[nodeIndex] = undefined
            continue
          }
          const queued = dirtyRowIndexesByNode[nodeIndex]
          if (!queued) {
            dirtyRowIndexesByNode[nodeIndex] = dependentRows
            nextDirtyRowIndexesByNode[nodeIndex] = undefined
            continue
          }
          queued.push(...dependentRows)
          nextDirtyRowIndexesByNode[nodeIndex] = undefined
        }
      }
    })

    const changedRowIds: DataGridRowId[] = []
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      if (changedRowMarks[rowIndex] === 0) {
        continue
      }
      const rowNode = sourceRowsBaseline[rowIndex]
      if (!rowNode) {
        continue
      }
      changedRowIds.push(rowNode.rowId)
    }

    if (nextSourceRows && changedRowIds.length > 0) {
      context.setSourceRows(nextSourceRows)
    }

    const computedUpdatesByRowId = new Map<DataGridRowId, Partial<T>>()
    const previousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    const nextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()

    if (captureRowPatchMaps && computedPatchByRowIndex && previousRowByIndex && nextRowByIndex) {
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const rowNode = sourceRowsBaseline[rowIndex]
        if (!rowNode) {
          continue
        }
        const rowId = rowNode.rowId
        const computedPatch = computedPatchByRowIndex[rowIndex]
        if (computedPatch) {
          computedUpdatesByRowId.set(rowId, computedPatch as Partial<T>)
        }
        const previousRow = previousRowByIndex[rowIndex]
        if (previousRow) {
          previousRowsById.set(rowId, previousRow)
        }
        const nextRow = nextRowByIndex[rowIndex]
        if (nextRow) {
          nextRowsById.set(rowId, nextRow)
        }
      }
    }

    const recomputedFields = computedOrder.filter(name => recomputedFormulaFieldNames.has(name))

    return {
      changed: changedRowIds.length > 0,
      changedRowIds,
      computedUpdatesByRowId,
      previousRowsById,
      nextRowsById,
      formulaDiagnostics: {
        recomputedFields,
        runtimeErrorCount: formulaRuntimeErrorsCollector.runtimeErrorCount,
        runtimeErrors: formulaRuntimeErrorsCollector.runtimeErrors,
      },
      computeStageDiagnostics: {
        strategy: effectiveRuntimeStrategy,
        rowsTouched: touchedRowsCount,
        changedRows: changedRowIds.length,
        fieldsTouched: Array.from(touchedComputedFields).sort((left, right) => left.localeCompare(right)),
        evaluations: computeEvaluationCount,
        skippedByObjectIs,
        dirtyRows: dirtyRowsCount,
        dirtyNodes: (() => {
          if (dirtyNodeCount === 0) {
            return [] as string[]
          }
          const dirtyNodes: string[] = []
          for (let index = 0; index < nodeCount; index += 1) {
            if (dirtyNodeMarks[index] === 0) {
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

  return {
    applyComputedFieldsToSourceRows,
  }
}
