import type { DataGridRowNode, DataGridSortState } from "../rowModel.js"
import { compareDataGridValues, type DataGridComparatorRegistry } from "../comparator/comparatorPolicy.js"
import { readRowField } from "./clientRowProjectionAccessors.js"
import { stableSerializeUnknown } from "./clientRowProjectionStableSerialize.js"

export function serializeSortValueModelForCache(
  sortModel: readonly DataGridSortState[],
  options: { includeDirection?: boolean } = {},
): string {
  if (!Array.isArray(sortModel) || sortModel.length === 0) {
    return "__none__"
  }
  const includeDirection = options.includeDirection !== false
  return sortModel
    .map(descriptor => {
      const dependencyFields = Array.isArray(descriptor.dependencyFields)
        ? [...descriptor.dependencyFields].map(value => String(value).trim()).filter(Boolean).sort().join(",")
        : ""
      const direction = includeDirection ? descriptor.direction ?? "asc" : ""
      const comparator = stableSerializeUnknown(descriptor.comparator ?? null)
      return `${descriptor.key}:${descriptor.field ?? ""}:${direction}:${dependencyFields}:${comparator}`
    })
    .join("|")
}

export function isSameSortModel(
  left: readonly DataGridSortState[],
  right: readonly DataGridSortState[],
): boolean {
  return serializeSortValueModelForCache(left, { includeDirection: true })
    === serializeSortValueModelForCache(right, { includeDirection: true })
}

function toFastComparableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compareFastNullableNumbers(
  leftValue: unknown,
  rightValue: unknown,
  leftNumber: number | undefined,
  rightNumber: number | undefined,
  nulls: "first" | "last",
): number {
  if (leftValue == null && rightValue == null) {
    return 0
  }
  if (leftValue == null) {
    return nulls === "first" ? -1 : 1
  }
  if (rightValue == null) {
    return nulls === "first" ? 1 : -1
  }
  return (leftNumber ?? 0) - (rightNumber ?? 0)
}

const NUMERIC_BUCKET_SORT_MIN_ROWS = 4096
const NUMERIC_BUCKET_SORT_MAX_RANGE = 65_536
const NUMERIC_BUCKET_SORT_RANGE_RATIO = 8

function shouldUseNumericIntegerBucketSort(rowCount: number, minValue: number, maxValue: number): boolean {
  if (rowCount < NUMERIC_BUCKET_SORT_MIN_ROWS) {
    return false
  }
  const range = maxValue - minValue + 1
  if (!Number.isSafeInteger(range) || range <= 0) {
    return false
  }
  const rangeBudget = Math.min(
    NUMERIC_BUCKET_SORT_MAX_RANGE,
    Math.max(1024, Math.floor(rowCount / NUMERIC_BUCKET_SORT_RANGE_RATIO)),
  )
  return range <= rangeBudget
}

interface RowTieBreakerEntry {
  rowId: unknown
  rowIdNumber: number | null
  rowIdText: string
  sourceIndex: number
}

function createRowTieBreakerComparator<T>(
  rows: readonly DataGridRowNode<T>[],
): (leftIndex: number, rightIndex: number) => number {
  const cache = new Array<RowTieBreakerEntry | null | undefined>(rows.length)
  const readEntry = (index: number): RowTieBreakerEntry | null => {
    const cached = cache[index]
    if (typeof cached !== "undefined") {
      return cached
    }
    const row = rows[index]
    if (!row) {
      cache[index] = null
      return null
    }
    const rowId = row.rowId
    const entry: RowTieBreakerEntry = {
      rowId,
      rowIdNumber: rowId == null ? null : toFastComparableNumber(rowId),
      rowIdText: rowId == null ? "" : String(rowId),
      sourceIndex: row.sourceIndex,
    }
    cache[index] = entry
    return entry
  }

  return (leftIndex: number, rightIndex: number): number => {
    const left = readEntry(leftIndex)
    const right = readEntry(rightIndex)
    if (!left || !right) {
      return leftIndex - rightIndex
    }
    let rowIdDelta = 0
    if (left.rowId == null && right.rowId == null) {
      rowIdDelta = 0
    } else if (left.rowId == null) {
      rowIdDelta = 1
    } else if (right.rowId == null) {
      rowIdDelta = -1
    } else if (left.rowIdNumber != null && right.rowIdNumber != null) {
      rowIdDelta = left.rowIdNumber - right.rowIdNumber
    } else {
      rowIdDelta = left.rowIdText.localeCompare(right.rowIdText)
    }
    if (rowIdDelta !== 0) {
      return rowIdDelta
    }
    const sourceDelta = left.sourceIndex - right.sourceIndex
    if (sourceDelta !== 0) {
      return sourceDelta
    }
    return leftIndex - rightIndex
  }
}

