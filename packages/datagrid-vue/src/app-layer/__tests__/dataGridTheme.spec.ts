import { afterEach, describe, expect, it } from "vitest"
import { resolveDataGridThemeStyleVars, resolveDataGridThemeTokens } from "../theme/dataGridTheme"

afterEach(() => {
  delete document.documentElement.dataset.theme
  document.documentElement.classList.remove("dark")
})

describe("DataGrid theme overrides", () => {
  it("applies explicit config tokens over inherited preset variants", () => {
    const color = "#c2410c"

    for (const variant of ["light", "dark"] as const) {
      expect(resolveDataGridThemeTokens({
        inheritThemeFromDocument: false,
        activeTokenVariant: variant,
        tokens: { gridBackgroundColor: color },
      }).gridBackgroundColor).toBe(color)
    }
  })

  it("keeps explicit variant values above base token overrides", () => {
    const tokens = resolveDataGridThemeTokens({
      inheritThemeFromDocument: false,
      activeTokenVariant: "dark",
      tokens: { gridBackgroundColor: "#c2410c" },
      tokenVariants: { dark: { gridBackgroundColor: "#7c2d12" } },
    })

    expect(tokens.gridBackgroundColor).toBe("#7c2d12")
  })

  it("continues to apply flat token overrides after document theme resolution", () => {
    document.documentElement.dataset.theme = "dark"

    expect(resolveDataGridThemeTokens({ gridBackgroundColor: "#c2410c" }).gridBackgroundColor)
      .toBe("#c2410c")
  })

  it("maps light and dark selected-row overrides to the public CSS token", () => {
    const theme = {
      inheritThemeFromDocument: false,
      tokenVariants: {
        light: { bodyRowSelectedBackgroundColor: "var(--color-surface-selection-light)" },
        dark: { bodyRowSelectedBackgroundColor: "var(--color-surface-selection-dark)" },
      },
      activeTokenVariant: "light" as const,
    }

    expect(resolveDataGridThemeStyleVars(theme)["--datagrid-row-selected-background-color"])
      .toBe("var(--color-surface-selection-light)")
    expect(resolveDataGridThemeStyleVars({ ...theme, activeTokenVariant: "dark" })["--datagrid-row-selected-background-color"])
      .toBe("var(--color-surface-selection-dark)")
    expect(resolveDataGridThemeTokens({ ...theme, activeTokenVariant: "dark" }).bodyRowSelectedBackgroundColor)
      .toBe("var(--color-surface-selection-dark)")
  })
})
