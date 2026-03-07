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
  const computedFields = new Set<string>()
  const overlayValuesByField = new Map<string, unknown[]>()
  let overlayFieldCountByRowIndex = new Uint16Array(0)

  const ensureOverlayFieldCountCapacity = (rowCount: number): void => {
    if (overlayFieldCountByRowIndex.length >= rowCount) {
      return
    }
    const next = new Uint16Array(rowCount)
    next.set(overlayFieldCountByRowIndex)
    overlayFieldCountByRowIndex = next
  }

  const incrementRowOverlayCount = (rowIndex: number): void => {
    ensureOverlayFieldCountCapacity(rowIndex + 1)
    overlayFieldCountByRowIndex[rowIndex] = (overlayFieldCountByRowIndex[rowIndex] ?? 0) + 1
  }

  const decrementRowOverlayCount = (rowIndex: number): void => {
    if (rowIndex < 0 || rowIndex >= overlayFieldCountByRowIndex.length) {
      return
    }
    const nextCount = (overlayFieldCountByRowIndex[rowIndex] ?? 0) - 1
    overlayFieldCountByRowIndex[rowIndex] = nextCount > 0 ? nextCount : 0
  }

  const rebuildOverlayFieldCounts = (): void => {
    const rowCount = context.getSourceRows().length
    ensureOverlayFieldCountCapacity(rowCount)
    overlayFieldCountByRowIndex.fill(0, 0, rowCount)
    for (const values of overlayValuesByField.values()) {
      for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
        if (!(rowIndex in values)) {
          continue
        }
        incrementRowOverlayCount(rowIndex)
      }
    }
  }

  const clear = (): void => {
    overlayValuesByField.clear()
    overlayFieldCountByRowIndex = new Uint16Array(0)
  }

  const setComputedFields = (fields: readonly string[]): boolean => {
    const nextFields = new Set(fields.map(field => field.trim()).filter(field => field.length > 0))
    let changed = nextFields.size !== computedFields.size
    if (!changed) {
      for (const field of nextFields) {
        if (!computedFields.has(field)) {
          changed = true
          break
        }
      }
    }
    if (!changed) {
      return false
    }
    computedFields.clear()
    for (const field of nextFields) {
      computedFields.add(field)
    }
    for (const field of Array.from(overlayValuesByField.keys())) {
      if (computedFields.has(field)) {
        continue
      }
      overlayValuesByField.delete(field)
    }
    rebuildOverlayFieldCounts()
    return true
  }

  const pruneRows = (rows: readonly DataGridRowNode<T>[]): boolean => {
    const previousIndexById = context.getSourceRowIndexById()
    let changed = false
    ensureOverlayFieldCountCapacity(rows.length)
    overlayFieldCountByRowIndex.fill(0, 0, rows.length)
    for (const [field, values] of overlayValuesByField.entries()) {
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
        incrementRowOverlayCount(nextIndex)
        if (previousIndex !== nextIndex) {
          fieldChanged = true
        }
      }
      const hasAnyValue = nextValues.length > 0 && nextValues.some((_, index) => index in nextValues)
      if (!hasAnyValue) {
        overlayValuesByField.delete(field)
        changed = true
        continue
      }
      if (fieldChanged || nextValues.length !== values.length) {
        overlayValuesByField.set(field, nextValues)
        changed = true
      }
    }
    return changed
  }

  const applyComputedUpdates = (
    updatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>,
  ): boolean => {
    let changed = false
    const sourceRows = context.getSourceRows()
    ensureOverlayFieldCountCapacity(sourceRows.length)
    for (const [rowId, patch] of updatesByRowId.entries()) {
      const rowIndex = context.getSourceRowIndexById().get(rowId)
      if (typeof rowIndex !== "number" || rowIndex < 0) {
        continue
      }
      const sourceRow = sourceRows[rowIndex]
      const sourceRecord = sourceRow?.data as Record<string, unknown> | undefined
      for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
        if (!computedFields.has(key)) {
          continue
        }
        let values = overlayValuesByField.get(key)
        const hasCurrentValue = Boolean(values && rowIndex in values)
        const currentValue = hasCurrentValue && values
          ? values[rowIndex]
          : undefined
        const baseValue = sourceRecord?.[key]
        if (Object.is(baseValue, value)) {
          if (hasCurrentValue && values) {
            delete values[rowIndex]
            decrementRowOverlayCount(rowIndex)
            changed = true
          }
          continue
        }
        if (Object.is(currentValue, value)) {
          continue
        }
        if (!values) {
          values = []
          overlayValuesByField.set(key, values)
        }
        if (!hasCurrentValue) {
          incrementRowOverlayCount(rowIndex)
        }
        values[rowIndex] = value
        changed = true
      }
    }
    return changed
  }

  const readFieldValue = (
    row: DataGridRowNode<T>,
    field: string,
    readBaseValue: (row: DataGridRowNode<T>) => unknown,
  ): unknown => {
    const rowIndex = context.getSourceRowIndexById().get(row.rowId)
    const values = overlayValuesByField.get(field)
    if (typeof rowIndex === "number" && values && rowIndex in values) {
      return values[rowIndex]
    }
    return readBaseValue(row)
  }

  const materializeRow = (row: DataGridRowNode<T>): DataGridRowNode<T> => {
    const rowIndex = context.getSourceRowIndexById().get(row.rowId)
    if (
      typeof rowIndex !== "number"
      || overlayValuesByField.size === 0
      || rowIndex < 0
      || rowIndex >= overlayFieldCountByRowIndex.length
      || overlayFieldCountByRowIndex[rowIndex] === 0
    ) {
      return row
    }
    let computedPatch: Record<string, unknown> | null = null
    for (const [field, values] of overlayValuesByField.entries()) {
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
    readFieldValue,
    materializeRow,
    materializeRows,
  }
}
