export function resolveFormulaTableContextKey(name: string): string {
  const normalized = name.trim().toLowerCase()
  return normalized.length === 0 ? "tables" : `table:${normalized}`
}

export function resolveFormulaTableBindingName(contextKey: string): string {
  if (contextKey === "tables") {
    return ""
  }
  return contextKey.startsWith("table:") ? contextKey.slice("table:".length) : contextKey
}
