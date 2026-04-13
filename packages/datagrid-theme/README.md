# @affino/datagrid-theme

Theme tokens, presets, and utilities for Affino DataGrid.

## What belongs here

- `DataGridThemeTokens`
- preset style configs such as `defaultStyleConfig`, `industrialNeutralTheme`, and `sugarTheme`
- token helpers such as `applyGridTheme`, `resolveGridThemeTokens`, and `mergeThemeTokens`

## What does not belong here

- grid runtime logic
- renderer-specific DOM or canvas layout code
- sandbox-only legacy table CSS

## Styling direction

The preferred styling path is token-driven theming through `DataGridStyleConfig.tokens` and `tokenVariants`.

Treat the exported default tokens as the current Affino baseline, not as a frozen visual contract. If your product needs an exact long-lived look, pin an explicit preset (`defaultStyleConfig`, `industrialNeutralTheme`, `sugarTheme`) or provide your own token map instead of inheriting the moving defaults.

The class-based sections on `DataGridStyleConfig` (`grid`, `header`, `body`, `group`, `summary`, `state`) are retained for compatibility with older adapters, but they are no longer the primary styling model.

## CSS assets

- `datagrid-demo.css` is a demo-only stylesheet asset kept for legacy/demo use.
- Modern Vue app rendering should rely on token application plus renderer-owned styles instead of this demo stylesheet.
