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
  --datagrid-selection-range-bg: color-mix(in srgb, var(--datagrid-accent-strong) 12%, transparent);
  --datagrid-selection-anchor-bg: transparent;
  --datagrid-selection-overlay-bg: transparent;
  --datagrid-selection-fill-preview-bg: transparent;
  --datagrid-selection-move-preview-bg: transparent;
  --datagrid-row-selected-background-color: transparent;
  --datagrid-row-selected-range-bg: transparent;
  --datagrid-row-selected-sticky-bg: transparent;
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

.grid-body-viewport:focus,
.grid-body-viewport:focus-visible,
.grid-header-viewport:focus,
.grid-header-viewport:focus-visible,
.grid-stage:focus,
.grid-stage:focus-visible {
  outline: none;
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

.affino-datagrid-app-root .grid-cell--selected {
  background: var(--datagrid-selection-range-bg) !important;
}

.affino-datagrid-app-root .grid-cell--selection-anchor {
  background: var(--datagrid-row-background-color) !important;
}

.affino-datagrid-app-root .grid-cell--selection-anchor.grid-cell--selected {
  background: var(--datagrid-row-background-color) !important;
}

.grid-cell--selection-edge::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  border-top: var(--selection-edge-top, 0 solid transparent);
  border-right: var(--selection-edge-right, 0 solid transparent);
  border-bottom: var(--selection-edge-bottom, 0 solid transparent);
  border-left: var(--selection-edge-left, 0 solid transparent);
  box-sizing: border-box;
  border-radius: 1px;
}

.grid-cell--selection-edge-top {
  --selection-edge-top: 2px solid var(--datagrid-selection-overlay-border);
}

.grid-cell--selection-edge-right {
  --selection-edge-right: 2px solid var(--datagrid-selection-overlay-border);
}

.grid-cell--selection-edge-bottom {
  --selection-edge-bottom: 2px solid var(--datagrid-selection-overlay-border);
}

.grid-cell--selection-edge-left {
  --selection-edge-left: 2px solid var(--datagrid-selection-overlay-border);
}

.affino-datagrid-app-root .grid-cell--pinned-left.grid-cell--selection-anchor,
.affino-datagrid-app-root .grid-cell--pinned-left.grid-cell--selection-anchor.grid-cell--selected {
  background: var(--datagrid-pinned-left-bg) !important;
}

.affino-datagrid-app-root .grid-cell--pinned-right.grid-cell--selection-anchor,
.affino-datagrid-app-root .grid-cell--pinned-right.grid-cell--selection-anchor.grid-cell--selected {
  background: var(--datagrid-pinned-right-bg) !important;
}

.grid-selection-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}

.affino-datagrid-app-root .grid-selection-overlay__segment {
  position: absolute;
  border: 2px solid var(--datagrid-selection-copied-border);
  box-sizing: border-box;
  border-radius: 1px;
  background: transparent !important;
}

.affino-datagrid-app-root .grid-selection-overlay__segment--move-preview {
  border-style: dashed;
  background: transparent !important;
}

.grid-stage--range-moving .grid-body-shell .grid-cell {
  cursor: grabbing;
}

.affino-datagrid-app-root .grid-cell--range-move-handle-hover {
  cursor: grab !important;
}

