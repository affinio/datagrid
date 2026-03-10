const DATA_GRID_OVERLAY_THEME_VAR_NAMES = [
  "--datagrid-font-family",
  "--datagrid-font-size",
  "--datagrid-text-primary",
  "--datagrid-text-muted",
  "--datagrid-text-soft",
  "--datagrid-accent-strong",
  "--datagrid-glass-border",
  "--datagrid-background-color",
  "--datagrid-editor-bg",
  "--datagrid-filter-trigger-border",
  "--datagrid-column-menu-bg",
  "--datagrid-column-menu-border",
  "--datagrid-column-menu-shadow",
  "--datagrid-column-menu-item-hover-bg",
  "--datagrid-column-menu-muted-text",
  "--datagrid-column-menu-focus-ring",
  "--datagrid-column-menu-search-border",
  "--datagrid-column-menu-search-bg",
  "--datagrid-sort-indicator-color",
] as const

export function readDataGridOverlayThemeVars(rootElement: HTMLElement | null): Record<string, string> {
  if (!rootElement || typeof window === "undefined") {
    return {}
  }
  const computedStyle = window.getComputedStyle(rootElement)
  const vars: Record<string, string> = {}
  for (const name of DATA_GRID_OVERLAY_THEME_VAR_NAMES) {
    vars[name] = computedStyle.getPropertyValue(name).trim()
  }
  return vars
}
