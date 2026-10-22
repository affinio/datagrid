import type { DataGridClientComputeMode } from "@affino/datagrid-core"

export interface DataGridFormulaRuntimeConfig {
  computeMode?: DataGridClientComputeMode
  formulaColumnCacheMaxColumns?: number | null
}

export interface DataGridFormulaRuntimeOptions extends DataGridFormulaRuntimeConfig {
  enabled: boolean
}

export type DataGridFormulaRuntimeProp =
  | boolean
  | (DataGridFormulaRuntimeConfig & {
      enabled?: boolean
    })
  | null

export function resolveDataGridFormulaRuntime(
  input: DataGridFormulaRuntimeProp | undefined,
): DataGridFormulaRuntimeOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
    }
  }
  if (!input) {
    return {
      enabled: false,
    }
  }
  return {
    enabled: input.enabled ?? true,
    computeMode: input.computeMode,
    formulaColumnCacheMaxColumns: input.formulaColumnCacheMaxColumns,
  }
}
