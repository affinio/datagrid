import type { DataGridRowNode, DataGridSortState } from "../rowModel.js"

export interface DataGridComparatorContext<T = unknown> {
  descriptor?: DataGridSortState
  leftRow?: DataGridRowNode<T>
  rightRow?: DataGridRowNode<T>
}

export type DataGridComparator<T = unknown> = (
  left: unknown,
  right: unknown,
  context: DataGridComparatorContext<T>,
) => number

export interface DataGridComparatorDefinition<T = unknown> {
  id: string
  compare: DataGridComparator<T>
}

export interface DataGridComparatorRegistry<T = unknown> {
  resolve(id: string): DataGridComparator<T> | undefined
}

export type DataGridComparatorRegistryInput<T = unknown> =
  | DataGridComparatorRegistry<T>
  | ReadonlyMap<string, DataGridComparator<T>>
  | Readonly<Record<string, DataGridComparator<T>>>
  | readonly DataGridComparatorDefinition<T>[]

function normalizeComparatorId(id: unknown): string {
  return typeof id === "string" ? id.trim() : ""
}

export function createDataGridComparatorRegistry<T = unknown>(
  input?: DataGridComparatorRegistryInput<T> | null,
): DataGridComparatorRegistry<T> | undefined {
  if (!input) return undefined
  if (typeof (input as DataGridComparatorRegistry<T>).resolve === "function") {
    return input as DataGridComparatorRegistry<T>
  }
  const comparators = new Map<string, DataGridComparator<T>>()
  const addComparator = (id: unknown, compare: unknown): void => {
    const normalizedId = normalizeComparatorId(id)
    if (!normalizedId || typeof compare !== "function") {
      throw new Error("Invalid DataGrid comparator registry entry")
    }
    if (comparators.has(normalizedId)) {
      throw new Error(`Duplicate DataGrid comparator id: ${normalizedId}`)
    }
    comparators.set(normalizedId, compare as DataGridComparator<T>)
  }
  if (input instanceof Map) {
    for (const [id, compare] of input.entries()) addComparator(id, compare)
  } else if (Array.isArray(input)) {
    for (const definition of input) addComparator(definition?.id, definition?.compare)
  } else {
    for (const [id, compare] of Object.entries(input)) addComparator(id, compare)
  }
  return {
    resolve: id => comparators.get(normalizeComparatorId(id)),
  }
}
