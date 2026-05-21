import { describe, expect, it } from "vitest"
import { defaultDarkThemeTokens, defaultThemeTokens } from "../defaultThemeTokens"
import { defaultStyleConfig } from "../defaultStyleConfig"
import { industrialNeutralTheme } from "../industrialNeutralTheme"
import { sugarTheme } from "../sugarTheme"
import { THEME_TOKEN_VARIABLE_MAP } from "../tokens"
import { resolveGridThemeTokens } from "../utils"
import type { DataGridStyleConfig, DataGridThemeTokens } from "../types"

const tokenKeys = Object.keys(THEME_TOKEN_VARIABLE_MAP) as Array<keyof DataGridThemeTokens>

function expectCompleteTokenSet(label: string, tokens: Partial<DataGridThemeTokens> | undefined): void {
  const missing = tokenKeys.filter(key => tokens?.[key] == null)
  expect(missing, `${label} missing theme tokens`).toEqual([])
}

function expectCompletePresetVariants(label: string, preset: DataGridStyleConfig): void {
  for (const [variant, tokens] of Object.entries(preset.tokenVariants ?? {})) {
    expectCompleteTokenSet(`${label}.${variant}`, tokens)
  }
}

describe("theme token coverage", () => {
  it("defines every mapped token in default and preset variants", () => {
    expectCompleteTokenSet("defaultThemeTokens", defaultThemeTokens)
    expectCompleteTokenSet("defaultDarkThemeTokens", defaultDarkThemeTokens)
    expectCompletePresetVariants("defaultStyleConfig", defaultStyleConfig)
    expectCompletePresetVariants("industrialNeutralTheme", industrialNeutralTheme)
    expectCompletePresetVariants("sugarTheme", sugarTheme)
  })

  it("keeps the three presets visually distinct and dark-mode capable", () => {
    const presets = [defaultStyleConfig, industrialNeutralTheme, sugarTheme]

    for (const preset of presets) {
      expect(preset.inheritThemeFromDocument).toBe(true)
      expect(preset.tokenVariants?.light).toBeDefined()
      expect(preset.tokenVariants?.dark).toBeDefined()
      expect(resolveGridThemeTokens({ ...preset, activeTokenVariant: "dark" }).gridBackgroundColor)
        .not.toBe(resolveGridThemeTokens({ ...preset, activeTokenVariant: "light" }).gridBackgroundColor)
    }

    const lightFonts = presets.map(preset => resolveGridThemeTokens(preset).gridFontFamily)
    expect(new Set(lightFonts).size).toBe(3)
    expect(resolveGridThemeTokens(defaultStyleConfig).gridAccentStrong)
      .not.toBe(resolveGridThemeTokens(industrialNeutralTheme).gridAccentStrong)
    expect(resolveGridThemeTokens(sugarTheme).gridAccentStrong)
      .not.toBe(resolveGridThemeTokens(industrialNeutralTheme).gridAccentStrong)
  })

  it("resolves document dark mode for presets without forcing active variants", () => {
    document.documentElement.dataset.theme = "dark"
    try {
      expect(resolveGridThemeTokens(defaultStyleConfig, { document }).gridBackgroundColor)
        .toBe(defaultDarkThemeTokens.gridBackgroundColor)
      expect(resolveGridThemeTokens(industrialNeutralTheme, { document }).gridBackgroundColor)
        .toBe(industrialNeutralTheme.tokenVariants?.dark?.gridBackgroundColor)
      expect(resolveGridThemeTokens(sugarTheme, { document }).gridBackgroundColor)
        .toBe(sugarTheme.tokenVariants?.dark?.gridBackgroundColor)
    } finally {
      delete document.documentElement.dataset.theme
    }
  })
})
