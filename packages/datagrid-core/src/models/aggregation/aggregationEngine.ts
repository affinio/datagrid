import type {
  DataGridAggregationColumnSpec,
  DataGridAggregationModel,
  DataGridRowNode,
} from "../rowModel.js"
import type { DataGridAggOp } from "@affino/datagrid-pivot"

export interface DataGridAggregationFieldReader<T = unknown> {
  (rowNode: DataGridRowNode<T>, key: string, field?: string): unknown
}

export interface DataGridAggregationEngineOptions<T = unknown> {
  readRowField?: DataGridAggregationFieldReader<T>
}

function readByPathSegments(value: unknown, segments: readonly string[]): unknown {
  if (segments.length === 0 || typeof value !== "object" || value === null) {
    return undefined
  }
  let current: unknown = value
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined
      }
      current = current[index]
      continue
    }
    if (typeof current !== "object" || current === null || !(segment in (current as Record<string, unknown>))) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function compileRowFieldReader<T>(
  key: string,
  field?: string,
  readRowField?: DataGridAggregationFieldReader<T>,
): ((rowNode: DataGridRowNode<T>) => unknown) {
  const resolvedField = field && field.trim().length > 0 ? field.trim() : key.trim()
  if (!resolvedField) {
    return () => undefined
  }
  if (typeof readRowField === "function") {
    return (rowNode: DataGridRowNode<T>): unknown => readRowField(rowNode, key, field)
  }
  const segments = resolvedField.includes(".")
    ? resolvedField.split(".").filter(Boolean)
    : []

  return (rowNode: DataGridRowNode<T>): unknown => {
    const source = rowNode.data as unknown
    const directValue = typeof source === "object" && source !== null
      ? (source as Record<string, unknown>)[resolvedField]
      : undefined
    if (typeof directValue !== "undefined") {
      return directValue
    }
    if (segments.length === 0) {
      return undefined
    }
    return readByPathSegments(source, segments)
  }
}

