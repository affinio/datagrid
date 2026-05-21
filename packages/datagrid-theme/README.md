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

The exported default tokens are intentionally plain: white and neutral gray surfaces, subtle borders, Arial-style system typography, and a small blue accent only for active/focus/selection states. Use `industrialNeutralTheme` or `sugarTheme` when you need a more opinionated look, or provide your own token map for product branding.

`DataGridStyleConfig` is token-only. Class-slot styling hooks were removed; renderer-owned class names remain internal implementation details.

## CSS assets

- `datagrid-demo.css` is a demo-only stylesheet asset kept for legacy/demo use.
- Modern Vue app rendering should rely on token application plus renderer-owned styles instead of this demo stylesheet.
