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
  --datagrid-selection-copied-contrast: color-mix(in srgb, var(--datagrid-background-color) 84%, var(--datagrid-text-color));
  --datagrid-selection-copied-glow: color-mix(in srgb, var(--datagrid-selection-copied-border) 38%, transparent);
}

.datagrid-app-layout {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.datagrid-app-workspace {
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}

.datagrid-app-stage {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
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

.datagrid-app-toolbar__button:focus,
.datagrid-app-toolbar__button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-app-toolbar__button--active {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 46%, var(--datagrid-filter-trigger-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 14%, var(--datagrid-editor-bg));
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
  flex: 1 1 auto;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--datagrid-background-color);
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
  border-right: var(--datagrid-column-divider-size) solid var(--datagrid-column-divider-color);
}

.grid-header-pane--right,
.grid-body-pane--right {
  border-left: var(--datagrid-column-divider-size) solid var(--datagrid-column-divider-color);
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
  position: relative;
  overflow-x: hidden;
  overflow-y: hidden;
  border-bottom: var(--datagrid-header-divider-size) solid var(--datagrid-header-divider-color);
  background: var(--datagrid-header-row-bg);
  overscroll-behavior-x: contain;
}

.grid-body-viewport {
  overflow: auto;
  position: relative;
  min-width: 0;
  min-height: 0;
  background: var(--datagrid-viewport-bg);
  overscroll-behavior-x: contain;
}

.grid-body-viewport--pinned-bottom {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
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
  --selection-edge-top: var(--datagrid-selection-stroke-width) solid var(--datagrid-selection-handle-border);
}

.grid-cell--selection-edge-right {
  --selection-edge-right: var(--datagrid-selection-stroke-width) solid var(--datagrid-selection-handle-border);
}

.grid-cell--selection-edge-bottom {
  --selection-edge-bottom: var(--datagrid-selection-stroke-width) solid var(--datagrid-selection-handle-border);
}

.grid-cell--selection-edge-left {
  --selection-edge-left: var(--datagrid-selection-stroke-width) solid var(--datagrid-selection-handle-border);
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

.grid-cell--pinned-left,
.grid-cell--pinned-right {
  background: var(--datagrid-pinned-bg);
}

.grid-cell--pinned-left {
  background: var(--datagrid-pinned-left-bg);
  box-shadow: var(--datagrid-pinned-left-shadow);
}

.grid-cell--index + .grid-cell--pinned-left,
.grid-cell--index + .grid-cell--row-selection + .grid-cell--pinned-left {
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
  background: var(--datagrid-selection-range-bg);
  box-shadow: inset 0 0 0 1px var(--datagrid-selection-border-color);
}

.grid-row .grid-cell--index {
  background: var(--datagrid-index-cell-background-color);
}

.grid-row.row--group .grid-cell {
  font-weight: 600;
  cursor: pointer;
  color: var(--datagrid-group-row-text-color);
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
  right: 12px;
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--datagrid-text-muted);
  border-bottom: 2px solid var(--datagrid-text-muted);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
  opacity: 0.8;
}

.datagrid-cell-combobox__input {
  padding-right: 32px;
  appearance: none;
}

.grid-cell--select:not(.grid-cell--editing) {
  position: relative;
  padding-right: 28px;
}

.grid-cell--select:not(.grid-cell--editing)::after {
  content: "";
  position: absolute;
  top: 50%;
  right: 12px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--datagrid-text-muted);
  border-bottom: 2px solid var(--datagrid-text-muted);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
}

.grid-cell--select:not(.grid-cell--editing):hover::after,
.grid-cell--select.grid-cell--selection-anchor:not(.grid-cell--editing)::after,
.grid-cell--select:not(.grid-cell--editing):focus-visible::after {
  opacity: 0.85;
}

.datagrid-cell-combobox__panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--datagrid-column-menu-border);
  border-radius: 12px;
  background: var(--datagrid-column-menu-bg);
  box-shadow: 0 18px 40px var(--datagrid-column-menu-shadow);
  overflow: auto;
  z-index: 240;
}

.datagrid-cell-combobox__panel--inline {
  position: absolute;
}

.datagrid-cell-combobox__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  width: 100%;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--datagrid-text-primary);
  font: inherit;
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
  font-size: 12px;
}

.datagrid-cell-combobox__empty {
  padding: 8px 10px;
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
