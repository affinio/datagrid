import {
  applyGridTheme,
  defaultStyleConfig,
  defaultThemeTokens,
  industrialNeutralTheme,
  resolveGridThemeTokens,
  sugarTheme,
  type DataGridStyleConfig,
  type DataGridThemeTokens,
} from "@affino/datagrid-theme"

export type DataGridThemePreset = "default" | "industrial-neutral" | "industrialNeutral" | "sugar"

export type DataGridThemeProp =
  | DataGridThemePreset
  | DataGridStyleConfig
  | Partial<DataGridThemeTokens>
  | null
  | undefined

const DATA_GRID_THEME_PRESETS: Record<DataGridThemePreset, DataGridStyleConfig> = {
  default: defaultStyleConfig,
  "industrial-neutral": industrialNeutralTheme,
  industrialNeutral: industrialNeutralTheme,
  sugar: sugarTheme,
}

function isStyleConfig(input: unknown): input is DataGridStyleConfig {
  if (!input || typeof input !== "object") {
    return false
  }
  return (
    "tokens" in input
    || "tokenVariants" in input
    || "activeTokenVariant" in input
    || "defaultTokenVariant" in input
    || "inheritThemeFromDocument" in input
    || "documentDarkClass" in input
    || "grid" in input
    || "header" in input
    || "body" in input
    || "group" in input
    || "summary" in input
    || "state" in input
  )
}

function resolveThemeStyleConfig(theme: DataGridThemeProp): DataGridStyleConfig | null {
  if (theme == null) {
    return defaultStyleConfig
  }
  if (typeof theme === "string") {
    return DATA_GRID_THEME_PRESETS[theme] ?? defaultStyleConfig
  }
  if (isStyleConfig(theme)) {
    return theme
  }
  return {
    tokens: theme,
  }
}

export function resolveDataGridThemeTokens(theme: DataGridThemeProp): DataGridThemeTokens {
  const styleConfig = resolveThemeStyleConfig(theme)
  return resolveGridThemeTokens(styleConfig)
}

export function applyDataGridTheme(rootElement: HTMLElement, theme: DataGridThemeProp): DataGridThemeTokens {
  const tokens = resolveDataGridThemeTokens(theme)
  applyGridTheme(rootElement, tokens)
  return tokens
}

export function clearDataGridTheme(rootElement: HTMLElement): void {
  applyGridTheme(rootElement, defaultThemeTokens)
}
