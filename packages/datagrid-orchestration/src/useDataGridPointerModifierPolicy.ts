export interface UseDataGridPointerModifierPolicyResult {
  isRangeMoveModifierActive: (event: MouseEvent | KeyboardEvent) => boolean
}

export function useDataGridPointerModifierPolicy(): UseDataGridPointerModifierPolicyResult {
  function isRangeMoveModifierActive(event: MouseEvent | KeyboardEvent): boolean {
    return event.altKey || event.ctrlKey || event.metaKey
  }

  return {
    isRangeMoveModifierActive,
  }
}

