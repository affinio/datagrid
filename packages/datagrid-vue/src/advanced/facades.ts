import { computed, ref, type Ref } from "vue"
import type { DataGridSortDirection, DataGridSortState } from "@affino/datagrid-core"
import { buildDataGridOverlayTransformFromSnapshot } from "../composables/selectionOverlayTransform"
import type { DataGridOverlayTransform, DataGridOverlayTransformInput } from "../types"

export interface UseDataGridViewportBridgeOptions {
  snapshot: Ref<DataGridOverlayTransformInput>
}

export function useDataGridViewportBridge(options: UseDataGridViewportBridgeOptions) {
  const overlayTransform = computed<DataGridOverlayTransform>(() => {
    return buildDataGridOverlayTransformFromSnapshot(options.snapshot.value)
  })
  return {
    overlayTransform,
  }
}

export interface UseDataGridHeaderOrchestrationOptions {
  initialSortState?: readonly DataGridSortState[]
}

export function useDataGridHeaderOrchestration(
  options: UseDataGridHeaderOrchestrationOptions = {},
) {
  const sortState = ref<readonly DataGridSortState[]>(options.initialSortState ?? [])

  function setSortState(nextState: readonly DataGridSortState[]) {
    sortState.value = nextState.map(entry => ({ ...entry }))
  }

  function toggleColumnSort(columnKey: string, directionCycle: readonly DataGridSortDirection[] = ["asc", "desc"]) {
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
    setSortState(sortState.value.map(entry => (
      entry.key === columnKey
        ? { key: columnKey, direction: directionCycle[currentIndex + 1] ?? "asc" }
        : { ...entry }
    )))
  }

  return {
    sortState,
    setSortState,
    toggleColumnSort,
  }
}

export function createDataGridHeaderBindings(
  columnKey: string,
  orchestration: ReturnType<typeof useDataGridHeaderOrchestration>,
) {
  return {
    onClick() {
      orchestration.toggleColumnSort(columnKey)
    },
    onKeydown(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        orchestration.toggleColumnSort(columnKey)
      }
    },
  }
}

export interface UseDataGridRowSelectionFacadeOptions {
  initialSelectedKeys?: readonly string[]
}

export function useDataGridRowSelectionFacade(
  options: UseDataGridRowSelectionFacadeOptions = {},
) {
  const selectedRowKeys = ref<Set<string>>(new Set(options.initialSelectedKeys ?? []))

  function isSelected(rowKey: string): boolean {
    return selectedRowKeys.value.has(rowKey)
  }

  function setSelected(rowKey: string, selected: boolean) {
    const next = new Set(selectedRowKeys.value)
    if (selected) {
      next.add(rowKey)
    } else {
      next.delete(rowKey)
    }
    selectedRowKeys.value = next
  }

  function clearSelection() {
    if (selectedRowKeys.value.size === 0) {
      return
    }
    selectedRowKeys.value = new Set()
  }

  return {
    selectedRowKeys,
    isSelected,
    setSelected,
    clearSelection,
  }
}

export interface UseDataGridFindReplaceFacadeOptions<TRow> {
  rows: Ref<readonly TRow[]>
  resolveCellValue: (row: TRow, columnKey: string) => string
  applyCellValue: (row: TRow, columnKey: string, nextValue: string) => TRow
}

export interface DataGridFindResult {
  rowIndex: number
  columnKey: string
  value: string
}

export function useDataGridFindReplaceFacade<TRow>(
  options: UseDataGridFindReplaceFacadeOptions<TRow>,
) {
  function findMatches(query: string, columnKeys: readonly string[]): DataGridFindResult[] {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return []
    }
    const results: DataGridFindResult[] = []
    options.rows.value.forEach((row, rowIndex) => {
      columnKeys.forEach(columnKey => {
        const value = options.resolveCellValue(row, columnKey)
        if (value.toLowerCase().includes(normalizedQuery)) {
          results.push({ rowIndex, columnKey, value })
        }
      })
    })
    return results
  }

  function replaceAll(search: string, replaceWith: string, columnKeys: readonly string[]): number {
    const normalizedSearch = search.trim()
    if (!normalizedSearch) {
      return 0
    }
    let updates = 0
    const nextRows = options.rows.value.map(row => {
      let nextRow = row
      columnKeys.forEach(columnKey => {
        const current = options.resolveCellValue(nextRow, columnKey)
        if (!current.includes(normalizedSearch)) {
          return
        }
        const replaced = current.split(normalizedSearch).join(replaceWith)
        if (replaced !== current) {
          nextRow = options.applyCellValue(nextRow, columnKey, replaced)
          updates += 1
        }
      })
      return nextRow
    })
    options.rows.value = nextRows
    return updates
  }

  return {
    findMatches,
    replaceAll,
  }
}
