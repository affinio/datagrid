export const DATA_GRID_CLASS_NAMES = {
  viewport: "datagrid-stage__viewport",
  row: "datagrid-stage__row",
  cell: "datagrid-stage__cell",
  headerCell: "datagrid-stage__cell--header",
  metrics: "datagrid-metrics",
  emptyState: "datagrid-stage__empty",
  status: "datagrid-controls__status",
  selectionOverlay: "datagrid-stage__selection-overlay",
  selectionOverlayMain: "datagrid-stage__selection-overlay--main",
  selectionOverlayFill: "datagrid-stage__selection-overlay--fill",
  selectionOverlayMove: "datagrid-stage__selection-overlay--move",
  selectionHandleCell: "datagrid-stage__selection-handle--cell",
  inlineEditor: "datagrid-stage__editor",
  inlineEditorInput: "datagrid-stage__editor-input",
  enumTrigger: "datagrid-stage__enum-trigger",
  treeToggle: "datagrid-stage__tree-toggle",
  filterTrigger: "datagrid-stage__filter-trigger",
} as const

export const DATA_GRID_DATA_ATTRS = {
  menuAction: "data-datagrid-menu-action",
  copyMenu: "data-datagrid-copy-menu",
  copyAction: "data-datagrid-copy-action",
  pasteAction: "data-datagrid-paste-action",
  cutAction: "data-datagrid-cut-action",
  resizeHandle: "data-datagrid-resize-handle",
  filterPanel: "data-datagrid-filter-panel",
  filterTrigger: "data-datagrid-filter-trigger",
  filterValue: "data-datagrid-filter-value",
  filterApply: "data-datagrid-filter-apply",
  filterReset: "data-datagrid-filter-reset",
  filterClearAll: "data-datagrid-filter-clear-all",
  filterClose: "data-datagrid-filter-close",
  inlineEditorColumnKey: "data-inline-editor-column-key",
  inlineEditorRowId: "data-inline-editor-row-id",
  columnKey: "data-column-key",
  rowId: "data-row-id",
  treeToggle: "data-datagrid-tree-toggle",
} as const

const toClassSelector = (className: string): string => `.${className}`
const toDataAttrSelector = (attribute: string): string => `[${attribute}]`

export const DATA_GRID_SELECTORS = {
  viewport: toClassSelector(DATA_GRID_CLASS_NAMES.viewport),
  row: toClassSelector(DATA_GRID_CLASS_NAMES.row),
  cell: toClassSelector(DATA_GRID_CLASS_NAMES.cell),
  headerCell: toClassSelector(DATA_GRID_CLASS_NAMES.headerCell),
  metrics: toClassSelector(DATA_GRID_CLASS_NAMES.metrics),
  emptyState: toClassSelector(DATA_GRID_CLASS_NAMES.emptyState),
  status: toClassSelector(DATA_GRID_CLASS_NAMES.status),
  selectionOverlay: toClassSelector(DATA_GRID_CLASS_NAMES.selectionOverlay),
  selectionOverlayMain: toClassSelector(DATA_GRID_CLASS_NAMES.selectionOverlayMain),
  selectionOverlayFill: toClassSelector(DATA_GRID_CLASS_NAMES.selectionOverlayFill),
  selectionOverlayMove: toClassSelector(DATA_GRID_CLASS_NAMES.selectionOverlayMove),
  selectionHandleCell: toClassSelector(DATA_GRID_CLASS_NAMES.selectionHandleCell),
  inlineEditor: toClassSelector(DATA_GRID_CLASS_NAMES.inlineEditor),
  inlineEditorInput: toClassSelector(DATA_GRID_CLASS_NAMES.inlineEditorInput),
  enumTrigger: toClassSelector(DATA_GRID_CLASS_NAMES.enumTrigger),
  treeToggle: toClassSelector(DATA_GRID_CLASS_NAMES.treeToggle),
  filterTrigger: toClassSelector(DATA_GRID_CLASS_NAMES.filterTrigger),
  menuAction: toDataAttrSelector(DATA_GRID_DATA_ATTRS.menuAction),
  copyMenu: toDataAttrSelector(DATA_GRID_DATA_ATTRS.copyMenu),
  copyAction: toDataAttrSelector(DATA_GRID_DATA_ATTRS.copyAction),
  pasteAction: toDataAttrSelector(DATA_GRID_DATA_ATTRS.pasteAction),
  cutAction: toDataAttrSelector(DATA_GRID_DATA_ATTRS.cutAction),
  resizeHandle: toDataAttrSelector(DATA_GRID_DATA_ATTRS.resizeHandle),
  filterPanel: toDataAttrSelector(DATA_GRID_DATA_ATTRS.filterPanel),
  filterValue: toDataAttrSelector(DATA_GRID_DATA_ATTRS.filterValue),
  filterApply: toDataAttrSelector(DATA_GRID_DATA_ATTRS.filterApply),
  filterReset: toDataAttrSelector(DATA_GRID_DATA_ATTRS.filterReset),
  filterClearAll: toDataAttrSelector(DATA_GRID_DATA_ATTRS.filterClearAll),
  filterClose: toDataAttrSelector(DATA_GRID_DATA_ATTRS.filterClose),
} as const

export const dataGridCellSelector = (columnKey: string): string => (
  `${DATA_GRID_SELECTORS.cell}[${DATA_GRID_DATA_ATTRS.columnKey}="${columnKey}"]`
)

export const dataGridHeaderCellSelector = (columnKey: string): string => (
  `${DATA_GRID_SELECTORS.headerCell}[${DATA_GRID_DATA_ATTRS.columnKey}="${columnKey}"]`
)

export const dataGridResizeHandleSelector = (columnKey: string): string => (
  `${DATA_GRID_SELECTORS.resizeHandle}[${DATA_GRID_DATA_ATTRS.columnKey}="${columnKey}"]`
)
