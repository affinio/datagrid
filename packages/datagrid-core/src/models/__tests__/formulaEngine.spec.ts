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
})
