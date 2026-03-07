import type {
  DataGridRowId,
  DataGridRowNode,
} from "./rowModel.js"

export interface ClientRowComputedSnapshotRuntimeContext<T> {
  applyRowDataPatch: (current: T, patch: Partial<T>) => T
  getSourceRows: () => readonly DataGridRowNode<T>[]
  getSourceRowIndexById: () => ReadonlyMap<DataGridRowId, number>
}

export interface ClientRowComputedSnapshotRuntime<T> {
  clear: () => void
  setComputedFields: (fields: readonly string[]) => boolean
  pruneRows: (rows: readonly DataGridRowNode<T>[]) => boolean
  applyComputedUpdates: (updatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>) => boolean
  replaceWithPatchedSnapshot: (input: {
    computedFields: readonly string[]
    updatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>
  }) => {
    changed: boolean
    fieldsChanged: boolean
  }
  createSnapshot: () => {
    computedFields: readonly string[]
    overlayValuesByField: Readonly<Record<string, readonly unknown[]>>
    rowCount: number
  }
  replaceSnapshot: (snapshot: {
    computedFields: readonly string[]
    overlayValuesByField: Readonly<Record<string, readonly unknown[]>>
    rowCount: number
  }) => boolean
  readFieldValue: (
    row: DataGridRowNode<T>,
    field: string,
    readBaseValue: (row: DataGridRowNode<T>) => unknown,
  ) => unknown
  materializeRow: (row: DataGridRowNode<T>) => DataGridRowNode<T>
  materializeRows: (rows: readonly DataGridRowNode<T>[]) => DataGridRowNode<T>[]
}