function toComparableNumber(value: unknown): number | null {
  if (value == null) {
    return null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compareUnknown(left: unknown, right: unknown): number {
  if (left == null && right == null) {
    return 0
  }
  if (left == null) {
    return 1
  }
  if (right == null) {
    return -1
  }
  const leftNumber = toComparableNumber(left)
  const rightNumber = toComparableNumber(right)
  if (leftNumber != null && rightNumber != null) {
    return leftNumber - rightNumber
  }
  return String(left).localeCompare(String(right))
}

function normalizeNumber(value: unknown): number | null {
  return toComparableNumber(value)
}

interface AvgState {
  sum: number
  count: number
}

interface NumericValueState {
  value: number
}

interface ComparableValueState {
  value: unknown
}

interface FirstState {
  hasValue: boolean
  value: unknown
}

interface LastState {
  hasValue: boolean
  value: unknown
}

interface DataGridIncrementalCounterMap {
  [key: string]: number | AvgState | undefined
}

function toAvgState(state: unknown): AvgState {
  return state as AvgState
}

function createEmptyAvgState(): AvgState {
  return { sum: 0, count: 0 }
}

function resolveAvgStateOrEmpty(value: unknown): AvgState {
  return value == null ? createEmptyAvgState() : toAvgState(value)
}

function readIncrementalCounterValue(value: unknown): number {
  return Number(value ?? 0)
}

type DataGridCompiledAggregationStateHandler<TState, TArgs extends readonly unknown[] = readonly [], TResult = void> = {
  bivarianceHack(state: TState, ...args: TArgs): TResult
}["bivarianceHack"]

type DataGridBuiltInAggregationOp = Exclude<DataGridAggOp, "custom">

interface DataGridBuiltInAggregationStateMap {
  sum: NumericValueState
  avg: AvgState
  count: NumericValueState
  countNonNull: NumericValueState
  min: ComparableValueState
  max: ComparableValueState
  first: FirstState
  last: LastState
}

export interface DataGridCompiledAggregationColumn<T = unknown, TState = unknown> {
  key: string
  op: DataGridAggOp
  readValue: (row: DataGridRowNode<T>) => unknown
  createState: () => TState
  add: DataGridCompiledAggregationStateHandler<TState, [value: unknown, row: DataGridRowNode<T>]>
  merge?: DataGridCompiledAggregationStateHandler<TState, [childState: TState]>
  remove?: DataGridCompiledAggregationStateHandler<TState, [value: unknown, row: DataGridRowNode<T>]>
  finalize: DataGridCompiledAggregationStateHandler<TState, [], unknown>
}

export type DataGridCompiledAggregationColumnAnyState<T = unknown> = DataGridCompiledAggregationColumn<T, unknown>

export type DataGridIncrementalAggregationLeafContribution = Readonly<Record<string, unknown>>
export type DataGridIncrementalAggregationGroupState = Record<string, unknown>

export interface DataGridAggregationEngine<T = unknown> {
  setModel: (model: DataGridAggregationModel<T> | null) => void
  getModel: () => DataGridAggregationModel<T> | null
  getCompiledColumns: () => readonly DataGridCompiledAggregationColumnAnyState<T>[]
  isIncrementalAggregationSupported: () => boolean
  createEmptyGroupState: () => DataGridIncrementalAggregationGroupState | null
  createLeafContribution: (row: DataGridRowNode<T>) => DataGridIncrementalAggregationLeafContribution | null
  applyContributionDelta: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void
  finalizeGroupState: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>
  computeAggregatesForLeaves: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown>
  computeAggregatesForGroupedRows: (
    projectedRows: readonly DataGridRowNode<T>[],
  ) => ReadonlyMap<string, Record<string, unknown>>
}

interface DataGridAggregationStackEntry {
  groupKey: string
  level: number
  states: unknown[]
}

function coerceForOp(
  op: DataGridAggOp,
  value: unknown,
  coerce?: (value: unknown) => number | string | null,
): unknown {
  if (typeof coerce === "function") {
    return coerce(value)
  }
  if (op === "sum" || op === "avg") {
    return normalizeNumber(value)
  }
  if (op === "min" || op === "max") {
    const numeric = normalizeNumber(value)
    if (numeric != null) {
      return numeric
    }
    if (value == null) {
      return null
    }
    return String(value)
  }
  return value
}

function compileBuiltInColumn<T, TOp extends DataGridBuiltInAggregationOp>(input: {
  key: string
  op: TOp
  readValue: (row: DataGridRowNode<T>) => unknown
  createState: () => DataGridBuiltInAggregationStateMap[TOp]
  add: DataGridCompiledAggregationStateHandler<
    DataGridBuiltInAggregationStateMap[TOp],
    [value: unknown, row: DataGridRowNode<T>]
  >
  merge: DataGridCompiledAggregationStateHandler<
    DataGridBuiltInAggregationStateMap[TOp],
    [childState: DataGridBuiltInAggregationStateMap[TOp]]
  >
  finalize: DataGridCompiledAggregationStateHandler<
    DataGridBuiltInAggregationStateMap[TOp],
    [],
    unknown
  >
}): DataGridCompiledAggregationColumnAnyState<T> {
  const {
    key,
    op,
    readValue,
    createState,
    add,
    merge,
    finalize,
  } = input
  return {
    key,
    op,
    readValue,
    createState,
    add: (state: unknown, value: unknown, row: DataGridRowNode<T>) => {
      add(state as DataGridBuiltInAggregationStateMap[TOp], value, row)
    },
    merge: (state: unknown, childState: unknown) => {
      merge(
        state as DataGridBuiltInAggregationStateMap[TOp],
        childState as DataGridBuiltInAggregationStateMap[TOp],
      )
    },
    finalize: (state: unknown) => finalize(state as DataGridBuiltInAggregationStateMap[TOp]),
  }
}

function compileColumnSpec<T, TState>(
  spec: DataGridAggregationColumnSpec<T, TState>,
  readRowField?: DataGridAggregationFieldReader<T>,
): DataGridCompiledAggregationColumnAnyState<T> | null {
  const key = spec.key.trim()
  if (key.length === 0) {
    return null
  }
  const op = spec.op
  const readValue = compileRowFieldReader<T>(spec.key, spec.field, readRowField)

  if (op === "custom") {
    const createState = typeof spec.createState === "function"
      ? (() => spec.createState!())
      : (() => null)
    const add = typeof spec.add === "function"
      ? ((state: unknown, value: unknown, row: DataGridRowNode<T>) => spec.add!(state as TState, value, row))
      : (() => {})
    const finalize = typeof spec.finalize === "function"
      ? ((state: unknown) => spec.finalize!(state as TState))
      : ((state: unknown) => state)
    const merge = typeof spec.merge === "function" ? spec.merge : undefined
    return {
      key,
      op,
      readValue,
      createState,
      add,
      merge: merge
        ? ((state: unknown, childState: unknown) => {
            merge(state as TState, childState as TState)
          })
        : undefined,
      remove: typeof spec.remove === "function"
        ? ((state: unknown, value: unknown, row: DataGridRowNode<T>) => spec.remove!(state as TState, value, row))
        : undefined,
      finalize,
    }
  }

  const readAggregatedValue = (row: DataGridRowNode<T>): unknown => {
    const raw = readValue(row)
    return coerceForOp(op, raw, spec.coerce)
  }

  switch (op) {
    case "sum":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: () => ({ value: 0 }),
        add: (state, value) => {
          const candidate = normalizeNumber(value)
          if (candidate != null) {
            state.value += candidate
          }
        },
        merge: (state, childState) => {
          state.value += childState.value
        },
        finalize: state => state.value,
      })
    case "avg":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: createEmptyAvgState,
        add: (state, value) => {
          const candidate = normalizeNumber(value)
          if (candidate != null) {
            state.sum += candidate
            state.count += 1
          }
        },
        merge: (state, childState) => {
          state.sum += childState.sum
          state.count += childState.count
        },
        finalize: state => state.count > 0 ? state.sum / state.count : null,
      })
    case "count":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: () => ({ value: 0 }),
        add: state => {
          state.value += 1
        },
        merge: (state, childState) => {
          state.value += childState.value
        },
        finalize: state => state.value,
      })
    case "countNonNull":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: () => ({ value: 0 }),
        add: (state, value) => {
          if (value != null) {
            state.value += 1
          }
        },
        merge: (state, childState) => {
          state.value += childState.value
        },
        finalize: state => state.value,
      })
    case "min":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: () => ({ value: null }),
        add: (state, value) => {
          if (value == null) {
            return
          }
          if (state.value == null || compareUnknown(value, state.value) < 0) {
            state.value = value
          }
        },
        merge: (state, childState) => {
          if (childState.value == null) {
            return
          }
          if (state.value == null || compareUnknown(childState.value, state.value) < 0) {
            state.value = childState.value
          }
        },
        finalize: state => state.value ?? null,
      })
    case "max":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: () => ({ value: null }),
        add: (state, value) => {
          if (value == null) {
            return
          }
          if (state.value == null || compareUnknown(value, state.value) > 0) {
            state.value = value
          }
        },
        merge: (state, childState) => {
          if (childState.value == null) {
            return
          }
          if (state.value == null || compareUnknown(childState.value, state.value) > 0) {
            state.value = childState.value
          }
        },
        finalize: state => state.value ?? null,
      })
    case "first":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: () => ({ hasValue: false, value: undefined }),
        add: (state, value) => {
          if (!state.hasValue) {
            state.hasValue = true
            state.value = value
          }
        },
        merge: (state, childState) => {
          if (!state.hasValue && childState.hasValue) {
            state.hasValue = true
            state.value = childState.value
          }
        },
        finalize: state => state.hasValue ? state.value : null,
      })
    case "last":
      return compileBuiltInColumn({
        key,
        op,
        readValue: readAggregatedValue,
        createState: () => ({ hasValue: false, value: undefined }),
        add: (state, value) => {
          state.hasValue = true
          state.value = value
        },
        merge: (state, childState) => {
          if (childState.hasValue) {
            state.hasValue = true
            state.value = childState.value
          }
        },
        finalize: state => state.hasValue ? state.value : null,
      })
    default:
      return null
  }
}