function sortRowsByIntegerBuckets<T>(
  rows: readonly DataGridRowNode<T>[],
  numericSortValuesByIndex: readonly (number | undefined)[],
  minValue: number,
  maxValue: number,
  direction: 1 | -1,
): DataGridRowNode<T>[] {
  const range = maxValue - minValue + 1
  const buckets = new Array<number[] | undefined>(range)
  for (let index = 0; index < rows.length; index += 1) {
    const bucketIndex = (numericSortValuesByIndex[index] ?? minValue) - minValue
    const bucket = buckets[bucketIndex]
    if (bucket) {
      bucket.push(index)
    } else {
      buckets[bucketIndex] = [index]
    }
  }

  const sortedRows = new Array<DataGridRowNode<T>>(rows.length)
  let outputIndex = 0
  const compareTieBreakers = createRowTieBreakerComparator(rows)
  const start = direction === -1 ? range - 1 : 0
  const end = direction === -1 ? -1 : range
  for (let bucketIndex = start; bucketIndex !== end; bucketIndex += direction) {
    const bucket = buckets[bucketIndex]
    if (!bucket) {
      continue
    }
    if (bucket.length > 1) {
      bucket.sort(compareTieBreakers)
    }
    for (let index = 0; index < bucket.length; index += 1) {
      const row = rows[bucket[index] ?? -1]
      if (row) {
        sortedRows[outputIndex] = row
        outputIndex += 1
      }
    }
  }
  return sortedRows
}

