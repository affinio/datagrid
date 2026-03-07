import { describe, expect, it } from "vitest"
import {
  areFormulaValuesEqual,
  coerceFormulaValueToBoolean,
  coerceFormulaValueToNumber,
  compareFormulaValues,
  compileDataGridFormulaFieldDefinition,
  diagnoseDataGridFormulaExpression,
  explainDataGridFormulaExpression,
  explainDataGridFormulaFieldDefinition,
  createFormulaErrorValue,
  findFormulaErrorValue,
  getFormulaNodeSpan,
  isFormulaValueBlank,
  isFormulaValueEmptyText,
  isFormulaErrorValue,
  normalizeFormulaValue,
  parseDataGridFormulaExpression,
} from "../formulaEngine.js"

describe("formulaEngine", () => {
  it("freezes null, blank, missing and zero semantics", () => {
    expect(normalizeFormulaValue(undefined)).toBe(null)
    expect(normalizeFormulaValue({})).toBe(null)
    expect(normalizeFormulaValue("")).toBe("")
    expect(normalizeFormulaValue(0)).toBe(0)
    expect(normalizeFormulaValue(false)).toBe(false)

    expect(isFormulaValueBlank(null)).toBe(true)
    expect(isFormulaValueBlank("")).toBe(false)
    expect(isFormulaValueEmptyText("")).toBe(true)
    expect(isFormulaValueEmptyText(null)).toBe(false)

    expect(coerceFormulaValueToNumber(null)).toBe(0)
    expect(coerceFormulaValueToNumber("")).toBe(0)
    expect(coerceFormulaValueToNumber(false)).toBe(0)
    expect(coerceFormulaValueToNumber(true)).toBe(1)

    expect(coerceFormulaValueToBoolean(null)).toBe(false)
    expect(coerceFormulaValueToBoolean("")).toBe(false)
    expect(coerceFormulaValueToBoolean("0")).toBe(false)
    expect(coerceFormulaValueToBoolean("hello")).toBe(true)
    expect(coerceFormulaValueToBoolean(0)).toBe(false)

    expect(areFormulaValuesEqual(null, null)).toBe(true)
    expect(areFormulaValuesEqual("", null)).toBe(false)
    expect(areFormulaValuesEqual("0", 0)).toBe(true)
    expect(compareFormulaValues(null, "")).toBeLessThan(0)
  })

  it("supports typed formula error values and error-value runtime policy", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    const errorValue = createFormulaErrorValue({
      code: "DIV_ZERO",
      message: "Division by zero.",
    })
    expect(isFormulaErrorValue(errorValue)).toBe(true)
    expect(findFormulaErrorValue([0, null, errorValue])).toEqual(errorValue)

    for (const compileStrategy of strategies) {
      const compiled = compileDataGridFormulaFieldDefinition({
        name: "ratioErrorValue",
        formula: "price / qty",
      }, {
        compileStrategy,
        runtimeErrorPolicy: "error-value",
      })

      const result = compiled.compute({
        row: {},
        rowId: `r-error-value-${compileStrategy}`,
        sourceIndex: 0,
        get: token => (token === "field:price" ? 10 : 0),
      })

      expect(isFormulaErrorValue(result)).toBe(true)
      expect(result).toMatchObject({
        kind: "error",
        code: "DIV_ZERO",
      })
    }
  })

  it("tracks source spans on parsed AST nodes", () => {
    const parsed = parseDataGridFormulaExpression("price * qty + tax")

    expect(parsed.formula).toBe("price * qty + tax")
    expect(getFormulaNodeSpan(parsed.ast)).toEqual({ start: 0, end: 17 })
    expect(parsed.ast.kind).toBe("binary")

    if (parsed.ast.kind === "binary") {
      expect(getFormulaNodeSpan(parsed.ast.left)).toEqual({ start: 0, end: 11 })
      expect(getFormulaNodeSpan(parsed.ast.right)).toEqual({ start: 14, end: 17 })
    }
  })

  it("reports syntax and validation diagnostics with exact spans", () => {
    const syntax = diagnoseDataGridFormulaExpression("price + )")
    expect(syntax.ok).toBe(false)
    expect(syntax.diagnostics[0]).toMatchObject({
      severity: "error",
      span: { start: 8, end: 9 },
    })

    const missingFunction = diagnoseDataGridFormulaExpression("MISSING_FN(price)")
    expect(missingFunction.ok).toBe(false)
    expect(missingFunction.diagnostics[0]).toMatchObject({
      severity: "error",
      span: { start: 0, end: 17 },
    })
  })

  it("builds explain trees and dependency traces for formulas", () => {
    const explained = explainDataGridFormulaExpression("IF(price > qty, subtotal + tax, 0)", {
      resolveDependencyToken: (identifier) => {
        if (identifier === "subtotal") {
          return "computed:subtotal"
        }
        return `field:${identifier}`
      },
    })

    expect(explained.identifiers).toEqual(["price", "qty", "subtotal", "tax"])
    expect(explained.dependencies).toEqual([
      { identifier: "price", token: "field:price", domain: "field", value: "price" },
      { identifier: "qty", token: "field:qty", domain: "field", value: "qty" },
      { identifier: "subtotal", token: "computed:subtotal", domain: "computed", value: "subtotal" },
      { identifier: "tax", token: "field:tax", domain: "field", value: "tax" },
    ])
    expect(explained.contextKeys).toEqual([])
    expect(explained.tree).toMatchObject({
      kind: "call",
      label: "IF()",
      children: [
        { kind: "binary", label: ">" },
        { kind: "binary", label: "+" },
        { kind: "number", label: "0" },
      ],
    })

    const fieldExplain = explainDataGridFormulaFieldDefinition({
      name: "total",
      field: "summary.total",
      formula: "subtotal + tax",
    }, {
      resolveDependencyToken: (identifier) => (
        identifier === "subtotal" ? "computed:subtotal" : `field:${identifier}`
      ),
    })

    expect(fieldExplain.name).toBe("total")
    expect(fieldExplain.field).toBe("summary.total")
    expect(fieldExplain.contextKeys).toEqual([])
    expect(fieldExplain.dependencies[0]).toMatchObject({
      identifier: "subtotal",
      domain: "computed",
      value: "subtotal",
    })
  })

  it("collects context keys from registered formula functions", () => {
    const explained = explainDataGridFormulaExpression("RATE() + price", {
      functionRegistry: {
        RATE: {
          arity: 0,
          contextKeys: ["pricing", "pricing", "session"],
          compute: () => 1,
        },
      },
    })

    expect(explained.contextKeys).toEqual(["pricing", "session"])

    const compiled = compileDataGridFormulaFieldDefinition({
      name: "adjusted",
      formula: "price * RATE()",
    }, {
      functionRegistry: {
        RATE: {
          arity: 0,
          contextKeys: ["pricing"],
          compute: () => 2,
        },
      },
    })

    expect(compiled.contextKeys).toEqual(["pricing"])
  })

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

  it("supports bracketed path references and canonicalizes them", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "nestedPath",
      formula: "user.orders[0].price + tax",
    })

    expect(compiled.identifiers).toEqual(["user.orders.0.price", "tax"])
    expect(compiled.deps).toEqual(["field:user.orders.0.price", "field:tax"])
    expect(
      compiled.compute({
        row: {},
        rowId: "r-bracket-path",
        sourceIndex: 0,
        get: token => {
          if (token === "field:user.orders.0.price") return 12
          if (token === "field:tax") return 3
          return null
        },
      }),
    ).toBe(15)
  })

  it("supports quoted field reference segments", () => {
    const explained = explainDataGridFormulaExpression("[gross margin] + metrics['tax.rate']", {
      resolveDependencyToken: identifier => `field:${identifier}`,
    })

    expect(explained.identifiers).toEqual(['"gross margin"', 'metrics."tax.rate"'])
    expect(explained.dependencies).toEqual([
      {
        identifier: '"gross margin"',
        token: 'field:"gross margin"',
        domain: "field",
        value: '"gross margin"',
      },
      {
        identifier: 'metrics."tax.rate"',
        token: 'field:metrics."tax.rate"',
        domain: "field",
        value: 'metrics."tax.rate"',
      },
    ])
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

  it("supports string literals and TRUE/FALSE/NULL keywords", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const condition = compileDataGridFormulaFieldDefinition({
        name: "literalIf",
        formula: "IF(TRUE, 'ok', \"no\")",
      }, { compileStrategy })

      expect(
        condition.compute({
          row: {},
          rowId: `r-literal-if-${compileStrategy}`,
          sourceIndex: 0,
          get: () => 0,
        }),
      ).toBe("ok")

      const fallback = compileDataGridFormulaFieldDefinition({
        name: "literalCoalesce",
        formula: "COALESCE(NULL, '', 'fallback')",
      }, { compileStrategy })

      expect(
        fallback.compute({
          row: {},
          rowId: `r-literal-coalesce-${compileStrategy}`,
          sourceIndex: 0,
          get: () => 0,
        }),
      ).toBe("")
    }
  })

  it("throws when formula references unknown function", () => {
    expect(() => {
      compileDataGridFormulaFieldDefinition({
        name: "brokenFn",
        formula: "MISSING_FN(price)",
      })
    }).toThrow(/Unknown function/i)
  })

  it("throws on odd argument count for IFS", () => {
    expect(() => {
      compileDataGridFormulaFieldDefinition({
        name: "brokenIfs",
        formula: "IFS(price > 0, 1, qty > 0)",
      })
    }).toThrow(/IFS.*even number of arguments/i)
  })

  it("reports function overrides for custom registry entries", () => {
    const overrides: string[] = []
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "x",
      formula: "SUM(price, qty)",
    }, {
      compileStrategy: "jit",
      functionRegistry: {
        sum: {
          compute: args => args.reduce((acc, value) => acc + Number(value ?? 0), 100),
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

  it("supports logical operators AND/OR/NOT", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "logical",
      formula: "NOT(price > 10 AND qty > 0) OR fee > 0",
    })

    expect(
      compiled.compute({
        row: {},
        rowId: "r-logical-1",
        sourceIndex: 0,
        get: token => {
          if (token === "field:price") return 12
          if (token === "field:qty") return 1
          if (token === "field:fee") return 0
          return 0
        },
      }),
    ).toBe(0)

    expect(
      compiled.compute({
        row: {},
        rowId: "r-logical-2",
        sourceIndex: 1,
        get: token => {
          if (token === "field:price") return 8
          if (token === "field:qty") return 0
          if (token === "field:fee") return 1
          return 0
        },
      }),
    ).toBe(1)
  })

  it("short-circuits IF, IFS, COALESCE and logical OR in AST and JIT strategies", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const ifCompiled = compileDataGridFormulaFieldDefinition({
        name: "ifGuard",
        formula: "IF(qty == 0, 0, price / qty)",
      }, {
        compileStrategy,
        runtimeErrorPolicy: "throw",
      })
      expect(
        ifCompiled.compute({
          row: {},
          rowId: `r-if-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:price" ? 10 : 0),
        }),
      ).toBe(0)

      const ifsCompiled = compileDataGridFormulaFieldDefinition({
        name: "ifsGuard",
        formula: "IFS(qty == 0, 0, price > 0, price / qty, 1, 99)",
      }, {
        compileStrategy,
        runtimeErrorPolicy: "throw",
      })
      expect(
        ifsCompiled.compute({
          row: {},
          rowId: `r-ifs-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:price" ? 10 : 0),
        }),
      ).toBe(0)

      const coalesceCompiled = compileDataGridFormulaFieldDefinition({
        name: "coalesceGuard",
        formula: "COALESCE(price, 10 / qty)",
      }, {
        compileStrategy,
        runtimeErrorPolicy: "throw",
      })
      expect(
        coalesceCompiled.compute({
          row: {},
          rowId: `r-coalesce-${compileStrategy}`,
          sourceIndex: 0,
          get: token => {
            if (token === "field:price") {
              return 0
            }
            return 0
          },
        }),
      ).toBe(0)

      const orCompiled = compileDataGridFormulaFieldDefinition({
        name: "orGuard",
        formula: "qty == 0 OR price / qty > 1",
      }, {
        compileStrategy,
        runtimeErrorPolicy: "throw",
      })
      expect(
        orCompiled.compute({
          row: {},
          rowId: `r-or-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:price" ? 10 : 0),
        }),
      ).toBe(1)
    }
  })

  it("uses first present value semantics for COALESCE (not truthy)", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const compiled = compileDataGridFormulaFieldDefinition({
        name: "coalescePresent",
        formula: "COALESCE(primary, fallback)",
      }, { compileStrategy })

      expect(
        compiled.compute({
          row: {},
          rowId: `r-coalesce-zero-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:primary" ? 0 : 5),
        }),
      ).toBe(0)

      expect(
        compiled.compute({
          row: {},
          rowId: `r-coalesce-false-${compileStrategy}`,
          sourceIndex: 1,
          get: token => (token === "field:primary" ? false : 1),
        }),
      ).toBe(false)

      expect(
        compiled.compute({
          row: {},
          rowId: `r-coalesce-empty-${compileStrategy}`,
          sourceIndex: 2,
          get: token => (token === "field:primary" ? "" : "fallback"),
        }),
      ).toBe("")

      expect(
        compiled.compute({
          row: {},
          rowId: `r-coalesce-null-${compileStrategy}`,
          sourceIndex: 3,
          get: token => (token === "field:primary" ? null : "fallback"),
        }),
      ).toBe("fallback")
    }
  })

  it("treats missing dependency values as blank nulls while preserving empty strings", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const coalesce = compileDataGridFormulaFieldDefinition({
        name: "missingVsEmpty",
        formula: "COALESCE(primary, fallback)",
      }, { compileStrategy })

      expect(
        coalesce.compute({
          row: {},
          rowId: `r-missing-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:fallback" ? "fallback" : undefined),
        }),
      ).toBe("fallback")

      expect(
        coalesce.compute({
          row: {},
          rowId: `r-empty-${compileStrategy}`,
          sourceIndex: 1,
          get: token => (token === "field:primary" ? "" : "fallback"),
        }),
      ).toBe("")

      const equality = compileDataGridFormulaFieldDefinition({
        name: "missingEqNull",
        formula: "left == right",
      }, { compileStrategy })

      expect(
        equality.compute({
          row: {},
          rowId: `r-missing-null-${compileStrategy}`,
          sourceIndex: 2,
          get: token => (token === "field:left" ? undefined : null),
        }),
      ).toBe(1)

      const arithmetic = compileDataGridFormulaFieldDefinition({
        name: "blankArithmetic",
        formula: "left + right + third",
      }, { compileStrategy })

      expect(
        arithmetic.compute({
          row: {},
          rowId: `r-blank-arithmetic-${compileStrategy}`,
          sourceIndex: 3,
          get: token => {
            if (token === "field:left") return undefined
            if (token === "field:right") return ""
            if (token === "field:third") return 5
            return 0
          },
        }),
      ).toBe(5)
    }
  })

  it("applies explicit equality and compare coercion contract", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]
    const timestamp = Date.parse("2024-01-01T00:00:00.000Z")

    for (const compileStrategy of strategies) {
      const eqNumericString = compileDataGridFormulaFieldDefinition({
        name: "eqNumericString",
        formula: "left == right",
      }, { compileStrategy })
      expect(
        eqNumericString.compute({
          row: {},
          rowId: `r-eq-numeric-string-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:left" ? "42" : 42),
        }),
      ).toBe(1)

      const eqDateTimestamp = compileDataGridFormulaFieldDefinition({
        name: "eqDateTimestamp",
        formula: "left == right",
      }, { compileStrategy })
      expect(
        eqDateTimestamp.compute({
          row: {},
          rowId: `r-eq-date-number-${compileStrategy}`,
          sourceIndex: 1,
          get: token => (
            token === "field:left"
              ? new Date("2024-01-01T00:00:00.000Z")
              : timestamp
          ),
        }),
      ).toBe(1)

      const eqNonNumericString = compileDataGridFormulaFieldDefinition({
        name: "eqNonNumericString",
        formula: "left == right",
      }, { compileStrategy })
      expect(
        eqNonNumericString.compute({
          row: {},
          rowId: `r-eq-nonnumeric-${compileStrategy}`,
          sourceIndex: 2,
          get: token => (token === "field:left" ? "abc" : 0),
        }),
      ).toBe(0)

      const cmpStringLex = compileDataGridFormulaFieldDefinition({
        name: "cmpStringLex",
        formula: "left > right",
      }, { compileStrategy })
      expect(
        cmpStringLex.compute({
          row: {},
          rowId: `r-cmp-string-lex-${compileStrategy}`,
          sourceIndex: 3,
          get: token => (token === "field:left" ? "10" : "2"),
        }),
      ).toBe(0)
    }
  })

  it("keeps parity between AST and JIT compile strategies", () => {
    const compiledAst = compileDataGridFormulaFieldDefinition({
      name: "parity",
      formula: "IF(price > qty, ROUND(price * qty + tax, 2), 0)",
    }, {
      compileStrategy: "ast",
    })

    const compiledJit = compileDataGridFormulaFieldDefinition({
      name: "parity",
      formula: "IF(price > qty, ROUND(price * qty + tax, 2), 0)",
    }, {
      compileStrategy: "jit",
    })

    const values = new Map<string, unknown>([
      ["field:price", 12.345],
      ["field:qty", 3.21],
      ["field:tax", 1.5],
    ])

    const context = {
      row: {},
      rowId: "r-parity",
      sourceIndex: 0,
      get: (token: string) => values.get(token),
    }

    expect(compiledAst.compute(context)).toBe(compiledJit.compute(context))
  })

  it("assigns the same expression hash to structurally equivalent formulas", () => {
    const direct = compileDataGridFormulaFieldDefinition({
      name: "direct",
      formula: "price + tax",
    })

    const grouped = compileDataGridFormulaFieldDefinition({
      name: "grouped",
      formula: "(price) + (tax)",
    })

    expect(direct.expressionHash).toBe(grouped.expressionHash)
  })

  it("supports a CSP-safe compile path with dynamic code generation disabled", () => {
    const runtimeWithFunctionOverride = globalThis as typeof globalThis & {
      Function: FunctionConstructor
    }
    const originalFunction = runtimeWithFunctionOverride.Function
    runtimeWithFunctionOverride.Function = ((..._args: ConstructorParameters<FunctionConstructor>) => {
      throw new Error("Dynamic code generation blocked.")
    }) as unknown as FunctionConstructor

    try {
      const compiled = compileDataGridFormulaFieldDefinition({
        name: "cspSafe",
        formula: "price * qty + tax",
      }, {
        compileStrategy: "auto",
        allowDynamicCodegen: false,
      })

      const contexts = [{ row: {}, rowId: "r-csp", sourceIndex: 0 }]
      const values = [12, 3, 1]

      expect(compiled.compute({
        row: {},
        rowId: "r-csp",
        sourceIndex: 0,
        get: token => {
          if (token === "field:price") {
            return 12
          }
          if (token === "field:qty") {
            return 3
          }
          return 1
        },
      })).toBe(37)
      expect(compiled.computeBatch?.(
        contexts,
        (_contextIndex, tokenIndex) => values[tokenIndex] ?? 0,
      )).toEqual([37])
    } finally {
      runtimeWithFunctionOverride.Function = originalFunction
    }
  })

  it("rejects explicit JIT mode when dynamic code generation is disabled", () => {
    expect(() => {
      compileDataGridFormulaFieldDefinition({
        name: "jitBlocked",
        formula: "price + tax",
      }, {
        compileStrategy: "jit",
        allowDynamicCodegen: false,
      })
    }).toThrow(/dynamic code generation is disabled/i)
  })

  it("folds constant-only formulas and removes dependency tokens", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]
    for (const compileStrategy of strategies) {
      const compiled = compileDataGridFormulaFieldDefinition({
        name: "constFolded",
        formula: "2 + 3 * 4",
      }, {
        compileStrategy,
      })

      expect(compiled.deps).toEqual([])
      expect(
        compiled.compute({
          row: {},
          rowId: `r-const-folded-${compileStrategy}`,
          sourceIndex: 0,
          get: () => 0,
        }),
      ).toBe(14)
    }
  })

  it("folds typed constant formulas and keeps literal semantics", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]
    for (const compileStrategy of strategies) {
      const coalesce = compileDataGridFormulaFieldDefinition({
        name: "typedConstCoalesce",
        formula: "COALESCE(NULL, '', 'x')",
      }, {
        compileStrategy,
      })

      expect(coalesce.deps).toEqual([])
      expect(
        coalesce.compute({
          row: {},
          rowId: `r-typed-const-coalesce-${compileStrategy}`,
          sourceIndex: 0,
          get: () => 0,
        }),
      ).toBe("")

      const compare = compileDataGridFormulaFieldDefinition({
        name: "typedConstCompare",
        formula: "'10' > '2'",
      }, {
        compileStrategy,
      })

      expect(compare.deps).toEqual([])
      expect(
        compare.compute({
          row: {},
          rowId: `r-typed-const-compare-${compileStrategy}`,
          sourceIndex: 1,
          get: () => 0,
        }),
      ).toBe(0)
    }
  })

  it("applies typed value coercion for arithmetic and comparison operations", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const arithmetic = compileDataGridFormulaFieldDefinition({
        name: "typedArithmetic",
        formula: "price + qty + bonus",
      }, { compileStrategy })

      expect(
        arithmetic.compute({
          row: {},
          rowId: `r-typed-arithmetic-${compileStrategy}`,
          sourceIndex: 0,
          get: token => {
            if (token === "field:price") return "10"
            if (token === "field:qty") return true
            if (token === "field:bonus") return null
            return 0
          },
        }),
      ).toBe(11)

      const dateComparison = compileDataGridFormulaFieldDefinition({
        name: "typedDateCompare",
        formula: "startedAt >= endedAt",
      }, { compileStrategy })

      expect(
        dateComparison.compute({
          row: {},
          rowId: `r-typed-date-${compileStrategy}`,
          sourceIndex: 0,
          get: token => {
            if (token === "field:startedAt") return new Date("2024-02-10T00:00:00.000Z")
            if (token === "field:endedAt") return new Date("2024-02-09T00:00:00.000Z")
            return null
          },
        }),
      ).toBe(1)
    }
  })

  it("passes typed values to custom formula functions", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const seenArgs: unknown[] = []
      const compiled = compileDataGridFormulaFieldDefinition({
        name: "typedFn",
        formula: "IDENTITY(raw)",
      }, {
        compileStrategy,
        functionRegistry: {
          IDENTITY: {
            arity: 1,
            compute: args => {
              seenArgs.push(args[0])
              return args[0]
            },
          },
        },
      })

      expect(
        compiled.compute({
          row: {},
          rowId: `r-typed-fn-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:raw" ? "hello" : null),
        }),
      ).toBe("hello")
      expect(seenArgs).toEqual(["hello"])
    }
  })

  it("supports first-wave built-in text and math helpers", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const stats = compileDataGridFormulaFieldDefinition({
        name: "stats",
        formula: "AVG(price, qty, bonus) + COUNT(price, qty, bonus, note)",
      }, { compileStrategy })

      expect(
        stats.compute({
          row: {},
          rowId: `r-wave1-stats-${compileStrategy}`,
          sourceIndex: 0,
          get: token => {
            if (token === "field:price") return 10
            if (token === "field:qty") return "5"
            if (token === "field:bonus") return true
            if (token === "field:note") return null
            return 0
          },
        }),
      ).toBe(8.333333333333332)

      const text = compileDataGridFormulaFieldDefinition({
        name: "text",
        formula: "CONCAT(UPPER(TRIM(name)), '-', LOWER(code), '-', LEN(code))",
      }, { compileStrategy })

      expect(
        text.compute({
          row: {},
          rowId: `r-wave1-text-${compileStrategy}`,
          sourceIndex: 1,
          get: token => {
            if (token === "field:name") return "  Alice  "
            if (token === "field:code") return "XyZ"
            return null
          },
        }),
      ).toBe("ALICE-xyz-3")

      const rounding = compileDataGridFormulaFieldDefinition({
        name: "rounding",
        formula: "CEIL(price) + FLOOR(qty)",
      }, { compileStrategy })

      expect(
        rounding.compute({
          row: {},
          rowId: `r-wave1-rounding-${compileStrategy}`,
          sourceIndex: 2,
          get: token => {
            if (token === "field:price") return 10.2
            if (token === "field:qty") return 4.9
            return 0
          },
        }),
      ).toBe(15)
    }
  })

  it("supports array, range and lookup-oriented helpers", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const summed = compileDataGridFormulaFieldDefinition({
        name: "summedRange",
        formula: "SUM(RANGE(price, tax, bonus))",
      }, { compileStrategy })

      expect(
        summed.compute({
          row: {},
          rowId: `r-range-sum-${compileStrategy}`,
          sourceIndex: 0,
          get: token => {
            if (token === "field:price") return 10
            if (token === "field:tax") return 2
            if (token === "field:bonus") return 3
            return null
          },
        }),
      ).toBe(15)

      const indexed = compileDataGridFormulaFieldDefinition({
        name: "indexed",
        formula: "INDEX(ARRAY(price, tax, bonus), 2)",
      }, { compileStrategy })

      expect(
        indexed.compute({
          row: {},
          rowId: `r-range-index-${compileStrategy}`,
          sourceIndex: 1,
          get: token => {
            if (token === "field:price") return 10
            if (token === "field:tax") return 2
            if (token === "field:bonus") return 3
            return null
          },
        }),
      ).toBe(2)

      const matched = compileDataGridFormulaFieldDefinition({
        name: "matched",
        formula: "MATCH(code, ARRAY('A', 'B', 'C'))",
      }, { compileStrategy })

      expect(
        matched.compute({
          row: {},
          rowId: `r-range-match-${compileStrategy}`,
          sourceIndex: 2,
          get: token => (token === "field:code" ? "B" : null),
        }),
      ).toBe(2)

      const lookedUp = compileDataGridFormulaFieldDefinition({
        name: "lookedUp",
        formula: "XLOOKUP(code, ARRAY('A', 'B', 'C'), ARRAY(price, tax, bonus), 99)",
      }, { compileStrategy })

      expect(
        lookedUp.compute({
          row: {},
          rowId: `r-range-lookup-${compileStrategy}`,
          sourceIndex: 3,
          get: token => {
            if (token === "field:code") return "C"
            if (token === "field:price") return 10
            if (token === "field:tax") return 2
            if (token === "field:bonus") return 3
            return null
          },
        }),
      ).toBe(3)

      const contains = compileDataGridFormulaFieldDefinition({
        name: "contains",
        formula: "IN(status, ARRAY('open', 'closed'))",
      }, { compileStrategy })

      expect(
        contains.compute({
          row: {},
          rowId: `r-range-in-${compileStrategy}`,
          sourceIndex: 4,
          get: token => (token === "field:status" ? "closed" : null),
        }),
      ).toBe(1)
    }
  })

  it("constant-folds first-wave built-in helpers", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const compiled = compileDataGridFormulaFieldDefinition({
        name: "foldedWave1",
        formula: "CONCAT(UPPER('ab'), '-', LEN('trim'))",
      }, { compileStrategy })

      expect(compiled.deps).toEqual([])
      expect(
        compiled.compute({
          row: {},
          rowId: `r-wave1-fold-${compileStrategy}`,
          sourceIndex: 0,
          get: () => null,
        }),
      ).toBe("AB-4")
    }
  })

  it("supports second-wave date, numeric and substring helpers", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const dateParts = compileDataGridFormulaFieldDefinition({
        name: "dateParts",
        formula: "YEAR(createdAt) + MONTH(createdAt) + DAY(createdAt)",
      }, { compileStrategy })

      expect(
        dateParts.compute({
          row: {},
          rowId: `r-wave2-date-${compileStrategy}`,
          sourceIndex: 0,
          get: token => (token === "field:createdAt" ? "2024-02-10T00:00:00.000Z" : null),
        }),
      ).toBe(2036)

      const substrings = compileDataGridFormulaFieldDefinition({
        name: "substrings",
        formula: "CONCAT(LEFT(code, 2), '-', MID(code, 2, 3), '-', RIGHT(code, 2))",
      }, { compileStrategy })

      expect(
        substrings.compute({
          row: {},
          rowId: `r-wave2-substr-${compileStrategy}`,
          sourceIndex: 1,
          get: token => (token === "field:code" ? "ABCDE" : null),
        }),
      ).toBe("AB-BCD-DE")

      const numerics = compileDataGridFormulaFieldDefinition({
        name: "numerics",
        formula: "POW(base, exp) + MOD(total, divisor)",
      }, { compileStrategy })

      expect(
        numerics.compute({
          row: {},
          rowId: `r-wave2-num-${compileStrategy}`,
          sourceIndex: 2,
          get: token => {
            if (token === "field:base") return 2
            if (token === "field:exp") return 5
            if (token === "field:total") return 17
            if (token === "field:divisor") return 5
            return 0
          },
        }),
      ).toBe(34)
    }
  })

  it("constant-folds second-wave date and utility helpers", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const compiled = compileDataGridFormulaFieldDefinition({
        name: "foldedWave2",
        formula: "YEAR(DATE(2024, 2, 10)) + LEN(RIGHT('ABCDE', 2)) + MOD(17, 5)",
      }, { compileStrategy })

      expect(compiled.deps).toEqual([])
      expect(
        compiled.compute({
          row: {},
          rowId: `r-wave2-fold-${compileStrategy}`,
          sourceIndex: 0,
          get: () => null,
        }),
      ).toBe(2028)
    }
  })

  it("supports JIT evaluator with escaped dependency token literals", () => {
    const escapedToken = "field:meta.\"price.with.quote\""
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "safeToken",
      formula: "price + fee",
    }, {
      compileStrategy: "jit",
      resolveDependencyToken: identifier => {
        if (identifier === "price") {
          return escapedToken
        }
        return `field:${identifier}`
      },
    })

    const values = new Map<string, unknown>([
      [escapedToken, 20],
      ["field:fee", 2],
    ])

    expect(
      compiled.compute({
        row: {},
        rowId: "r-safe-token",
        sourceIndex: 0,
        get: token => values.get(token),
      }),
    ).toBe(22)
  })

  it("evaluates JIT batch kernels with token-index readers", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "batchTotal",
      formula: "price * qty + tax",
    }, {
      compileStrategy: "jit",
    })

    expect(typeof compiled.computeBatch).toBe("function")
    const contexts = [
      { row: {}, rowId: "r1", sourceIndex: 0 },
      { row: {}, rowId: "r2", sourceIndex: 1 },
      { row: {}, rowId: "r3", sourceIndex: 2 },
    ]
    const rows = [
      [10, 2, 1],
      [8, 3, 2],
      [7, 4, 3],
    ]
    const result = compiled.computeBatch?.(
      contexts,
      (contextIndex, tokenIndex) => rows[contextIndex]?.[tokenIndex] ?? 0,
    ) ?? []

    expect(result).toEqual([21, 26, 31])
  })

  it("evaluates JIT columnar batch kernels with token columns", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "columnarTotal",
      formula: "price * qty + tax",
    }, {
      compileStrategy: "jit",
    })

    expect(typeof compiled.computeBatchColumnar).toBe("function")
    const contexts = [
      { row: {}, rowId: "r1", sourceIndex: 0 },
      { row: {}, rowId: "r2", sourceIndex: 1 },
      { row: {}, rowId: "r3", sourceIndex: 2 },
    ]
    const tokenColumns = [
      [10, 8, 7],
      [2, 3, 4],
      [1, 2, 3],
    ]
    const result = compiled.computeBatchColumnar?.(contexts, tokenColumns) ?? []

    expect(result).toEqual([21, 26, 31])
  })

  it("exposes AST batch evaluators with token-index readers", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "astBatchTotal",
      formula: "price * qty + tax",
    }, {
      compileStrategy: "ast",
    })

    expect(typeof compiled.computeBatch).toBe("function")
    expect(typeof compiled.computeBatchColumnar).toBe("function")

    const contexts = [
      { row: {}, rowId: "r1", sourceIndex: 0 },
      { row: {}, rowId: "r2", sourceIndex: 1 },
      { row: {}, rowId: "r3", sourceIndex: 2 },
    ]
    const rows = [
      [10, 2, 1],
      [8, 3, 2],
      [7, 4, 3],
    ]
    const result = compiled.computeBatch?.(
      contexts,
      (contextIndex, tokenIndex) => rows[contextIndex]?.[tokenIndex] ?? 0,
    ) ?? []
    const columnarResult = compiled.computeBatchColumnar?.(contexts, [
      [10, 8, 7],
      [2, 3, 4],
      [1, 2, 3],
    ]) ?? []

    expect(result).toEqual([21, 26, 31])
    expect(columnarResult).toEqual([21, 26, 31])
  })

  it("falls back to row-wise semantics when JIT batch hits runtime errors", () => {
    const runtimeErrors: string[] = []
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "batchRatio",
      formula: "price / qty",
    }, {
      compileStrategy: "jit",
      runtimeErrorPolicy: "coerce-zero",
      onRuntimeError: error => {
        runtimeErrors.push(`${String(error.rowId)}:${error.code}`)
      },
    })

    const contexts = [
      { row: {}, rowId: "r1", sourceIndex: 0 },
      { row: {}, rowId: "r2", sourceIndex: 1 },
      { row: {}, rowId: "r3", sourceIndex: 2 },
    ]
    const rows = [
      [12, 3],
      [10, 0],
      [9, 3],
    ]
    const result = compiled.computeBatch?.(
      contexts,
      (contextIndex, tokenIndex) => rows[contextIndex]?.[tokenIndex] ?? 0,
    ) ?? []

    expect(result).toEqual([4, 0, 3])
    expect(runtimeErrors).toEqual(["r2:DIV_ZERO"])
  })

  it("falls back to row-wise semantics when JIT columnar batch hits runtime errors", () => {
    const runtimeErrors: string[] = []
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "columnarRatio",
      formula: "price / qty",
    }, {
      compileStrategy: "jit",
      runtimeErrorPolicy: "coerce-zero",
      onRuntimeError: error => {
        runtimeErrors.push(`${String(error.rowId)}:${error.code}`)
      },
    })

    const contexts = [
      { row: {}, rowId: "r1", sourceIndex: 0 },
      { row: {}, rowId: "r2", sourceIndex: 1 },
      { row: {}, rowId: "r3", sourceIndex: 2 },
    ]
    const tokenColumns = [
      [12, 10, 9],
      [3, 0, 3],
    ]
    const result = compiled.computeBatchColumnar?.(contexts, tokenColumns) ?? []

    expect(result).toEqual([4, 0, 3])
    expect(runtimeErrors).toEqual(["r2:DIV_ZERO"])
  })

  it("propagates typed error values through dependent formulas", () => {
    const strategies: Array<"ast" | "jit"> = ["ast", "jit"]

    for (const compileStrategy of strategies) {
      const dependent = compileDataGridFormulaFieldDefinition({
        name: "dependent",
        formula: "subtotal + tax",
      }, {
        compileStrategy,
        runtimeErrorPolicy: "error-value",
      })

      const upstreamError = createFormulaErrorValue({
        code: "DIV_ZERO",
        message: "Division by zero.",
      })

      const result = dependent.compute({
        row: {},
        rowId: `r-dependent-error-${compileStrategy}`,
        sourceIndex: 0,
        get: token => {
          if (token === "field:subtotal") {
            return upstreamError
          }
          if (token === "field:tax") {
            return 2
          }
          return null
        },
      })

      expect(result).toEqual(upstreamError)
    }
  })

  it("returns typed error values per row in batch mode when error-value policy is enabled", () => {
    const compiled = compileDataGridFormulaFieldDefinition({
      name: "batchErrorValue",
      formula: "price / qty",
    }, {
      compileStrategy: "jit",
      runtimeErrorPolicy: "error-value",
    })

    const contexts = [
      { row: {}, rowId: "r1", sourceIndex: 0 },
      { row: {}, rowId: "r2", sourceIndex: 1 },
      { row: {}, rowId: "r3", sourceIndex: 2 },
    ]
    const rows = [
      [12, 3],
      [10, 0],
      [9, 3],
    ]
    const result = compiled.computeBatch?.(
      contexts,
      (contextIndex, tokenIndex) => rows[contextIndex]?.[tokenIndex] ?? 0,
    ) ?? []

    expect(result[0]).toBe(4)
    expect(result[2]).toBe(3)
    expect(isFormulaErrorValue(result[1] ?? null)).toBe(true)
    expect(result[1]).toMatchObject({
      kind: "error",
      code: "DIV_ZERO",
    })
  })
})
