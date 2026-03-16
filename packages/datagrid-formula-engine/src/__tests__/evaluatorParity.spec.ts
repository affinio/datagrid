import { describe, expect, it } from "vitest"
import {
  compileFormulaAstBatchEvaluatorJit,
  compileFormulaAstColumnarBatchEvaluatorFused,
  compileFormulaAstColumnarBatchEvaluatorJit,
  compileFormulaAstColumnarBatchEvaluatorVector,
  compileFormulaAstTokenIndexEvaluator,
} from "../runtime/evaluators.js"
import { normalizeFormulaFunctionRegistry, normalizeFormulaText } from "../syntax/functions.js"
import { parseFormula } from "../syntax/parser.js"
import { tokenizeFormula } from "../syntax/tokenizer.js"

function parseFormulaAst(formulaText: string) {
  const formula = normalizeFormulaText(formulaText)
  return parseFormula(tokenizeFormula(formula))
}

function evaluateInterpreterBatch(
  formulaText: string,
  tokenColumns: readonly (readonly unknown[])[],
  identifiers: readonly string[],
): readonly unknown[] {
  const tokenIndexByIdentifier = new Map(identifiers.map((identifier, index) => [identifier, index]))
  const evaluator = compileFormulaAstTokenIndexEvaluator(
    parseFormulaAst(formulaText),
    normalizeFormulaFunctionRegistry(undefined),
    identifier => tokenIndexByIdentifier.get(identifier),
  )
  return tokenColumns[0]?.map((_, contextIndex) => evaluator(tokenIndex => tokenColumns[tokenIndex]?.[contextIndex])) ?? []
}

function evaluateColumnarBatch(
  formulaText: string,
  tokenColumns: readonly (readonly unknown[])[],
  identifiers: readonly string[],
  compiler: typeof compileFormulaAstColumnarBatchEvaluatorFused
    | typeof compileFormulaAstColumnarBatchEvaluatorVector,
): readonly unknown[] | null {
  const tokenIndexByIdentifier = new Map(identifiers.map((identifier, index) => [identifier, index]))
  const evaluator = compiler(
    parseFormulaAst(formulaText),
    identifier => tokenIndexByIdentifier.get(identifier),
  )
  if (!evaluator) {
    return null
  }
  return evaluator(tokenColumns[0]?.length ?? 0, tokenColumns)
}

function evaluateColumnarJitBatch(
  formulaText: string,
  tokenColumns: readonly (readonly unknown[])[],
  identifiers: readonly string[],
): readonly unknown[] {
  const tokenIndexByIdentifier = new Map(identifiers.map((identifier, index) => [identifier, index]))
  const evaluator = compileFormulaAstColumnarBatchEvaluatorJit(
    parseFormulaAst(formulaText),
    normalizeFormulaFunctionRegistry(undefined),
    identifier => tokenIndexByIdentifier.get(identifier),
  )
  return evaluator(tokenColumns[0]?.length ?? 0, tokenColumns)
}

function evaluateJitBatch(
  formulaText: string,
  tokenColumns: readonly (readonly unknown[])[],
  identifiers: readonly string[],
): readonly unknown[] {
  const tokenIndexByIdentifier = new Map(identifiers.map((identifier, index) => [identifier, index]))
  const evaluator = compileFormulaAstBatchEvaluatorJit(
    parseFormulaAst(formulaText),
    normalizeFormulaFunctionRegistry(undefined),
    identifier => tokenIndexByIdentifier.get(identifier),
  )
  return evaluator(tokenColumns[0]?.length ?? 0, (contextIndex, tokenIndex) => tokenColumns[tokenIndex]?.[contextIndex])
}

describe("formula evaluator backend parity", () => {
  const identifiers = ["price", "qty", "discount", "alt", "flag"] as const
  const tokenColumns = [
    [10, 2, 5, 8, 3],
    [2, 10, 5, 4, 3],
    [1, 0.5, 0, 2, -1],
    [null, 7, null, 1, null],
    [1, 0, 1, 0, 1],
  ] as const

  it("keeps interpreter, fused, vector and jit backends aligned for shared scalar formulas", () => {
    const formulas = [
      "price + qty",
      "price + discount * qty",
      "-price",
      "+discount",
      "price > qty",
      "price == qty",
      "price != qty",
    ]

    for (const formula of formulas) {
      const interpreter = evaluateInterpreterBatch(formula, tokenColumns, identifiers)
      const fused = evaluateColumnarBatch(formula, tokenColumns, identifiers, compileFormulaAstColumnarBatchEvaluatorFused)
      const vector = evaluateColumnarBatch(formula, tokenColumns, identifiers, compileFormulaAstColumnarBatchEvaluatorVector)
      const columnarJit = evaluateColumnarJitBatch(formula, tokenColumns, identifiers)
      const batchJit = evaluateJitBatch(formula, tokenColumns, identifiers)

      expect(fused).toEqual(interpreter)
      expect(vector).toEqual(interpreter)
      expect(columnarJit).toEqual(interpreter)
      expect(batchJit).toEqual(interpreter)
    }
  })

  it("keeps interpreter, vector and jit backends aligned for control-flow formulas", () => {
    const formulas = [
      "IF(price > qty, price, qty)",
      "IFS(price > qty, price, qty > 5, qty, discount)",
      "COALESCE(alt, discount, qty)",
      "flag AND (price > qty)",
      "flag OR (qty > price)",
    ]

    for (const formula of formulas) {
      const interpreter = evaluateInterpreterBatch(formula, tokenColumns, identifiers)
      const vector = evaluateColumnarBatch(formula, tokenColumns, identifiers, compileFormulaAstColumnarBatchEvaluatorVector)
      const columnarJit = evaluateColumnarJitBatch(formula, tokenColumns, identifiers)
      const batchJit = evaluateJitBatch(formula, tokenColumns, identifiers)

      expect(vector).toEqual(interpreter)
      expect(columnarJit).toEqual(interpreter)
      expect(batchJit).toEqual(interpreter)
    }
  })
})