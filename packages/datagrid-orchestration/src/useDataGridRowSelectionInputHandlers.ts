export interface UseDataGridRowSelectionInputHandlersOptions {
  toggleSelectAllVisible: (checked: boolean) => void
  toggleRowSelection: (rowId: string, checked: boolean) => void
}

export interface UseDataGridRowSelectionInputHandlersResult {
  onSelectAllChange: (event: Event) => void
  onRowSelectChange: (rowId: string, event: Event) => void
}

export function useDataGridRowSelectionInputHandlers(
  options: UseDataGridRowSelectionInputHandlersOptions,
): UseDataGridRowSelectionInputHandlersResult {
  function onSelectAllChange(event: Event): void {
    options.toggleSelectAllVisible((event.target as HTMLInputElement).checked)
  }

  function onRowSelectChange(rowId: string, event: Event): void {
    options.toggleRowSelection(rowId, (event.target as HTMLInputElement).checked)
  }

  return {
    onSelectAllChange,
    onRowSelectChange,
  }
}
