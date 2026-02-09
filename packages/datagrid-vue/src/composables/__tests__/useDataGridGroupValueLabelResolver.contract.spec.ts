import { describe, expect, it } from "vitest"
import { useDataGridGroupValueLabelResolver } from "../useDataGridGroupValueLabelResolver"

interface Row {
  service?: string
  owner?: string
  status?: string
}

type GroupKey = "none" | "service" | "owner" | "status"

describe("useDataGridGroupValueLabelResolver contract", () => {
  it("returns trimmed group label for present values", () => {
    const resolver = useDataGridGroupValueLabelResolver<Row, GroupKey>({
      resolveCellValue(row, key) {
        return row[key]
      },
      disabledGroupKeys: ["none"],
    })
    expect(resolver.resolveGroupValueLabel({ service: "  billing-api  " }, "service")).toBe("billing-api")
  })

  it("returns empty placeholder for blank values", () => {
    const resolver = useDataGridGroupValueLabelResolver<Row, GroupKey>({
      resolveCellValue(row, key) {
        return row[key]
      },
      emptyLabel: "(n/a)",
      disabledGroupKeys: ["none"],
    })
    expect(resolver.resolveGroupValueLabel({ owner: "   " }, "owner")).toBe("(n/a)")
    expect(resolver.resolveGroupValueLabel({}, "status")).toBe("(n/a)")
  })

  it("returns empty string for disabled group key", () => {
    const resolver = useDataGridGroupValueLabelResolver<Row, GroupKey>({
      resolveCellValue(row, key) {
        return row[key]
      },
      disabledGroupKeys: ["none"],
    })
    expect(resolver.resolveGroupValueLabel({ service: "api" }, "none")).toBe("")
  })
})
