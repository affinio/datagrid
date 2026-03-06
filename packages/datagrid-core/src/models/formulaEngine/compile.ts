import type {
  DataGridComputedDependencyToken,
  DataGridFormulaFieldDefinition,
  DataGridFormulaValue,
  DataGridRowId,
} from "../rowModel.js"
import {
  collectFormulaContextKeys,
  collectFormulaIdentifiers,
  createFormulaErrorValue,
  foldFormulaConstants,
  normalizeFormulaFieldName,
  normalizeFormulaFunctionRegistry,
  normalizeFormulaRuntimeError,
  normalizeFormulaText,
  parseFormula,
  throwFormulaError,
  tokenizeFormula,
  validateFormulaFunctions,
  type DataGridCompiledFormulaBatchContext,
  type DataGridCompiledFormulaField,
  type DataGridFormulaBatchEvaluator,
  type DataGridFormulaColumnarBatchEvaluator,
  type DataGridFormulaCompileOptions,
  type DataGridFormulaCompileStrategy,
  type DataGridFormulaEvaluator,
  type DataGridFormulaRuntimeErrorPolicy,
} from "./core.js"
import {
  compileFormulaAstBatchEvaluatorJit,
  compileFormulaAstColumnarBatchEvaluatorJit,
  compileFormulaAstEvaluator,
  compileFormulaAstEvaluatorJit,
  compileFormulaAstTokenIndexEvaluator,
} from "./evaluators.js"

