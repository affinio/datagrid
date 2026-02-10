import { ref, watch, type Ref } from "vue"
import type { DataGridSortDirection, DataGridSortState } from "@affino/datagrid-core"

export interface UseAffinoDataGridSortingFeatureOptions {
  initialSortState?: readonly DataGridSortState[]
  onSortModelChange: (nextState: readonly DataGridSortState[]) => void
}

export interface UseAffinoDataGridSortingFeatureResult {
  sortState: Ref<readonly DataGridSortState[]>
  setSortState: (nextState: readonly DataGridSortState[]) => void
  toggleColumnSort: (columnKey: string, directionCycle?: readonly DataGridSortDirection[]) => void
  clearSort: () => void
  resolveColumnSortDirection: (columnKey: string) => DataGridSortDirection | null
}

export function useAffinoDataGridSortingFeature(
  options: UseAffinoDataGridSortingFeatureOptions,
): UseAffinoDataGridSortingFeatureResult {
  const sortState = ref<readonly DataGridSortState[]>(options.initialSortState ?? [])

  const setSortState = (nextState: readonly DataGridSortState[]) => {
    sortState.value = nextState.map(entry => ({ ...entry }))
  }

  const toggleColumnSort = (
    columnKey: string,
    directionCycle: readonly DataGridSortDirection[] = ["asc", "desc"],
  ) => {
    const current = sortState.value.find(entry => entry.key === columnKey)
    if (!current) {
      setSortState([{ key: columnKey, direction: directionCycle[0] ?? "asc" }])
      return
    }

    const currentIndex = directionCycle.indexOf(current.direction)
    if (currentIndex < 0 || currentIndex === directionCycle.length - 1) {
      setSortState(sortState.value.filter(entry => entry.key !== columnKey))
      return
    }

    setSortState(
      sortState.value.map(entry => (
        entry.key === columnKey
          ? { key: columnKey, direction: directionCycle[currentIndex + 1] ?? "asc" }
          : { ...entry }
      )),
    )
  }

  const clearSort = () => {
    if (sortState.value.length === 0) {
      return
    }
    sortState.value = []
  }

  const resolveColumnSortDirection = (columnKey: string): DataGridSortDirection | null => {
    const entry = sortState.value.find(item => item.key === columnKey)
    return entry?.direction ?? null
  }

  watch(sortState, nextSortState => {
    options.onSortModelChange(nextSortState)
  }, { immediate: true })

  return {
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    resolveColumnSortDirection,
  }
}
