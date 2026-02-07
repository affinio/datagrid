export {
  createInMemoryTableSettingsAdapter as createInMemoryDataGridSettingsAdapter,
  type UiTableGroupState as DataGridGroupState,
  type UiTablePinPosition as DataGridPinPosition,
  type UiTableSettingsAdapter as DataGridSettingsAdapter,
} from "./tableSettingsAdapter"

// Legacy exports kept for migration compatibility.
export * from "./tableSettingsAdapter"
