// src/datagrid/theme/utils.ts

import { THEME_TOKEN_VARIABLE_MAP } from "./tokens"
import type { DataGridThemeTokens } from "./types"

/** Apply CSS custom properties for the given theme to a DOM element */
export function applyTableTheme(el: HTMLElement, tokens: DataGridThemeTokens) {
  for (const [key, cssVar] of Object.entries(THEME_TOKEN_VARIABLE_MAP)) {
    const value = tokens[key as keyof DataGridThemeTokens]
    if (value != null) el.style.setProperty(cssVar, value)
  }
}

/** Merge two token sets (useful for partial overrides) */
export function mergeThemeTokens(
  base: DataGridThemeTokens,
  override?: Partial<DataGridThemeTokens>
): DataGridThemeTokens {
  return { ...base, ...override }
}
