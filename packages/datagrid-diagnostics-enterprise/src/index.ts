export { default as DataGridDiagnosticsInspectorPanel } from "./DataGridDiagnosticsInspectorPanel.vue"
export { default as DataGridDiagnosticsTriggerButton } from "./DataGridDiagnosticsTriggerButton"

/**
 * Enterprise diagnostics package stays additive over the community grid stack.
 *
 * Planned enterprise-only layers:
 * - runtime and projection diagnostics panels
 * - trace / explain tooling
 * - profiler adapters and performance health snapshots
 */
export interface DataGridDiagnosticsEnterpriseMarker {
  readonly enterprise: true
}
