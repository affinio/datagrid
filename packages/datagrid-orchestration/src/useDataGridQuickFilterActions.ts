export interface UseDataGridQuickFilterActionsOptions {
  resolveQuery: () => string
  setQuery: (value: string) => void
  setLastAction: (message: string) => void
}

export interface UseDataGridQuickFilterActionsResult {
  clearQuickFilter: () => void
}

export function useDataGridQuickFilterActions(
  options: UseDataGridQuickFilterActionsOptions,
): UseDataGridQuickFilterActionsResult {
  function clearQuickFilter(): void {
    if (!options.resolveQuery()) {
      return
    }
    options.setQuery("")
    options.setLastAction("Quick filter cleared")
  }

  return {
    clearQuickFilter,
  }
}