export function compileDataGridFormulaFieldDefinition<TRow = unknown>(
  definition: DataGridFormulaFieldDefinition,
  options: DataGridFormulaCompileOptions = {},
): DataGridCompiledFormulaField<TRow> {
  const name = normalizeFormulaFieldName(definition.name, "Formula name")
  const field = normalizeFormulaFieldName(definition.field ?? name, "Formula target field")
  const formula = normalizeFormulaText(definition.formula)
  const tokens = tokenizeFormula(formula)
  const ast = parseFormula(tokens)
  const functionRegistry = normalizeFormulaFunctionRegistry(options.functionRegistry, {
    onFunctionOverride: options.onFunctionOverride,
  })
  validateFormulaFunctions(ast, functionRegistry)
  const optimizedAst = foldFormulaConstants(ast)
  const runtimeErrorPolicy: DataGridFormulaRuntimeErrorPolicy = options.runtimeErrorPolicy ?? "coerce-zero"

  const references: string[] = []
  collectFormulaIdentifiers(optimizedAst, references)

  const identifiers: string[] = []
  const seenIdentifiers = new Set<string>()
  for (const reference of references) {
    const normalized = reference.trim()
    if (normalized.length === 0 || seenIdentifiers.has(normalized)) {
      continue
    }
    seenIdentifiers.add(normalized)
    identifiers.push(normalized)
  }

  const contextKeys = (() => {
    const collected: string[] = []
    collectFormulaContextKeys(optimizedAst, functionRegistry, collected)
    return Array.from(new Set(collected.map(key => key.trim()).filter(key => key.length > 0)))
  })()

  const resolveDependencyToken = options.resolveDependencyToken
    ?? ((identifier: string): DataGridComputedDependencyToken => `field:${identifier}`)
  const deps: DataGridComputedDependencyToken[] = []
  const dependencyTokenByIdentifier = new Map<string, DataGridComputedDependencyToken>()
  const seenDependencyTokens = new Set<string>()

  for (const identifier of identifiers) {
    const token = resolveDependencyToken(identifier)
    dependencyTokenByIdentifier.set(identifier, token)
    if (seenDependencyTokens.has(token)) {
      continue
    }
    seenDependencyTokens.add(token)
    deps.push(token)
  }

  const dependencyTokenIndexByToken = new Map<DataGridComputedDependencyToken, number>()
  for (let tokenIndex = 0; tokenIndex < deps.length; tokenIndex += 1) {
    const token = deps[tokenIndex]
    if (typeof token !== "string") {
      continue
    }
    dependencyTokenIndexByToken.set(token, tokenIndex)
  }

  const resolveIdentifierToken = (
    identifier: string,
  ): DataGridComputedDependencyToken | undefined => dependencyTokenByIdentifier.get(identifier)
  const resolveIdentifierTokenIndex = (
    identifier: string,
  ): number | undefined => {
    const token = resolveIdentifierToken(identifier)
    if (!token) {
      return undefined
    }
    return dependencyTokenIndexByToken.get(token)
  }

  const compileStrategy: DataGridFormulaCompileStrategy = (
    options.compileStrategy === "ast"
    || options.compileStrategy === "jit"
    || options.compileStrategy === "auto"
  )
    ? options.compileStrategy
    : "auto"
  const allowDynamicCodegen = options.allowDynamicCodegen !== false

  let evaluator: DataGridFormulaEvaluator
  let batchEvaluator: DataGridFormulaBatchEvaluator | null = null
  let columnarBatchEvaluator: DataGridFormulaColumnarBatchEvaluator | null = null
  const tokenIndexEvaluator = compileFormulaAstTokenIndexEvaluator(
    optimizedAst,
    functionRegistry,
    resolveIdentifierTokenIndex,
  )
  if (compileStrategy === "jit" && !allowDynamicCodegen) {
    throwFormulaError(
      `Failed to compile JIT evaluator for '${name}': dynamic code generation is disabled. Use compileStrategy 'ast' or allowDynamicCodegen: true.`,
    )
  }
  if (compileStrategy === "ast" || !allowDynamicCodegen) {
    evaluator = compileFormulaAstEvaluator(
      optimizedAst,
      functionRegistry,
      resolveIdentifierToken,
    )
  } else {
    try {
      evaluator = compileFormulaAstEvaluatorJit(
        optimizedAst,
        functionRegistry,
        resolveIdentifierTokenIndex,
        deps,
      )
      batchEvaluator = compileFormulaAstBatchEvaluatorJit(
        optimizedAst,
        functionRegistry,
        resolveIdentifierTokenIndex,
      )
      columnarBatchEvaluator = compileFormulaAstColumnarBatchEvaluatorJit(
        optimizedAst,
        functionRegistry,
        resolveIdentifierTokenIndex,
      )
    } catch (error) {
      if (compileStrategy === "jit") {
        const message = error instanceof Error
          ? error.message
          : String(error ?? "Unknown JIT compile error.")
        throwFormulaError(`Failed to compile JIT evaluator for '${name}': ${message}`)
      }
      evaluator = compileFormulaAstEvaluator(
        optimizedAst,
        functionRegistry,
        resolveIdentifierToken,
      )
    }
  }

  const evaluateWithRuntimePolicy = (
    evaluate: () => DataGridFormulaValue,
    contextMeta: {
      rowId: DataGridRowId
      sourceIndex: number
    },
  ): DataGridFormulaValue => {
    try {
      return evaluate()
    } catch (error) {
      const runtimeError = normalizeFormulaRuntimeError(error, {
        formulaName: name,
        field,
        formula,
        rowId: contextMeta.rowId,
        sourceIndex: contextMeta.sourceIndex,
      })
      options.onRuntimeError?.(runtimeError)
      if (runtimeErrorPolicy === "throw") {
        throw new Error(`[DataGridFormula] ${runtimeError.message}`)
      }
      if (runtimeErrorPolicy === "error-value") {
        return createFormulaErrorValue(runtimeError)
      }
      return 0
    }
  }

  const rowFallbackChunkSize = 128

  const evaluateRowWithTokenIndexReader = (
    contexts: readonly DataGridCompiledFormulaBatchContext<TRow>[],
    contextIndex: number,
    readTokenAt: (contextIndex: number, tokenIndex: number) => unknown,
  ): DataGridFormulaValue => {
    const context = contexts[contextIndex]
    if (!context) {
      return 0
    }
    return evaluateWithRuntimePolicy(
      () => tokenIndexEvaluator((tokenIndex) => readTokenAt(contextIndex, tokenIndex)),
      {
        rowId: context.rowId,
        sourceIndex: context.sourceIndex,
      },
    )
  }

  const buildRowWiseResults = (
    contexts: readonly DataGridCompiledFormulaBatchContext<TRow>[],
    readTokenAt: (contextIndex: number, tokenIndex: number) => unknown,
    startIndex = 0,
    endIndex = contexts.length,
    output?: DataGridFormulaValue[],
  ): DataGridFormulaValue[] => {
    const target = output ?? new Array<DataGridFormulaValue>(contexts.length)
    for (let contextIndex = startIndex; contextIndex < endIndex; contextIndex += 1) {
      target[contextIndex] = evaluateRowWithTokenIndexReader(contexts, contextIndex, readTokenAt)
    }
    return target
  }

  const computeBatch: DataGridCompiledFormulaField<TRow>["computeBatch"] = (
    (contexts, readTokenByIndex) => {
      if (contexts.length === 0) {
        return []
      }
      if (batchEvaluator) {
        try {
          return batchEvaluator(
            contexts.length,
            readTokenByIndex,
          )
        } catch {
          // Batch evaluator may throw on the first failing row.
          // Retry by chunks to preserve fast path for unaffected ranges.
          if (contexts.length > rowFallbackChunkSize) {
            const results = new Array<DataGridFormulaValue>(contexts.length)
            for (let start = 0; start < contexts.length; start += rowFallbackChunkSize) {
              const end = Math.min(start + rowFallbackChunkSize, contexts.length)
              const chunkLength = end - start
              try {
                const chunkResult = batchEvaluator(
                  chunkLength,
                  (contextIndex, tokenIndex) => readTokenByIndex(start + contextIndex, tokenIndex),
                )
                for (let offset = 0; offset < chunkLength; offset += 1) {
                  results[start + offset] = chunkResult[offset] ?? 0
                }
              } catch {
                buildRowWiseResults(
                  contexts,
                  readTokenByIndex,
                  start,
                  end,
                  results,
                )
              }
            }
            return results
          }
        }
      }

      return buildRowWiseResults(contexts, readTokenByIndex)
    }
  )

  const computeBatchColumnar: DataGridCompiledFormulaField<TRow>["computeBatchColumnar"] = (
    (contexts, tokenColumns) => {
      if (contexts.length === 0) {
        return []
      }
      if (columnarBatchEvaluator) {
        try {
          return columnarBatchEvaluator(
            contexts.length,
            tokenColumns,
          )
        } catch {
          // Columnar evaluator may throw on the first failing row.
          // Retry by chunks to keep fast path for non-failing ranges.
          if (contexts.length > rowFallbackChunkSize) {
            const results = new Array<DataGridFormulaValue>(contexts.length)
            for (let start = 0; start < contexts.length; start += rowFallbackChunkSize) {
              const end = Math.min(start + rowFallbackChunkSize, contexts.length)
              const chunkLength = end - start
              const chunkColumns = tokenColumns.map(
                column => (column ? column.slice(start, end) : []),
              )
              try {
                const chunkResult = columnarBatchEvaluator(
                  chunkLength,
                  chunkColumns,
                )
                for (let offset = 0; offset < chunkLength; offset += 1) {
                  results[start + offset] = chunkResult[offset] ?? 0
                }
              } catch {
                buildRowWiseResults(
                  contexts,
                  (contextIndex, tokenIndex) => {
                    const column = tokenColumns[tokenIndex]
                    return column ? column[contextIndex] : undefined
                  },
                  start,
                  end,
                  results,
                )
              }
            }
            return results
          }
        }
      }

      return buildRowWiseResults(
        contexts,
        (contextIndex, tokenIndex) => {
          const column = tokenColumns[tokenIndex]
          return column ? column[contextIndex] : undefined
        },
      )
    }
  )

  return {
    name,
    field,
    formula,
    identifiers,
    deps,
    contextKeys,
    computeBatch,
    computeBatchColumnar,
    compute: (context) => {
      return evaluateWithRuntimePolicy(
        () => evaluator(token => context.get(token)),
        {
          rowId: context.rowId,
          sourceIndex: context.sourceIndex,
        },
      )
    },
  }
}
