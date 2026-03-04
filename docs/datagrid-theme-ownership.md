# DataGrid Theme Ownership

Updated: `2026-02-09`

## Scope

Theme presets, tokens, and utilities live in `@affino/datagrid-theme`. The headless runtime in `@affino/datagrid-core` stays style-free and only references theme types when exposed in public config shapes.

## Boundary

- `@affino/datagrid-theme`
  - Tokens + CSS variable map.
  - Theme utilities (`applyGridTheme`, `resolveGridThemeTokens`, `mergeThemeTokens`).
  - Presets (e.g. `industrialNeutralTheme`).
  - Demo stylesheet `datagrid-demo.css`.
- `@affino/datagrid-core`
  - Runtime/state/viewport/data model logic.
  - No theme presets or CSS ownership.
  - Types may reference `DataGridStyleConfig` from `@affino/datagrid-theme`.

## Usage

- Runtime + adapters import theme helpers from `@affino/datagrid-theme`.
- Plugin contracts are owned by `@affino/datagrid-plugins`.

## Rationale

Separating theme ownership keeps the core runtime headless, reduces style coupling, and allows presets to evolve without impacting runtime boundaries.
