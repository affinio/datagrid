import type { DataGridFormulaEnterpriseRuntimeConfig } from "@affino/datagrid-formula-engine-enterprise"

export interface DataGridFormulaRuntimeOptions extends DataGridFormulaEnterpriseRuntimeConfig {
  enabled: boolean
}

export type DataGridFormulaRuntimeProp =
  | boolean
  | (DataGridFormulaEnterpriseRuntimeConfig & {
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
