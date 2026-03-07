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
  type DataGridCompiledFormulaArtifact,
  type DataGridCompiledFormulaField,
  type DataGridFormulaBatchEvaluator,
  type DataGridFormulaColumnarBatchEvaluator,
  type DataGridFormulaExpressionAnalysis,
  type DataGridFormulaCompileOptions,
  type DataGridFormulaCompileStrategy,
  type DataGridFormulaEvaluator,
  type DataGridFormulaAstNode,
  type DataGridFormulaRuntimeErrorPolicy,
} from "./core.js"
import {
  compileFormulaAstBatchEvaluatorJit,
  compileFormulaAstColumnarBatchEvaluatorFused,
  compileFormulaAstColumnarBatchEvaluatorJit,
  compileFormulaAstEvaluator,
  compileFormulaAstEvaluatorJit,
  compileFormulaAstTokenIndexEvaluator,
} from "./evaluators.js"

function serializeFormulaValue(value: DataGridFormulaValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => serializeFormulaValue(item)).join(",")}]`
  }
  if (value == null) {
    return "null"
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? `n:${value}` : `n:${String(value)}`
  }
  if (typeof value === "string") {
    return `s:${JSON.stringify(value)}`
  }
  if (typeof value === "boolean") {
    return value ? "b:1" : "b:0"
  }
  if (typeof value === "object" && "kind" in value && (value as { kind?: unknown }).kind === "error") {
    const errorValue = value as { code?: unknown; message?: unknown }
    return `e:${String(errorValue.code ?? "")}:${String(errorValue.message ?? "")}`
  }
  return `u:${String(value)}`
}

function serializeFormulaAst(node: DataGridFormulaAstNode): string {
  switch (node.kind) {
    case "number":
      return `num(${node.value})`
    case "literal":
      return `lit(${serializeFormulaValue(node.value)})`
    case "identifier":
      return `id(${JSON.stringify(node.name)})`
    case "call":
      return `call(${JSON.stringify(node.name)}:${node.args.map(arg => serializeFormulaAst(arg)).join(",")})`
    case "unary":
      return `unary(${node.operator}:${serializeFormulaAst(node.value)})`
    case "binary":
      return `binary(${node.operator}:${serializeFormulaAst(node.left)}:${serializeFormulaAst(node.right)})`
  }
}

function hashFormulaAst(node: DataGridFormulaAstNode): string {
  const serialized = serializeFormulaAst(node)
  let hash = 0x811c9dc5
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function analyzeFormulaExpression(
  formulaText: string,
  options: DataGridFormulaCompileOptions = {},
): {
  formula: string
  functionRegistry: ReturnType<typeof normalizeFormulaFunctionRegistry>
  optimizedAst: DataGridFormulaAstNode
  expressionHash: string
  identifiers: readonly string[]
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
  dependencyTokenByIdentifier: ReadonlyMap<string, DataGridComputedDependencyToken>
} {
  const formula = normalizeFormulaText(formulaText)
  const tokens = tokenizeFormula(formula)
  const ast = parseFormula(tokens)
  const functionRegistry = normalizeFormulaFunctionRegistry(options.functionRegistry, {
    onFunctionOverride: options.onFunctionOverride,
  })
  validateFormulaFunctions(ast, functionRegistry)
  const optimizedAst = foldFormulaConstants(ast)

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

  const contextKeys = Array.from(new Set((() => {
    const collected: string[] = []
    collectFormulaContextKeys(optimizedAst, functionRegistry, collected)
    return collected.map(key => key.trim()).filter(key => key.length > 0)
  })()))

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

  return {
    formula,
    functionRegistry,
    optimizedAst,
    expressionHash: hashFormulaAst(optimizedAst),
    identifiers,
    deps,
    contextKeys,
    dependencyTokenByIdentifier,
  }
}

export function analyzeDataGridFormulaFieldDefinition(
  definition: DataGridFormulaFieldDefinition,
  options: DataGridFormulaCompileOptions = {},
): DataGridFormulaExpressionAnalysis {
  const analyzed = analyzeFormulaExpression(definition.formula, options)
  return {
    formula: analyzed.formula,
    expressionHash: analyzed.expressionHash,
    identifiers: analyzed.identifiers,
    deps: analyzed.deps,
    contextKeys: analyzed.contextKeys,
  }
}

export function bindCompiledFormulaArtifactToFieldDefinition<TRow = unknown>(
  artifact: DataGridCompiledFormulaArtifact<TRow>,
  definition: DataGridFormulaFieldDefinition,
  options: Pick<DataGridFormulaCompileOptions, "runtimeErrorPolicy" | "onRuntimeError"> = {},
): DataGridCompiledFormulaField<TRow> {
  return artifact.bind(definition, options)
}

export function compileDataGridFormulaFieldArtifact<TRow = unknown>(
  definition: DataGridFormulaFieldDefinition,
  options: DataGridFormulaCompileOptions = {},
): DataGridCompiledFormulaArtifact<TRow> {
  const analyzed = analyzeFormulaExpression(definition.formula, options)
  const dependencyTokenIndexByToken = new Map<DataGridComputedDependencyToken, number>()
  for (let tokenIndex = 0; tokenIndex < analyzed.deps.length; tokenIndex += 1) {
    const token = analyzed.deps[tokenIndex]
    if (typeof token !== "string") {
      continue
    }
    dependencyTokenIndexByToken.set(token, tokenIndex)
  }

  const resolveIdentifierToken = (
    identifier: string,
  ): DataGridComputedDependencyToken | undefined => analyzed.dependencyTokenByIdentifier.get(identifier)
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
  const fusedColumnarBatchEvaluator = compileFormulaAstColumnarBatchEvaluatorFused(
    analyzed.optimizedAst,
    resolveIdentifierTokenIndex,
  )
  const tokenIndexEvaluator = compileFormulaAstTokenIndexEvaluator(
    analyzed.optimizedAst,
    analyzed.functionRegistry,
    resolveIdentifierTokenIndex,
  )
  if (compileStrategy === "jit" && !allowDynamicCodegen) {
    throwFormulaError(
      `Failed to compile JIT evaluator: dynamic code generation is disabled. Use compileStrategy 'ast' or allowDynamicCodegen: true.`,
    )
  }
  if (compileStrategy === "ast" || !allowDynamicCodegen) {
    evaluator = compileFormulaAstEvaluator(
      analyzed.optimizedAst,
      analyzed.functionRegistry,
      resolveIdentifierToken,
    )
  } else {
    try {
      evaluator = compileFormulaAstEvaluatorJit(
        analyzed.optimizedAst,
        analyzed.functionRegistry,
        resolveIdentifierTokenIndex,
        analyzed.deps,
      )
      batchEvaluator = compileFormulaAstBatchEvaluatorJit(
        analyzed.optimizedAst,
        analyzed.functionRegistry,
        resolveIdentifierTokenIndex,
      )
      columnarBatchEvaluator = compileFormulaAstColumnarBatchEvaluatorJit(
        analyzed.optimizedAst,
        analyzed.functionRegistry,
        resolveIdentifierTokenIndex,
      )
    } catch (error) {
      if (compileStrategy === "jit") {
        const message = error instanceof Error
          ? error.message
          : String(error ?? "Unknown JIT compile error.")
        throwFormulaError(`Failed to compile JIT evaluator: ${message}`)
      }
      evaluator = compileFormulaAstEvaluator(
        analyzed.optimizedAst,
        analyzed.functionRegistry,
        resolveIdentifierToken,
      )
    }
  }

  const rowFallbackChunkSize = 128

  const bind = (
    fieldDefinition: DataGridFormulaFieldDefinition,
    bindOptions: Pick<DataGridFormulaCompileOptions, "runtimeErrorPolicy" | "onRuntimeError"> = {},
  ): DataGridCompiledFormulaField<TRow> => {
    const name = normalizeFormulaFieldName(fieldDefinition.name, "Formula name")
    const field = normalizeFormulaFieldName(fieldDefinition.field ?? name, "Formula target field")
    const runtimeErrorPolicy: DataGridFormulaRuntimeErrorPolicy = bindOptions.runtimeErrorPolicy ?? "coerce-zero"
    const batchExecutionMode = fusedColumnarBatchEvaluator
      ? "columnar-fused"
      : columnarBatchEvaluator
        ? "columnar-jit"
        : "columnar-ast"

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
          formula: analyzed.formula,
          rowId: contextMeta.rowId,
          sourceIndex: contextMeta.sourceIndex,
        })
        bindOptions.onRuntimeError?.(runtimeError)
        if (runtimeErrorPolicy === "throw") {
          throw new Error(`[DataGridFormula] ${runtimeError.message}`)
        }
        if (runtimeErrorPolicy === "error-value") {
          return createFormulaErrorValue(runtimeError)
        }
        return 0
      }
    }

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
            return batchEvaluator(contexts.length, readTokenByIndex)
          } catch {
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
                  buildRowWiseResults(contexts, readTokenByIndex, start, end, results)
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
        if (fusedColumnarBatchEvaluator) {
          try {
            return fusedColumnarBatchEvaluator(contexts.length, tokenColumns)
          } catch {
            if (contexts.length > rowFallbackChunkSize) {
              const results = new Array<DataGridFormulaValue>(contexts.length)
              for (let start = 0; start < contexts.length; start += rowFallbackChunkSize) {
                const end = Math.min(start + rowFallbackChunkSize, contexts.length)
                const chunkLength = end - start
                const chunkColumns = tokenColumns.map(column => (column ? column.slice(start, end) : []))
                try {
                  const chunkResult = fusedColumnarBatchEvaluator(chunkLength, chunkColumns)
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
        if (columnarBatchEvaluator) {
          try {
            return columnarBatchEvaluator(contexts.length, tokenColumns)
          } catch {
            if (contexts.length > rowFallbackChunkSize) {
              const results = new Array<DataGridFormulaValue>(contexts.length)
              for (let start = 0; start < contexts.length; start += rowFallbackChunkSize) {
                const end = Math.min(start + rowFallbackChunkSize, contexts.length)
                const chunkLength = end - start
                const chunkColumns = tokenColumns.map(column => (column ? column.slice(start, end) : []))
                try {
                  const chunkResult = columnarBatchEvaluator(chunkLength, chunkColumns)
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
      formula: analyzed.formula,
      expressionHash: analyzed.expressionHash,
      identifiers: analyzed.identifiers,
      deps: analyzed.deps,
      contextKeys: analyzed.contextKeys,
      batchExecutionMode,
      computeBatch,
      computeBatchColumnar,
      compute: (context) => evaluateWithRuntimePolicy(
        () => evaluator(token => context.get(token)),
        {
          rowId: context.rowId,
          sourceIndex: context.sourceIndex,
        },
      ),
    }
  }

  return {
    formula: analyzed.formula,
    expressionHash: analyzed.expressionHash,
    identifiers: analyzed.identifiers,
    deps: analyzed.deps,
    contextKeys: analyzed.contextKeys,
    bind,
  }
}

export function compileDataGridFormulaFieldDefinition<TRow = unknown>(
  definition: DataGridFormulaFieldDefinition,
  options: DataGridFormulaCompileOptions = {},
): DataGridCompiledFormulaField<TRow> {
  const artifact = compileDataGridFormulaFieldArtifact<TRow>(definition, options)
  return bindCompiledFormulaArtifactToFieldDefinition(artifact, definition, options)
}