export function createClientRowComputedSnapshotRuntime<T>(
  context: ClientRowComputedSnapshotRuntimeContext<T>,
): ClientRowComputedSnapshotRuntime<T> {
  interface ComputedSnapshotState {
    computedFields: Set<string>
    overlayValuesByField: Map<string, unknown[]>
    overlayFieldCountByRowIndex: Map<number, number>
  }

  const createEmptyState = (): ComputedSnapshotState => ({
    computedFields: new Set<string>(),
    overlayValuesByField: new Map<string, unknown[]>(),
    overlayFieldCountByRowIndex: new Map<number, number>(),
  })

  let snapshotState = createEmptyState()

  const incrementRowOverlayCount = (state: ComputedSnapshotState, rowIndex: number): void => {
    state.overlayFieldCountByRowIndex.set(
      rowIndex,
      (state.overlayFieldCountByRowIndex.get(rowIndex) ?? 0) + 1,
    )
  }

  const decrementRowOverlayCount = (state: ComputedSnapshotState, rowIndex: number): void => {
    const nextCount = (state.overlayFieldCountByRowIndex.get(rowIndex) ?? 0) - 1
    if (nextCount > 0) {
      state.overlayFieldCountByRowIndex.set(rowIndex, nextCount)
      return
    }
    state.overlayFieldCountByRowIndex.delete(rowIndex)
  }

  const rebuildOverlayFieldCounts = (state: ComputedSnapshotState): void => {
    state.overlayFieldCountByRowIndex.clear()
    for (const values of state.overlayValuesByField.values()) {
      for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
        if (!(rowIndex in values)) {
          continue
        }
        incrementRowOverlayCount(state, rowIndex)
      }
    }
  }

  const cloneState = (state: ComputedSnapshotState): ComputedSnapshotState => ({
    computedFields: new Set<string>(state.computedFields),
    overlayValuesByField: new Map<string, unknown[]>(
      Array.from(state.overlayValuesByField.entries(), ([field, values]) => [field, values.slice()]),
    ),
    overlayFieldCountByRowIndex: new Map<number, number>(state.overlayFieldCountByRowIndex),
  })

  const serializeState = (state: ComputedSnapshotState): {
    computedFields: readonly string[]
    overlayValuesByField: Readonly<Record<string, readonly unknown[]>>
    rowCount: number
  } => {
    const overlayValuesByField: Record<string, readonly unknown[]> = {}
    for (const [field, values] of state.overlayValuesByField.entries()) {
      overlayValuesByField[field] = values.slice()
    }
    return {
      computedFields: Array.from(state.computedFields),
      overlayValuesByField,
      rowCount: context.getSourceRows().length,
    }
  }

  const deserializeState = (snapshot: {
    computedFields: readonly string[]
    overlayValuesByField: Readonly<Record<string, readonly unknown[]>>
    rowCount: number
  }): ComputedSnapshotState => {
    const nextState = createEmptyState()
    for (const field of snapshot.computedFields) {
      const normalizedField = field.trim()
      if (normalizedField.length > 0) {
        nextState.computedFields.add(normalizedField)
      }
    }
    for (const [field, values] of Object.entries(snapshot.overlayValuesByField ?? {})) {
      const normalizedField = field.trim()
      if (normalizedField.length === 0 || !nextState.computedFields.has(normalizedField)) {
        continue
      }
      nextState.overlayValuesByField.set(normalizedField, Array.from(values ?? []))
    }
    rebuildOverlayFieldCounts(nextState)
    return nextState
  }

  const setComputedFieldsInState = (
    state: ComputedSnapshotState,
    fields: readonly string[],
  ): boolean => {
    const nextFields = new Set(fields.map(field => field.trim()).filter(field => field.length > 0))
    let changed = nextFields.size !== state.computedFields.size
    if (!changed) {
      for (const field of nextFields) {
        if (!state.computedFields.has(field)) {
          changed = true
          break
        }
      }
    }
    if (!changed) {
      return false
    }
    state.computedFields.clear()
    for (const field of nextFields) {
      state.computedFields.add(field)
    }
    for (const field of Array.from(state.overlayValuesByField.keys())) {
      if (state.computedFields.has(field)) {
        continue
      }
      state.overlayValuesByField.delete(field)
    }
    rebuildOverlayFieldCounts(state)
    return true
  }

  const applyComputedUpdatesInState = (
    state: ComputedSnapshotState,
    updatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>,
  ): boolean => {
    let changed = false
    const sourceRows = context.getSourceRows()
    for (const [rowId, patch] of updatesByRowId.entries()) {
      const rowIndex = context.getSourceRowIndexById().get(rowId)
      if (typeof rowIndex !== "number" || rowIndex < 0) {
        continue
      }
      const sourceRow = sourceRows[rowIndex]
      const sourceRecord = sourceRow?.data as Record<string, unknown> | undefined
      for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
        if (!state.computedFields.has(key)) {
          continue
        }
        let values = state.overlayValuesByField.get(key)
        const hasCurrentValue = Boolean(values && rowIndex in values)
        const currentValue = hasCurrentValue && values
          ? values[rowIndex]
          : undefined
        const baseValue = sourceRecord?.[key]
        if (Object.is(baseValue, value)) {
          if (hasCurrentValue && values) {
            delete values[rowIndex]
            decrementRowOverlayCount(state, rowIndex)
            changed = true
          }
          continue
        }
        if (Object.is(currentValue, value)) {
          continue
        }
        if (!values) {
          values = []
          state.overlayValuesByField.set(key, values)
        }
        if (!hasCurrentValue) {
          incrementRowOverlayCount(state, rowIndex)
        }
        values[rowIndex] = value
        changed = true
      }
    }
    return changed
  }

  const clear = (): void => {
    snapshotState = createEmptyState()
  }

  const setComputedFields = (fields: readonly string[]): boolean => {
    return setComputedFieldsInState(snapshotState, fields)
  }

  const pruneRows = (rows: readonly DataGridRowNode<T>[]): boolean => {
    const previousIndexById = context.getSourceRowIndexById()
    let changed = false
    snapshotState.overlayFieldCountByRowIndex.clear()
    for (const [field, values] of snapshotState.overlayValuesByField.entries()) {
      const nextValues: unknown[] = []
      let fieldChanged = false
      for (let nextIndex = 0; nextIndex < rows.length; nextIndex += 1) {
        const rowId = rows[nextIndex]?.rowId
        const previousIndex = typeof rowId !== "undefined"
          ? previousIndexById.get(rowId)
          : undefined
        if (typeof previousIndex !== "number" || !(previousIndex in values)) {
          continue
        }
        nextValues[nextIndex] = values[previousIndex]
        incrementRowOverlayCount(snapshotState, nextIndex)
        if (previousIndex !== nextIndex) {
          fieldChanged = true
        }
      }
      const hasAnyValue = nextValues.length > 0 && nextValues.some((_, index) => index in nextValues)
      if (!hasAnyValue) {
        snapshotState.overlayValuesByField.delete(field)
        changed = true
        continue
      }
      if (fieldChanged || nextValues.length !== values.length) {
        snapshotState.overlayValuesByField.set(field, nextValues)
        changed = true
      }
    }
    return changed
  }

  const applyComputedUpdates = (
    updatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>,
  ): boolean => {
    return applyComputedUpdatesInState(snapshotState, updatesByRowId)
  }

  const replaceWithPatchedSnapshot = (input: {
    computedFields: readonly string[]
    updatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>
  }): {
    changed: boolean
    fieldsChanged: boolean
  } => {
    const nextState = cloneState(snapshotState)
    const fieldsChanged = setComputedFieldsInState(nextState, input.computedFields)
    const updatesChanged = applyComputedUpdatesInState(nextState, input.updatesByRowId)
    if (!fieldsChanged && !updatesChanged) {
      return {
        changed: false,
        fieldsChanged: false,
      }
    }
    snapshotState = nextState
    return {
      changed: true,
      fieldsChanged,
    }
  }

  const createSnapshot = (): {
    computedFields: readonly string[]
    overlayValuesByField: Readonly<Record<string, readonly unknown[]>>
    rowCount: number
  } => {
    return serializeState(snapshotState)
  }

  const replaceSnapshot = (snapshot: {
    computedFields: readonly string[]
    overlayValuesByField: Readonly<Record<string, readonly unknown[]>>
    rowCount: number
  }): boolean => {
    snapshotState = deserializeState(snapshot)
    return true
  }

  const readFieldValue = (
    row: DataGridRowNode<T>,
    field: string,
    readBaseValue: (row: DataGridRowNode<T>) => unknown,
  ): unknown => {
    const rowIndex = context.getSourceRowIndexById().get(row.rowId)
    const values = snapshotState.overlayValuesByField.get(field)
    if (typeof rowIndex === "number" && values && rowIndex in values) {
      return values[rowIndex]
    }
    return readBaseValue(row)
  }

  const materializeRow = (row: DataGridRowNode<T>): DataGridRowNode<T> => {
    const rowIndex = context.getSourceRowIndexById().get(row.rowId)
    if (
      typeof rowIndex !== "number"
      || snapshotState.overlayValuesByField.size === 0
      || !snapshotState.overlayFieldCountByRowIndex.has(rowIndex)
    ) {
      return row
    }
    let computedPatch: Record<string, unknown> | null = null
    for (const [field, values] of snapshotState.overlayValuesByField.entries()) {
      if (!(rowIndex in values)) {
        continue
      }
      const nextValue = values[rowIndex]
      const previousValue = (row.data as Record<string, unknown>)[field]
      if (Object.is(previousValue, nextValue)) {
        continue
      }
      if (!computedPatch) {
        computedPatch = {}
      }
      computedPatch[field] = nextValue
    }
    if (!computedPatch) {
      return row
    }
    const nextData = context.applyRowDataPatch(row.data, computedPatch as Partial<T>)
    if (nextData === row.data) {
      return row
    }
    return {
      ...row,
      data: nextData,
      row: nextData,
    }
  }

  const materializeRows = (rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] => {
    return rows.map(materializeRow)
  }

  return {
    clear,
    setComputedFields,
    pruneRows,
    applyComputedUpdates,
    replaceWithPatchedSnapshot,
    createSnapshot,
    replaceSnapshot,
    readFieldValue,
    materializeRow,
    materializeRows,
  }
}
