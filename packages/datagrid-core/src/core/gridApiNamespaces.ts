import type { DataGridApi } from "./gridApiContracts"

export interface DataGridApiMethodSet<TRow = unknown> {
  lifecycle: DataGridApi<TRow>["lifecycle"]
  capabilities: DataGridApi<TRow>["capabilities"]
  init: DataGridApi<TRow>["init"]
  start: DataGridApi<TRow>["start"]
  stop: DataGridApi<TRow>["stop"]
  dispose: DataGridApi<TRow>["dispose"]
  setPivotModel: DataGridApi<TRow>["pivot"]["setModel"]
  getPivotModel: DataGridApi<TRow>["pivot"]["getModel"]
  getPivotCellDrilldown: DataGridApi<TRow>["pivot"]["getCellDrilldown"]
  exportPivotLayout: DataGridApi<TRow>["pivot"]["exportLayout"]
  exportPivotInterop: DataGridApi<TRow>["pivot"]["exportInterop"]
  importPivotLayout: DataGridApi<TRow>["pivot"]["importLayout"]
  hasSelectionSupport: DataGridApi<TRow>["selection"]["hasSupport"]
  getSelectionSnapshot: DataGridApi<TRow>["selection"]["getSnapshot"]
  setSelectionSnapshot: DataGridApi<TRow>["selection"]["setSnapshot"]
  clearSelection: DataGridApi<TRow>["selection"]["clear"]
  summarizeSelection: DataGridApi<TRow>["selection"]["summarize"]
  hasTransactionSupport: DataGridApi<TRow>["transaction"]["hasSupport"]
  getTransactionSnapshot: DataGridApi<TRow>["transaction"]["getSnapshot"]
  beginTransactionBatch: DataGridApi<TRow>["transaction"]["beginBatch"]
  commitTransactionBatch: DataGridApi<TRow>["transaction"]["commitBatch"]
  rollbackTransactionBatch: DataGridApi<TRow>["transaction"]["rollbackBatch"]
  applyTransaction: DataGridApi<TRow>["transaction"]["apply"]
  canUndoTransaction: DataGridApi<TRow>["transaction"]["canUndo"]
  canRedoTransaction: DataGridApi<TRow>["transaction"]["canRedo"]
  undoTransaction: DataGridApi<TRow>["transaction"]["undo"]
  redoTransaction: DataGridApi<TRow>["transaction"]["redo"]
  getRowModelSnapshot: DataGridApi<TRow>["rows"]["getSnapshot"]
  getRowCount: DataGridApi<TRow>["rows"]["getCount"]
  getRow: DataGridApi<TRow>["rows"]["get"]
  getRowsInRange: DataGridApi<TRow>["rows"]["getRange"]
  hasDataMutationSupport: DataGridApi<TRow>["rows"]["hasDataMutationSupport"]
  setData: DataGridApi<TRow>["rows"]["setData"]
  replaceData: DataGridApi<TRow>["rows"]["replaceData"]
  appendData: DataGridApi<TRow>["rows"]["appendData"]
  prependData: DataGridApi<TRow>["rows"]["prependData"]
  getPaginationSnapshot: DataGridApi<TRow>["rows"]["getPagination"]
  setPagination: DataGridApi<TRow>["rows"]["setPagination"]
  setPageSize: DataGridApi<TRow>["rows"]["setPageSize"]
  setCurrentPage: DataGridApi<TRow>["rows"]["setCurrentPage"]
  setSortModel: DataGridApi<TRow>["rows"]["setSortModel"]
  setFilterModel: DataGridApi<TRow>["rows"]["setFilterModel"]
  setSortAndFilterModel: DataGridApi<TRow>["rows"]["setSortAndFilterModel"]
  setGroupBy: DataGridApi<TRow>["rows"]["setGroupBy"]
  setAggregationModel: DataGridApi<TRow>["rows"]["setAggregationModel"]
  getAggregationModel: DataGridApi<TRow>["rows"]["getAggregationModel"]
  setGroupExpansion: DataGridApi<TRow>["rows"]["setGroupExpansion"]
  toggleGroup: DataGridApi<TRow>["rows"]["toggleGroup"]
  expandGroup: DataGridApi<TRow>["rows"]["expandGroup"]
  collapseGroup: DataGridApi<TRow>["rows"]["collapseGroup"]
  expandAllGroups: DataGridApi<TRow>["rows"]["expandAllGroups"]
  collapseAllGroups: DataGridApi<TRow>["rows"]["collapseAllGroups"]
  hasPatchSupport: DataGridApi<TRow>["rows"]["hasPatchSupport"]
  patchRows: DataGridApi<TRow>["rows"]["patch"]
  applyEdits: DataGridApi<TRow>["rows"]["applyEdits"]
  setAutoReapply: DataGridApi<TRow>["rows"]["setAutoReapply"]
  getAutoReapply: DataGridApi<TRow>["rows"]["getAutoReapply"]
  getColumnModelSnapshot: DataGridApi<TRow>["columns"]["getSnapshot"]
  getColumn: DataGridApi<TRow>["columns"]["get"]
  setColumns: DataGridApi<TRow>["columns"]["setAll"]
  setColumnOrder: DataGridApi<TRow>["columns"]["setOrder"]
  setColumnVisibility: DataGridApi<TRow>["columns"]["setVisibility"]
  setColumnWidth: DataGridApi<TRow>["columns"]["setWidth"]
  setColumnPin: DataGridApi<TRow>["columns"]["setPin"]
  getColumnHistogram: DataGridApi<TRow>["columns"]["getHistogram"]
  setViewportRange: DataGridApi<TRow>["view"]["setViewportRange"]
  refresh: DataGridApi<TRow>["view"]["refresh"]
  reapplyView: DataGridApi<TRow>["view"]["reapply"]
  refreshCellsByRowKeys: DataGridApi<TRow>["view"]["refreshCellsByRowKeys"]
  refreshCellsByRanges: DataGridApi<TRow>["view"]["refreshCellsByRanges"]
  onCellsRefresh: DataGridApi<TRow>["view"]["onCellsRefresh"]
  hasComputeSupport: DataGridApi<TRow>["compute"]["hasSupport"]
  getComputeMode: DataGridApi<TRow>["compute"]["getMode"]
  switchComputeMode: DataGridApi<TRow>["compute"]["switchMode"]
  getComputeDiagnostics: DataGridApi<TRow>["compute"]["getDiagnostics"]
  getAllDiagnostics: DataGridApi<TRow>["diagnostics"]["getAll"]
  getSchema: DataGridApi<TRow>["meta"]["getSchema"]
  getApiCapabilities: DataGridApi<TRow>["meta"]["getCapabilities"]
  getRuntimeInfo: DataGridApi<TRow>["meta"]["getRuntimeInfo"]
  getProjectionMode: DataGridApi<TRow>["policy"]["getProjectionMode"]
  setProjectionMode: DataGridApi<TRow>["policy"]["setProjectionMode"]
  registerPlugin: DataGridApi<TRow>["plugins"]["register"]
  unregisterPlugin: DataGridApi<TRow>["plugins"]["unregister"]
  hasPlugin: DataGridApi<TRow>["plugins"]["has"]
  listPlugins: DataGridApi<TRow>["plugins"]["list"]
  clearPlugins: DataGridApi<TRow>["plugins"]["clear"]
  getUnifiedState: DataGridApi<TRow>["state"]["get"]
  setUnifiedState: DataGridApi<TRow>["state"]["set"]
  onApiEvent: DataGridApi<TRow>["events"]["on"]
}

