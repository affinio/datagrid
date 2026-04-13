import {
  defaultStyleConfig,
  industrialNeutralTheme,
  resolveGridThemeTokens,
  sugarTheme,
  type DataGridStyleConfig,
  type DataGridThemeTokens,
} from "@affino/datagrid-theme"
import type { DataGridThemeProp } from "@affino/datagrid-vue-app"

const SPREADSHEET_WORKBOOK_THEME_PRESETS: Record<
  NonNullable<Extract<DataGridThemeProp, string>>,
  DataGridStyleConfig
> = {
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

function resolveSpreadsheetWorkbookThemeStyleConfig(theme: DataGridThemeProp | null | undefined): DataGridStyleConfig {
  if (theme == null) {
    return industrialNeutralTheme
  }
  if (typeof theme === "string") {
    if (theme === "sugar") {
      return mergeStyleConfigs(defaultStyleConfig, sugarTheme)
    }
    return SPREADSHEET_WORKBOOK_THEME_PRESETS[theme] ?? defaultStyleConfig
  }
  if (isStyleConfig(theme)) {
    return mergeStyleConfigs(defaultStyleConfig, theme)
  }
  return mergeStyleConfigs(defaultStyleConfig, {
    tokens: theme,
  })
}

export function resolveSpreadsheetWorkbookThemeTokens(
  theme: DataGridThemeProp | null | undefined,
): DataGridThemeTokens {
  return resolveGridThemeTokens(resolveSpreadsheetWorkbookThemeStyleConfig(theme), {
    document: typeof document === "undefined" ? undefined : document,
  })
}