function createStates<T>(
  columns: readonly DataGridCompiledAggregationColumnAnyState<T>[],
): unknown[] {
  return columns.map(column => column.createState())
}

function finalizeStates<T>(
  columns: readonly DataGridCompiledAggregationColumnAnyState<T>[],
  states: readonly unknown[],
): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {}
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]
    if (!column) {
      continue
    }
    const state = states[index]
    aggregates[column.key] = column.finalize(state)
  }
  return aggregates
}

function addLeafToStates<T>(
  columns: readonly DataGridCompiledAggregationColumnAnyState<T>[],
  states: readonly unknown[],
  row: DataGridRowNode<T>,
): void {
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]
    if (!column) {
      continue
    }
    const state = states[index]
    const value = column.readValue(row)
    column.add(state, value, row)
  }
}

function mergeStates<T>(
  columns: readonly DataGridCompiledAggregationColumnAnyState<T>[],
  targetStates: readonly unknown[],
  childStates: readonly unknown[],
): void {
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]
    if (!column?.merge) {
      continue
    }
    const targetState = targetStates[index]
    const childState = childStates[index]
    column.merge(targetState, childState)
  }
}

function compileAggregationColumns<T>(
  model: DataGridAggregationModel<T> | null,
  readRowField?: DataGridAggregationFieldReader<T>,
): readonly DataGridCompiledAggregationColumnAnyState<T>[] {
  if (!model || !Array.isArray(model.columns) || model.columns.length === 0) {
    return []
  }
  const compiled: DataGridCompiledAggregationColumnAnyState<T>[] = []
  for (const spec of model.columns) {
    const column = compileColumnSpec(spec, readRowField)
    if (!column) {
      continue
    }
    compiled.push(column)
  }
  return compiled
}

