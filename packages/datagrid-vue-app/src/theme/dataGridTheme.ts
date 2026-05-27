import {
  applyGridTheme,
  defaultStyleConfig,
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

function mergeTokenVariants(
  base: DataGridStyleConfig["tokenVariants"],
  override: DataGridStyleConfig["tokenVariants"],
): DataGridStyleConfig["tokenVariants"] {
  if (!base && !override) {
    return undefined
  }
  const merged: NonNullable<DataGridStyleConfig["tokenVariants"]> = {
    ...(base ?? {}),
  }
  for (const [variantKey, tokens] of Object.entries(override ?? {})) {
    merged[variantKey] = {
      ...(merged[variantKey] ?? {}),
      ...tokens,
    }
  }
  return merged
}

function mergeStyleConfigs(base: DataGridStyleConfig, override: DataGridStyleConfig): DataGridStyleConfig {
  return {
    ...base,
    ...override,
    tokens: { ...(base.tokens ?? {}), ...(override.tokens ?? {}) },
    tokenVariants: mergeTokenVariants(base.tokenVariants, override.tokenVariants),
  }
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
  )
}

function resolveThemeStyleConfig(theme: DataGridThemeProp): DataGridStyleConfig | null {
  if (theme == null) {
    return defaultStyleConfig
  }
  if (typeof theme === "string") {
    if (theme === "sugar") {
      return mergeStyleConfigs(defaultStyleConfig, sugarTheme)
    }
    return DATA_GRID_THEME_PRESETS[theme] ?? defaultStyleConfig
  }
  if (isStyleConfig(theme)) {
    return mergeStyleConfigs(defaultStyleConfig, theme)
  }
  return defaultStyleConfig
}

function isThemeTokenOverride(theme: DataGridThemeProp): theme is Partial<DataGridThemeTokens> {
  return theme != null && typeof theme === "object" && !isStyleConfig(theme)
}

function mergeDefinedThemeTokenOverrides(
  tokens: DataGridThemeTokens,
  override: Partial<DataGridThemeTokens>,
): DataGridThemeTokens {
  const merged: DataGridThemeTokens = { ...tokens }
  for (const [key, value] of Object.entries(override)) {
    if (value != null) {
      merged[key as keyof DataGridThemeTokens] = value
    }
  }
  return merged
}

export function resolveDataGridThemeTokens(theme: DataGridThemeProp): DataGridThemeTokens {
  const styleConfig = resolveThemeStyleConfig(theme)
  const tokens = resolveGridThemeTokens(styleConfig ?? defaultStyleConfig, {
    document: typeof document === "undefined" ? undefined : document,
  })
  return isThemeTokenOverride(theme) ? mergeDefinedThemeTokenOverrides(tokens, theme) : tokens
}

export function applyDataGridTheme(rootElement: HTMLElement, theme: DataGridThemeProp): DataGridThemeTokens {
  const tokens = resolveDataGridThemeTokens(theme)
  applyGridTheme(rootElement, tokens)
  return tokens
}

export function clearDataGridTheme(rootElement: HTMLElement): void {
  applyDataGridTheme(rootElement, "default")
}
