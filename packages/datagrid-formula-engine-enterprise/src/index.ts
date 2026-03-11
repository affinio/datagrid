export * from "@affino/datagrid-formula-engine"
export {
  DATAGRID_ENTERPRISE_FORMULA_PACKS,
  DATAGRID_FINANCE_FORMULA_FUNCTIONS,
  listDataGridEnterpriseFormulaPackNames,
  mergeDataGridFormulaFunctionRegistries,
  resolveDataGridEnterpriseFormulaFunctions,
} from "./formulaPacks"
export type {
  DataGridEnterpriseFormulaPackName,
} from "./formulaPacks"

export interface DataGridFormulaEnterpriseRuntimeConfig {
  computeMode?: "sync" | "worker"
  formulaColumnCacheMaxColumns?: number | null
}

/**
 * Enterprise formula runtime surface is intentionally additive.
 *
 * Planned enterprise-only layers:
 * - premium worker-owned formula execution
 * - advanced fused/vector runtime tiers
 * - profiler / explain tooling
 * - enterprise compute policies and scaling controls
 */
export interface DataGridFormulaEnterpriseRuntimeMarker {
  readonly enterprise: true
}
