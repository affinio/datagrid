import { defaultDarkThemeTokens, defaultThemeTokens } from "./defaultThemeTokens"
import type { DataGridStyleConfig } from "./types"

export const defaultStyleConfig: DataGridStyleConfig = {
  inheritThemeFromDocument: true,
  defaultTokenVariant: "light",
  tokens: defaultThemeTokens,
  tokenVariants: {
    light: defaultThemeTokens,
    dark: defaultDarkThemeTokens,
  },
}
