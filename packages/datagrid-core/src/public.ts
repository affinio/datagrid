/**
 * Stable public API for @affino/datagrid-core.
 * Keep this surface semver-safe and intentionally narrow.
 */
export * from "./types/index.js"

export {
  createInMemoryDataGridSettingsAdapter,
  type DataGridSettingsAdapter,
  type DataGridGroupState,
  type DataGridPinPosition,
} from "./dataGridSettingsAdapter.js"

export {
  DATAGRID_DEPRECATION_WINDOWS,
  DATAGRID_FORBIDDEN_DEEP_IMPORT_PATTERNS,
  DATAGRID_PUBLIC_PACKAGE_VERSION,
  DATAGRID_PUBLIC_PROTOCOL_VERSION,
  DATAGRID_SEMVER_RULES,
  DATAGRID_STABLE_ENTRYPOINTS,
  DATAGRID_ADVANCED_ENTRYPOINTS,
  DATAGRID_INTERNAL_ENTRYPOINTS,
  compareDatagridSemver,
  getDataGridVersionedPublicProtocol,
  resolveDatagridDeprecationStatus,
  type DataGridDeprecationSnapshot,
  type DataGridDeprecationStatus,
  type DataGridDeprecationWindow,
  type DataGridSemver,
  type DataGridVersionedPublicProtocol,
} from "./protocol/index.js"

export {
  createDataGridCore,
  type DataGridCoreEventService,
  type DataGridCoreRowModelService,
  type DataGridCoreColumnModelService,
  type DataGridCoreEditService,
  type DataGridCoreTransactionService,
  type DataGridCoreSelectionService,
  type DataGridCoreViewportService,
  type DataGridCoreServiceByName,
  type DataGridCore,
  type DataGridCoreLifecycleState,
  type DataGridCoreService,
  type DataGridCoreServiceContext,
  type DataGridCoreServiceName,
  type DataGridCoreServiceRegistry,
  type CreateDataGridCoreOptions,
} from "./core/gridCore.js"

export {
  createDataGridApi,
  type DataGridApi,
  type CreateDataGridApiOptions,
} from "./core/gridApi.js"

export {
  type DataGridSelectionSnapshot,
  type DataGridSelectionSnapshotRange,
  type GridSelectionSnapshot,
  type GridSelectionSnapshotRange,
} from "./selection/snapshot.js"

export {
  createClientRowModel,
  createServerBackedRowModel,
  type DataGridAdvancedFilter,
  type DataGridFilterClause,
  type DataGridFilterSnapshot,
  type DataGridGroupExpansionSnapshot,
  type DataGridGroupBySpec,
  type DataGridLegacyVisibleRow,
  type DataGridRowGroupMeta,
  type DataGridRowKind,
  type DataGridRowRenderMeta,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowNodeState,
  type DataGridRowPinState,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridRowModel,
  type DataGridRowModelKind,
  type DataGridRowModelSnapshot,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridSortDirection,
  type DataGridSortState,
  type DataGridViewportRange,
  type ClientRowModel,
  type CreateClientRowModelOptions,
  type ServerBackedRowModel,
  type CreateServerBackedRowModelOptions,
  getDataGridRowRenderMeta,
} from "./models/index.js"

export {
  createDataGridColumnModel,
  type DataGridColumnDef,
  type DataGridColumnModel,
  type DataGridColumnModelSnapshot,
  type DataGridColumnModelListener,
  type DataGridColumnSnapshot,
  type DataGridColumnPin,
  type CreateDataGridColumnModelOptions,
  createDataGridEditModel,
  type CreateDataGridEditModelOptions,
  type DataGridEditModel,
  type DataGridEditModelListener,
  type DataGridEditModelSnapshot,
  type DataGridEditPatch,
} from "./models/index.js"

