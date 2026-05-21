import type {
  DataGridSpreadsheetFormulaTableBinding,
  DataGridSpreadsheetFormulaTablePatch,
} from "./sheetModel.js"

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

export interface SpreadsheetFormulaTableRuntime {
  getSource(contextKey: string): DataGridSpreadsheetFormulaTableBinding["source"] | undefined
  exportBindings(): readonly DataGridSpreadsheetFormulaTableBinding[]
  replaceBindings(bindings: readonly DataGridSpreadsheetFormulaTableBinding[]): void
  patch(patch: DataGridSpreadsheetFormulaTablePatch): {
    changed: boolean
    dirtyContextKeys: ReadonlySet<string>
  }
  clear(): void
}

export function createSpreadsheetFormulaTableRuntime(
  initialBindings: readonly DataGridSpreadsheetFormulaTableBinding[] = [],
): SpreadsheetFormulaTableRuntime {
  const formulaTablesByContextKey = new Map<string, DataGridSpreadsheetFormulaTableBinding["source"]>()

  const exportBindings = (): readonly DataGridSpreadsheetFormulaTableBinding[] => Object.freeze(
    [...formulaTablesByContextKey.entries()]
      .map(([contextKey, source]) => ({
        name: resolveFormulaTableBindingName(contextKey),
        source,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  )

  const replaceBindings = (bindings: readonly DataGridSpreadsheetFormulaTableBinding[]): void => {
    formulaTablesByContextKey.clear()
    for (const binding of bindings) {
      formulaTablesByContextKey.set(resolveFormulaTableContextKey(binding.name), binding.source)
    }
  }

  replaceBindings(initialBindings)

  return {
    getSource(contextKey) {
      return formulaTablesByContextKey.get(contextKey)
    },
    exportBindings,
    replaceBindings,
    patch(patch) {
      let changed = false
      const dirtyContextKeys = new Set<string>()

      for (const binding of patch.set ?? []) {
        const contextKey = resolveFormulaTableContextKey(binding.name)
        if (formulaTablesByContextKey.get(contextKey) === binding.source) {
          continue
        }
        formulaTablesByContextKey.set(contextKey, binding.source)
        dirtyContextKeys.add(contextKey)
        changed = true
      }

      for (const name of patch.remove ?? []) {
        const contextKey = resolveFormulaTableContextKey(name)
        if (!formulaTablesByContextKey.delete(contextKey)) {
          continue
        }
        dirtyContextKeys.add(contextKey)
        changed = true
      }

      return {
        changed,
        dirtyContextKeys,
      }
    },
    clear() {
      formulaTablesByContextKey.clear()
    },
  }
}
