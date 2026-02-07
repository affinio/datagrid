/**
 * Stable public API for @affino/datagrid-core.
 * Keep this surface small and semver-protected while internals evolve.
 */
export * from "./types";
export { createInMemoryTableSettingsAdapter, } from "./tableSettingsAdapter";
export { createInMemoryDataGridSettingsAdapter, } from "./dataGridSettingsAdapter";
export { createDataGridRuntime, isDataGridHostEventName, DATAGRID_HOST_EVENT_NAME_MAP, } from "./runtime/dataGridRuntime";
export { createDataGridViewportController, } from "./viewport/dataGridViewportController";
