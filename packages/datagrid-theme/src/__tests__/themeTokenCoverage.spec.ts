import { describe, expect, it } from "vitest"
import { defaultThemeTokens } from "../defaultThemeTokens"
import { industrialNeutralTheme } from "../industrialNeutralTheme"
import { sugarTheme } from "../sugarTheme"
import { THEME_TOKEN_VARIABLE_MAP } from "../tokens"
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
    expectCompletePresetVariants("industrialNeutralTheme", industrialNeutralTheme)
    expectCompletePresetVariants("sugarTheme", sugarTheme)
  })
})
