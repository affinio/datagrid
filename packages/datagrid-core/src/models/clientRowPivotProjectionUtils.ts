import type {
  DataGridRowId,
  DataGridRowNode,
  DataGridSortState,
} from "./rowModel.js"

function toComparableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function comparePivotSortValue(
  left: unknown,
  right: unknown,
  normalizeText: (value: unknown) => string,
): number {
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
  return normalizeText(left).localeCompare(normalizeText(right), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

export function sortPivotProjectionRows<T>(
  rows: readonly DataGridRowNode<T>[],
  descriptors: readonly DataGridSortState[],
  readRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown,
  normalizeText: (value: unknown) => string,
): DataGridRowNode<T>[] {
  if (!Array.isArray(rows) || rows.length <= 1 || descriptors.length === 0) {
    return [...rows]
  }

  interface PivotBlock {
    anchor: DataGridRowNode<T>
    rows: DataGridRowNode<T>[]
    index: number
  }

  const blocks: PivotBlock[] = []
  const grandTotalRows: DataGridRowNode<T>[] = []
  let index = 0
  while (index < rows.length) {
    const current = rows[index]
    if (!current) {
      index += 1
      continue
    }
    if (String(current.rowId) === "pivot:grand-total") {
      grandTotalRows.push(current)
      index += 1
      continue
    }
    const currentLevel = current.kind === "group"
      ? Math.max(0, Math.trunc(current.groupMeta?.level ?? 0))
      : -1
    if (current.kind === "group" && currentLevel === 0) {
      const blockStart = index
      index += 1
      while (index < rows.length) {
        const next = rows[index]
        if (!next || String(next.rowId) === "pivot:grand-total") {
          break
        }
        if (next.kind === "group" && Math.max(0, Math.trunc(next.groupMeta?.level ?? 0)) === 0) {
          break
        }
        index += 1
      }
      blocks.push({
        anchor: current,
        rows: rows.slice(blockStart, index),
        index: blocks.length,
      })
      continue
    }
    blocks.push({
      anchor: current,
      rows: [current],
      index: blocks.length,
    })
    index += 1
  }

  blocks.sort((left, right) => {
    for (const descriptor of descriptors) {
      const direction = descriptor.direction === "desc" ? -1 : 1
      const leftValue = readRowField(left.anchor, descriptor.key, descriptor.field)
      const rightValue = readRowField(right.anchor, descriptor.key, descriptor.field)
      const compared = comparePivotSortValue(leftValue, rightValue, normalizeText)
      if (compared !== 0) {
        return compared * direction
      }
    }
    const rowIdDelta = comparePivotSortValue(left.anchor.rowId, right.anchor.rowId, normalizeText)
    if (rowIdDelta !== 0) {
      return rowIdDelta
    }
    const sourceDelta = left.anchor.sourceIndex - right.anchor.sourceIndex
    if (sourceDelta !== 0) {
      return sourceDelta
    }
    return left.index - right.index
  })

  const sortedRows: DataGridRowNode<T>[] = []
  for (const block of blocks) {
    sortedRows.push(...block.rows)
  }
  if (grandTotalRows.length > 0) {
    sortedRows.push(...grandTotalRows)
  }
  return sortedRows
}

function isSamePivotGroupMeta<T>(
  left: DataGridRowNode<T>["groupMeta"],
  right: DataGridRowNode<T>["groupMeta"],
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  return left.groupKey === right.groupKey
    && left.groupField === right.groupField
    && left.groupValue === right.groupValue
    && left.level === right.level
    && left.childrenCount === right.childrenCount
}

function isSamePivotRowData(
  left: unknown,
  right: unknown,
): boolean {
  if (left === right) {
    return true
  }
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (leftRecord[key] !== rightRecord[key]) {
      return false
    }
  }
  return true
}

function canReusePivotProjectedRow<T>(
  previous: DataGridRowNode<T>,
  next: DataGridRowNode<T>,
  options: { includeDisplayIndex?: boolean } = {},
): boolean {
  const includeDisplayIndex = options.includeDisplayIndex === true
  return previous.kind === next.kind
    && previous.rowId === next.rowId
    && previous.rowKey === next.rowKey
    && previous.sourceIndex === next.sourceIndex
    && previous.originalIndex === next.originalIndex
    && (!includeDisplayIndex || previous.displayIndex === next.displayIndex)
    && previous.state.selected === next.state.selected
    && previous.state.group === next.state.group
    && previous.state.pinned === next.state.pinned
    && previous.state.expanded === next.state.expanded
    && isSamePivotGroupMeta(previous.groupMeta, next.groupMeta)
    && isSamePivotRowData(previous.data, next.data)
}

export function preservePivotProjectionRowIdentity<T>(
  previousRows: readonly DataGridRowNode<T>[],
  nextRows: readonly DataGridRowNode<T>[],
  options: { includeDisplayIndex?: boolean } = {},
): DataGridRowNode<T>[] {
  if (previousRows.length === 0 || nextRows.length === 0) {
    return [...nextRows]
  }
  const previousByRowId = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of previousRows) {
    previousByRowId.set(row.rowId, row)
  }
  const projected: DataGridRowNode<T>[] = []
  for (const nextRow of nextRows) {
    const previousRow = previousByRowId.get(nextRow.rowId)
    if (previousRow && canReusePivotProjectedRow(previousRow, nextRow, options)) {
      projected.push(previousRow)
      continue
    }
    projected.push(nextRow)
  }
  return projected
}
