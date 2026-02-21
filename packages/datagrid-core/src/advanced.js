/**
 * Advanced API for @affino/datagrid-core.
 * This surface is intended for power users and may evolve faster than root stable exports.
 */
export { createDataGridRuntime, isHostEventName as isDataGridHostEventName, HOST_EVENT_NAME_MAP, } from "./runtime/dataGridRuntime.js";
export { createDataGridAdapterRuntime, resolveDataGridAdapterEventName, } from "./adapters/adapterRuntimeProtocol.js";
export { createDataGridTransactionService, } from "./core/transactionService.js";
export { createDataGridA11yStateMachine, } from "./a11y/index.js";
export { createDataGridViewportController, } from "./viewport/dataGridViewportController.js";
export { createDataSourceBackedRowModel, } from "./models/index.js";
export { applyGroupSelectionPolicy, clampGridSelectionPoint, clampSelectionArea, createGridSelectionContextFromFlattenedRows, createGridSelectionRange, createGridSelectionRangeFromInput, normalizeGridSelectionRange, } from "./selection/selectionState.js";
export { transformDataGridPublicProtocolSource, } from "./protocol/index.js";
export { DATAGRID_EVENT_TIERS, DATAGRID_EVENT_TIER_ENTRYPOINTS, createDataGridEventEnvelope, isDataGridEventTier, } from "./protocol/index.js";
