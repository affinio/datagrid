import { computed, nextTick, onUnmounted, ref, shallowRef, watch, type Ref } from "vue"
import {
  createClientRowModel,
  type ClientRowModel,
  type CreateClientRowModelOptions,
  type DataGridRowModel,
  type DataGridRowNodeInput,
} from "@affino/datagrid-vue"

function getProjectionStageNow(): number {
  const performanceApi = globalThis.performance
  if (performanceApi && typeof performanceApi.now === "function") {
    return performanceApi.now()
  }
  return Date.now()
}

const defaultProjectionStageTimer: NonNullable<CreateClientRowModelOptions<unknown>["projectionStageTimer"]> = (_stage, run) => {
  const startedAt = getProjectionStageNow()
  const result = run()
  return {
    result,
    duration: Math.max(0, getProjectionStageNow() - startedAt),
  }
}

function resolveClientRowModelOptions(
  value: Omit<CreateClientRowModelOptions<unknown>, "rows"> | undefined,
): Omit<CreateClientRowModelOptions<unknown>, "rows"> {
  return {
    projectionStageTimer: defaultProjectionStageTimer,
    ...(value ?? {}),
  }
}

function cloneClientRowModelOptionValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (!value || typeof value !== "object") {
    return value
  }
  const existing = seen.get(value)
  if (existing) {
    return existing
  }
  if (Array.isArray(value)) {
    const clone: unknown[] = []
    seen.set(value, clone)
    for (const entry of value) {
      clone.push(cloneClientRowModelOptionValue(entry, seen))
    }
    return clone
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return value
  }
  const clone: Record<string, unknown> = {}
  seen.set(value, clone)
  for (const key of Object.keys(value)) {
    clone[key] = cloneClientRowModelOptionValue((value as Record<string, unknown>)[key], seen)
  }
  return clone
}

function areClientRowModelOptionValuesEqual(left: unknown, right: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(left, right)) {
    return true
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    return false
  }
  const previousRight = seen.get(left)
  if (previousRight === right) {
    return true
  }
  seen.set(left, right)
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((value, index) => areClientRowModelOptionValuesEqual(value, right[index], seen))
  }
  const leftPrototype = Object.getPrototypeOf(left)
  const rightPrototype = Object.getPrototypeOf(right)
  if (leftPrototype !== Object.prototype && leftPrototype !== null || rightPrototype !== Object.prototype && rightPrototype !== null) {
    return false
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  return leftKeys.every(key => (
    Object.prototype.hasOwnProperty.call(right, key)
    && areClientRowModelOptionValuesEqual(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
      seen,
    )
  ))
}

export type DataGridAppRowsUpdateMode = "replace" | "patch"

function resolveDiffRow(
  value: unknown,
  index: number,
  resolveRowId: ((row: unknown, index: number) => string | number) | undefined,
): { id: string | number; data: unknown } | null {
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    if ((candidate.kind === "leaf" || candidate.kind === "group")
      && (typeof candidate.rowId === "string" || typeof candidate.rowId === "number")
      && "data" in candidate) {
      return { id: candidate.rowId, data: candidate.data }
    }
  }
  const id = typeof resolveRowId === "function"
    ? resolveRowId(value, index)
    : value && typeof value === "object"
      ? ((value as Record<string, unknown>).rowId ?? (value as Record<string, unknown>).id)
      : index
  if (typeof id !== "string" && typeof id !== "number") {
    return null
  }
  return { id, data: value }
}

function areDiffRowValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object"
    || Array.isArray(left) || Array.isArray(right)) {
    return false
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length && leftKeys.every(key => (
    Object.prototype.hasOwnProperty.call(right, key)
    && Object.is((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
  ))
}

function resolveRowDiff(
  previousRows: readonly unknown[],
  nextRows: readonly unknown[],
  resolveRowId: ((row: unknown, index: number) => string | number) | undefined,
): Array<{ rowId: string | number; data: Record<string, unknown> }> | null {
  if (previousRows.length !== nextRows.length) {
    return null
  }
  const updates: Array<{ rowId: string | number; data: Record<string, unknown> }> = []
  for (let index = 0; index < nextRows.length; index += 1) {
    const previous = resolveDiffRow(previousRows[index], index, resolveRowId)
    const next = resolveDiffRow(nextRows[index], index, resolveRowId)
    if (!previous || !next || !Object.is(previous.id, next.id)) {
      return null
    }
    if (!areDiffRowValuesEqual(previous.data, next.data)) {
      if (!next.data || typeof next.data !== "object" || Array.isArray(next.data)) {
        return null
      }
      updates.push({ rowId: next.id, data: next.data as Record<string, unknown> })
    }
  }
  return updates
}

export interface UseDataGridAppRowModelOptions {
  rows: Ref<readonly unknown[]>
  rowModel: Ref<DataGridRowModel<unknown> | undefined>
  clientRowModelOptions: Ref<Omit<CreateClientRowModelOptions<unknown>, "rows"> | undefined>
  rowsUpdateMode?: DataGridAppRowsUpdateMode
  onOwnedRowModelRecreated?: () => void
}

export interface UseDataGridAppRowModelResult {
  dataGridInstanceKey: Ref<number>
  resolvedRowModel: Ref<DataGridRowModel<unknown>>
  disposeOwnedRowModel: (model: DataGridRowModel<unknown> | null) => void
}

export function useDataGridAppRowModel(
  options: UseDataGridAppRowModelOptions,
): UseDataGridAppRowModelResult {
  const dataGridInstanceKey = ref(0)
  let lastRowsForDiff = options.rows.value
  let lastClientRowModelOptions = options.clientRowModelOptions.value
  let lastClientRowModelOptionsSnapshot = cloneClientRowModelOptionValue(lastClientRowModelOptions)
  const fallbackRowModel = createClientRowModel<unknown>()
  const internalRowModel = shallowRef<ClientRowModel<unknown> | null>(
    options.rowModel.value
      ? null
      : createClientRowModel<unknown>({
          rows: options.rows.value as readonly DataGridRowNodeInput<unknown>[],
          ...resolveClientRowModelOptions(options.clientRowModelOptions.value),
        }),
  )

  const disposeOwnedRowModel = (model: DataGridRowModel<unknown> | null): void => {
    if (!model || model === options.rowModel.value) {
      return
    }
    if ("dispose" in model && typeof model.dispose === "function") {
      model.dispose()
    }
  }

  const disposeOwnedRowModelLater = (model: DataGridRowModel<unknown> | null): void => {
    if (!model || model === options.rowModel.value) {
      return
    }
    void nextTick(() => {
      disposeOwnedRowModel(model)
    })
  }

  const recreateInternalRowModel = (): void => {
    if (options.rowModel.value) {
      return
    }
    const previousModel = internalRowModel.value
    internalRowModel.value = createClientRowModel<unknown>({
      rows: options.rows.value as readonly DataGridRowNodeInput<unknown>[],
      ...resolveClientRowModelOptions(options.clientRowModelOptions.value),
    })
    dataGridInstanceKey.value += 1
    options.onOwnedRowModelRecreated?.()
    lastClientRowModelOptions = options.clientRowModelOptions.value
    lastClientRowModelOptionsSnapshot = cloneClientRowModelOptionValue(lastClientRowModelOptions)
    disposeOwnedRowModelLater(previousModel)
  }

  const resolvedRowModel = computed<DataGridRowModel<unknown>>(() => {
    return options.rowModel.value ?? internalRowModel.value ?? fallbackRowModel
  })

  watch(
    options.rows,
    nextRows => {
      if (!internalRowModel.value) {
        return
      }
      const previousRows = lastRowsForDiff
      lastRowsForDiff = nextRows
      if (options.rowsUpdateMode === "patch" && previousRows !== nextRows) {
        const updates = resolveRowDiff(
          previousRows,
          nextRows,
          options.clientRowModelOptions.value?.resolveRowId as ((row: unknown, index: number) => string | number) | undefined,
        )
        if (updates) {
          if (updates.length > 0) {
            internalRowModel.value.patchRows(updates)
          }
          return
        }
      }
      internalRowModel.value.setRows(nextRows as readonly DataGridRowNodeInput<unknown>[])
    },
    { deep: false },
  )

  watch(
    options.clientRowModelOptions,
    nextOptions => {
      if (nextOptions !== lastClientRowModelOptions
        && areClientRowModelOptionValuesEqual(nextOptions, lastClientRowModelOptionsSnapshot)) {
        lastClientRowModelOptions = nextOptions
        return
      }
      recreateInternalRowModel()
    },
    { deep: true },
  )

  watch(
    options.rowModel,
    nextRowModel => {
      if (nextRowModel) {
        const previousModel = internalRowModel.value
        internalRowModel.value = null
        dataGridInstanceKey.value += 1
        disposeOwnedRowModelLater(previousModel)
        return
      }
      if (!internalRowModel.value) {
        recreateInternalRowModel()
      }
    },
  )

  onUnmounted(() => {
    disposeOwnedRowModel(internalRowModel.value)
    disposeOwnedRowModel(fallbackRowModel)
  })

  return {
    dataGridInstanceKey,
    resolvedRowModel,
    disposeOwnedRowModel,
  }
}
