const DATA_GRID_APP_STYLE_ID = "affino-datagrid-vue-app-styles"

const DATA_GRID_APP_STYLES = `
.affino-datagrid-app-root {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
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
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.grid-header-viewport {
  overflow-x: hidden;
  overflow-y: hidden;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
}

.grid-body-viewport {
  overflow: auto;
  min-width: 0;
  min-height: 0;
}

.grid-header-row,
.grid-row {
  display: flex;
  width: max-content;
  min-width: 100%;
}

.grid-body-content {
  min-width: 100%;
}

.grid-main-track {
  display: flex;
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
  position: relative;
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
  padding: 6px 8px;
  text-align: left;
  white-space: nowrap;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  background: #fff;
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
  background: #e3efff;
}

.grid-cell--fill-preview {
  background: #dbeafe;
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
  --clipboard-pending-top: #1d4ed8;
}

.grid-cell--clipboard-pending-right {
  --clipboard-pending-right: #1d4ed8;
}

.grid-cell--clipboard-pending-bottom {
  --clipboard-pending-bottom: #1d4ed8;
}

.grid-cell--clipboard-pending-left {
  --clipboard-pending-left: #1d4ed8;
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
  background: #f8fafc;
  font-weight: 600;
  position: relative;
  padding-right: 12px;
  overflow: visible;
}

.grid-cell--header-sortable {
  cursor: pointer;
}

.grid-cell--pinned-left,
.grid-cell--pinned-right {
  position: sticky;
  z-index: 5;
  background: inherit;
}

.grid-cell--header.grid-cell--pinned-left,
.grid-cell--header.grid-cell--pinned-right {
  z-index: 7;
}

.grid-cell--pinned-left {
  box-shadow: 1px 0 0 #e2e8f0;
}

.grid-cell--pinned-right {
  box-shadow: -1px 0 0 #e2e8f0;
}

.sort-indicator {
  width: 12px;
  text-align: center;
  color: #64748b;
  font-size: 11px;
  margin-left: auto;
}

.grid-cell--index {
  position: sticky;
  left: 0;
  z-index: 6;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
}

.grid-row .grid-cell--index {
  background: #fff;
}

.grid-row.row--group .grid-cell {
  font-weight: 600;
  cursor: pointer;
}

.grid-row.row--tree .grid-cell {
  background: #f0fdf4;
}

.grid-row.row--tree .grid-cell--index {
  background: #f0fdf4;
}

.grid-row.row--pivot .grid-cell {
  background: #f7fbff;
}

.grid-row.row--pivot .grid-cell--index {
  background: #f7fbff;
}

.grid-row.row--group.row--pivot .grid-cell {
  background: #e3efff;
}

.grid-row.row--group.row--pivot .grid-cell--index {
  background: #e3efff;
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

.col-filter-input {
  width: 100%;
  min-width: 0;
  height: 22px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  background: #fff;
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
  background: transparent;
  outline: none;
}

.grid-cell--editing {
  padding: 0;
}

.cell-fill-handle {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 6px;
  height: 6px;
  border: 1px solid #1d4ed8;
  border-radius: 1px;
  background: #2563eb;
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
  right: -6px;
  width: 12px;
  min-width: 12px;
  height: 100%;
  border: 0;
  background: transparent;
  cursor: col-resize;
  padding: 0;
  z-index: 2;
}
`

export function ensureDataGridAppStyles(): void {
  if (typeof document === "undefined") {
    return
  }

  if (document.getElementById(DATA_GRID_APP_STYLE_ID)) {
    return
  }

  const style = document.createElement("style")
  style.id = DATA_GRID_APP_STYLE_ID
  style.textContent = DATA_GRID_APP_STYLES
  document.head.append(style)
}
