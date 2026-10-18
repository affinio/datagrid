import type {
  DataGridRowId,
  DataGridRowIdResolver,
  DataGridRowNode,
  DataGridRowNodeInput,
} from "./public.js"

export interface CreateClientRowStoreOptions<T> {
  rows?: readonly DataGridRowNodeInput<T>[]
  resolveRowId?: DataGridRowIdResolver<T>
}

export interface ClientRowStoreSnapshot<T> {
  readonly revision: number
  readonly rows: readonly DataGridRowNode<T>[]
}

export type ClientRowStoreListener<T> = (snapshot: ClientRowStoreSnapshot<T>) => void

export interface ClientRowStore<T> {
  getSnapshot(): ClientRowStoreSnapshot<T>
  getRows(): readonly DataGridRowNode<T>[]
  getRow(index: number): DataGridRowNode<T> | undefined
  getRowById(rowId: DataGridRowId): DataGridRowNode<T> | undefined
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  appendRows(rows: readonly DataGridRowNodeInput<T>[]): void
  removeRows(rowIds: readonly DataGridRowId[]): boolean
  subscribe(listener: ClientRowStoreListener<T>): () => void
  dispose(): void
}

function isRowNode<T>(value: DataGridRowNodeInput<T>): value is DataGridRowNode<T> {
  return Boolean(value && typeof value === "object"
    && ((value as DataGridRowNode<T>).kind === "leaf" || (value as DataGridRowNode<T>).kind === "group")
    && "rowKey" in value)
}

function rowValue<T>(input: DataGridRowNodeInput<T>): T {
  if (isRowNode(input)) return input.data
  if (input && typeof input === "object" && "row" in input) return (input as { row: T }).row
  if (input && typeof input === "object" && "data" in input) return (input as { data: T }).data
  return input as T
}

function resolveId<T>(
  input: DataGridRowNodeInput<T>,
  row: T,
  index: number,
  resolver?: DataGridRowIdResolver<T>,
): DataGridRowId {
  if (isRowNode(input)) return input.rowId ?? input.rowKey
  if (typeof resolver === "function") return resolver(row, index)
  if (row && typeof row === "object") {
    const value = (row as { rowId?: unknown; id?: unknown }).rowId ?? (row as { id?: unknown }).id
    if (typeof value === "string" || typeof value === "number") return value
  }
  return index
}

function normalizeRows<T>(
  inputs: readonly DataGridRowNodeInput<T>[],
  resolver?: DataGridRowIdResolver<T>,
): readonly DataGridRowNode<T>[] {
  const ids = new Set<DataGridRowId>()
  return inputs.map((input, index) => {
    const row = rowValue(input)
    const id = resolveId(input, row, index, resolver)
    if (typeof id !== "string" && typeof id !== "number") {
      throw new Error("[DataGrid] Row id must be a string or number.")
    }
    if (ids.has(id)) throw new Error(`[DataGrid] Duplicate row id '${String(id)}'.`)
    ids.add(id)
    if (isRowNode(input)) {
      return { ...input, data: row, row, rowId: id, rowKey: id, sourceIndex: index, originalIndex: index, displayIndex: index }
    }
    return {
      kind: "leaf",
      data: row,
      row,
      rowId: id,
      rowKey: id,
      sourceIndex: index,
      originalIndex: index,
      displayIndex: index,
      state: { selected: false, group: false, pinned: "none", expanded: false },
    }
  })
}

/** A formula-free, projection-free store for canonical client row nodes. */
export function createClientRowStore<T>(options: CreateClientRowStoreOptions<T> = {}): ClientRowStore<T> {
  let rows = normalizeRows(options.rows ?? [], options.resolveRowId)
  let revision = 0
  let disposed = false
  const listeners = new Set<ClientRowStoreListener<T>>()
  const snapshot = (): ClientRowStoreSnapshot<T> => ({ revision, rows })
  const ensureActive = (): void => {
    if (disposed) throw new Error("ClientRowStore has been disposed")
  }
  const commit = (nextRows: readonly DataGridRowNodeInput<T>[]): void => {
    ensureActive()
    rows = normalizeRows(nextRows, options.resolveRowId)
    revision += 1
    const current = snapshot()
    for (const listener of listeners) listener(current)
  }
  return {
    getSnapshot: snapshot,
    getRows: () => rows,
    getRow: index => rows[index],
    getRowById: rowId => rows.find(row => row.rowId === rowId),
    setRows: nextRows => commit(nextRows),
    appendRows: nextRows => {
      if (nextRows.length > 0) commit([...rows, ...nextRows])
    },
    removeRows: rowIds => {
      const ids = new Set(rowIds)
      const nextRows = rows.filter(row => !ids.has(row.rowId))
      if (nextRows.length === rows.length) return false
      commit(nextRows)
      return true
    },
    subscribe: listener => {
      ensureActive()
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: () => {
      disposed = true
      listeners.clear()
    },
  }
}