.affino-datagrid-app-root .grid-cell--fill-preview {
  background: transparent !important;
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

.grid-cell--header-menu-enabled {
  cursor: pointer;
}

.grid-cell--header-menu-open {
  background: color-mix(in srgb, var(--datagrid-header-cell-hover-bg) 72%, var(--datagrid-accent-strong) 28%);
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

.col-filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
}

.col-filter-badge {
  color: var(--datagrid-header-text-color);
  background: color-mix(in srgb, var(--datagrid-accent-strong) 22%, transparent);
}

.grid-cell--index {
  color: var(--datagrid-index-cell-text-color);
  background: var(--datagrid-index-cell-background-color);
  border-right: var(--datagrid-column-divider-size) solid var(--datagrid-column-divider-color);
}

.grid-row .grid-cell--index {
  background: var(--datagrid-index-cell-background-color);
}

.grid-row--striped .grid-cell,
.grid-row--striped .grid-cell--index {
  background: color-mix(in srgb, var(--datagrid-row-background-color) 94%, var(--datagrid-accent-strong) 6%);
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

.grid-row--hoverable.grid-row--hovered .grid-cell,
.grid-row--hoverable.grid-row--hovered .grid-cell--index {
  background: var(--datagrid-row-hover-background-color);
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

.ui-menu {
  position: relative;
  display: contents;
  font-family: inherit;
}

.ui-menu-content,
.ui-submenu-content {
  position: absolute;
  min-width: 180px;
  max-width: 360px;
  width: max-content;
  background: var(--ui-menu-bg, #fff);
  border: 1px solid var(--ui-menu-border, #ddd);
  border-radius: 8px;
  box-shadow: var(--ui-menu-shadow, 0 4px 8px rgba(15, 23, 42, 0.12));
  outline: none;
  z-index: 999;
}

.ui-menu-content {
  padding: 6px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
}

.ui-submenu-content {
  padding: 6px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  z-index: 1000;
}

.ui-menu-item,
.ui-submenu-trigger {
  width: 100%;
  box-sizing: border-box;
  min-height: 32px;
  padding: 0.45rem 0.82rem;
  font-size: 12.5px;
}

.ui-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  border-radius: 6px;
  color: var(--ui-menu-text, #1f1f1f);
  cursor: default;
  user-select: none;
}

.ui-menu-item:hover,
.ui-menu-item:focus,
.ui-menu-item:focus-visible,
.ui-submenu-trigger:hover,
.ui-submenu-trigger:focus,
.ui-submenu-trigger:focus-visible {
  background: var(--ui-menu-hover-bg, #f3f3f3);
}

.ui-menu-item:focus,
.ui-menu-item:focus-visible,
.ui-submenu-trigger:focus,
.ui-submenu-trigger:focus-visible {
  outline: none;
  box-shadow: var(--ui-menu-focus-ring, none);
}

.ui-menu-label {
  color: var(--ui-menu-muted, #6b6b6b);
  user-select: none;
}

.ui-menu-separator {
  height: 1px;
  margin: 4px 0;
  background: var(--ui-menu-separator, #ececec);
}

.ui-submenu-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  border-radius: 6px;
  color: var(--ui-submenu-trigger-text, var(--ui-menu-text, #1f1f1f));
  cursor: default;
  user-select: none;
}

.ui-submenu-arrow {
  font-size: 11px;
  color: var(--ui-menu-muted, #6b6b6b);
}

.datagrid-column-menu__panel,
.datagrid-column-menu__submenu-panel {
  --ui-menu-bg: var(--datagrid-column-menu-bg);
  --ui-menu-border: var(--datagrid-column-menu-border);
  --ui-menu-hover-bg: var(--datagrid-column-menu-item-hover-bg);
  --ui-menu-text: var(--datagrid-text-primary);
  --ui-submenu-trigger-text: var(--datagrid-text-primary);
  --ui-menu-muted: var(--datagrid-column-menu-muted-text);
  --ui-menu-separator: color-mix(in srgb, var(--datagrid-glass-border) 70%, transparent);
  --ui-menu-focus-ring: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
  --ui-menu-shadow: 0 10px 28px var(--datagrid-column-menu-shadow);
  color: var(--datagrid-text-primary);
}

.datagrid-column-menu__panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: min(312px, calc(100vw - 16px));
  max-height: min(548px, calc(100vh - 24px));
  padding: 6px;
  overflow: hidden;
}

.datagrid-column-menu__section-head,
.datagrid-column-menu__footer,
.datagrid-column-menu__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.datagrid-column-menu__title {
  min-width: 0;
  padding: 4px 9px 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.datagrid-column-menu__link,
.datagrid-column-menu__item {
  font: inherit;
}

.datagrid-column-menu__link {
  border: 0;
  background: transparent;
  color: var(--datagrid-text-primary);
  cursor: pointer;
}

.datagrid-column-menu__section-head .datagrid-column-menu__link {
  padding: 0;
  font-size: 11px;
  color: var(--datagrid-sort-indicator-color);
}

.datagrid-column-menu__section-head .datagrid-column-menu__link:hover:not(:disabled) {
  background: transparent;
  color: var(--datagrid-text-primary);
}

.datagrid-column-menu__section {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 7px 8px 8px;
}

.datagrid-column-menu__section-separator {
  margin: 2px 0;
}

.datagrid-column-menu__section--filter {
  padding-top: 6px;
}

.datagrid-column-menu__section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--datagrid-sort-indicator-color);
}

.datagrid-column-menu__item {
  font-size: 12.5px;
}

.datagrid-column-menu__link:hover:not(:disabled) {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 10%, transparent);
}

.datagrid-column-menu__link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.datagrid-column-menu__item--submenu {
  font-weight: inherit;
}

.datagrid-column-menu__panel .ui-submenu-trigger.datagrid-column-menu__item--submenu {
  border: 0 !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent;
}

.datagrid-column-menu__panel .ui-submenu-trigger.datagrid-column-menu__item--submenu:hover,
.datagrid-column-menu__panel .ui-submenu-trigger.datagrid-column-menu__item--submenu:focus,
.datagrid-column-menu__panel .ui-submenu-trigger.datagrid-column-menu__item--submenu:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  background: var(--ui-menu-hover-bg, #f3f3f3);
}

.datagrid-column-menu__state,
.datagrid-column-menu__summary,
.datagrid-column-menu__value-count {
  color: var(--datagrid-sort-indicator-color);
  font-size: 11px;
}

.datagrid-column-menu__state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--datagrid-accent-strong) 9%, transparent);
}

.datagrid-column-menu__search {
  width: 100%;
  min-width: 0;
  height: 32px;
  border: 1px solid var(--datagrid-column-menu-search-border) !important;
  border-radius: 8px;
  padding: 0 11px;
  font-size: 12px;
  color: var(--datagrid-text-primary);
  background: var(--datagrid-column-menu-search-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--datagrid-background-color) 18%, transparent);
}

.datagrid-column-menu__search::placeholder {
  color: var(--datagrid-column-menu-muted-text);
  opacity: 1;
}

.datagrid-column-menu__search:focus,
.datagrid-column-menu__search:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 44%, var(--datagrid-filter-trigger-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--datagrid-accent-strong) 18%, transparent);
}

.datagrid-column-menu__merge-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--datagrid-text-primary);
  padding: 1px 2px 0;
}

