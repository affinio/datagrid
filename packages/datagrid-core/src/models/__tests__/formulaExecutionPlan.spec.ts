import { describe, expect, it } from "vitest"
import {
  createDataGridFormulaExecutionPlan,
  snapshotDataGridFormulaExecutionPlan,
} from "../formulaExecutionPlan.js"

describe("formulaExecutionPlan", () => {
  it("builds deterministic topological order and levels", () => {
    const plan = createDataGridFormulaExecutionPlan([
      {
        name: "gross",
        field: "gross",
        deps: [
          { domain: "computed", value: "total" },
          { domain: "computed", value: "tax" },
        ],
      },
      {
        name: "tax",
        field: "tax",
        deps: [
          { domain: "computed", value: "total" },
          { domain: "field", value: "taxRate" },
        ],
      },
      {
        name: "total",
        field: "total",
        deps: [
          { domain: "field", value: "price" },
          { domain: "field", value: "qty" },
        ],
      },
    ])

    expect(plan.order).toEqual(["total", "tax", "gross"])
    expect(plan.levels).toEqual([["total"], ["tax"], ["gross"]])
  })

  it("resolves affected nodes by base field changes", () => {
    const plan = createDataGridFormulaExecutionPlan([
      {
        name: "total",
        field: "total",
        deps: [
          { domain: "field", value: "price" },
          { domain: "field", value: "qty" },
        ],
      },
      {
        name: "tax",
        field: "tax",
        deps: [
          { domain: "computed", value: "total" },
          { domain: "field", value: "taxRate" },
        ],
      },
      {
        name: "gross",
        field: "gross",
        deps: [
          { domain: "computed", value: "total" },
          { domain: "computed", value: "tax" },
        ],
      },
    ])

    expect(Array.from(plan.affectedByFields(new Set(["price"])))).toEqual(["total", "tax", "gross"])
    expect(Array.from(plan.affectedByFields(new Set(["taxRate"])))).toEqual(["tax", "gross"])
    expect(Array.from(plan.directByFields(new Set(["price"])))).toEqual(["total"])
    expect(Array.from(plan.directByFields(new Set(["taxRate"])))).toEqual(["tax"])
  })

  it("resolves affected nodes by computed changes", () => {
    const plan = createDataGridFormulaExecutionPlan([
      {
        name: "total",
        field: "total",
        deps: [{ domain: "field", value: "price" }],
      },
      {
        name: "tax",
        field: "tax",
        deps: [{ domain: "computed", value: "total" }],
      },
      {
        name: "gross",
        field: "gross",
        deps: [{ domain: "computed", value: "tax" }],
      },
    ])

    expect(Array.from(plan.affectedByComputed(new Set(["tax"])))).toEqual(["tax", "gross"])
    expect(Array.from(plan.affectedByComputed(new Set(["total"])))).toEqual(["total", "tax", "gross"])
  })

  it("exposes split deps snapshot and immutable order/levels", () => {
    const plan = createDataGridFormulaExecutionPlan([
      {
        name: "tax",
        field: "tax",
        deps: [
          { domain: "computed", value: "total" },
          { domain: "field", value: "taxRate" },
        ],
      },
      {
        name: "total",
        field: "total",
        deps: [{ domain: "field", value: "price" }],
      },
    ])

    const taxNode = plan.nodes.get("tax")
    expect(taxNode).toEqual({
      name: "tax",
      field: "tax",
      level: 1,
      fieldDeps: ["total", "taxRate"],
      computedDeps: ["total"],
      dependents: [],
    })

    expect(Object.isFrozen(plan.order)).toBe(true)
    expect(Object.isFrozen(plan.levels)).toBe(true)
    expect(Object.isFrozen(plan.levels[0])).toBe(true)
  })

  it("builds a serializable snapshot from execution plan", () => {
    const plan = createDataGridFormulaExecutionPlan([
      {
        name: "total",
        field: "total",
        deps: [
          { domain: "field", value: "price" },
          { domain: "field", value: "qty" },
        ],
      },
      {
        name: "gross",
        field: "gross",
        deps: [{ domain: "computed", value: "total" }],
      },
    ])

    const snapshot = snapshotDataGridFormulaExecutionPlan(plan)
    expect(snapshot).toEqual({
      order: ["total", "gross"],
      levels: [["total"], ["gross"]],
      nodes: [
        {
          name: "total",
          field: "total",
          level: 0,
          fieldDeps: ["price", "qty"],
          computedDeps: [],
          dependents: ["gross"],
        },
        {
          name: "gross",
          field: "gross",
          level: 1,
          fieldDeps: ["total"],
          computedDeps: ["total"],
          dependents: [],
        },
      ],
    })
  })
})
