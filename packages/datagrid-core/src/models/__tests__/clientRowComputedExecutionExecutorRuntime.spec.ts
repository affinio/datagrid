import { describe, expect, it } from "vitest"
import { createDataGridComputedDirtyPropagationRuntime } from "../compute/clientRowComputedExecutionDirtyPropagationRuntime"
import { createDataGridComputedExecutionExecutorRuntime } from "../compute/clientRowComputedExecutionExecutorRuntime"
import type {
  DataGridClientComputedExecutionRuntimeContext,
  DataGridRegisteredComputedField,
} from "../compute/clientRowComputedExecutionRuntime"
import type { DataGridRowNode } from "../rowModel"

describe("createDataGridComputedExecutionExecutorRuntime", () => {
  it("executes same-level work in batch-major order", () => {
    type Row = {
      id: number
      first?: number
      second?: number
    }

    const sourceRowsBaseline: DataGridRowNode<Row>[] = Array.from({ length: 4 }, (_, index) => ({
      row: { id: index + 1 },
      data: { id: index + 1 },
      rowId: `r${index + 1}`,
      rowKey: `r${index + 1}`,
      sourceIndex: index,
      originalIndex: index,
      displayIndex: index,
      kind: "leaf",
    }))
    const columnValuesByField = new Map<string, unknown[]>()
    const getFieldValues = (field: string): unknown[] => {
      let values = columnValuesByField.get(field)
      if (!values) {
        values = sourceRowsBaseline.map(rowNode => (rowNode.data as Record<string, unknown>)[field])
        columnValuesByField.set(field, values)
      }
      return values
    }
    const callOrder: string[] = []
    const computedEntryByIndex: DataGridRegisteredComputedField<Row>[] = [
      {
        name: "first",
        field: "first",
        deps: [],
        compute: () => 0,
        computeBatch: (contexts) => {
          callOrder.push(`first:${contexts.map(context => context.rowId).join(",")}`)
          return contexts.map(() => 10)
        },
      },
      {
        name: "second",
        field: "second",
        deps: [],
        compute: () => 0,
        computeBatch: (contexts) => {
          callOrder.push(`second:${contexts.map(context => context.rowId).join(",")}`)
          return contexts.map(() => 20)
        },
      },
    ]
    const context = {
      isRecord: (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null,
      isColumnCacheParityVerificationEnabled: () => false,
      getComputedEntryByIndex: () => computedEntryByIndex,
      resolveComputedTokenValue: () => undefined,
      resolveRowFieldReader: (fieldInput: string) => {
        return (rowNode: DataGridRowNode<Row>) => (rowNode.data as Record<string, unknown>)[fieldInput]
      },
      getSourceColumnValues: getFieldValues,
      clearSourceColumnValuesCache: () => {
        columnValuesByField.clear()
      },
    } as unknown as DataGridClientComputedExecutionRuntimeContext<Row>
    const executorRuntime = createDataGridComputedExecutionExecutorRuntime<Row>({
      context,
      vectorBatchSize: 2,
      captureRowPatchMaps: false,
      rowCount: sourceRowsBaseline.length,
      nodeCount: computedEntryByIndex.length,
      sourceRowsBaseline,
      computedDependentsByIndex: [[], []],
      formulaFieldsByName: new Map(),
      valuesDiffer: (left, right) => !Object.is(left, right),
    })
    const dirtyRuntime = createDataGridComputedDirtyPropagationRuntime(computedEntryByIndex.length, sourceRowsBaseline.length)

    for (let nodeIndex = 0; nodeIndex < computedEntryByIndex.length; nodeIndex += 1) {
      for (let rowIndex = 0; rowIndex < sourceRowsBaseline.length; rowIndex += 1) {
        dirtyRuntime.enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
      }
    }

    const queuedSameLevelWork = executorRuntime.executeLevel(dirtyRuntime, {
      levelNodeIndexes: [0, 1],
      levelNodeIndexSet: new Set([0, 1]),
      computedOrder: ["first", "second"],
      computedEntryByIndex,
      computedFieldReaderByIndex: [
        rowNode => (rowNode.data as Record<string, unknown>).first,
        rowNode => (rowNode.data as Record<string, unknown>).second,
      ],
    })
    const executionResult = executorRuntime.finalize()

    expect(queuedSameLevelWork).toBe(false)
    expect(callOrder).toEqual([
      "first:r1,r2",
      "second:r1,r2",
      "first:r3,r4",
      "second:r3,r4",
    ])
    expect(executionResult.changedRowIds).toEqual(["r1", "r2", "r3", "r4"])
  })

  it("reuses shared dependency columns for same-signature node groups", () => {
    type Row = {
      id: number
      price: number
      qty: number
      total?: number
      gross?: number
    }

    const sourceRowsBaseline: DataGridRowNode<Row>[] = Array.from({ length: 4 }, (_, index) => ({
      row: { id: index + 1, price: 10 + index, qty: 2 + index },
      data: { id: index + 1, price: 10 + index, qty: 2 + index },
      rowId: `r${index + 1}`,
      rowKey: `r${index + 1}`,
      sourceIndex: index,
      originalIndex: index,
      displayIndex: index,
      kind: "leaf",
    }))
    const columnValuesByField = new Map<string, unknown[]>()
    const getFieldValues = (field: string): unknown[] => {
      let values = columnValuesByField.get(field)
      if (!values) {
        values = sourceRowsBaseline.map(rowNode => (rowNode.data as Record<string, unknown>)[field])
        columnValuesByField.set(field, values)
      }
      return values
    }
    const dependencyReadCounts = new Map<string, number>()
    const countReader = (key: string, field: string) => {
      return (rowNode: DataGridRowNode<Row>, rowIndex?: number, columnReadContext?: { readFieldAtRow: (field: string, rowIndex: number, rowNode: DataGridRowNode<Row>) => unknown }) => {
        dependencyReadCounts.set(key, (dependencyReadCounts.get(key) ?? 0) + 1)
        if (typeof rowIndex === "number" && columnReadContext) {
          return columnReadContext.readFieldAtRow(field, rowIndex, rowNode)
        }
        return (rowNode.data as Record<string, unknown>)[field]
      }
    }
    const computedEntryByIndex: DataGridRegisteredComputedField<Row>[] = [
      {
        name: "total",
        field: "total",
        deps: [
          { token: "field:price", domain: "field", value: "price" },
          { token: "field:qty", domain: "field", value: "qty" },
        ],
        compute: () => 0,
        computeBatchColumnar: (_contexts, tokenColumns) => tokenColumns[0]!.map((price, index) => Number(price ?? 0) * Number(tokenColumns[1]?.[index] ?? 0)),
        dependencyReaders: [countReader("total:price", "price"), countReader("total:qty", "qty")],
      },
      {
        name: "gross",
        field: "gross",
        deps: [
          { token: "field:price", domain: "field", value: "price" },
          { token: "field:qty", domain: "field", value: "qty" },
        ],
        compute: () => 0,
        computeBatchColumnar: (_contexts, tokenColumns) => tokenColumns[0]!.map((price, index) => Number(price ?? 0) * Number(tokenColumns[1]?.[index] ?? 0) + 1),
        dependencyReaders: [countReader("gross:price", "price"), countReader("gross:qty", "qty")],
      },
    ]
    const context = {
      isRecord: (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null,
      isColumnCacheParityVerificationEnabled: () => false,
      getComputedEntryByIndex: () => computedEntryByIndex,
      resolveComputedTokenValue: () => undefined,
      resolveRowFieldReader: (fieldInput: string) => {
        return (rowNode: DataGridRowNode<Row>) => (rowNode.data as Record<string, unknown>)[fieldInput]
      },
      getSourceColumnValues: getFieldValues,
      clearSourceColumnValuesCache: () => {
        columnValuesByField.clear()
      },
    } as unknown as DataGridClientComputedExecutionRuntimeContext<Row>
    const executorRuntime = createDataGridComputedExecutionExecutorRuntime<Row>({
      context,
      vectorBatchSize: 4,
      captureRowPatchMaps: false,
      rowCount: sourceRowsBaseline.length,
      nodeCount: computedEntryByIndex.length,
      sourceRowsBaseline,
      computedDependentsByIndex: [[], []],
      formulaFieldsByName: new Map(),
      valuesDiffer: (left, right) => !Object.is(left, right),
    })
    const dirtyRuntime = createDataGridComputedDirtyPropagationRuntime(computedEntryByIndex.length, sourceRowsBaseline.length)

    for (let nodeIndex = 0; nodeIndex < computedEntryByIndex.length; nodeIndex += 1) {
      for (let rowIndex = 0; rowIndex < sourceRowsBaseline.length; rowIndex += 1) {
        dirtyRuntime.enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
      }
    }

    executorRuntime.executeLevel(dirtyRuntime, {
      levelNodeIndexes: [0, 1],
      levelNodeIndexSet: new Set([0, 1]),
      computedOrder: ["total", "gross"],
      computedEntryByIndex,
      computedFieldReaderByIndex: [
        rowNode => (rowNode.data as Record<string, unknown>).total,
        rowNode => (rowNode.data as Record<string, unknown>).gross,
      ],
    })

    expect(dependencyReadCounts).toEqual(new Map([
      ["total:price", 4],
      ["total:qty", 4],
    ]))
  })
})