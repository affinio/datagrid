import { computed, ref, type ComputedRef, type Ref } from "vue"
import {
  toggleDataGridRowSelection,
  toggleAllVisibleDataGridRows,
  areAllVisibleDataGridRowsSelected,
  areSomeVisibleDataGridRowsSelected,
  reconcileDataGridRowSelection,
  setsEqual,
} from "@affino/datagrid-orchestration"

export interface UseDataGridRowSelectionOrchestrationOptions<TRow> {
  allRows: Ref<readonly TRow[]>
  visibleRows: Ref<readonly TRow[]>
  resolveRowId: (row: TRow) => string
  initialSelectedRowIds?: readonly string[]
}

export interface UseDataGridRowSelectionOrchestrationResult {
  selectedRowIds: Ref<Set<string>>
  selectedCount: ComputedRef<number>
  allVisibleSelected: ComputedRef<boolean>
  someVisibleSelected: ComputedRef<boolean>
  isRowSelected: (rowId: string) => boolean
  toggleRowSelection: (rowId: string, selected?: boolean) => void
  toggleSelectAllVisible: (selected: boolean) => void
  clearRowSelection: () => void
  reconcileSelection: () => void
}

export function useDataGridRowSelectionOrchestration<TRow>(
  options: UseDataGridRowSelectionOrchestrationOptions<TRow>,
): UseDataGridRowSelectionOrchestrationResult {
  const selectedRowIds = ref<Set<string>>(new Set(options.initialSelectedRowIds ?? []))

  const selectedCount = computed(() => selectedRowIds.value.size)
  const allVisibleSelected = computed(() =>
    areAllVisibleDataGridRowsSelected(selectedRowIds.value, options.visibleRows.value, options.resolveRowId),
  )
  const someVisibleSelected = computed(() =>
    areSomeVisibleDataGridRowsSelected(selectedRowIds.value, options.visibleRows.value, options.resolveRowId),
  )

  function isRowSelected(rowId: string): boolean {
    return selectedRowIds.value.has(rowId)
  }

  function toggleRowSelection(rowId: string, selected?: boolean): void {
    selectedRowIds.value = toggleDataGridRowSelection(selectedRowIds.value, rowId, selected)
  }

  function toggleSelectAllVisible(selected: boolean): void {
    selectedRowIds.value = toggleAllVisibleDataGridRows(
      selectedRowIds.value,
      options.visibleRows.value,
      options.resolveRowId,
      selected,
    )
  }

  function clearRowSelection(): void {
    if (selectedRowIds.value.size === 0) {
      return
    }
    selectedRowIds.value = new Set()
  }

  function reconcileSelection(): void {
    if (selectedRowIds.value.size === 0) {
      return
    }
    const next = reconcileDataGridRowSelection(selectedRowIds.value, options.allRows.value, options.resolveRowId)
    if (!setsEqual(next, selectedRowIds.value)) {
      selectedRowIds.value = next
    }
  }

  return {
    selectedRowIds,
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    isRowSelected,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearRowSelection,
    reconcileSelection,
  }
}
