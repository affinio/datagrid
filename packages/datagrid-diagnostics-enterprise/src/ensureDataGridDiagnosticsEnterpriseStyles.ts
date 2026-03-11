const DATA_GRID_DIAGNOSTICS_ENTERPRISE_STYLE_ID = "affino-datagrid-diagnostics-enterprise-styles"

const DATA_GRID_DIAGNOSTICS_ENTERPRISE_STYLES = `
.datagrid-diagnostics-inspector {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 14px;
  border: 1px solid var(--datagrid-column-menu-border);
  border-radius: 14px;
  background: var(--datagrid-column-menu-bg);
  box-shadow: 0 18px 40px var(--datagrid-column-menu-shadow);
  color: var(--datagrid-text-primary);
  font-family: var(--datagrid-font-family);
  font-size: var(--datagrid-font-size);
  overflow: hidden;
}

.datagrid-diagnostics-inspector__header,
.datagrid-diagnostics-inspector__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.datagrid-diagnostics-inspector__tabs {
  display: flex;
  gap: 8px;
  overflow: auto;
  min-width: 0;
  padding-bottom: 2px;
  position: sticky;
  top: 0;
  z-index: 3;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--datagrid-column-menu-bg) 99%, transparent) 0%,
      color-mix(in srgb, var(--datagrid-column-menu-bg) 94%, transparent) 82%,
      transparent 100%
    );
  backdrop-filter: blur(8px);
}

.datagrid-diagnostics-inspector__tab {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--datagrid-column-menu-search-border);
  border-radius: 999px;
  background: transparent;
  color: var(--datagrid-column-menu-muted-text);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.datagrid-diagnostics-inspector__tab:hover {
  background: var(--datagrid-column-menu-item-hover-bg);
  color: var(--datagrid-text-primary);
}

.datagrid-diagnostics-inspector__tab:focus,
.datagrid-diagnostics-inspector__tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-diagnostics-inspector__tab--active {
  border-color: color-mix(in srgb, var(--datagrid-accent-strong) 48%, var(--datagrid-column-menu-search-border));
  background: color-mix(in srgb, var(--datagrid-accent-strong) 16%, transparent);
  color: var(--datagrid-text-primary);
}

.datagrid-diagnostics-inspector__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.datagrid-diagnostics-inspector__status {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 0 6px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--datagrid-column-menu-bg) 98%, transparent) 0%,
      color-mix(in srgb, var(--datagrid-column-menu-bg) 92%, transparent) 78%,
      transparent 100%
    );
  backdrop-filter: blur(8px);
}

.datagrid-diagnostics-inspector__status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--datagrid-column-menu-border) 72%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--datagrid-editor-bg) 92%, transparent);
}

.datagrid-diagnostics-inspector__status-label,
.datagrid-diagnostics-inspector__status-value {
  font-size: 11px;
}

.datagrid-diagnostics-inspector__status-label {
  color: var(--datagrid-column-menu-muted-text);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.datagrid-diagnostics-inspector__status-value {
  color: var(--datagrid-text-primary);
}

.datagrid-diagnostics-inspector__eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-diagnostics-inspector__title {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
  color: var(--datagrid-text-primary);
}

.datagrid-diagnostics-inspector__ghost,
.datagrid-diagnostics-inspector__secondary {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--datagrid-column-menu-search-border);
  border-radius: 8px;
  background: transparent;
  color: var(--datagrid-text-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.datagrid-diagnostics-inspector__ghost:hover,
.datagrid-diagnostics-inspector__secondary:hover {
  background: var(--datagrid-column-menu-item-hover-bg);
}

.datagrid-diagnostics-inspector__ghost:focus,
.datagrid-diagnostics-inspector__ghost:focus-visible,
.datagrid-diagnostics-inspector__secondary:focus,
.datagrid-diagnostics-inspector__secondary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--datagrid-column-menu-focus-ring);
}

.datagrid-diagnostics-inspector__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--datagrid-column-menu-border) 68%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--datagrid-column-menu-search-bg) 92%, transparent);
}

.datagrid-diagnostics-inspector__section--raw {
  flex: 1 1 auto;
  min-height: 220px;
  overflow: hidden;
}

.datagrid-diagnostics-inspector__section-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-diagnostics-inspector__summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
  gap: 8px 12px;
  margin: 0;
}

.datagrid-diagnostics-inspector__summary-label,
.datagrid-diagnostics-inspector__summary-value {
  margin: 0;
}

.datagrid-diagnostics-inspector__summary-label {
  color: var(--datagrid-column-menu-muted-text);
  font-size: 12px;
  font-weight: 600;
}

.datagrid-diagnostics-inspector__summary-value {
  color: var(--datagrid-text-primary);
  font-size: 12px;
  font-weight: 600;
  word-break: break-word;
}

.datagrid-diagnostics-inspector__trace-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.datagrid-diagnostics-inspector__trace-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--datagrid-column-menu-border) 64%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--datagrid-editor-bg) 90%, transparent);
}

.datagrid-diagnostics-inspector__trace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.datagrid-diagnostics-inspector__trace-source,
.datagrid-diagnostics-inspector__trace-time,
.datagrid-diagnostics-inspector__trace-meta {
  font-size: 12px;
}

.datagrid-diagnostics-inspector__trace-source {
  color: var(--datagrid-text-primary);
}

.datagrid-diagnostics-inspector__trace-time,
.datagrid-diagnostics-inspector__trace-meta {
  color: var(--datagrid-column-menu-muted-text);
}

.datagrid-diagnostics-inspector__snapshot {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--datagrid-column-menu-border) 72%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--datagrid-editor-bg) 92%, transparent);
  color: var(--datagrid-text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.45;
  overflow: auto;
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
}
`

export function ensureDataGridDiagnosticsEnterpriseStyles(): void {
  if (typeof document === "undefined") {
    return
  }
  if (document.getElementById(DATA_GRID_DIAGNOSTICS_ENTERPRISE_STYLE_ID)) {
    return
  }
  const style = document.createElement("style")
  style.id = DATA_GRID_DIAGNOSTICS_ENTERPRISE_STYLE_ID
  style.textContent = DATA_GRID_DIAGNOSTICS_ENTERPRISE_STYLES
  document.head.append(style)
}
