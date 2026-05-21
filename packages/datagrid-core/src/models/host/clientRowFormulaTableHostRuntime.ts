import type {
  DataGridFormulaTablePatch,
  DataGridFormulaTableSource,
} from "../rowModel.js"

export interface CreateClientRowFormulaTableHostRuntimeOptions {
  ensureActive: () => void
  setFormulaTable: (name: string, rows: DataGridFormulaTableSource) => boolean
  removeFormulaTable: (name: string) => boolean
  getFormulaTableNames: () => readonly string[]
  recomputeFormulaContext: (contextKeys: ReadonlySet<string>) => void
}

export interface ClientRowFormulaTableHostRuntime {
  setFormulaTable(name: string, rows: DataGridFormulaTableSource): void
  patchFormulaTables(patch: DataGridFormulaTablePatch): boolean
  removeFormulaTable(name: string): boolean
  getFormulaTableNames(): readonly string[]
}

function normalizeFormulaTableName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

function createFormulaTableContextKey(name: string): string {
  return `table:${name}`
}

export function createClientRowFormulaTableHostRuntime(
  options: CreateClientRowFormulaTableHostRuntimeOptions,
): ClientRowFormulaTableHostRuntime {
  const patchFormulaTables = (patch: DataGridFormulaTablePatch): boolean => {
    options.ensureActive()
    const contextKeys = new Set<string>()
    let changed = false

    if (Array.isArray(patch.remove)) {
      for (const name of patch.remove) {
        const normalizedName = normalizeFormulaTableName(name)
        if (normalizedName.length === 0) {
          continue
        }
        if (!options.removeFormulaTable(normalizedName)) {
          continue
        }
        contextKeys.add("tables")
        contextKeys.add(createFormulaTableContextKey(normalizedName))
        changed = true
      }
    }

    if (Array.isArray(patch.set)) {
      for (const entry of patch.set) {
        if (!entry) {
          continue
        }
        const normalizedName = normalizeFormulaTableName(entry.name)
        if (normalizedName.length === 0) {
          throw new Error("[clientRowModel] Formula table name must be non-empty")
        }
        if (!options.setFormulaTable(normalizedName, entry.rows)) {
          continue
        }
        contextKeys.add("tables")
        contextKeys.add(createFormulaTableContextKey(normalizedName))
        changed = true
      }
    }

    if (!changed) {
      return false
    }

    options.recomputeFormulaContext(contextKeys)
    return true
  }

  return {
    setFormulaTable(name, rows) {
      void patchFormulaTables({
        set: [{ name, rows }],
      })
    },
    patchFormulaTables,
    removeFormulaTable(name) {
      return patchFormulaTables({
        remove: [name],
      })
    },
    getFormulaTableNames() {
      options.ensureActive()
      return options.getFormulaTableNames()
    },
  }
}
