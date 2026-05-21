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

The built-in presets are intentionally distinct and each ships `light` and `dark` token variants:

- `defaultStyleConfig`: strict neutral baseline with white/gray surfaces, Arial-style typography, and a small blue interaction accent.
- `industrialNeutralTheme`: compact engineering preset with monospace typography, stronger grid lines, steel surfaces, and cyan operational accents.
- `sugarTheme`: warmer expressive preset with soft rose surfaces and a pink/violet accent system.

All presets set `inheritThemeFromDocument: true`; `resolveGridThemeTokens()` will select the `dark` variant when `document.documentElement` has `data-theme="dark"` or the configured dark class. Provide `activeTokenVariant` only when you need to force a specific variant.

`DataGridStyleConfig` is token-only. Class-slot styling hooks were removed; renderer-owned class names remain internal implementation details.

## CSS assets

- `datagrid-demo.css` is a demo-only stylesheet asset kept for legacy/demo use.
- Modern Vue app rendering should rely on token application plus renderer-owned styles instead of this demo stylesheet.
