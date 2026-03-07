export * from "@affino/datagrid-formula-engine"

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
