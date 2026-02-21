import type {
  DataGridAggOp,
  DataGridAggregationColumnSpec,
  DataGridAggregationModel,
  DataGridRowNode,
} from "./rowModel.js"

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
): ((rowNode: DataGridRowNode<T>) => unknown) {
  const resolvedField = field && field.trim().length > 0 ? field.trim() : key.trim()
  if (!resolvedField) {
    return () => undefined
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

interface FirstState {
  hasValue: boolean
  value: unknown
}

interface LastState {
  hasValue: boolean
  value: unknown
}

export interface DataGridCompiledAggregationColumn<T = unknown> {
  key: string
  op: DataGridAggOp
  readValue: (row: DataGridRowNode<T>) => unknown
  createState: () => unknown
  add: (state: unknown, value: unknown, row: DataGridRowNode<T>) => void
  merge?: (state: unknown, childState: unknown) => void
  remove?: (state: unknown, value: unknown, row: DataGridRowNode<T>) => void
  finalize: (state: unknown) => unknown
}

export type DataGridIncrementalAggregationLeafContribution = Readonly<Record<string, unknown>>
export type DataGridIncrementalAggregationGroupState = Record<string, unknown>

export interface DataGridAggregationEngine<T = unknown> {
  setModel: (model: DataGridAggregationModel<T> | null) => void
  getModel: () => DataGridAggregationModel<T> | null
  getCompiledColumns: () => readonly DataGridCompiledAggregationColumn<T>[]
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

function compileColumnSpec<T>(
  spec: DataGridAggregationColumnSpec<T>,
): DataGridCompiledAggregationColumn<T> | null {
  const key = spec.key.trim()
  if (key.length === 0) {
    return null
  }
  const op = spec.op
  const readValue = compileRowFieldReader<T>(spec.key, spec.field)

  if (op === "custom") {
    const createState = typeof spec.createState === "function" ? spec.createState : (() => null)
    const add = typeof spec.add === "function" ? spec.add : (() => {})
    const finalize = typeof spec.finalize === "function" ? spec.finalize : ((state: unknown) => state)
    const merge = typeof spec.merge === "function" ? spec.merge : undefined
    return {
      key,
      op,
      readValue,
      createState,
      add: (state: unknown, value: unknown, row: DataGridRowNode<T>) => {
        add(state, value, row)
      },
      merge: merge
        ? ((state: unknown, childState: unknown) => {
            merge(state, childState)
          })
        : undefined,
      remove: spec.remove,
      finalize: (state: unknown) => finalize(state),
    }
  }

  const readAggregatedValue = (row: DataGridRowNode<T>): unknown => {
    const raw = readValue(row)
    return coerceForOp(op, raw, spec.coerce)
  }

  let createBuiltInState: () => unknown
  let addBuiltInValue: (state: unknown, value: unknown) => void
  let mergeBuiltInState: (state: unknown, childState: unknown) => void
  let finalize: (state: unknown) => unknown

  switch (op) {
    case "sum":
      createBuiltInState = () => ({ value: 0 })
      addBuiltInValue = (state, value) => {
        const candidate = normalizeNumber(value)
        if (candidate != null) {
          ;(state as { value: number }).value += candidate
        }
      }
      mergeBuiltInState = (state, childState) => {
        ;(state as { value: number }).value += (childState as { value: number }).value
      }
      finalize = state => (state as { value: number }).value
      break
    case "avg":
      createBuiltInState = () => ({ sum: 0, count: 0 } satisfies AvgState)
      addBuiltInValue = (state, value) => {
        const candidate = normalizeNumber(value)
        if (candidate != null) {
          const avgState = state as AvgState
          avgState.sum += candidate
          avgState.count += 1
        }
      }
      mergeBuiltInState = (state, childState) => {
        const target = state as AvgState
        const child = childState as AvgState
        target.sum += child.sum
        target.count += child.count
      }
      finalize = state => {
        const avgState = state as AvgState
        return avgState.count > 0 ? avgState.sum / avgState.count : null
      }
      break
    case "count":
      createBuiltInState = () => ({ value: 0 })
      addBuiltInValue = (state) => {
        ;(state as { value: number }).value += 1
      }
      mergeBuiltInState = (state, childState) => {
        ;(state as { value: number }).value += (childState as { value: number }).value
      }
      finalize = state => (state as { value: number }).value
      break
    case "countNonNull":
      createBuiltInState = () => ({ value: 0 })
      addBuiltInValue = (state, value) => {
        // countNonNull is intentionally evaluated after `coerce`/readValue normalization.
        if (value != null) {
          ;(state as { value: number }).value += 1
        }
      }
      mergeBuiltInState = (state, childState) => {
        ;(state as { value: number }).value += (childState as { value: number }).value
      }
      finalize = state => (state as { value: number }).value
      break
    case "min":
      createBuiltInState = () => ({ value: null as unknown })
      addBuiltInValue = (state, value) => {
        if (value == null) {
          return
        }
        const current = state as { value: unknown }
        if (current.value == null || compareUnknown(value, current.value) < 0) {
          current.value = value
        }
      }
      mergeBuiltInState = (state, childState) => {
        const childValue = (childState as { value: unknown }).value
        if (childValue == null) {
          return
        }
        const current = state as { value: unknown }
        if (current.value == null || compareUnknown(childValue, current.value) < 0) {
          current.value = childValue
        }
      }
      finalize = state => (state as { value: unknown }).value ?? null
      break
    case "max":
      createBuiltInState = () => ({ value: null as unknown })
      addBuiltInValue = (state, value) => {
        if (value == null) {
          return
        }
        const current = state as { value: unknown }
        if (current.value == null || compareUnknown(value, current.value) > 0) {
          current.value = value
        }
      }
      mergeBuiltInState = (state, childState) => {
        const childValue = (childState as { value: unknown }).value
        if (childValue == null) {
          return
        }
        const current = state as { value: unknown }
        if (current.value == null || compareUnknown(childValue, current.value) > 0) {
          current.value = childValue
        }
      }
      finalize = state => (state as { value: unknown }).value ?? null
      break
    case "first":
      createBuiltInState = () => ({ hasValue: false, value: undefined } satisfies FirstState)
      addBuiltInValue = (state, value) => {
        const firstState = state as FirstState
        if (!firstState.hasValue) {
          firstState.hasValue = true
          firstState.value = value
        }
      }
      mergeBuiltInState = (state, childState) => {
        const target = state as FirstState
        const child = childState as FirstState
        if (!target.hasValue && child.hasValue) {
          target.hasValue = true
          target.value = child.value
        }
      }
      finalize = state => {
        const firstState = state as FirstState
        return firstState.hasValue ? firstState.value : null
      }
      break
    case "last":
      createBuiltInState = () => ({ hasValue: false, value: undefined } satisfies LastState)
      addBuiltInValue = (state, value) => {
        const lastState = state as LastState
        lastState.hasValue = true
        lastState.value = value
      }
      mergeBuiltInState = (state, childState) => {
        const target = state as LastState
        const child = childState as LastState
        if (child.hasValue) {
          target.hasValue = true
          target.value = child.value
        }
      }
      finalize = state => {
        const lastState = state as LastState
        return lastState.hasValue ? lastState.value : null
      }
      break
    default:
      return null
  }

  return {
    key,
    op,
    readValue: readAggregatedValue,
    createState: createBuiltInState,
    add: (state: unknown, value: unknown, _row: DataGridRowNode<T>) => addBuiltInValue(state, value),
    merge: (state: unknown, childState: unknown) => mergeBuiltInState(state, childState),
    finalize,
  }
}

function createStates<T>(
  columns: readonly DataGridCompiledAggregationColumn<T>[],
): unknown[] {
  return columns.map(column => column.createState())
}

function finalizeStates<T>(
  columns: readonly DataGridCompiledAggregationColumn<T>[],
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
  columns: readonly DataGridCompiledAggregationColumn<T>[],
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
  columns: readonly DataGridCompiledAggregationColumn<T>[],
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
): readonly DataGridCompiledAggregationColumn<T>[] {
  if (!model || !Array.isArray(model.columns) || model.columns.length === 0) {
    return []
  }
  const compiled: DataGridCompiledAggregationColumn<T>[] = []
  for (const spec of model.columns) {
    const column = compileColumnSpec(spec)
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
): DataGridAggregationEngine<T> {
  let model = initialModel
  let compiledColumns = compileAggregationColumns(model)
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
        state[column.key] = { sum: 0, count: 0 } satisfies AvgState
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
    const contribution: Record<string, unknown> = {}
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
        ? ({ sum: 0, count: 0 } satisfies AvgState)
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
        const target = (groupState[column.key] ?? { sum: 0, count: 0 }) as AvgState
        const previousValue = (previous?.[column.key] ?? { sum: 0, count: 0 }) as AvgState
        const nextValue = (next?.[column.key] ?? { sum: 0, count: 0 }) as AvgState
        target.sum += (nextValue.sum ?? 0) - (previousValue.sum ?? 0)
        target.count += (nextValue.count ?? 0) - (previousValue.count ?? 0)
        groupState[column.key] = target
        continue
      }
      const current = Number(groupState[column.key] ?? 0)
      const previousValue = Number(previous?.[column.key] ?? 0)
      const nextValue = Number(next?.[column.key] ?? 0)
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
        const state = (groupState[column.key] ?? { sum: 0, count: 0 }) as AvgState
        aggregates[column.key] = state.count > 0 ? state.sum / state.count : null
        continue
      }
      aggregates[column.key] = Number(groupState[column.key] ?? 0)
    }
    return aggregates
  }

  return {
    setModel(nextModel: DataGridAggregationModel<T> | null) {
      model = nextModel
      compiledColumns = compileAggregationColumns(model)
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
