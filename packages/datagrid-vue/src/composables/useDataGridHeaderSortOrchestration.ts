import type { Ref } from "vue"
import type { DataGridSortState } from "@affino/datagrid-core"

export interface UseDataGridHeaderSortOrchestrationOptions {
  sortState: Ref<readonly DataGridSortState[]>
  isSortableColumn: (columnKey: string) => boolean
}

export interface DataGridHeaderSortEntry {
  entry: DataGridSortState
  index: number
}

export interface UseDataGridHeaderSortOrchestrationResult {
  getSortEntry: (columnKey: string) => DataGridHeaderSortEntry | null
  getHeaderSortDirection: (columnKey: string) => "asc" | "desc" | null
  getHeaderSortPriority: (columnKey: string) => number | null
  getHeaderAriaSort: (columnKey: string) => "none" | "ascending" | "descending"
  applySortFromHeader: (columnKey: string, keepExisting: boolean) => void
  applyExplicitSort: (columnKey: string, direction: "asc" | "desc" | null) => void
}

function cycleDirection(current: "asc" | "desc" | null): "asc" | "desc" | null {
  if (current === null) {
    return "asc"
  }
  if (current === "asc") {
    return "desc"
  }
  return null
}

export function useDataGridHeaderSortOrchestration(
  options: UseDataGridHeaderSortOrchestrationOptions,
): UseDataGridHeaderSortOrchestrationResult {
  function getSortEntry(columnKey: string): DataGridHeaderSortEntry | null {
    const index = options.sortState.value.findIndex(entry => entry.key === columnKey)
    if (index < 0) {
      return null
    }
    const entry = options.sortState.value[index]
    if (!entry) {
      return null
    }
    return { entry, index }
  }

  function getHeaderSortDirection(columnKey: string): "asc" | "desc" | null {
    return getSortEntry(columnKey)?.entry.direction ?? null
  }

  function getHeaderSortPriority(columnKey: string): number | null {
    const entry = getSortEntry(columnKey)
    if (!entry) {
      return null
    }
    return entry.index + 1
  }

  function getHeaderAriaSort(columnKey: string): "none" | "ascending" | "descending" {
    const direction = getHeaderSortDirection(columnKey)
    if (direction === "asc") {
      return "ascending"
    }
    if (direction === "desc") {
      return "descending"
    }
    return "none"
  }

  function applySortFromHeader(columnKey: string, keepExisting: boolean) {
    if (!options.isSortableColumn(columnKey)) {
      return
    }
    const existing = getSortEntry(columnKey)
    const nextDirection = cycleDirection(existing?.entry.direction ?? null)
    const nextState: DataGridSortState[] = keepExisting
      ? [...options.sortState.value]
      : []

    if (existing) {
      nextState.splice(existing.index, 1)
    }

    if (nextDirection !== null) {
      nextState.push({ key: columnKey, direction: nextDirection })
    }

    if (nextState.length === options.sortState.value.length) {
      const same = nextState.every((entry, index) => {
        const previous = options.sortState.value[index]
        return previous?.key === entry.key && previous?.direction === entry.direction
      })
      if (same) {
        return
      }
    }

    options.sortState.value = nextState
  }

  function applyExplicitSort(columnKey: string, direction: "asc" | "desc" | null) {
    if (!options.isSortableColumn(columnKey)) {
      return
    }
    if (direction === null) {
      options.sortState.value = options.sortState.value.filter(entry => entry.key !== columnKey)
      return
    }
    options.sortState.value = [{ key: columnKey, direction }]
  }

  return {
    getSortEntry,
    getHeaderSortDirection,
    getHeaderSortPriority,
    getHeaderAriaSort,
    applySortFromHeader,
    applyExplicitSort,
  }
}
