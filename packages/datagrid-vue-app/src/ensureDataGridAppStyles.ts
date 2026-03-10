const DATA_GRID_APP_STYLE_ID = "affino-datagrid-vue-app-styles"

const DATA_GRID_APP_STYLES = `
.affino-datagrid-app-root {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  font-family: var(--datagrid-font-family);
  font-size: var(--datagrid-font-size);
  color: var(--datagrid-text-color);
  background: var(--datagrid-background-color);
}

.table-wrap {
  overflow: auto;
  flex: 1;
  min-height: 0;
  min-width: 0;
  border: 0;
  border-radius: 0;
}

.grid-stage {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  border: 1px solid var(--datagrid-glass-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--datagrid-background-color);
}

.grid-header-shell,
.grid-body-shell {
  display: grid;
  min-width: 0;
}

.grid-body-shell {
  min-height: 0;
}

.grid-header-pane,
.grid-body-pane {
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.grid-header-pane {
  border-bottom: var(--datagrid-header-divider-size) solid var(--datagrid-header-divider-color);
  background: var(--datagrid-header-row-bg);
  z-index: 2;
}

.grid-body-pane {
  background: var(--datagrid-viewport-bg);
  min-height: 0;
}

.grid-header-viewport {
  overflow-x: hidden;
  overflow-y: hidden;
  border-bottom: var(--datagrid-header-divider-size) solid var(--datagrid-header-divider-color);
  background: var(--datagrid-header-row-bg);
}

.grid-body-viewport {
  overflow: auto;
  min-width: 0;
  min-height: 0;
  background: var(--datagrid-viewport-bg);
}

.grid-header-row,
.grid-row {
  display: flex;
  width: max-content;
  min-width: 100%;
}

.grid-pane-track,
.grid-center-track {
  display: flex;
}

.grid-body-content {
  min-width: 100%;
  position: relative;
}

.grid-pane-content {
  min-width: 100%;
  position: relative;
  will-change: transform;
}

.grid-column-spacer {
  flex: 0 0 auto;
  align-self: stretch;
}

.grid-stage--auto-row-height .grid-body-content .grid-cell {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

.grid-row--autosize-probe .grid-cell {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

.grid-cell {
  box-sizing: border-box;
  position: relative;
  border-bottom: var(--datagrid-row-divider-size) solid var(--datagrid-row-divider-color);
  border-right: var(--datagrid-column-divider-size) solid var(--datagrid-column-divider-color);
  padding: var(--datagrid-body-cell-padding-y) var(--datagrid-body-cell-padding-x);
  text-align: left;
  white-space: nowrap;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--datagrid-row-text-color);
  background: var(--datagrid-row-background-color);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

.grid-cell:focus,
.grid-cell:focus-visible {
  outline: none;
}

.grid-cell::selection {
  background: transparent;
}

.grid-cell::-moz-selection {
  background: transparent;
}

.grid-cell--selected {
  background: var(--datagrid-selection-range-bg);
}

.grid-cell--selection-anchor {
  background: var(--datagrid-row-background-color);
}

.grid-cell--selection-anchor.grid-cell--selected {
  background: var(--datagrid-row-background-color) !important;
}

.grid-cell--pinned-left.grid-cell--selection-anchor,
.grid-cell--pinned-left.grid-cell--selection-anchor.grid-cell--selected {
  background: var(--datagrid-pinned-left-bg) !important;
}

.grid-cell--pinned-right.grid-cell--selection-anchor,
.grid-cell--pinned-right.grid-cell--selection-anchor.grid-cell--selected {
  background: var(--datagrid-pinned-right-bg) !important;
}

.grid-selection-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}

.grid-selection-overlay__segment {
  position: absolute;
  border: 2px solid var(--datagrid-selection-copied-border);
  box-sizing: border-box;
  border-radius: 1px;
}

.grid-cell--fill-preview {
  background: var(--datagrid-selection-fill-preview-bg);
}

.grid-cell--clipboard-pending::after {
  content: "";
  position: absolute;
  inset: -1px;
  pointer-events: none;
  z-index: 4;
  background-image:
    repeating-linear-gradient(90deg, var(--clipboard-pending-top, transparent) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(90deg, var(--clipboard-pending-bottom, transparent) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(0deg, var(--clipboard-pending-left, transparent) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(0deg, var(--clipboard-pending-right, transparent) 0 6px, transparent 6px 12px);
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-size:
    calc(100% - 2px) 1px,
    calc(100% - 2px) 1px,
    1px calc(100% - 2px),
    1px calc(100% - 2px);
  background-position:
    1px 1px,
    1px calc(100% - 1px),
    1px 1px,
    calc(100% - 1px) 1px;
  animation: grid-clipboard-ants 0.7s linear infinite;
}

.grid-cell--clipboard-pending-top {
  --clipboard-pending-top: var(--datagrid-selection-copied-border);
}

.grid-cell--clipboard-pending-right {
  --clipboard-pending-right: var(--datagrid-selection-copied-border);
}

.grid-cell--clipboard-pending-bottom {
  --clipboard-pending-bottom: var(--datagrid-selection-copied-border);
}

.grid-cell--clipboard-pending-left {
  --clipboard-pending-left: var(--datagrid-selection-copied-border);
}

@keyframes grid-clipboard-ants {
  from {
    background-position:
      1px 1px,
      1px calc(100% - 1px),
      1px 1px,
      calc(100% - 1px) 1px;
  }
  to {
    background-position:
      13px 1px,
      -11px calc(100% - 1px),
      1px 13px,
      calc(100% - 1px) -11px;
  }
}

.grid-cell--header {
  background: var(--datagrid-header-cell-bg);
  color: var(--datagrid-header-text-color);
  font-weight: 600;
  position: relative;
  padding:
    var(--datagrid-header-padding-y)
    calc(var(--datagrid-header-padding-x) + 4px)
    var(--datagrid-header-padding-y)
    var(--datagrid-header-padding-x);
  overflow: visible;
}

.grid-cell--header-sortable {
  cursor: pointer;
}

.grid-cell--header-sortable:hover {
  background: var(--datagrid-header-cell-hover-bg);
}

.grid-cell--pinned-left,
.grid-cell--pinned-right {
  background: var(--datagrid-pinned-bg);
}

.grid-cell--pinned-left {
  background: var(--datagrid-pinned-left-bg);
  box-shadow: var(--datagrid-pinned-left-shadow);
}

.grid-cell--index + .grid-cell--pinned-left {
  box-shadow: none;
}

.grid-cell--pinned-right {
  background: var(--datagrid-pinned-right-bg);
  box-shadow: var(--datagrid-pinned-right-shadow);
}

.sort-indicator {
  width: 12px;
  text-align: center;
  color: var(--datagrid-sort-indicator-color);
  font-size: 11px;
  margin-left: auto;
}

.grid-cell--index {
  color: var(--datagrid-index-cell-text-color);
  background: var(--datagrid-index-cell-background-color);
  border-right: var(--datagrid-column-divider-size) solid var(--datagrid-column-divider-color);
}

.grid-row .grid-cell--index {
  background: var(--datagrid-index-cell-background-color);
}

.grid-row.row--group .grid-cell {
  font-weight: 600;
  cursor: pointer;
  color: var(--datagrid-group-row-text-color);
  background: var(--datagrid-group-row-background-color);
}

.grid-row.row--tree .grid-cell {
  background: color-mix(in srgb, var(--datagrid-row-background-color) 82%, var(--datagrid-accent-strong) 18%);
}

.grid-row.row--tree .grid-cell--index {
  background: color-mix(in srgb, var(--datagrid-index-cell-background-color) 82%, var(--datagrid-accent-strong) 18%);
}

.grid-row.row--pivot .grid-cell {
  background: color-mix(in srgb, var(--datagrid-row-background-color) 88%, var(--datagrid-accent-strong) 12%);
}

.grid-row.row--pivot .grid-cell--index {
  background: color-mix(in srgb, var(--datagrid-index-cell-background-color) 88%, var(--datagrid-accent-strong) 12%);
}

.grid-row.row--group.row--pivot .grid-cell {
  background: color-mix(in srgb, var(--datagrid-group-row-background-color) 78%, var(--datagrid-accent-strong) 22%);
}

.grid-row.row--group.row--pivot .grid-cell--index {
  background: color-mix(in srgb, var(--datagrid-index-cell-background-color) 76%, var(--datagrid-accent-strong) 24%);
}

.grid-spacer {
  width: 1px;
}

.col-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
  padding-right: 8px;
}

.col-head > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-filter {
  margin-top: 4px;
  padding-right: 8px;
}

.col-filter--index-spacer {
  height: 22px;
  pointer-events: none;
}

.col-filter-input {
  width: 100%;
  min-width: 0;
  height: 22px;
  border: 1px solid var(--datagrid-filter-trigger-border);
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--datagrid-text-primary);
  background: var(--datagrid-filter-trigger-bg);
}

.cell-editor-input {
  display: block;
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0;
  border-radius: 0;
  padding: 6px 8px;
  margin: 0;
  font: inherit;
  color: inherit;
  color: var(--datagrid-text-primary);
  background: var(--datagrid-editor-bg);
  outline: none;
}

.grid-cell--editing {
  padding: 0;
  background: var(--datagrid-editor-bg);
  box-shadow: inset 0 0 0 1px var(--datagrid-editor-border);
}

.cell-fill-handle {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 6px;
  height: 6px;
  border: 1px solid var(--datagrid-selection-handle-border);
  border-radius: 1px;
  background: var(--datagrid-selection-handle-bg);
  padding: 0;
  cursor: crosshair;
  z-index: 3;
}

.row-resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 10px;
  border: 0;
  background: transparent;
  cursor: row-resize;
  padding: 0;
  z-index: 4;
}

.col-resize {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  min-width: 10px;
  height: 100%;
  border: 0;
  background: transparent;
  cursor: col-resize;
  padding: 0;
  z-index: 4;
}
`

export function ensureDataGridAppStyles(): void {
  if (typeof document === "undefined") {
    return
  }

  const existingStyle = document.getElementById(DATA_GRID_APP_STYLE_ID)
  if (existingStyle instanceof HTMLStyleElement) {
    if (existingStyle.textContent !== DATA_GRID_APP_STYLES) {
      existingStyle.textContent = DATA_GRID_APP_STYLES
    }
    return
  }

  const style = document.createElement("style")
  style.id = DATA_GRID_APP_STYLE_ID
  style.textContent = DATA_GRID_APP_STYLES
  document.head.append(style)
}
