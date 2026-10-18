import type { DataGridGroupExpansionSnapshot, DataGridRowId, DataGridRowNode } from "../rowModel.js"
import { createChunkedSequence } from "./treeProjectionChunkedSequence.js"

export interface TreeGroupIndexShift {
  start: number
  delta: number
}

type ExpansionToggledKeysCacheEntry = {
  ref: readonly string[]
  set: ReadonlySet<string>
}

const EMPTY_STRING_SET: ReadonlySet<string> = new Set<string>()
const EXPANSION_TOGGLED_KEYS_CACHE = new WeakMap<DataGridGroupExpansionSnapshot, ExpansionToggledKeysCacheEntry>()

export function resolveExpansionToggledKeys(
  snapshot: DataGridGroupExpansionSnapshot,
  precomputedExpansionToggledKeys?: ReadonlySet<string>,
): ReadonlySet<string> {
  if (precomputedExpansionToggledKeys) {
    return precomputedExpansionToggledKeys
  }
  if (snapshot.toggledGroupKeys.length === 0) {
    return EMPTY_STRING_SET
  }

  const cached = EXPANSION_TOGGLED_KEYS_CACHE.get(snapshot)
  if (cached && cached.ref === snapshot.toggledGroupKeys) {
    return cached.set
  }

  const set = new Set(snapshot.toggledGroupKeys)
  EXPANSION_TOGGLED_KEYS_CACHE.set(snapshot, {
    ref: snapshot.toggledGroupKeys,
    set,
  })
  return set
}

export function resolveSingleExpansionDelta(
  previousSnapshot: DataGridGroupExpansionSnapshot,
  nextSnapshot: DataGridGroupExpansionSnapshot,
  previousSet?: ReadonlySet<string>,
  nextSet?: ReadonlySet<string>,
): string | null {
  if (previousSnapshot.expandedByDefault !== nextSnapshot.expandedByDefault) {
    return null
  }
  const previousArray = previousSnapshot.toggledGroupKeys
  const nextArray = nextSnapshot.toggledGroupKeys
  if (Math.abs(previousArray.length - nextArray.length) > 1) {
    return null
  }

  const previous = previousSet ?? new Set<string>(previousArray)
  const next = nextSet ?? new Set<string>(nextArray)
  let changedKey: string | null = null
  let changedCount = 0
  for (const key of previous) {
    if (!next.has(key)) {
      changedCount += 1
      if (changedCount > 1) {
        return null
      }
      changedKey = key
    }
  }
  for (const key of next) {
    if (!previous.has(key)) {
      changedCount += 1
      if (changedCount > 1) {
        return null
      }
      changedKey = key
    }
  }
  return changedCount === 1 ? changedKey : null
}

export function projectionSegmentMatches<T>(
  rows: readonly DataGridRowNode<T>[],
  startIndex: number,
  expectedRows: readonly DataGridRowNode<T>[],
): boolean {
  if (startIndex < 0 || startIndex + expectedRows.length > rows.length) {
    return false
  }
  for (let index = 0; index < expectedRows.length; index += 1) {
    const current = rows[startIndex + index]
    const expected = expectedRows[index]
    if (!current || !expected) {
      return false
    }
    if (current.rowId !== expected.rowId || current.kind !== expected.kind) {
      return false
    }
  }
  return true
}

export function replaceProjectionSegment<T>(
  rows: readonly DataGridRowNode<T>[],
  startIndex: number,
  removeCount: number,
  replacement: readonly DataGridRowNode<T>[],
): DataGridRowNode<T>[] {
  const safeStart = Math.max(0, Math.min(startIndex, rows.length))
  const safeRemoveCount = Math.max(0, Math.min(removeCount, rows.length - safeStart))
  const replacementSpan = Math.max(safeRemoveCount, replacement.length)
  if (replacementSpan >= 4096) {
    const sequence = createChunkedSequence(rows, 256)
    sequence.replace(safeStart, safeRemoveCount, replacement)
    return sequence.toArray()
  }

  const result = rows.slice()
  const delta = replacement.length - safeRemoveCount
  const tailStart = safeStart + safeRemoveCount

  if (delta > 0) {
    const previousLength = result.length
    result.length = previousLength + delta
    for (let index = previousLength - 1; index >= tailStart; index -= 1) {
      result[index + delta] = result[index]!
    }
  } else if (delta < 0) {
    for (let index = tailStart; index < result.length; index += 1) {
      result[index + delta] = result[index]!
    }
    result.length += delta
  }

  for (let index = 0; index < replacement.length; index += 1) {
    result[safeStart + index] = replacement[index]!
  }
  return result
}

