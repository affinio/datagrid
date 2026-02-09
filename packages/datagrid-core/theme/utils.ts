// src/datagrid/theme/utils.ts

import { defaultThemeTokens } from "./defaultThemeTokens"
import { THEME_TOKEN_VARIABLE_MAP } from "./tokens"
import type { DataGridStyleConfig, DataGridThemeTokens } from "./types"

/** Apply CSS custom properties for the given theme to a DOM element */
export function applyGridTheme(el: HTMLElement, tokens: DataGridThemeTokens) {
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

function resolveDocumentVariant(styleConfig: DataGridStyleConfig, doc?: Document): string | undefined {
  if (!doc) return undefined
  const datasetTheme = doc.documentElement?.dataset?.theme
  if (datasetTheme && styleConfig.tokenVariants?.[datasetTheme]) {
    return datasetTheme
  }
  const darkClass = styleConfig.documentDarkClass ?? "dark"
  if (doc.documentElement?.classList?.contains(darkClass) && styleConfig.tokenVariants?.dark) {
    return "dark"
  }
  return undefined
}

export function resolveGridThemeTokens(
  styleConfig?: DataGridStyleConfig | null,
  options?: { document?: Document },
): DataGridThemeTokens {
  if (!styleConfig) {
    return defaultThemeTokens
  }
  const documentVariant = styleConfig.inheritThemeFromDocument
    ? resolveDocumentVariant(styleConfig, options?.document ?? (typeof document === "undefined" ? undefined : document))
    : undefined
  const activeVariant = styleConfig.activeTokenVariant ?? documentVariant ?? styleConfig.defaultTokenVariant
  const variantTokens = activeVariant ? styleConfig.tokenVariants?.[activeVariant] : undefined
  return mergeThemeTokens(
    mergeThemeTokens(defaultThemeTokens, styleConfig.tokens),
    variantTokens,
  )
}
