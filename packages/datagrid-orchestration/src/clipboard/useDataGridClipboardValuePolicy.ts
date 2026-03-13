export interface UseDataGridClipboardValuePolicyResult {
  normalizeClipboardValue: (value: unknown) => string
}

export function useDataGridClipboardValuePolicy(): UseDataGridClipboardValuePolicyResult {
  function normalizeClipboardValue(value: unknown): string {
    if (typeof value === "undefined" || value === null) {
      return ""
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value)
    }
    return String(value)
  }

  return {
    normalizeClipboardValue,
  }
}
