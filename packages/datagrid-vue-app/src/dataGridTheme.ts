import {
  applyGridTheme,
  defaultStyleConfig,
  industrialNeutralTheme,
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
    grid: { ...(base.grid ?? {}), ...(override.grid ?? {}) },
    header: { ...(base.header ?? {}), ...(override.header ?? {}) },
    body: { ...(base.body ?? {}), ...(override.body ?? {}) },
    group: { ...(base.group ?? {}), ...(override.group ?? {}) },
    summary: { ...(base.summary ?? {}), ...(override.summary ?? {}) },
    state: { ...(base.state ?? {}), ...(override.state ?? {}) },
    tokens: { ...(base.tokens ?? {}), ...(override.tokens ?? {}) },
    tokenVariants: mergeTokenVariants(base.tokenVariants, override.tokenVariants),
  }
}

function resolveDocumentVariant(styleConfig: DataGridStyleConfig, doc?: Document): string | undefined {
  if (!doc) {
    return undefined
  }
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
    if (theme === "sugar") {
      return mergeStyleConfigs(industrialNeutralTheme, sugarTheme)
    }
    return DATA_GRID_THEME_PRESETS[theme] ?? defaultStyleConfig
  }
  if (isStyleConfig(theme)) {
    return mergeStyleConfigs(industrialNeutralTheme, theme)
  }
  return mergeStyleConfigs(industrialNeutralTheme, {
    tokens: theme,
  })
}

export function resolveDataGridThemeTokens(theme: DataGridThemeProp): DataGridThemeTokens {
  const styleConfig = resolveThemeStyleConfig(theme)
  const activeVariant = styleConfig?.inheritThemeFromDocument
    ? resolveDocumentVariant(styleConfig, typeof document === "undefined" ? undefined : document)
    : undefined
  const resolvedVariant = activeVariant ?? styleConfig?.activeTokenVariant ?? styleConfig?.defaultTokenVariant
  const variantTokens = resolvedVariant ? styleConfig?.tokenVariants?.[resolvedVariant] : undefined
  const mergedStyleConfig = mergeStyleConfigs(
    industrialNeutralTheme,
    styleConfig ?? defaultStyleConfig,
  )
  return {
    ...((mergedStyleConfig.tokens ?? {}) as Partial<DataGridThemeTokens>),
    ...((resolvedVariant ? mergedStyleConfig.tokenVariants?.[resolvedVariant] : undefined) ?? {}),
  } as DataGridThemeTokens
}

export function applyDataGridTheme(rootElement: HTMLElement, theme: DataGridThemeProp): DataGridThemeTokens {
  const tokens = resolveDataGridThemeTokens(theme)
  applyGridTheme(rootElement, tokens)
  return tokens
}

export function clearDataGridTheme(rootElement: HTMLElement): void {
  applyDataGridTheme(rootElement, "default")
}
