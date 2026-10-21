import type { DataGridRowId } from "../models/rowModel.js"

export interface DataGridRowSelectionModelSnapshot {
  readonly revision: number
  readonly selectedRowIds: ReadonlySet<DataGridRowId>
}

const rowIdSetValues = new WeakMap<object, Set<DataGridRowId>>()

function getBackingSet(set: object): Set<DataGridRowId> {
  const values = rowIdSetValues.get(set)
  if (!values) {
    throw new Error("Immutable row selection set is not initialized")
  }
  return values
}

class ImmutableDataGridRowIdSet implements ReadonlySet<DataGridRowId> {
  constructor(values: Iterable<DataGridRowId>) {
    rowIdSetValues.set(this, new Set(values))
    Object.freeze(this)
  }

  get size(): number {
    return getBackingSet(this).size
  }

  has(value: DataGridRowId): boolean {
    return getBackingSet(this).has(value)
  }

  entries(): SetIterator<[DataGridRowId, DataGridRowId]> {
    return getBackingSet(this).entries()
  }

  keys(): SetIterator<DataGridRowId> {
    return getBackingSet(this).keys()
  }

  values(): SetIterator<DataGridRowId> {
    return getBackingSet(this).values()
  }

  forEach(
    callbackfn: (value: DataGridRowId, value2: DataGridRowId, set: ReadonlySet<DataGridRowId>) => void,
    thisArg?: unknown,
  ): void {
    getBackingSet(this).forEach(value => callbackfn.call(thisArg, value, value, this))
  }

  [Symbol.iterator](): SetIterator<DataGridRowId> {
    return getBackingSet(this)[Symbol.iterator]()
  }
}

function createSnapshot(revision: number, rowIds: Iterable<DataGridRowId>): DataGridRowSelectionModelSnapshot {
  return Object.freeze({
    revision,
    selectedRowIds: new ImmutableDataGridRowIdSet(rowIds),
  })
}

function sameIds(left: ReadonlySet<DataGridRowId>, right: ReadonlySet<DataGridRowId>): boolean {
  if (left.size !== right.size) {
    return false
  }
  for (const rowId of left) {
    if (!right.has(rowId)) {
      return false
    }
  }
  return true
}

function transition(
  snapshot: DataGridRowSelectionModelSnapshot,
  nextIds: Set<DataGridRowId>,
): DataGridRowSelectionModelSnapshot {
  return sameIds(snapshot.selectedRowIds, nextIds)
    ? snapshot
    : createSnapshot(snapshot.revision + 1, nextIds)
}

export function createDataGridRowSelectionModelSnapshot(
  rowIds: Iterable<DataGridRowId> = [],
): DataGridRowSelectionModelSnapshot {
  return createSnapshot(0, rowIds)
}

export function replaceDataGridRowSelectionModel(
  snapshot: DataGridRowSelectionModelSnapshot,
  rowIds: Iterable<DataGridRowId>,
): DataGridRowSelectionModelSnapshot {
  return transition(snapshot, new Set(rowIds))
}

/** Advances the revision when an external selection representation changes. */
export function advanceDataGridRowSelectionModelRevision(
  snapshot: DataGridRowSelectionModelSnapshot,
  rowIds: Iterable<DataGridRowId> = snapshot.selectedRowIds,
): DataGridRowSelectionModelSnapshot {
  return createSnapshot(snapshot.revision + 1, rowIds)
}

export function addDataGridRowSelectionModelRows(
  snapshot: DataGridRowSelectionModelSnapshot,
  rowIds: Iterable<DataGridRowId>,
): DataGridRowSelectionModelSnapshot {
  const nextIds = new Set(snapshot.selectedRowIds)
  for (const rowId of rowIds) {
    nextIds.add(rowId)
  }
  return transition(snapshot, nextIds)
}

export function removeDataGridRowSelectionModelRows(
  snapshot: DataGridRowSelectionModelSnapshot,
  rowIds: Iterable<DataGridRowId>,
): DataGridRowSelectionModelSnapshot {
  const nextIds = new Set(snapshot.selectedRowIds)
  for (const rowId of rowIds) {
    nextIds.delete(rowId)
  }
  return transition(snapshot, nextIds)
}

export function toggleDataGridRowSelectionModelRow(
  snapshot: DataGridRowSelectionModelSnapshot,
  rowId: DataGridRowId,
): DataGridRowSelectionModelSnapshot {
  const nextIds = new Set(snapshot.selectedRowIds)
  if (nextIds.has(rowId)) {
    nextIds.delete(rowId)
  } else {
    nextIds.add(rowId)
  }
  return transition(snapshot, nextIds)
}
