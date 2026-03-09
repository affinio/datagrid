// Runtime evaluator entrypoints. Backend-specific implementation lives in
// ../evaluators/* while this file stays a stable runtime-facing barrel.
export {
  compileFormulaAstEvaluator,
  compileFormulaAstTokenIndexEvaluator,
} from "../evaluators/interpreter.js"

export {
  compileFormulaAstEvaluatorJit,
  compileFormulaAstBatchEvaluatorJit,
  compileFormulaAstColumnarBatchEvaluatorJit,
} from "../evaluators/jit.js"

export {
  compileFormulaAstColumnarBatchEvaluatorFused,
} from "../evaluators/columnar.js"

export {
  compileFormulaAstColumnarBatchEvaluatorVector,
} from "../evaluators/vector.js"