.datagrid-column-menu__merge-toggle input {
  margin: 0;
}

.datagrid-column-menu__values {
  max-height: min(152px, calc(100vh - 390px));
  border: 1px solid color-mix(in srgb, var(--datagrid-glass-border) 68%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--datagrid-editor-bg) 97%, transparent);
  overflow: hidden;
}

.datagrid-column-menu__values-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: inherit;
  overflow: auto;
  padding: 3px;
}

.datagrid-column-menu__value {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 24px;
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 11.5px;
  cursor: pointer;
  color: var(--datagrid-text-primary);
}

.datagrid-column-menu__value input {
  margin: 0;
}

.datagrid-column-menu__value:hover,
.datagrid-column-menu__value[aria-selected="true"] {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 8%, transparent);
}

.datagrid-column-menu__value-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.datagrid-column-menu__value-count {
  min-width: 18px;
  text-align: right;
}

.datagrid-column-menu__empty {
  padding: 10px 8px;
  color: var(--datagrid-sort-indicator-color);
  text-align: center;
  font-size: 12px;
}

.datagrid-column-menu__hint {
  color: var(--datagrid-sort-indicator-color);
  font-size: 12px;
}

.datagrid-column-menu__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 70px;
  height: 29px;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  background: transparent;
  color: var(--datagrid-text-primary);
  cursor: pointer;
}

.datagrid-column-menu__button--secondary {
  border-color: color-mix(in srgb, var(--datagrid-glass-border) 72%, transparent);
  background: color-mix(in srgb, var(--datagrid-editor-bg) 97%, transparent);
}

.datagrid-column-menu__button--primary {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 44%, transparent);
  background: color-mix(in srgb, var(--datagrid-accent-strong) 18%, transparent);
}

.datagrid-column-menu__button--secondary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--datagrid-editor-bg) 84%, var(--datagrid-accent-strong) 16%);
}

.datagrid-column-menu__button--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 24%, transparent);
}

.datagrid-column-menu__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.datagrid-column-menu__button:focus,
.datagrid-column-menu__button:focus-visible,
.datagrid-column-menu__link:focus,
.datagrid-column-menu__link:focus-visible {
  outline: none;
  box-shadow: var(--ui-menu-focus-ring, none);
}

.datagrid-column-menu__toolbar {
  flex-wrap: wrap;
  align-items: center;
}

.datagrid-column-menu__toolbar .datagrid-column-menu__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--datagrid-glass-border) 68%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--datagrid-editor-bg) 96%, transparent);
  font-size: 11px;
  font-weight: 500;
  color: var(--datagrid-text-primary);
}

.datagrid-column-menu__toolbar .datagrid-column-menu__summary {
  margin-left: auto;
}

.datagrid-column-menu__footer {
  justify-content: flex-end;
  padding-top: 4px;
  gap: 6px;
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