export function resolveGroupRowIndexByRowId<T>(
  rows: readonly DataGridRowNode<T>[],
  groupRowId: DataGridRowId,
  groupIndexByRowId?: ReadonlyMap<DataGridRowId, number>,
  fallbackGroupIndexByRowId?: ReadonlyMap<DataGridRowId, number>,
  groupIndexShiftHistory?: readonly TreeGroupIndexShift[],
  groupIndexBornAt?: ReadonlyMap<DataGridRowId, number>,
): number {
  const tryResolve = (
    indexMap?: ReadonlyMap<DataGridRowId, number>,
    shiftHistory?: readonly TreeGroupIndexShift[],
    bornAt?: ReadonlyMap<DataGridRowId, number>,
  ): number => {
    const indexed = indexMap?.get(groupRowId)
    if (typeof indexed !== "number") {
      return -1
    }
    let resolved = indexed
    const startAt = bornAt?.get(groupRowId) ?? 0
    for (let index = startAt; index < (shiftHistory?.length ?? 0); index += 1) {
      const shift = shiftHistory![index]!
      if (resolved >= shift.start) {
        resolved += shift.delta
      }
    }
    const candidate = rows[resolved]
    if (candidate?.kind === "group" && candidate.rowId === groupRowId) {
      return resolved
    }
    return -1
  }

  const primary = tryResolve(groupIndexByRowId, groupIndexShiftHistory, groupIndexBornAt)
  if (primary >= 0) {
    return primary
  }
  const fallback = tryResolve(fallbackGroupIndexByRowId)
  if (fallback >= 0) {
    return fallback
  }
  return -1
}

export function updateGroupIndexAfterSubtreeReplacement<T>(
  groupIndexByRowId: Map<DataGridRowId, number>,
  groupIndexShiftHistory: TreeGroupIndexShift[],
  groupIndexBornAt: Map<DataGridRowId, number>,
  replaceStart: number,
  deletedRows: readonly DataGridRowNode<T>[],
  insertedRows: readonly DataGridRowNode<T>[],
): void {
  const deleteEnd = replaceStart + deletedRows.length
  for (const row of deletedRows) {
    if (row.kind === "group") {
      groupIndexByRowId.delete(row.rowId)
      groupIndexBornAt.delete(row.rowId)
    }
  }

  const indexDelta = insertedRows.length - deletedRows.length
  if (indexDelta !== 0) {
    groupIndexShiftHistory.push({ start: deleteEnd, delta: indexDelta })
    if (groupIndexShiftHistory.length >= 64) {
      for (const [rowId, index] of groupIndexByRowId.entries()) {
        let resolved = index
        const startAt = groupIndexBornAt.get(rowId) ?? 0
        for (let shiftIndex = startAt; shiftIndex < groupIndexShiftHistory.length; shiftIndex += 1) {
          const shift = groupIndexShiftHistory[shiftIndex]!
          if (resolved >= shift.start) {
            resolved += shift.delta
          }
        }
        groupIndexByRowId.set(rowId, resolved)
      }
      groupIndexShiftHistory.length = 0
      groupIndexBornAt.clear()
    }
  }

  for (let offset = 0; offset < insertedRows.length; offset += 1) {
    const row = insertedRows[offset]
    if (row?.kind === "group") {
      groupIndexByRowId.set(row.rowId, replaceStart + offset)
      if (groupIndexShiftHistory.length > 0) {
        groupIndexBornAt.set(row.rowId, groupIndexShiftHistory.length)
      }
    }
  }
}