export function createDataGridApiFromMethodSet<TRow = unknown>(
  methodSet: DataGridApiMethodSet<TRow>,
): DataGridApi<TRow> {
  return {
    lifecycle: methodSet.lifecycle,
    capabilities: methodSet.capabilities,
    init: methodSet.init,
    start: methodSet.start,
    stop: methodSet.stop,
    dispose: methodSet.dispose,
    pivot: {
      setModel: methodSet.setPivotModel,
      getModel: methodSet.getPivotModel,
      getCellDrilldown: methodSet.getPivotCellDrilldown,
      exportLayout: methodSet.exportPivotLayout,
      exportInterop: methodSet.exportPivotInterop,
      importLayout: methodSet.importPivotLayout,
    },
    selection: {
      hasSupport: methodSet.hasSelectionSupport,
      getSnapshot: methodSet.getSelectionSnapshot,
      setSnapshot: methodSet.setSelectionSnapshot,
      clear: methodSet.clearSelection,
      summarize: methodSet.summarizeSelection,
    },
    transaction: {
      hasSupport: methodSet.hasTransactionSupport,
      getSnapshot: methodSet.getTransactionSnapshot,
      beginBatch: methodSet.beginTransactionBatch,
      commitBatch: methodSet.commitTransactionBatch,
      rollbackBatch: methodSet.rollbackTransactionBatch,
      apply: methodSet.applyTransaction,
      canUndo: methodSet.canUndoTransaction,
      canRedo: methodSet.canRedoTransaction,
      undo: methodSet.undoTransaction,
      redo: methodSet.redoTransaction,
    },
    rows: {
      getSnapshot: methodSet.getRowModelSnapshot,
      getCount: methodSet.getRowCount,
      get: methodSet.getRow,
      getRange: methodSet.getRowsInRange,
      hasDataMutationSupport: methodSet.hasDataMutationSupport,
      setData: methodSet.setData,
      replaceData: methodSet.replaceData,
      appendData: methodSet.appendData,
      prependData: methodSet.prependData,
      getPagination: methodSet.getPaginationSnapshot,
      setPagination: methodSet.setPagination,
      setPageSize: methodSet.setPageSize,
      setCurrentPage: methodSet.setCurrentPage,
      setSortModel: methodSet.setSortModel,
      setFilterModel: methodSet.setFilterModel,
      setSortAndFilterModel: methodSet.setSortAndFilterModel,
      setGroupBy: methodSet.setGroupBy,
      setAggregationModel: methodSet.setAggregationModel,
      getAggregationModel: methodSet.getAggregationModel,
      setGroupExpansion: methodSet.setGroupExpansion,
      toggleGroup: methodSet.toggleGroup,
      expandGroup: methodSet.expandGroup,
      collapseGroup: methodSet.collapseGroup,
      expandAllGroups: methodSet.expandAllGroups,
      collapseAllGroups: methodSet.collapseAllGroups,
      hasPatchSupport: methodSet.hasPatchSupport,
      patch: methodSet.patchRows,
      applyEdits: methodSet.applyEdits,
      setAutoReapply: methodSet.setAutoReapply,
      getAutoReapply: methodSet.getAutoReapply,
    },
    columns: {
      getSnapshot: methodSet.getColumnModelSnapshot,
      get: methodSet.getColumn,
      setAll: methodSet.setColumns,
      setOrder: methodSet.setColumnOrder,
      setVisibility: methodSet.setColumnVisibility,
      setWidth: methodSet.setColumnWidth,
      setPin: methodSet.setColumnPin,
      getHistogram: methodSet.getColumnHistogram,
    },
    view: {
      setViewportRange: methodSet.setViewportRange,
      refresh: methodSet.refresh,
      reapply: methodSet.reapplyView,
      expandAllGroups: methodSet.expandAllGroups,
      collapseAllGroups: methodSet.collapseAllGroups,
      refreshCellsByRowKeys: methodSet.refreshCellsByRowKeys,
      refreshCellsByRanges: methodSet.refreshCellsByRanges,
      onCellsRefresh: methodSet.onCellsRefresh,
    },
    compute: {
      hasSupport: methodSet.hasComputeSupport,
      getMode: methodSet.getComputeMode,
      switchMode: methodSet.switchComputeMode,
      getDiagnostics: methodSet.getComputeDiagnostics,
    },
    diagnostics: {
      getAll: methodSet.getAllDiagnostics,
    },
    meta: {
      getSchema: methodSet.getSchema,
      getCapabilities: methodSet.getApiCapabilities,
      getRuntimeInfo: methodSet.getRuntimeInfo,
    },
    policy: {
      getProjectionMode: methodSet.getProjectionMode,
      setProjectionMode: methodSet.setProjectionMode,
    },
    plugins: {
      register: methodSet.registerPlugin,
      unregister: methodSet.unregisterPlugin,
      has: methodSet.hasPlugin,
      list: methodSet.listPlugins,
      clear: methodSet.clearPlugins,
    },
    state: {
      get: methodSet.getUnifiedState,
      set: methodSet.setUnifiedState,
    },
    events: {
      on: methodSet.onApiEvent,
    },
  }
}
