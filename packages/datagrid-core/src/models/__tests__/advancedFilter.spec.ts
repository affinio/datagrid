import { describe, expect, it } from "vitest"
import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  cloneDataGridFilterSnapshot,
  evaluateDataGridAdvancedFilterExpression,
  normalizeDataGridAdvancedFilterExpression,
  type DataGridFilterSnapshot,
} from "../index"

describe("advanced filter expression", () => {
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

  it("keeps backward compatibility with legacy advancedFilters map", () => {
    const expression = buildDataGridAdvancedFilterExpressionFromLegacyFilters({
      latencyMs: {
        type: "number",
        clauses: [
          {
            operator: "gt",
            value: 40,
          },
          {
            operator: "lt",
            value: 120,
            join: "and",
          },
        ],
      },
      owner: {
        type: "text",
        clauses: [
          {
            operator: "contains",
            value: "oc",
          },
        ],
      },
    })

    const accepted = evaluateDataGridAdvancedFilterExpression(expression, condition => {
      const row = {
        latencyMs: 84,
        owner: "noc",
      }
      return (row as Record<string, unknown>)[condition.key]
    })
    const rejected = evaluateDataGridAdvancedFilterExpression(expression, condition => {
      const row = {
        latencyMs: 140,
        owner: "noc",
      }
      return (row as Record<string, unknown>)[condition.key]
    })

    expect(accepted).toBe(true)
    expect(rejected).toBe(false)
  })

  it("clones filter snapshot without leaking mutable references", () => {
    const source: DataGridFilterSnapshot = {
      columnFilters: {
        owner: { kind: "valueSet", tokens: ["string:noc"] },
      },
      advancedFilters: {
        latencyMs: {
          type: "number",
          clauses: [
            {
              operator: "between",
              value: 10,
              value2: 90,
            },
          ],
        },
      },
      advancedExpression: {
        kind: "condition",
        key: "owner",
        operator: "equals",
        value: "noc",
      },
    }

    const cloned = cloneDataGridFilterSnapshot(source)
    expect(cloned).not.toBeNull()
    expect(cloned).toEqual(source)

    if (!cloned) {
      return
    }

    cloned.columnFilters.owner = { kind: "valueSet", tokens: ["string:ops"] }
    cloned.advancedFilters.latencyMs.clauses[0]!.operator = "gt"

    expect(source.columnFilters.owner).toEqual({ kind: "valueSet", tokens: ["string:noc"] })
    expect(source.advancedFilters.latencyMs.clauses[0]!.operator).toBe("between")
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
