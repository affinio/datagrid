const DATA_GRID_APP_STYLE_ID = "affino-datagrid-vue-app-styles"

const DATA_GRID_APP_STYLES = `
.affino-datagrid-app-root {
  display: flex;
  min-width: 0;
  min-height: 0;
  font-family: var(--datagrid-font-family);
  font-size: var(--datagrid-font-size);
  color: var(--datagrid-text-color);
  background: var(--datagrid-background-color);
  --datagrid-surface-elevated-color: color-mix(in srgb, var(--datagrid-background-color) 92%, white 8%);
  --datagrid-selection-border-color: color-mix(in srgb, var(--datagrid-text-color) 22%, transparent);
  --datagrid-selection-stroke-width: 2px;
  --datagrid-selection-range-bg: color-mix(in srgb, var(--datagrid-accent-strong) 12%, transparent);
  --datagrid-selection-anchor-bg: transparent;
  --datagrid-selection-overlay-bg: transparent;
  --datagrid-selection-fill-preview-bg: transparent;
  --datagrid-selection-move-preview-bg: transparent;
  --datagrid-row-selected-background-color: transparent;
  --datagrid-row-selected-range-bg: transparent;
  --datagrid-row-selected-sticky-bg: transparent;
  --datagrid-row-band-base-bg: var(--datagrid-row-background-color);
  --datagrid-row-band-hover-bg: color-mix(in srgb, var(--datagrid-row-background-color) 74%, var(--datagrid-row-hover-background-color) 26%);
  --datagrid-row-band-striped-bg: color-mix(in srgb, var(--datagrid-row-background-color) 93%, var(--datagrid-accent-strong) 7%);
  --datagrid-row-band-group-bg: var(--datagrid-group-row-background-color);
  --datagrid-row-band-tree-bg: color-mix(in srgb, var(--datagrid-row-background-color) 82%, var(--datagrid-accent-strong) 18%);
  --datagrid-row-band-pivot-bg: color-mix(in srgb, var(--datagrid-row-background-color) 88%, var(--datagrid-accent-strong) 12%);
  --datagrid-row-band-pivot-group-bg: color-mix(in srgb, var(--datagrid-group-row-background-color) 78%, var(--datagrid-accent-strong) 22%);
  --datagrid-header-column-divider-color: var(--datagrid-column-divider-color);
  --datagrid-header-column-divider-size: var(--datagrid-column-divider-size);
  --datagrid-pinned-pane-separator-size: 2px;
  --datagrid-pinned-pane-separator-color: color-mix(in srgb, var(--datagrid-column-divider-color) 82%, var(--datagrid-text-color) 18%);
  --datagrid-selection-copied-contrast: color-mix(in srgb, var(--datagrid-background-color) 84%, var(--datagrid-text-color));
  --datagrid-selection-copied-glow: color-mix(in srgb, var(--datagrid-selection-copied-border) 38%, transparent);
}

.affino-datagrid-app-root--theme-sugar {
  --datagrid-pinned-pane-separator-color: color-mix(in srgb, var(--datagrid-column-divider-color) 88%, var(--datagrid-text-color) 12%);
}

.affino-datagrid-app-root--fill {
  flex: 1 1 auto;
  height: 100%;
}

.affino-datagrid-app-root--auto-height {
  height: auto;
}

.datagrid-app-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  width: 100%;
}

.datagrid-app-layout--fill {
  flex: 1 1 auto;
  height: 100%;
}

.datagrid-app-layout--auto-height {
  height: auto;
}

.datagrid-app-workspace {
  display: flex;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  width: 100%;
}

.datagrid-app-workspace--fill {
  flex: 1 1 auto;
  height: 100%;
}

.datagrid-app-workspace--auto-height {
  align-items: flex-start;
  height: auto;
}

.datagrid-app-stage {
  display: flex;
  min-width: 0;
  min-height: 0;
  width: 100%;
}

.datagrid-app-stage--fill {
  flex: 1 1 auto;
  height: 100%;
}

.datagrid-app-stage--auto-height {
  height: auto;
}

.datagrid-gantt-stage {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  flex: 1 1 auto;
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.datagrid-gantt-stage__table,
.datagrid-gantt-stage__timeline {
  min-width: 0;
  min-height: 0;
}

.datagrid-gantt-stage__table {
  display: flex;
  min-width: 280px;
}

.datagrid-gantt-stage__table > .grid-stage {
  border-radius: 8px 0 0 8px;
  border-right-width: 0;
}

.datagrid-gantt-stage__splitter {
  position: absolute;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  border: 0;
  background: transparent;
  cursor: col-resize;
  padding: 0;
  z-index: 5;
  touch-action: none;
}

.datagrid-gantt-stage__splitter::before {
  content: "";
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 50%;
  width: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--datagrid-glass-border) 78%, transparent);
  transform: translateX(-50%);
}

.datagrid-gantt-stage__splitter:hover::before,
.datagrid-gantt-stage__splitter:focus-visible::before {
  background: var(--datagrid-accent-strong);
}

.datagrid-gantt-stage__splitter:focus,
.datagrid-gantt-stage__splitter:focus-visible {
  outline: none;
}

.datagrid-gantt-stage__timeline {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--datagrid-glass-border);
  border-left-width: 1px;
  border-radius: 0 8px 8px 0;
  overflow: hidden;
  background: var(--datagrid-background-color);
}

.datagrid-gantt-stage__timeline-header {
  position: relative;
  min-width: 0;
  border-bottom: var(--datagrid-header-divider-size) solid var(--datagrid-header-divider-color);
  background: var(--datagrid-header-row-bg);
}

.datagrid-gantt-stage__timeline-body {
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--datagrid-viewport-bg);
}

.datagrid-gantt-stage__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  color: var(--datagrid-text-muted);
  font-size: 13px;
  text-align: center;
}

.datagrid-gantt-timeline__viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  touch-action: none;
  -webkit-overflow-scrolling: touch;
}

.datagrid-gantt-timeline__viewport--header {
  height: 100%;
}

.datagrid-gantt-timeline__viewport--body {
  height: 100%;
}

.datagrid-gantt-timeline__viewport:focus,
.datagrid-gantt-timeline__viewport:focus-visible {
  outline: none;
}

.datagrid-gantt-timeline__track-spacer {
  min-height: 1px;
}

.datagrid-gantt-timeline__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1;
}

.datagrid-gantt-timeline__canvas--header {
  pointer-events: none;
}

.datagrid-gantt-timeline__canvas--body {
  touch-action: none;
}

@media (max-width: 960px) {
  .datagrid-gantt-stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(280px, 42vh) minmax(280px, 1fr);
  }

  .datagrid-gantt-stage__table {
    min-width: 0;
  }

  .datagrid-gantt-stage__splitter {
    display: none;
  }

  .datagrid-gantt-stage__table > .grid-stage {
    border-radius: 8px 8px 0 0;
    border-right-width: 1px;
    border-bottom-width: 0;
  }

  .datagrid-gantt-stage__timeline {
    border-radius: 0 0 8px 8px;
  }
}

.datagrid-app-inspector-shell {
  display: flex;
  flex: 0 0 min(480px, 42vw);
  width: min(480px, 42vw);
  min-width: 360px;
  max-width: min(540px, 48vw);
  min-height: 0;
}

.datagrid-app-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.datagrid-app-toolbar__group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.datagrid-app-toolbar__button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--datagrid-filter-trigger-border);
  border-radius: 8px;
  background: var(--datagrid-editor-bg);
  color: var(--datagrid-text-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}

.datagrid-app-toolbar__button:hover {
  background: color-mix(in srgb, var(--datagrid-column-menu-item-hover-bg) 72%, var(--datagrid-editor-bg));
}

.datagrid-app-toolbar__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: color-mix(in srgb, var(--datagrid-grid-surface) 88%, var(--datagrid-editor-bg));
}

.datagrid-app-toolbar__button:hover:disabled {
  background: color-mix(in srgb, var(--datagrid-grid-surface) 88%, var(--datagrid-editor-bg));
}

.datagrid-app-toolbar__button:focus,
.datagrid-app-toolbar__button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-app-toolbar__button--active {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 46%, var(--datagrid-filter-trigger-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 14%, var(--datagrid-editor-bg));
}

.datagrid-app-toolbar__button-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}

.datagrid-app-toolbar__button-icon svg {
  display: block;
  width: 14px;
  height: 14px;
}

.datagrid-app-toolbar__button-icon--advanced-filter {
  color: var(--datagrid-accent-strong);
}

.datagrid-overlay-drag-handle {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

[data-datagrid-overlay-dragging="true"] .datagrid-overlay-drag-handle,
.datagrid-overlay-drag-handle:active {
  cursor: grabbing;
}

.datagrid-column-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(340px, calc(100vw - 16px));
  max-height: min(480px, calc(100vh - 16px));
  padding: 10px;
  border: 1px solid var(--datagrid-column-menu-border);
  border-radius: 12px;
  background: var(--datagrid-column-menu-bg);
  box-shadow: 0 18px 40px var(--datagrid-column-menu-shadow);
  color: var(--datagrid-text-primary);
  font-family: var(--datagrid-font-family);
  font-size: var(--datagrid-font-size);
  overflow-x: hidden;
  overflow-y: auto;
}

.datagrid-advanced-filter__applied {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--datagrid-accent-strong) 14%, var(--datagrid-column-menu-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--datagrid-accent-strong) 6%, var(--datagrid-column-menu-bg));
}

.datagrid-advanced-filter__applied-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.datagrid-advanced-filter__applied-title {
  color: var(--datagrid-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.datagrid-advanced-filter__applied-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.datagrid-advanced-filter__applied-chip,
.datagrid-advanced-filter__applied-empty {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.2;
}

.datagrid-advanced-filter__applied-chip {
  border: 1px solid color-mix(in srgb, var(--datagrid-accent-strong) 18%, var(--datagrid-filter-trigger-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 10%, var(--datagrid-editor-bg));
  color: var(--datagrid-text-primary);
}

.datagrid-advanced-filter__applied-empty {
  border: 1px dashed var(--datagrid-filter-trigger-border);
  color: var(--datagrid-text-muted);
}

.datagrid-column-layout__header,
.datagrid-column-layout__footer,
.datagrid-column-layout__visibility,
.datagrid-column-layout__move-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.datagrid-column-layout__eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-column-layout__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  color: var(--datagrid-text-primary);
}

.datagrid-column-layout__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  padding-right: 2px;
  min-height: 0;
}

.datagrid-column-layout__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, var(--datagrid-column-menu-border) 72%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--datagrid-column-menu-item-hover-bg) 36%, transparent);
}

.datagrid-column-layout__visibility {
  justify-content: flex-start;
  min-width: 0;
}

.datagrid-column-layout__visibility input {
  margin: 0;
}

.datagrid-column-layout__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.datagrid-column-layout__move-actions {
  justify-content: flex-end;
}

.datagrid-column-layout__ghost,
.datagrid-column-layout__secondary,
.datagrid-column-layout__primary,
.datagrid-column-layout__icon-button {
  height: 30px;
  border: 1px solid var(--datagrid-column-menu-search-border);
  border-radius: 7px;
  background: var(--datagrid-column-menu-search-bg);
  color: var(--datagrid-text-primary);
  font: inherit;
}

.datagrid-column-layout__icon-button {
  width: 30px;
  min-width: 30px;
  padding: 0;
  cursor: pointer;
}

.datagrid-column-layout__icon-button:hover:not(:disabled) {
  background: var(--datagrid-column-menu-item-hover-bg);
}

.datagrid-column-layout__ghost:focus,
.datagrid-column-layout__ghost:focus-visible,
.datagrid-column-layout__secondary:focus,
.datagrid-column-layout__secondary:focus-visible,
.datagrid-column-layout__primary:focus,
.datagrid-column-layout__primary:focus-visible,
.datagrid-column-layout__icon-button:focus,
.datagrid-column-layout__icon-button:focus-visible {
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-column-layout__ghost:disabled,
.datagrid-column-layout__secondary:disabled,
.datagrid-column-layout__primary:disabled,
.datagrid-column-layout__icon-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.datagrid-column-layout__ghost,
.datagrid-column-layout__secondary,
.datagrid-column-layout__primary {
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.datagrid-column-layout__ghost,
.datagrid-column-layout__secondary {
  background: transparent;
}

.datagrid-column-layout__ghost:hover,
.datagrid-column-layout__secondary:hover {
  background: var(--datagrid-column-menu-item-hover-bg);
}

.datagrid-column-layout__primary {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 48%, var(--datagrid-column-menu-search-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 18%, transparent);
}

.datagrid-column-layout__primary:hover {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 26%, transparent);
}

.datagrid-aggregations {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(360px, calc(100vw - 16px));
  max-height: min(500px, calc(100vh - 16px));
  padding: 10px;
  border: 1px solid var(--datagrid-column-menu-border);
  border-radius: 12px;
  background: var(--datagrid-column-menu-bg);
  box-shadow: 0 18px 40px var(--datagrid-column-menu-shadow);
  color: var(--datagrid-text-primary);
  font-family: var(--datagrid-font-family);
  font-size: var(--datagrid-font-size);
  overflow-x: hidden;
  overflow-y: auto;
}

.datagrid-aggregations__header,
.datagrid-aggregations__footer,
.datagrid-aggregations__footer-actions,
.datagrid-aggregations__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.datagrid-aggregations__eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-aggregations__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  color: var(--datagrid-text-primary);
}

.datagrid-aggregations__basis {
  display: grid;
  gap: 4px;
}

.datagrid-aggregations__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-aggregations__select,
.datagrid-aggregations__op,
.datagrid-aggregations__ghost,
.datagrid-aggregations__secondary,
.datagrid-aggregations__primary {
  height: 30px;
  border: 1px solid var(--datagrid-column-menu-search-border);
  border-radius: 7px;
  background: var(--datagrid-column-menu-search-bg);
  color: var(--datagrid-text-primary);
  font: inherit;
}

.datagrid-aggregations__select,
.datagrid-aggregations__op {
  padding: 0 11px;
}

.datagrid-aggregations__select:focus,
.datagrid-aggregations__select:focus-visible,
.datagrid-aggregations__op:focus,
.datagrid-aggregations__op:focus-visible,
.datagrid-aggregations__ghost:focus,
.datagrid-aggregations__ghost:focus-visible,
.datagrid-aggregations__secondary:focus,
.datagrid-aggregations__secondary:focus-visible,
.datagrid-aggregations__primary:focus,
.datagrid-aggregations__primary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-aggregations__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  padding-right: 2px;
  min-height: 0;
}

.datagrid-aggregations__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 122px;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, var(--datagrid-column-menu-border) 72%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--datagrid-column-menu-item-hover-bg) 36%, transparent);
}

.datagrid-aggregations__toggle {
  justify-content: flex-start;
  min-width: 0;
}

.datagrid-aggregations__toggle input {
  margin: 0;
}

.datagrid-aggregations__row-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.datagrid-aggregations__empty {
  padding: 12px;
  border: 1px dashed color-mix(in srgb, var(--datagrid-column-menu-border) 72%, transparent);
  border-radius: 12px;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-aggregations__ghost,
.datagrid-aggregations__secondary,
.datagrid-aggregations__primary {
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.datagrid-aggregations__ghost,
.datagrid-aggregations__secondary {
  background: transparent;
}

.datagrid-aggregations__ghost:hover,
.datagrid-aggregations__secondary:hover {
  background: var(--datagrid-column-menu-item-hover-bg);
}

.datagrid-aggregations__primary {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 48%, var(--datagrid-column-menu-search-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 18%, transparent);
}

.datagrid-aggregations__primary:hover {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 26%, transparent);
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
  position: relative;
  width: 100%;
  min-height: 0;
  min-width: 0;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--datagrid-background-color);
}

.grid-stage--layout-fill {
  flex: 1 1 auto;
  height: 100%;
}

.grid-stage--layout-auto-height {
  grid-template-rows: auto auto;
  height: auto;
  align-self: flex-start;
}

.grid-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 1px solid var(--datagrid-glass-border);
  border-radius: inherit;
  box-sizing: border-box;
  z-index: 8;
}

.grid-header-shell,
.grid-body-shell {
  display: grid;
  min-width: 0;
}

.grid-header-shell {
  position: relative;
  background: var(--datagrid-header-row-bg);
}

.grid-body-shell {
  position: relative;
  min-height: 0;
}

.grid-body-shell--pinned-bottom {
  border-top: var(--datagrid-row-divider-size) solid var(--datagrid-row-divider-color);
  flex: 0 0 auto;
}

.grid-header-pane,
.grid-body-pane {
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.grid-header-pane--left,
.grid-body-pane--left {
  box-shadow: none;
}

.grid-header-pane--right,
.grid-body-pane--right {
  box-shadow: none;
}

.grid-header-pane--left::after,
.grid-body-pane--left::after,
.grid-header-pane--right::before,
.grid-body-pane--right::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: var(--datagrid-pinned-pane-separator-size);
  background: var(--datagrid-pinned-pane-separator-color);
  pointer-events: none;
  z-index: 5;
}

.grid-header-pane--left::after,
.grid-body-pane--left::after {
  right: 0;
}

.grid-header-pane--right::before,
.grid-body-pane--right::before {
  left: 0;
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

.grid-body-pane--layout-auto-height {
  min-height: 100%;
}

.grid-header-viewport {
  position: relative;
  overflow-x: hidden;
  overflow-y: hidden;
  border-bottom: var(--datagrid-header-divider-size) solid var(--datagrid-header-divider-color);
  background: var(--datagrid-header-row-bg);
  overscroll-behavior-x: contain;
  touch-action: none;
}

.grid-body-viewport {
  overflow: auto;
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--datagrid-viewport-bg);
  overscroll-behavior-x: contain;
  touch-action: none;
  -webkit-overflow-scrolling: touch;
}

.grid-body-viewport--pinned-bottom {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.grid-body-viewport--layout-auto-height {
  min-height: 100%;
}

.grid-body-viewport--pinned-bottom::-webkit-scrollbar {
  display: none;
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
  position: relative;
  z-index: 4;
}

.grid-stage--canvas-chrome .grid-row--hovered::before,
.grid-stage--canvas-chrome .grid-row--striped::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.grid-stage--canvas-chrome .grid-row--hovered::before {
  background: transparent;
}

.grid-stage--canvas-chrome .grid-row--striped::before {
  background: transparent;
}

.grid-stage--canvas-chrome .grid-row--hovered {
  background: transparent;
}

.grid-stage--canvas-chrome .grid-row--striped {
  background: transparent;
}

.grid-stage--canvas-chrome .grid-row > .grid-cell,
.grid-stage--canvas-chrome .grid-row > .grid-column-spacer {
  position: relative;
  z-index: 1;
}

.grid-pane-track,
.grid-center-track {
  display: flex;
}

.grid-body-content {
  min-width: 100%;
  position: relative;
  z-index: 4;
}

.grid-pane-content {
  min-width: 100%;
  position: relative;
  z-index: 4;
  will-change: transform;
}

.grid-chrome-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
  z-index: 3;
}

.grid-chrome-canvas--center-shell {
  top: 0;
  bottom: auto;
}

.grid-chrome-canvas--header-center {
  top: 0;
  bottom: auto;
}

.grid-header-shell .grid-chrome-canvas {
  z-index: 5;
}

.grid-column-spacer {
  flex: 0 0 auto;
  align-self: stretch;
}

.grid-stage--auto-row-height .grid-row {
  align-items: stretch;
}

.grid-stage--auto-row-height .grid-body-content .grid-cell,
.grid-stage--auto-row-height .grid-pane-content .grid-cell {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  overflow-wrap: anywhere;
  word-break: break-word;
  align-items: flex-start;
}

.grid-row--autosize-probe .grid-cell {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

.grid-cell {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;
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

.grid-stage--canvas-chrome .grid-body-shell .grid-cell,
.grid-stage--canvas-chrome .grid-body-shell .grid-cell--index,
.grid-stage--canvas-chrome .grid-header-shell .grid-cell,
.grid-stage--canvas-chrome .grid-header-shell .grid-cell--index {
  background: transparent;
}

.grid-stage--canvas-chrome .grid-header-viewport {
  background: transparent;
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

.affino-datagrid-app-root .grid-stage--single-cell-selection .grid-cell--selection-anchor {
  outline: var(--datagrid-selection-stroke-width) solid var(--datagrid-selection-overlay-border);
  outline-offset: calc(-1 * var(--datagrid-selection-stroke-width));
}

.grid-cell--selection-edge {
  --selection-edge-top-size: 0px;
  --selection-edge-right-size: 0px;
  --selection-edge-bottom-size: 0px;
  --selection-edge-left-size: 0px;
  --selection-edge-top-color: transparent;
  --selection-edge-right-color: transparent;
  --selection-edge-bottom-color: transparent;
  --selection-edge-left-color: transparent;
  box-shadow:
    inset 0 var(--selection-edge-top-size) 0 0 var(--selection-edge-top-color),
    inset calc(-1 * var(--selection-edge-right-size)) 0 0 0 var(--selection-edge-right-color),
    inset 0 calc(-1 * var(--selection-edge-bottom-size)) 0 0 var(--selection-edge-bottom-color),
    inset var(--selection-edge-left-size) 0 0 0 var(--selection-edge-left-color);
}

.grid-cell--selection-edge-top {
  --selection-edge-top-size: var(--datagrid-selection-stroke-width);
  --selection-edge-top-color: var(--datagrid-selection-handle-border);
}

.grid-cell--selection-edge-right {
  --selection-edge-right-size: var(--datagrid-selection-stroke-width);
  --selection-edge-right-color: var(--datagrid-selection-handle-border);
}

.grid-cell--selection-edge-bottom {
  --selection-edge-bottom-size: var(--datagrid-selection-stroke-width);
  --selection-edge-bottom-color: var(--datagrid-selection-handle-border);
}

.grid-cell--selection-edge-left {
  --selection-edge-left-size: var(--datagrid-selection-stroke-width);
  --selection-edge-left-color: var(--datagrid-selection-handle-border);
}

.grid-selection-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}

.affino-datagrid-app-root .grid-selection-overlay__segment {
  position: absolute;
  border: var(--datagrid-selection-stroke-width) solid var(--datagrid-selection-handle-border);
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

.grid-stage--fill-dragging,
.grid-stage--fill-dragging *,
.grid-stage--fill-dragging .grid-body-shell,
.grid-stage--fill-dragging .grid-body-shell .grid-cell,
.grid-stage--fill-dragging .grid-body-viewport,
.grid-stage--fill-dragging .grid-cell--range-move-handle-hover,
.grid-stage--fill-dragging .cell-fill-handle {
  cursor: crosshair !important;
}

html.datagrid-fill-drag-cursor,
html.datagrid-fill-drag-cursor *,
body.datagrid-fill-drag-cursor,
body.datagrid-fill-drag-cursor * {
  cursor: crosshair !important;
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
  inset: -2px;
  pointer-events: none;
  z-index: 7;
  background-image:
    repeating-linear-gradient(90deg, var(--clipboard-pending-top, transparent) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(90deg, var(--clipboard-pending-bottom, transparent) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(0deg, var(--clipboard-pending-left, transparent) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(0deg, var(--clipboard-pending-right, transparent) 0 6px, transparent 6px 12px);
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-size:
    calc(100% - 4px) 2px,
    calc(100% - 4px) 2px,
    2px calc(100% - 4px),
    2px calc(100% - 4px);
  background-position:
    2px 2px,
    2px calc(100% - 2px),
    2px 2px,
    calc(100% - 2px) 2px;
  box-shadow:
    0 0 0 1px var(--datagrid-selection-copied-contrast),
    0 0 0 2px var(--datagrid-selection-copied-glow);
  border-radius: 2px;
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
      2px 2px,
      2px calc(100% - 2px),
      2px 2px,
      calc(100% - 2px) 2px;
  }
  to {
    background-position:
      14px 2px,
      -10px calc(100% - 2px),
      2px 14px,
      calc(100% - 2px) -10px;
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
  cursor: default;
}

.grid-cell--header-menu-open {
  background: color-mix(in srgb, var(--datagrid-header-cell-hover-bg) 72%, var(--datagrid-accent-strong) 28%);
}

.grid-header-row--pivot-groups .grid-cell--header {
  min-height: 28px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.grid-header-row--pivot-groups {
  position: relative;
  z-index: 6;
}

.grid-header-shell--pivot-groups .grid-header-row:not(.grid-header-row--pivot-groups) .grid-cell--header {
  border-right: var(--datagrid-header-column-divider-size) solid var(--datagrid-header-column-divider-color);
}

.grid-header-shell--pivot-groups .grid-header-row--pivot-groups .grid-cell--header-group {
  border-right: var(--datagrid-header-column-divider-size) solid var(--datagrid-header-column-divider-color);
}

.grid-cell--header-group {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--datagrid-header-row-bg) 78%, var(--datagrid-header-cell-bg) 22%);
  border-bottom: 1px solid color-mix(in srgb, var(--datagrid-header-divider-color) 70%, transparent);
}

.grid-cell--header-group[data-datagrid-pivot-group-depth="0"] {
  background: color-mix(in srgb, var(--datagrid-header-row-bg) 72%, var(--datagrid-header-cell-bg) 28%);
}

.grid-cell--header-group[data-datagrid-pivot-group-depth="1"] {
  background: color-mix(in srgb, var(--datagrid-header-row-bg) 82%, var(--datagrid-header-cell-bg) 18%);
}

.grid-cell--header-group[data-datagrid-pivot-group-depth="2"],
.grid-cell--header-group[data-datagrid-pivot-group-depth="3"] {
  background: color-mix(in srgb, var(--datagrid-header-row-bg) 88%, var(--datagrid-header-cell-bg) 12%);
}

.grid-cell--header-group-last {
  border-right-color: transparent !important;
}

.grid-cell--header-group-empty {
  color: transparent;
}

.grid-cell--pinned-left,
.grid-cell--pinned-right {
  background: var(--datagrid-pinned-bg);
}

.grid-cell--pinned-left {
  background: var(--datagrid-pinned-left-bg);
}

.grid-cell--pinned-right {
  background: var(--datagrid-pinned-right-bg);
}

.grid-cell--pinned-divider-right {
  box-shadow: inset calc(-1 * var(--datagrid-column-divider-size)) 0 0 var(--datagrid-column-divider-color);
}

.grid-cell--pinned-divider-left {
  box-shadow: inset var(--datagrid-column-divider-size) 0 0 var(--datagrid-column-divider-color);
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
}

.grid-cell--checkbox {
  justify-content: center;
  padding-left: 8px;
  padding-right: 8px;
}

.grid-cell--index-number {
  cursor: pointer;
}

.grid-cell--index-selected {
  overflow: visible;
}

.datagrid-stage__row-index-cell.grid-cell--index-selected::before {
  content: "";
  position: absolute;
  left: 6px;
  right: calc(6px + var(--datagrid-column-divider-size));
  background: var(--datagrid-selection-range-bg);
  border-left: 1px solid var(--datagrid-selection-border-color);
  border-right: 1px solid var(--datagrid-selection-border-color);
  pointer-events: none;
  z-index: 0;
}

.datagrid-stage__row-index-cell.grid-cell--index-selected-top::before {
  top: 2px;
  bottom: calc(var(--datagrid-row-divider-size) * -1);
  border-top: 1px solid var(--datagrid-selection-border-color);
  border-radius: 10px 10px 0 0;
}

.datagrid-stage__row-index-cell.grid-cell--index-selected-middle::before {
  top: calc(var(--datagrid-row-divider-size) * -1);
  bottom: calc(var(--datagrid-row-divider-size) * -1);
}

.datagrid-stage__row-index-cell.grid-cell--index-selected-bottom::before {
  top: calc(var(--datagrid-row-divider-size) * -1);
  bottom: 2px;
  border-bottom: 1px solid var(--datagrid-selection-border-color);
  border-radius: 0 0 10px 10px;
}

.datagrid-stage__row-index-cell.grid-cell--index-selected-single::before {
  top: 2px;
  bottom: 2px;
  border-top: 1px solid var(--datagrid-selection-border-color);
  border-bottom: 1px solid var(--datagrid-selection-border-color);
  border-radius: 10px;
}

.datagrid-stage__row-index-cell.grid-cell--index-selected .row-resize-handle {
  position: relative;
  z-index: 1;
}

.grid-row .grid-cell--index {
  background: var(--datagrid-index-cell-background-color);
}

.grid-row.row--group .grid-cell {
  font-weight: 600;
  cursor: pointer;
  color: var(--datagrid-group-row-text-color);
}

.grid-row.row--group.grid-row--group-explicit-trigger .grid-cell,
.grid-row.row--group.grid-row--group-explicit-trigger .grid-cell--index-number {
  cursor: default;
}

.grid-checkbox-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.grid-checkbox-trigger:focus-visible {
  outline: 2px solid var(--datagrid-accent-strong);
  outline-offset: 1px;
}

.grid-checkbox-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--datagrid-selection-border-color, color-mix(in srgb, var(--datagrid-text-color) 22%, transparent));
  border-radius: 4px;
  background: var(--datagrid-surface-elevated-color, color-mix(in srgb, var(--datagrid-background-color) 92%, white 8%));
  transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}

.grid-checkbox-indicator--checked,
.grid-checkbox-indicator--mixed {
  border-color: color-mix(in srgb, var(--datagrid-checkbox-accent, var(--datagrid-accent-strong)) 72%, var(--datagrid-selection-border-color, color-mix(in srgb, var(--datagrid-text-color) 22%, transparent)));
  background: color-mix(in srgb, var(--datagrid-checkbox-accent, var(--datagrid-accent-strong)) 14%, var(--datagrid-surface-elevated-color, color-mix(in srgb, var(--datagrid-background-color) 92%, white 8%)));
}

.grid-checkbox-indicator__mark {
  display: block;
  opacity: 0;
}

.grid-checkbox-indicator__mark--checked {
  width: 9px;
  height: 5px;
  border-left: 2px solid var(--datagrid-checkbox-accent, var(--datagrid-accent-strong));
  border-bottom: 2px solid var(--datagrid-checkbox-accent, var(--datagrid-accent-strong));
  transform: translateY(-1px) rotate(-45deg);
  opacity: 1;
}

.grid-checkbox-indicator__mark--mixed {
  width: 8px;
  height: 2px;
  border-radius: 999px;
  background: var(--datagrid-checkbox-accent, var(--datagrid-accent-strong));
  opacity: 1;
}

.grid-cell--checkbox[role="checkbox"]:focus-visible .grid-checkbox-indicator {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--datagrid-accent-strong) 28%, transparent);
}

.grid-row--checkbox-selected .grid-cell,
.grid-row--checkbox-selected .grid-cell--index {
  background: var(--datagrid-row-selected-background-color);
}

.grid-row--focused .grid-cell,
.grid-row--focused .grid-cell--index {
  background: var(--datagrid-row-selected-background-color);
}

.grid-row--hoverable.grid-row--hovered .grid-cell,
.grid-row--hoverable.grid-row--hovered .grid-cell--index {
  background-image: linear-gradient(var(--datagrid-row-band-hover-bg), var(--datagrid-row-band-hover-bg));
  background-size: calc(100% - var(--datagrid-column-divider-size)) calc(100% - var(--datagrid-row-divider-size));
  background-position: top left;
  background-repeat: no-repeat;
}

.grid-row--striped .grid-cell,
.grid-row--striped .grid-cell--index {
  background-image: linear-gradient(var(--datagrid-row-band-striped-bg), var(--datagrid-row-band-striped-bg));
  background-size: calc(100% - var(--datagrid-column-divider-size)) calc(100% - var(--datagrid-row-divider-size));
  background-position: top left;
  background-repeat: no-repeat;
}

.grid-stage--canvas-chrome .grid-row--hoverable.grid-row--hovered .grid-cell,
.grid-stage--canvas-chrome .grid-row--hoverable.grid-row--hovered .grid-cell--index {
  background-image: linear-gradient(var(--datagrid-row-band-hover-bg), var(--datagrid-row-band-hover-bg));
  background-size: calc(100% - var(--datagrid-column-divider-size)) calc(100% - var(--datagrid-row-divider-size));
  background-position: top left;
  background-repeat: no-repeat;
}

.grid-stage--canvas-chrome .grid-row--striped .grid-cell,
.grid-stage--canvas-chrome .grid-row--striped .grid-cell--index {
  background-image: linear-gradient(var(--datagrid-row-band-striped-bg), var(--datagrid-row-band-striped-bg));
  background-size: calc(100% - var(--datagrid-column-divider-size)) calc(100% - var(--datagrid-row-divider-size));
  background-position: top left;
  background-repeat: no-repeat;
}

.grid-row--clipboard-pending::after {
  content: "";
  position: absolute;
  inset: -2px;
  pointer-events: none;
  z-index: 7;
  background-image:
    repeating-linear-gradient(90deg, var(--datagrid-selection-copied-border) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(90deg, var(--datagrid-selection-copied-border) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(0deg, var(--datagrid-selection-copied-border) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(0deg, var(--datagrid-selection-copied-border) 0 6px, transparent 6px 12px);
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-size:
    calc(100% - 4px) 2px,
    calc(100% - 4px) 2px,
    2px calc(100% - 4px),
    2px calc(100% - 4px);
  background-position:
    2px 2px,
    2px calc(100% - 2px),
    2px 2px,
    calc(100% - 2px) 2px;
  box-shadow:
    0 0 0 1px var(--datagrid-selection-copied-contrast),
    0 0 0 2px var(--datagrid-selection-copied-glow);
  border-radius: 2px;
  animation: grid-clipboard-ants 0.7s linear infinite;
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

.col-head__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-head__group-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 24px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--datagrid-accent-strong) 14%, transparent);
  color: var(--datagrid-accent-strong);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.col-head__pivot-group-label {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  line-height: 1.1;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  opacity: 0.82;
}

.grid-cell--header-group[data-datagrid-pivot-group-depth="0"] .col-head__pivot-group-label {
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  opacity: 0.76;
}

.grid-cell--header-group[data-datagrid-pivot-group-depth="1"] .col-head__pivot-group-label {
  font-size: 0.72rem;
  opacity: 0.84;
}

.grid-cell--header-group[data-datagrid-pivot-group-depth="2"] .col-head__pivot-group-label,
.grid-cell--header-group[data-datagrid-pivot-group-depth="3"] .col-head__pivot-group-label {
  font-size: 0.74rem;
  text-transform: none;
  letter-spacing: 0.015em;
  opacity: 0.9;
}

.col-head--row-select,
.col-head--index {
  justify-content: center;
  padding-right: 0;
}

.col-head > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  margin-left: auto;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--datagrid-sort-indicator-color);
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}

.col-menu-trigger:hover {
  background: color-mix(in srgb, var(--datagrid-column-menu-item-hover-bg) 72%, transparent);
}

.col-menu-trigger--active {
  color: var(--datagrid-accent-strong);
}

.col-menu-trigger--filtered,
.col-menu-trigger--grouped,
.col-menu-trigger--open {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 22%, transparent);
  background: color-mix(in srgb, var(--datagrid-accent-strong) 10%, transparent);
}

.col-menu-trigger:focus,
.col-menu-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.col-menu-trigger__icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
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
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
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

.datagrid-column-menu__section--with-values {
  flex: 1 1 auto;
  min-height: 0;
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

.datagrid-column-menu__panel .ui-menu-item[aria-disabled="true"],
.datagrid-column-menu__panel .ui-submenu-trigger[aria-disabled="true"],
.datagrid-column-menu__submenu-panel .ui-menu-item[aria-disabled="true"],
.datagrid-column-menu__submenu-panel .ui-submenu-trigger[aria-disabled="true"] {
  opacity: 0.34;
  color: var(--datagrid-column-menu-muted-text);
  background: transparent;
  box-shadow: none;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(0.35) saturate(0.15);
}

.datagrid-column-menu__panel .ui-menu-item[aria-disabled="true"]:hover,
.datagrid-column-menu__panel .ui-menu-item[aria-disabled="true"]:focus,
.datagrid-column-menu__panel .ui-menu-item[aria-disabled="true"]:focus-visible,
.datagrid-column-menu__panel .ui-submenu-trigger[aria-disabled="true"]:hover,
.datagrid-column-menu__panel .ui-submenu-trigger[aria-disabled="true"]:focus,
.datagrid-column-menu__panel .ui-submenu-trigger[aria-disabled="true"]:focus-visible,
.datagrid-column-menu__submenu-panel .ui-menu-item[aria-disabled="true"]:hover,
.datagrid-column-menu__submenu-panel .ui-menu-item[aria-disabled="true"]:focus,
.datagrid-column-menu__submenu-panel .ui-menu-item[aria-disabled="true"]:focus-visible,
.datagrid-column-menu__submenu-panel .ui-submenu-trigger[aria-disabled="true"]:hover,
.datagrid-column-menu__submenu-panel .ui-submenu-trigger[aria-disabled="true"]:focus,
.datagrid-column-menu__submenu-panel .ui-submenu-trigger[aria-disabled="true"]:focus-visible {
  background: transparent;
  box-shadow: none;
}

.datagrid-column-menu__panel .ui-menu-item[aria-disabled="true"] .datagrid-column-menu__state,
.datagrid-column-menu__panel .ui-submenu-trigger[aria-disabled="true"] .datagrid-column-menu__state,
.datagrid-column-menu__submenu-panel .ui-menu-item[aria-disabled="true"] .datagrid-column-menu__state,
.datagrid-column-menu__submenu-panel .ui-submenu-trigger[aria-disabled="true"] .datagrid-column-menu__state {
  background: color-mix(in srgb, var(--datagrid-column-menu-muted-text) 10%, transparent);
  color: inherit;
}

.datagrid-column-menu__panel .ui-menu-item[aria-disabled="true"] .ui-submenu-arrow,
.datagrid-column-menu__panel .ui-submenu-trigger[aria-disabled="true"] .ui-submenu-arrow,
.datagrid-column-menu__submenu-panel .ui-menu-item[aria-disabled="true"] .ui-submenu-arrow,
.datagrid-column-menu__submenu-panel .ui-submenu-trigger[aria-disabled="true"] .ui-submenu-arrow {
  color: inherit;
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
  flex: 1 1 152px;
  min-height: 72px;
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
  min-height: 0;
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

.datagrid-context-menu {
  position: fixed;
  z-index: 80;
  min-width: 188px;
  padding: 6px;
  border: 1px solid var(--datagrid-glass-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--datagrid-surface-elevated-color) 94%, white 6%);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.datagrid-context-menu:focus,
.datagrid-context-menu:focus-visible {
  outline: none;
}

.datagrid-context-menu__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--datagrid-text-primary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.datagrid-context-menu__item:hover,
.datagrid-context-menu__item:focus,
.datagrid-context-menu__item:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--datagrid-accent-strong) 11%, transparent);
}

.datagrid-context-menu__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
}

.datagrid-context-menu__separator {
  height: 1px;
  margin: 4px 2px;
  background: color-mix(in srgb, var(--datagrid-glass-border) 88%, transparent);
}

.datagrid-advanced-filter {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(540px, calc(100vw - 16px));
  max-height: min(500px, calc(100vh - 16px));
  padding: 10px;
  border: 1px solid var(--datagrid-column-menu-border);
  border-radius: 12px;
  background: var(--datagrid-column-menu-bg);
  box-shadow: 0 18px 40px var(--datagrid-column-menu-shadow);
  color: var(--datagrid-text-primary);
  font-family: var(--datagrid-font-family);
  font-size: var(--datagrid-font-size);
  overflow-x: hidden;
  overflow-y: auto;
}

.datagrid-advanced-filter__header,
.datagrid-advanced-filter__footer,
.datagrid-advanced-filter__footer-actions,
.datagrid-advanced-filter__row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.datagrid-advanced-filter__eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-advanced-filter__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  color: var(--datagrid-text-primary);
}

.datagrid-advanced-filter__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding-right: 2px;
  min-height: 0;
}

.datagrid-advanced-filter__row {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) minmax(0, 0.92fr) minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--datagrid-column-menu-border) 72%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--datagrid-column-menu-item-hover-bg) 42%, transparent);
}

.datagrid-advanced-filter__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.datagrid-advanced-filter__field--join {
  min-width: 70px;
}

.datagrid-advanced-filter__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-advanced-filter__select,
.datagrid-advanced-filter__field input,
.datagrid-advanced-filter__primary,
.datagrid-advanced-filter__secondary,
.datagrid-advanced-filter__ghost {
  height: 30px;
  border: 1px solid var(--datagrid-column-menu-search-border);
  border-radius: 7px;
  background: var(--datagrid-column-menu-search-bg);
  color: var(--datagrid-text-primary);
  font: inherit;
}

.datagrid-advanced-filter__select,
.datagrid-advanced-filter__field input {
  width: 100%;
  min-width: 0;
  padding: 0 10px;
}

.datagrid-advanced-filter__field input::placeholder {
  color: var(--datagrid-column-menu-muted-text);
  opacity: 1;
}

.datagrid-advanced-filter__select:focus,
.datagrid-advanced-filter__field input:focus,
.datagrid-advanced-filter__select:focus-visible,
.datagrid-advanced-filter__field input:focus-visible,
.datagrid-advanced-filter__primary:focus,
.datagrid-advanced-filter__primary:focus-visible,
.datagrid-advanced-filter__secondary:focus,
.datagrid-advanced-filter__secondary:focus-visible,
.datagrid-advanced-filter__ghost:focus,
.datagrid-advanced-filter__ghost:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-advanced-filter__ghost,
.datagrid-advanced-filter__secondary,
.datagrid-advanced-filter__primary {
  padding: 0 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.datagrid-advanced-filter__ghost,
.datagrid-advanced-filter__secondary {
  background: transparent;
}

.datagrid-advanced-filter__ghost:hover,
.datagrid-advanced-filter__secondary:hover {
  background: var(--datagrid-column-menu-item-hover-bg);
}

.datagrid-advanced-filter__primary {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 48%, var(--datagrid-column-menu-search-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 18%, transparent);
}

.datagrid-advanced-filter__primary:hover {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 26%, transparent);
}

.datagrid-advanced-filter__ghost--danger {
  color: color-mix(in srgb, #ef4444 70%, var(--datagrid-text-primary));
}

.datagrid-advanced-filter__ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.datagrid-find-replace {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(440px, calc(100vw - 16px));
  max-height: min(420px, calc(100vh - 16px));
  padding: 10px;
  border: 1px solid var(--datagrid-column-menu-border);
  border-radius: 12px;
  background: var(--datagrid-column-menu-bg);
  box-shadow: 0 18px 40px var(--datagrid-column-menu-shadow);
  color: var(--datagrid-text-primary);
  font-family: var(--datagrid-font-family);
  font-size: var(--datagrid-font-size);
  overflow-x: hidden;
  overflow-y: auto;
}

.datagrid-find-replace__header,
.datagrid-find-replace__footer,
.datagrid-find-replace__footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.datagrid-find-replace__eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-find-replace__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  color: var(--datagrid-text-primary);
}

.datagrid-find-replace__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.datagrid-find-replace__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.datagrid-find-replace__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-find-replace__field input,
.datagrid-find-replace__primary,
.datagrid-find-replace__secondary,
.datagrid-find-replace__ghost {
  height: 30px;
  border: 1px solid var(--datagrid-column-menu-search-border);
  border-radius: 7px;
  background: var(--datagrid-column-menu-search-bg);
  color: var(--datagrid-text-primary);
  font: inherit;
}

.datagrid-find-replace__field input {
  width: 100%;
  min-width: 0;
  padding: 0 10px;
}

.datagrid-find-replace__field input::placeholder {
  color: var(--datagrid-column-menu-muted-text);
  opacity: 1;
}

.datagrid-find-replace__field input:focus,
.datagrid-find-replace__field input:focus-visible,
.datagrid-find-replace__primary:focus,
.datagrid-find-replace__primary:focus-visible,
.datagrid-find-replace__secondary:focus,
.datagrid-find-replace__secondary:focus-visible,
.datagrid-find-replace__ghost:focus,
.datagrid-find-replace__ghost:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-find-replace__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--datagrid-text-secondary);
}

.datagrid-find-replace__status {
  min-height: 34px;
  padding: 8px 10px;
  border: 1px dashed var(--datagrid-filter-trigger-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--datagrid-column-menu-item-hover-bg) 34%, transparent);
  color: var(--datagrid-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.datagrid-find-replace__status[data-has-message="true"] {
  border-style: solid;
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 18%, var(--datagrid-filter-trigger-border));
  color: var(--datagrid-text-primary);
}

.datagrid-find-replace__ghost,
.datagrid-find-replace__secondary,
.datagrid-find-replace__primary {
  padding: 0 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.datagrid-find-replace__ghost,
.datagrid-find-replace__secondary {
  background: transparent;
}

.datagrid-find-replace__ghost:hover,
.datagrid-find-replace__secondary:hover {
  background: var(--datagrid-column-menu-item-hover-bg);
}

.datagrid-find-replace__primary {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 48%, var(--datagrid-column-menu-search-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 18%, transparent);
}

.datagrid-find-replace__primary:hover {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 26%, transparent);
}

.datagrid-find-replace__ghost:disabled,
.datagrid-find-replace__secondary:disabled,
.datagrid-find-replace__primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .datagrid-advanced-filter {
    width: min(460px, calc(100vw - 16px));
  }

  .datagrid-advanced-filter__row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .datagrid-advanced-filter__row-actions {
    justify-content: flex-end;
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .datagrid-find-replace {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    padding: 12px;
  }

  .datagrid-find-replace__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .datagrid-find-replace__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .datagrid-find-replace__footer-actions {
    width: 100%;
  }

  .datagrid-find-replace__footer-actions > button {
    flex: 1 1 auto;
  }
}

@media (max-width: 640px) {
  .datagrid-advanced-filter {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    padding: 12px;
  }

  .datagrid-advanced-filter__row {
    grid-template-columns: minmax(0, 1fr);
  }

  .datagrid-advanced-filter__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .datagrid-advanced-filter__footer-actions {
    width: 100%;
  }

  .datagrid-advanced-filter__footer-actions > button,
  .datagrid-advanced-filter__footer > button {
    flex: 1 1 auto;
  }
}

.cell-editor-control {
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
  caret-color: var(--datagrid-selection-handle-border);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
}

.cell-editor-input {
  appearance: none;
}

.datagrid-cell-combobox {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
}

.datagrid-cell-combobox::after {
  content: "";
  position: absolute;
  top: 50%;
  right: 10px;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid color-mix(in srgb, var(--datagrid-text-muted) 88%, transparent);
  border-bottom: 1.5px solid color-mix(in srgb, var(--datagrid-text-muted) 88%, transparent);
  transform: translateY(-58%) rotate(45deg);
  pointer-events: none;
  opacity: 0.9;
}

.datagrid-cell-combobox__input {
  padding-right: 24px;
  appearance: none;
}

.grid-cell--select:not(.grid-cell--editing) {
  position: relative;
  padding-right: 24px;
}

.grid-cell--date:not(.grid-cell--editing) {
  position: relative;
  padding-right: 26px;
}

.grid-cell--select:not(.grid-cell--editing)::before {
  content: "";
  position: absolute;
  top: 50%;
  right: 10px;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid color-mix(in srgb, var(--datagrid-text-muted) 88%, transparent);
  border-bottom: 1.5px solid color-mix(in srgb, var(--datagrid-text-muted) 88%, transparent);
  transform: translateY(-58%) rotate(45deg);
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
  z-index: 5;
}

.grid-cell--select:not(.grid-cell--editing):hover::before,
.grid-cell--select.grid-cell--selection-anchor:not(.grid-cell--editing)::before,
.grid-cell--select:not(.grid-cell--editing):focus-visible::before {
  opacity: 0.85;
}

.grid-cell--date:not(.grid-cell--editing)::before {
  content: "";
  position: absolute;
  top: 50%;
  right: 8px;
  width: 12px;
  height: 12px;
  border: 1.5px solid color-mix(in srgb, var(--datagrid-text-muted) 88%, transparent);
  border-radius: 3px;
  background:
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--datagrid-text-muted) 88%, transparent) 0,
      color-mix(in srgb, var(--datagrid-text-muted) 88%, transparent) 1.5px,
      transparent 1.5px,
      transparent 4px,
      color-mix(in srgb, var(--datagrid-text-muted) 18%, transparent) 4px,
      color-mix(in srgb, var(--datagrid-text-muted) 18%, transparent) 5.5px,
      transparent 5.5px
    );
  transform: translateY(-50%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
  z-index: 5;
}

.grid-cell--date:not(.grid-cell--editing):hover::before,
.grid-cell--date.grid-cell--selection-anchor:not(.grid-cell--editing)::before,
.grid-cell--date:not(.grid-cell--editing):focus-visible::before {
  opacity: 0.85;
}

.datagrid-cell-combobox__panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px;
  border: 1px solid var(--datagrid-column-menu-border);
  border-radius: 10px;
  background: var(--datagrid-editor-bg);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--datagrid-column-menu-shadow) 55%, transparent);
  overflow: auto;
  z-index: 240;
  font-size: var(--datagrid-font-size);
  line-height: 1.2;
}

.datagrid-cell-combobox__panel--inline {
  position: absolute;
}

.datagrid-cell-combobox__panel--attached-below {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.datagrid-cell-combobox__panel--attached-above {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.datagrid-cell-combobox__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--datagrid-text-primary);
  font: inherit;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
}

.datagrid-cell-combobox__option:hover,
.datagrid-cell-combobox__option--active {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 18%, transparent);
  background: var(--datagrid-column-menu-item-hover-bg);
}

.datagrid-cell-combobox__option--selected {
  background: color-mix(in srgb, var(--datagrid-accent-strong) 12%, transparent);
}

.datagrid-cell-combobox__option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.datagrid-cell-combobox__option-state,
.datagrid-cell-combobox__empty {
  color: var(--datagrid-text-muted);
  font-size: calc(var(--datagrid-font-size) - 1px);
}

.datagrid-cell-combobox__option-state {
  flex: 0 0 auto;
  position: relative;
  width: 14px;
  height: 14px;
  color: var(--datagrid-accent-strong);
}

.datagrid-cell-combobox__option-state::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 1px;
  width: 4px;
  height: 8px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(40deg);
}

.datagrid-cell-combobox__empty {
  padding: 8px;
}

.cell-editor-select {
  appearance: none;
  padding-right: 28px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--datagrid-text-muted) 50%),
    linear-gradient(135deg, var(--datagrid-text-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 16px) calc(50% - 1px),
    calc(100% - 11px) calc(50% - 1px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  cursor: pointer;
}

.cell-editor-input--date {
  padding-right: 8px;
}

.cell-editor-control::selection {
  color: var(--datagrid-text-primary);
  background: color-mix(in srgb, var(--datagrid-selection-active-border) 28%, white);
}

.cell-editor-control::-moz-selection {
  color: var(--datagrid-text-primary);
  background: color-mix(in srgb, var(--datagrid-selection-active-border) 28%, white);
}

.grid-cell--editing {
  padding: 0;
  background: var(--datagrid-editor-bg);
  box-shadow: inset 0 0 0 1px var(--datagrid-editor-border);
}

.affino-datagrid-app-root .grid-cell--find-match-active {
  outline: 2px solid color-mix(in srgb, var(--datagrid-accent-strong) 72%, #f59e0b 28%);
  outline-offset: -2px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--datagrid-accent-strong) 32%, transparent);
}

.affino-datagrid-app-root .grid-cell--find-match-flash-a,
.affino-datagrid-app-root .grid-cell--find-match-flash-b {
  animation: datagrid-find-match-flash 640ms cubic-bezier(0.2, 0.7, 0.2, 1);
}

@keyframes datagrid-find-match-flash {
  0% {
    background: color-mix(in srgb, #f59e0b 42%, var(--datagrid-selection-range-bg));
    outline-color: color-mix(in srgb, #f59e0b 84%, var(--datagrid-accent-strong));
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, #f59e0b 60%, transparent),
      0 0 0 2px color-mix(in srgb, #f59e0b 16%, transparent);
  }
  100% {
    background: transparent;
    outline-color: color-mix(in srgb, var(--datagrid-accent-strong) 72%, #f59e0b 28%);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--datagrid-accent-strong) 32%, transparent);
  }
}

.cell-fill-handle {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 9px;
  height: 9px;
  border: 1px solid var(--datagrid-selection-handle-border);
  border-radius: 2px;
  background: var(--datagrid-selection-handle-bg);
  padding: 0;
  cursor: crosshair;
  z-index: 3;
}

.grid-fill-action {
  --datagrid-fill-action-border: var(--datagrid-column-menu-border, var(--datagrid-copy-menu-border));
  --datagrid-fill-action-bg: color-mix(
    in srgb,
    var(--datagrid-column-menu-bg, var(--datagrid-copy-menu-bg)) 92%,
    var(--datagrid-editor-bg) 8%
  );
  --datagrid-fill-action-shadow: var(--datagrid-column-menu-shadow, var(--datagrid-copy-menu-shadow));
  --datagrid-fill-action-hover-bg: color-mix(
    in srgb,
    var(--datagrid-column-menu-item-hover-bg, var(--datagrid-copy-menu-item-hover-bg)) 82%,
    var(--datagrid-fill-action-bg) 18%
  );
  --datagrid-fill-action-hover-border: var(
    --datagrid-copy-menu-item-hover-border,
    color-mix(in srgb, var(--datagrid-accent-strong) 20%, var(--datagrid-fill-action-border))
  );
  position: absolute;
  display: inline-flex;
  align-items: flex-end;
  z-index: 7;
}

.grid-fill-action--floating {
  pointer-events: auto;
}

.grid-fill-action__trigger,
.grid-fill-action__item {
  border: 1px solid var(--datagrid-fill-action-border);
  background: var(--datagrid-fill-action-bg);
  color: var(--datagrid-text-primary);
  font: inherit;
}

.grid-fill-action__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  min-width: 14px;
  height: 14px;
  padding: 0;
  border-radius: 999px;
  box-shadow: 0 6px 16px var(--datagrid-fill-action-shadow);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.grid-fill-action__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px);
  display: flex;
  flex-direction: column;
  min-width: 88px;
  padding: 4px;
  border: 1px solid var(--datagrid-fill-action-border);
  border-radius: 10px;
  background: var(--datagrid-fill-action-bg);
  box-shadow: 0 14px 28px var(--datagrid-fill-action-shadow);
  backdrop-filter: blur(12px);
}

.grid-fill-action__item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}

.grid-fill-action__item:hover,
.grid-fill-action__item--active {
  border-color: var(--datagrid-fill-action-hover-border);
  background: var(--datagrid-fill-action-hover-bg);
}

.grid-fill-action__trigger:focus,
.grid-fill-action__trigger:focus-visible,
.grid-fill-action__item:focus,
.grid-fill-action__item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
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

@media (max-width: 960px) {
  .datagrid-app-workspace {
    flex-direction: column;
  }

  .datagrid-app-inspector-shell {
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
    max-width: none;
    min-height: 320px;
  }
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