export function sortLeafRows<T>(
  rows: readonly DataGridRowNode<T>[],
  sortModel: readonly DataGridSortState[],
  resolveSortValues?: (row: DataGridRowNode<T>, descriptors: readonly DataGridSortState[]) => readonly unknown[],
  resolveSingleSortValue?: (row: DataGridRowNode<T>, descriptor: DataGridSortState) => unknown,
  options: { comparatorRegistry?: DataGridComparatorRegistry<T> } = {},
): DataGridRowNode<T>[] {
  const descriptors = Array.isArray(sortModel) ? sortModel.filter(Boolean) : []
  if (descriptors.length === 0) {
    return rows as DataGridRowNode<T>[]
  }
  if (descriptors.length === 1) {
    const descriptor = descriptors[0]
    if (!descriptor) {
      return rows as DataGridRowNode<T>[]
    }
    const direction = descriptor.direction === "desc" ? -1 : 1
    const nulls = descriptor.comparator?.nulls === "first" ? "first" : "last"
    const sortValuesByIndex = new Array<unknown>(rows.length)
    const numericSortValuesByIndex = new Array<number | undefined>(rows.length)
    let canUseNumericSortFastPath = descriptor.comparator?.kind !== "custom"
    let canUseIntegerBucketSort = canUseNumericSortFastPath
    let hasNullableSortValue = false
    let minIntegerSortValue = Number.POSITIVE_INFINITY
    let maxIntegerSortValue = Number.NEGATIVE_INFINITY
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      if (!row) {
        sortValuesByIndex[index] = undefined
        hasNullableSortValue = true
        canUseIntegerBucketSort = false
        continue
      }
      const sortValue = resolveSingleSortValue
        ? resolveSingleSortValue(row, descriptor)
        : resolveSortValues
          ? resolveSortValues(row, descriptors)[0]
          : readRowField(row, descriptor.key, descriptor.field)
      sortValuesByIndex[index] = sortValue
      if (!canUseNumericSortFastPath || sortValue == null) {
        if (sortValue == null) {
          hasNullableSortValue = true
          canUseIntegerBucketSort = false
        }
        continue
      }
      const numericSortValue = toFastComparableNumber(sortValue)
      if (numericSortValue == null) {
        canUseNumericSortFastPath = false
        canUseIntegerBucketSort = false
        continue
      }
      numericSortValuesByIndex[index] = numericSortValue
      if (!canUseIntegerBucketSort) {
        continue
      }
      if (!Number.isSafeInteger(numericSortValue)) {
        canUseIntegerBucketSort = false
        continue
      }
      minIntegerSortValue = Math.min(minIntegerSortValue, numericSortValue)
      maxIntegerSortValue = Math.max(maxIntegerSortValue, numericSortValue)
    }

    if (
      canUseNumericSortFastPath
      && canUseIntegerBucketSort
      && !hasNullableSortValue
      && shouldUseNumericIntegerBucketSort(rows.length, minIntegerSortValue, maxIntegerSortValue)
    ) {
      return sortRowsByIntegerBuckets(
        rows,
        numericSortValuesByIndex,
        minIntegerSortValue,
        maxIntegerSortValue,
        direction,
      )
    }

    const orderedIndexes = new Array<number>(rows.length)
    for (let index = 0; index < rows.length; index += 1) {
      orderedIndexes[index] = index
    }
    const compareTieBreakers = createRowTieBreakerComparator(rows)

    orderedIndexes.sort((leftIndex, rightIndex) => {
      const leftRow = rows[leftIndex]
      const rightRow = rows[rightIndex]
      if (!leftRow || !rightRow) {
        return leftIndex - rightIndex
      }
      const compared = canUseNumericSortFastPath
        ? compareFastNullableNumbers(
            sortValuesByIndex[leftIndex],
            sortValuesByIndex[rightIndex],
            numericSortValuesByIndex[leftIndex],
            numericSortValuesByIndex[rightIndex],
            nulls,
          )
        : compareDataGridValues(
            sortValuesByIndex[leftIndex],
            sortValuesByIndex[rightIndex],
            { descriptor, leftRow, rightRow },
            { comparatorRegistry: options.comparatorRegistry },
          )
      if (compared !== 0) {
        return compared * direction
      }
      return compareTieBreakers(leftIndex, rightIndex)
    })

    const sortedRows = new Array<DataGridRowNode<T>>(orderedIndexes.length)
    for (let index = 0; index < orderedIndexes.length; index += 1) {
      const rowIndex = orderedIndexes[index]
      if (typeof rowIndex === "undefined") {
        continue
      }
      const row = rows[rowIndex]
      if (row) {
        sortedRows[index] = row
      }
    }
    return sortedRows
  }

  const sortValuesByIndex = new Array<readonly unknown[]>(rows.length)
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      sortValuesByIndex[index] = []
      continue
    }
    sortValuesByIndex[index] = resolveSortValues
      ? resolveSortValues(row, descriptors)
      : descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
  }

  const orderedIndexes = new Array<number>(rows.length)
  for (let index = 0; index < rows.length; index += 1) {
    orderedIndexes[index] = index
  }
  const compareTieBreakers = createRowTieBreakerComparator(rows)

  orderedIndexes.sort((leftIndex, rightIndex) => {
    const leftRow = rows[leftIndex]
    const rightRow = rows[rightIndex]
    if (!leftRow || !rightRow) {
      return leftIndex - rightIndex
    }
    const leftSortValues = sortValuesByIndex[leftIndex] ?? []
    const rightSortValues = sortValuesByIndex[rightIndex] ?? []
    for (let descriptorIndex = 0; descriptorIndex < descriptors.length; descriptorIndex += 1) {
      const descriptor = descriptors[descriptorIndex]
      if (!descriptor) {
        continue
      }
      const direction = descriptor.direction === "desc" ? -1 : 1
      const leftValue = leftSortValues[descriptorIndex]
      const rightValue = rightSortValues[descriptorIndex]
      const compared = compareDataGridValues(
        leftValue,
        rightValue,
        { descriptor, leftRow, rightRow },
        { comparatorRegistry: options.comparatorRegistry },
      )
      if (compared !== 0) {
        return compared * direction
      }
    }
    return compareTieBreakers(leftIndex, rightIndex)
  })

  const sortedRows = new Array<DataGridRowNode<T>>(orderedIndexes.length)
  for (let index = 0; index < orderedIndexes.length; index += 1) {
    const rowIndex = orderedIndexes[index]
    if (typeof rowIndex === "undefined") {
      continue
    }
    const row = rows[rowIndex]
    if (row) {
      sortedRows[index] = row
    }
  }
  return sortedRows
}