function isIncrementalAggregationOp(op: DataGridAggOp): boolean {
  return op === "sum" || op === "count" || op === "countNonNull" || op === "avg"
}

export function createDataGridAggregationEngine<T>(
  initialModel: DataGridAggregationModel<T> | null = null,
  options: DataGridAggregationEngineOptions<T> = {},
): DataGridAggregationEngine<T> {
  let model = initialModel
  let compiledColumns = compileAggregationColumns(model, options.readRowField)
  const isIncrementalSupported = (): boolean => {
    if (compiledColumns.length === 0) {
      return false
    }
    return compiledColumns.every(column => isIncrementalAggregationOp(column.op))
  }

  const createEmptyGroupState = (): DataGridIncrementalAggregationGroupState | null => {
    if (!isIncrementalSupported()) {
      return null
    }
    const state: DataGridIncrementalAggregationGroupState = {}
    for (const column of compiledColumns) {
      if (column.op === "avg") {
        state[column.key] = createEmptyAvgState()
      } else {
        state[column.key] = 0
      }
    }
    return state
  }

  const createLeafContribution = (
    row: DataGridRowNode<T>,
  ): DataGridIncrementalAggregationLeafContribution | null => {
    if (!isIncrementalSupported() || row.kind !== "leaf") {
      return null
    }
    const contribution: DataGridIncrementalCounterMap = {}
    for (const column of compiledColumns) {
      const value = column.readValue(row)
      if (column.op === "sum") {
        contribution[column.key] = normalizeNumber(value) ?? 0
        continue
      }
      if (column.op === "count") {
        contribution[column.key] = 1
        continue
      }
      if (column.op === "countNonNull") {
        contribution[column.key] = value == null ? 0 : 1
        continue
      }
      const numeric = normalizeNumber(value)
      contribution[column.key] = numeric == null
        ? createEmptyAvgState()
        : ({ sum: numeric, count: 1 } satisfies AvgState)
    }
    return contribution
  }

  const applyContributionDelta = (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ): void => {
    if (!isIncrementalSupported()) {
      return
    }
    for (const column of compiledColumns) {
      if (column.op === "avg") {
        const target = resolveAvgStateOrEmpty(groupState[column.key])
        const previousValue = resolveAvgStateOrEmpty(previous?.[column.key])
        const nextValue = resolveAvgStateOrEmpty(next?.[column.key])
        target.sum += (nextValue.sum ?? 0) - (previousValue.sum ?? 0)
        target.count += (nextValue.count ?? 0) - (previousValue.count ?? 0)
        groupState[column.key] = target
        continue
      }
      const current = readIncrementalCounterValue(groupState[column.key])
      const previousValue = readIncrementalCounterValue(previous?.[column.key])
      const nextValue = readIncrementalCounterValue(next?.[column.key])
      groupState[column.key] = current + (nextValue - previousValue)
    }
  }

  const finalizeGroupState = (
    groupState: DataGridIncrementalAggregationGroupState,
  ): Record<string, unknown> => {
    if (!isIncrementalSupported()) {
      return {}
    }
    const aggregates: Record<string, unknown> = {}
    for (const column of compiledColumns) {
      if (column.op === "avg") {
        const state = resolveAvgStateOrEmpty(groupState[column.key])
        aggregates[column.key] = state.count > 0 ? state.sum / state.count : null
        continue
      }
      aggregates[column.key] = readIncrementalCounterValue(groupState[column.key])
    }
    return aggregates
  }

  return {
    setModel(nextModel: DataGridAggregationModel<T> | null) {
      model = nextModel
      compiledColumns = compileAggregationColumns(model, options.readRowField)
    },
    getModel: () => model,
    getCompiledColumns: () => compiledColumns,
    isIncrementalAggregationSupported: isIncrementalSupported,
    createEmptyGroupState,
    createLeafContribution,
    applyContributionDelta,
    finalizeGroupState,
    computeAggregatesForLeaves(rows: readonly DataGridRowNode<T>[]): Record<string, unknown> {
      if (compiledColumns.length === 0 || rows.length === 0) {
        return {}
      }
      const states = createStates(compiledColumns)
      for (const row of rows) {
        if (row.kind !== "leaf") {
          continue
        }
        addLeafToStates(compiledColumns, states, row)
      }
      return finalizeStates(compiledColumns, states)
    },
    computeAggregatesForGroupedRows(projectedRows: readonly DataGridRowNode<T>[]): ReadonlyMap<string, Record<string, unknown>> {
      const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
      if (compiledColumns.length === 0 || projectedRows.length === 0) {
        return aggregatesByGroupKey
      }
      const canUseMergedStackPath = compiledColumns.every(column => typeof column.merge === "function")

      const stack: DataGridAggregationStackEntry[] = []
      const flush = (minLevel = -1): void => {
        while (stack.length > 0) {
          const current = stack[stack.length - 1]
          if (!current || current.level < minLevel) {
            break
          }
          stack.pop()
          aggregatesByGroupKey.set(current.groupKey, finalizeStates(compiledColumns, current.states))
          if (canUseMergedStackPath) {
            const parent = stack[stack.length - 1]
            if (parent) {
              mergeStates(compiledColumns, parent.states, current.states)
            }
          }
        }
      }

      for (const row of projectedRows) {
        if (row.kind === "group") {
          const groupKey = row.groupMeta?.groupKey
          if (!groupKey) {
            continue
          }
          const level = Number.isFinite(row.groupMeta?.level)
            ? Math.max(0, Math.trunc(row.groupMeta?.level as number))
            : 0
          flush(level)
          stack.push({
            groupKey,
            level,
            states: createStates(compiledColumns),
          })
          continue
        }
        if (stack.length === 0) {
          continue
        }
        if (canUseMergedStackPath) {
          const leafTarget = stack[stack.length - 1]
          if (leafTarget) {
            addLeafToStates(compiledColumns, leafTarget.states, row)
          }
          continue
        }
        for (const entry of stack) {
          addLeafToStates(compiledColumns, entry.states, row)
        }
      }
      flush(-1)
      return aggregatesByGroupKey
    },
  }
}
