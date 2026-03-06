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

  it("resolves nested field path ancestors and descendants", () => {
    const plan = createDataGridFormulaExecutionPlan([
      {
        name: "total",
        field: "total",
        deps: [
          { domain: "field", value: "order.unitPrice" },
          { domain: "field", value: "order.items.0.tax" },
        ],
      },
      {
        name: "gross",
        field: "gross",
        deps: [{ domain: "computed", value: "total" }],
      },
      {
        name: "orderTouch",
        field: "orderTouch",
        deps: [{ domain: "field", value: "order" }],
      },
    ])

    expect(Array.from(plan.directByFields(new Set(["order"]))).sort()).toEqual([
      "orderTouch",
      "total",
    ])
    expect(Array.from(plan.affectedByFields(new Set(["order"]))).sort()).toEqual([
      "gross",
      "orderTouch",
      "total",
    ])
    expect(Array.from(plan.directByFields(new Set(["order.items"]))).sort()).toEqual([
      "orderTouch",
      "total",
    ])
    expect(Array.from(plan.directByFields(new Set(["order.unitPrice"]))).sort()).toEqual([
      "orderTouch",
      "total",
    ])
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

  it("supports iterative cycle groups when explicitly enabled", () => {
    const plan = createDataGridFormulaExecutionPlan([
      {
        name: "left",
        field: "left",
        deps: [{ domain: "computed", value: "right" }],
      },
      {
        name: "right",
        field: "right",
        deps: [{ domain: "computed", value: "left" }],
      },
    ], {
      cyclePolicy: "iterative",
    })

    expect(plan.order).toEqual(["left", "right"])
    expect(plan.levels).toEqual([["left", "right"]])
    expect(plan.iterativeGroups).toEqual([["left", "right"]])
    expect(snapshotDataGridFormulaExecutionPlan(plan)).toEqual({
      order: ["left", "right"],
      levels: [["left", "right"]],
      nodes: [
        {
          name: "left",
          field: "left",
          level: 0,
          fieldDeps: ["right"],
          computedDeps: ["right"],
          dependents: ["right"],
          iterative: true,
          cycleGroup: ["left", "right"],
        },
        {
          name: "right",
          field: "right",
          level: 0,
          fieldDeps: ["left"],
          computedDeps: ["left"],
          dependents: ["left"],
          iterative: true,
          cycleGroup: ["left", "right"],
        },
      ],
      iterativeGroups: [["left", "right"]],
    })
  })
})
