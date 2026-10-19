import { describe, expect, it } from "vitest"
import { resolveSpreadsheetWorkbookDependencies } from "../workbookDependencyResolver"

describe("resolveSpreadsheetWorkbookDependencies", () => {
  it("merges view, table, and direct-reference dependencies while removing self and unknown ids", () => {
    const sheets = [
      { id: "orders", viewDefinition: null, formulaUsesAllTables: false, formulaTableDependencyAliases: [], formulaReferenceDependencyAliases: [] },
      { id: "customers", viewDefinition: null, formulaUsesAllTables: false, formulaTableDependencyAliases: [], formulaReferenceDependencyAliases: [] },
      {
        id: "report",
        viewDefinition: { source: "orders" },
        formulaUsesAllTables: false,
        formulaTableDependencyAliases: ["customers", "report"],
        formulaReferenceDependencyAliases: ["orders", "missing"],
      },
    ]
    const aliases = new Map([
      ["customers", { id: "customers" }],
      ["report", { id: "report" }],
      ["orders", { id: "orders" }],
    ])

    const dependencies = resolveSpreadsheetWorkbookDependencies(
      sheets,
      aliases,
      sheetId => sheets.some(sheet => sheet.id === sheetId),
      definition => [definition.source],
    )

    expect([...dependencies.get("report") ?? []]).toEqual(["orders", "customers"])
  })

  it("adds every other sheet when a formula reads all tables", () => {
    const sheets = [
      { id: "a", viewDefinition: null, formulaUsesAllTables: false, formulaTableDependencyAliases: [], formulaReferenceDependencyAliases: [] },
      { id: "b", viewDefinition: null, formulaUsesAllTables: true, formulaTableDependencyAliases: [], formulaReferenceDependencyAliases: [] },
    ]
    const dependencies = resolveSpreadsheetWorkbookDependencies(sheets, new Map(), () => true, () => [])
    expect([...dependencies.get("b") ?? []]).toEqual(["a"])
  })
})
