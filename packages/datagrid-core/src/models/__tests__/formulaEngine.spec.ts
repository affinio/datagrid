import { describe, expect, it } from "vitest"
import { compileDataGridFormulaFieldDefinition } from "../formulaEngine.js"

describe("formulaEngine", () => {
  it("compiles arithmetic formula and evaluates with dependency tokens", () => {
    const compiled = compileDataGridFormulaFieldDefinition<{ price: number; quantity: number; tax: number }>({
      name: "total",
      formula: "=price * quantity + tax",
    })

    expect(compiled.field).toBe("total")
    expect(compiled.deps).toEqual(["field:price", "field:quantity", "field:tax"])

    const values = new Map<string, unknown>([
      ["field:price", 10],
      ["field:quantity", 3],
      ["field:tax", 2],
    ])
    expect(
      compiled.compute({
        row: { price: 10, quantity: 3, tax: 2 },
        rowId: "r1",
        sourceIndex: 0,
        get: token => values.get(token),
      }),
    ).toBe(32)
  })

  it("supports computed dependency token resolution and deduplicates deps", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "grandTotal",
      field: "grand",
      formula: "subtotal + fee + subtotal",
    }, {
      resolveDependencyToken: identifier => {
        if (identifier === "subtotal") {
          return "computed:subtotal"
        }
        return `field:${identifier}`
      },
    })

    expect(compiled.field).toBe("grand")
    expect(compiled.deps).toEqual(["computed:subtotal", "field:fee"])
    expect(
      compiled.compute({
        row: {},
        rowId: "r2",
        sourceIndex: 1,
        get: token => {
          if (token === "computed:subtotal") {
            return 15
          }
          if (token === "field:fee") {
            return 2
          }
          return 0
        },
      }),
    ).toBe(32)
  })

  it("throws on invalid formula expressions", () => {
    expect(() => {
      compileDataGridFormulaFieldDefinition({
        name: "broken",
        formula: "price + )",
      })
    }).toThrow(/DataGridFormula/i)
  })

  it("rejects bracket notation in identifiers", () => {
    expect(() => {
      compileDataGridFormulaFieldDefinition({
        name: "brokenPath",
        formula: "user.orders[0].price + tax",
      })
    }).toThrow(/Bracket notation is not supported/i)
  })

  it("supports function calls and comparison operators", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "discounted",
      formula: "IF(price > 10, ROUND(price * qty, 0), 0)",
    })

    expect(compiled.deps).toEqual(["field:price", "field:qty"])

    expect(
      compiled.compute({
        row: {},
        rowId: "r3",
        sourceIndex: 0,
        get: token => {
          if (token === "field:price") {
            return 12
          }
          if (token === "field:qty") {
            return 2.4
          }
          return 0
        },
      }),
    ).toBe(29)

    expect(
      compiled.compute({
        row: {},
        rowId: "r4",
        sourceIndex: 1,
        get: token => {
          if (token === "field:price") {
            return 9
          }
          if (token === "field:qty") {
            return 3
          }
          return 0
        },
      }),
    ).toBe(0)
  })

  it("throws when formula references unknown function", () => {
    expect(() => {
      compileDataGridFormulaFieldDefinition({
        name: "brokenFn",
        formula: "MISSING_FN(price)",
      })
    }).toThrow(/Unknown function/i)
  })

  it("reports function overrides for custom registry entries", () => {
    const overrides: string[] = []
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "x",
      formula: "SUM(price, qty)",
    }, {
      functionRegistry: {
        sum: {
          compute: args => args.reduce((acc, value) => acc + value, 100),
        },
      },
      onFunctionOverride: functionName => {
        overrides.push(functionName)
      },
    })

    expect(
      compiled.compute({
        row: {},
        rowId: "r-override",
        sourceIndex: 0,
        get: token => (token === "field:price" ? 10 : 2),
      }),
    ).toBe(112)
    expect(overrides).toEqual(["SUM"])
  })

  it("coerces division by zero to 0", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "ratio",
      formula: "price / qty",
    })
    expect(
      compiled.compute({
        row: {},
        rowId: "r5",
        sourceIndex: 0,
        get: token => (token === "field:price" ? 10 : 0),
      }),
    ).toBe(0)
  })

  it("reports runtime errors via callback", () => {
    const runtimeErrors: string[] = []
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "ratio",
      formula: "price / qty",
    }, {
      onRuntimeError: error => {
        runtimeErrors.push(error.code)
      },
    })

    expect(
      compiled.compute({
        row: {},
        rowId: "r6",
        sourceIndex: 0,
        get: token => (token === "field:price" ? 10 : 0),
      }),
    ).toBe(0)
    expect(runtimeErrors).toEqual(["DIV_ZERO"])
  })

  it("throws runtime errors when throw policy is enabled", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "ratio",
      formula: "price / qty",
    }, {
      runtimeErrorPolicy: "throw",
    })

    expect(() => {
      compiled.compute({
        row: {},
        rowId: "r7",
        sourceIndex: 0,
        get: token => (token === "field:price" ? 10 : 0),
      })
    }).toThrow(/DataGridFormula/i)
  })
})
