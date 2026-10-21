import { describe, expect, it } from "vitest"
import {
  cloneDataGridFilterSnapshot,
  evaluateDataGridAdvancedFilterExpression,
  normalizeDataGridAdvancedFilterExpression,
  type DataGridFilterSnapshot,
} from "../index"

describe("advanced filter expression", () => {
  it("evaluates the does not contain operator", () => {
    const expression = normalizeDataGridAdvancedFilterExpression({
      kind: "condition",
      key: "owner",
      type: "text",
      operator: "does-not-contain",
      value: "noc",
    })

    expect(evaluateDataGridAdvancedFilterExpression(expression, () => "Operations")).toBe(true)
    expect(evaluateDataGridAdvancedFilterExpression(expression, () => "NOC Team")).toBe(false)
  })

  it("evaluates nested group + not expression deterministically", () => {
    const expression = normalizeDataGridAdvancedFilterExpression({
      kind: "group",
      operator: "and",
      children: [
        {
          kind: "condition",
          key: "status",
          type: "text",
          operator: "in",
          value: ["active", "warning"],
        },
        {
          kind: "group",
          operator: "or",
          children: [
            {
              kind: "condition",
              key: "latencyMs",
              type: "number",
              operator: "gt",
              value: 90,
            },
            {
              kind: "not",
              child: {
                kind: "condition",
                key: "owner",
                type: "text",
                operator: "equals",
                value: "noc",
              },
            },
          ],
        },
      ],
    })

    const rowA = {
      status: "active",
      latencyMs: 65,
      owner: "ops",
    }
    const rowB = {
      status: "active",
      latencyMs: 65,
      owner: "noc",
    }

    const rowAResult = evaluateDataGridAdvancedFilterExpression(expression, condition => {
      return (rowA as Record<string, unknown>)[condition.key]
    })
    const rowBResult = evaluateDataGridAdvancedFilterExpression(expression, condition => {
      return (rowB as Record<string, unknown>)[condition.key]
    })

    expect(rowAResult).toBe(true)
    expect(rowBResult).toBe(false)
  })

  it("clones filter snapshot without leaking mutable references", () => {
    const source: DataGridFilterSnapshot = {
      columnFilters: {
        owner: { kind: "valueSet", tokens: ["string:noc"] },
      },
      advancedExpression: {
        kind: "condition",
        key: "owner",
        operator: "equals",
        value: "noc",
      },
      quickFilter: {
        query: "noc",
        columns: ["owner", "service"],
        mode: "tokens",
      },
    }

    const cloned = cloneDataGridFilterSnapshot(source)
    expect(cloned).not.toBeNull()
    expect(cloned).toMatchObject({
      columnFilters: source.columnFilters,
      advancedExpression: source.advancedExpression,
      quickFilter: source.quickFilter,
    })

    if (!cloned) {
      return
    }

    cloned.columnFilters.owner = { kind: "valueSet", tokens: ["string:ops"] }
    cloned.quickFilter!.columns = ["region"]
    if (cloned.advancedExpression?.kind === "condition") {
      cloned.advancedExpression.value = "operations"
    }

    expect(source.columnFilters.owner).toEqual({ kind: "valueSet", tokens: ["string:noc"] })
    expect(source.advancedExpression?.kind === "condition" && source.advancedExpression.value).toBe("noc")
    expect(source.quickFilter?.columns).toEqual(["owner", "service"])
  })

  it("supports set/date operators in advanced expression", () => {
    const expression = normalizeDataGridAdvancedFilterExpression({
      kind: "group",
      operator: "and",
      children: [
        {
          kind: "condition",
          key: "region",
          type: "set",
          operator: "in",
          value: ["us-east", "eu-central"],
        },
        {
          kind: "condition",
          key: "updatedAt",
          type: "date",
          operator: "gte",
          value: "2026-02-01T00:00:00.000Z",
        },
      ],
    })

    const accepted = evaluateDataGridAdvancedFilterExpression(expression, condition => {
      const row = {
        region: "us-east",
        updatedAt: "2026-02-10T10:00:00.000Z",
      }
      return (row as Record<string, unknown>)[condition.key]
    })
    const rejected = evaluateDataGridAdvancedFilterExpression(expression, condition => {
      const row = {
        region: "ap-south",
        updatedAt: "2026-01-15T09:00:00.000Z",
      }
      return (row as Record<string, unknown>)[condition.key]
    })

    expect(accepted).toBe(true)
    expect(rejected).toBe(false)
  })
})
