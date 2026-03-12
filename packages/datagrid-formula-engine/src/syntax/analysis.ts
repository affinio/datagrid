import type {
  DataGridComputedDependencyToken,
} from "../coreTypes.js"
import type {
  DataGridFormulaDiagnosticsResult,
  DataGridFormulaExplainDependency,
  DataGridFormulaExplainNode,
  DataGridFormulaExplainResult,
  DataGridFormulaFieldExplainResult,
} from "../analysis/types.js"
export type {
  DataGridFormulaDiagnosticsResult,
  DataGridFormulaExplainDependency,
  DataGridFormulaExplainDependencyDomain,
  DataGridFormulaExplainNode,
  DataGridFormulaExplainResult,
  DataGridFormulaFieldExplainResult,
} from "../analysis/types.js"
import type {
  DataGridFormulaCompileOptions,
  DataGridFormulaFunctionRuntime,
  DataGridFormulaParseResult,
} from "../runtime/types.js"
export type {
  DataGridCompiledFormulaArtifact,
  DataGridCompiledFormulaBatchContext,
  DataGridCompiledFormulaBatchExecutionMode,
  DataGridCompiledFormulaField,
  DataGridFormulaBatchEvaluator,
  DataGridFormulaColumnarBatchEvaluator,
  DataGridFormulaCompileOptions,
  DataGridFormulaCompileStrategy,
  DataGridFormulaEvaluator,
  DataGridFormulaEvaluatorForToken,
  DataGridFormulaExpressionAnalysis,
  DataGridFormulaFunctionRuntime,
  DataGridFormulaParseResult,
  DataGridFormulaRuntimeErrorPolicy,
  DataGridFormulaTokenIndexEvaluator,
  DataGridFormulaTokenValueReader,
} from "../runtime/types.js"
import {
  collectFormulaContextKeys,
  normalizeFormulaFieldName,
  normalizeFormulaFunctionRegistry,
  normalizeFormulaText,
} from "./functions.js"
import type {
  DataGridFormulaAstNode,
} from "./types.js"
export type {
  DataGridFormulaAstNode,
  DataGridFormulaDiagnostic,
  DataGridFormulaFunctionArity,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
  DataGridFormulaOperator,
  DataGridFormulaReferenceSegment,
  DataGridFormulaSourceSpan,
  DataGridFormulaToken,
} from "./types.js"
import {
  normalizeFormulaDiagnostic,
} from "./ast.js"
import { parseFormula } from "./parser.js"
import { tokenizeFormula } from "./tokenizer.js"
import {
  collectFormulaIdentifiers,
  validateFormulaFunctions,
  foldFormulaConstants,
} from "./optimizer.js"
import { parseDataGridComputedDependencyToken as parseDependencyToken } from "../contracts.js"

function dedupeFormulaIdentifiers(root: DataGridFormulaAstNode): readonly string[] {
  const references: string[] = []
  collectFormulaIdentifiers(root, references)
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
  return Object.freeze(identifiers)
}

function normalizeFormulaExplainDependency(
  identifier: string,
  token: DataGridComputedDependencyToken,
): DataGridFormulaExplainDependency {
  const parsedToken = parseDependencyToken(token)
  if (parsedToken) {
    return {
      identifier,
      token,
      domain: parsedToken.domain,
      value: parsedToken.name,
      ...(parsedToken.rowDomain.kind === "current"
        ? null
        : { rowSelector: parsedToken.rowDomain }),
    }
  }
  const normalizedToken = typeof token === "string" ? token.trim() : ""
  if (normalizedToken.startsWith("field:")) {
    return { identifier, token, domain: "field", value: normalizedToken.slice("field:".length) }
  }
  if (normalizedToken.startsWith("computed:")) {
    return { identifier, token, domain: "computed", value: normalizedToken.slice("computed:".length) }
  }
  if (normalizedToken.startsWith("meta:")) {
    return { identifier, token, domain: "meta", value: normalizedToken.slice("meta:".length) }
  }
  return {
    identifier,
    token,
    domain: "unknown",
    value: normalizedToken.length > 0 ? normalizedToken : String(token),
  }
}

function createFormulaExplainNode(root: DataGridFormulaAstNode): DataGridFormulaExplainNode {
  if (root.kind === "number") {
    return { kind: root.kind, label: String(root.value), span: root.span, children: [], value: root.value }
  }
  if (root.kind === "literal") {
    return { kind: root.kind, label: "literal", span: root.span, children: [], value: root.value }
  }
  if (root.kind === "identifier") {
    return {
      kind: root.kind,
      label: root.name,
      span: root.span,
      children: [],
      name: root.name,
      sheetReference: root.sheetReference,
      referenceName: root.referenceName,
      rangeReferenceName: root.rangeReferenceName ?? null,
      rowSelector: root.rowSelector,
    }
  }
  if (root.kind === "call") {
    return {
      kind: root.kind,
      label: `${root.name}()`,
      span: root.span,
      children: root.args.map(createFormulaExplainNode),
      name: root.name,
      operator: "CALL",
    }
  }
  if (root.kind === "unary") {
    return {
      kind: root.kind,
      label: root.operator,
      span: root.span,
      children: [createFormulaExplainNode(root.value)],
      operator: root.operator,
    }
  }
  return {
    kind: root.kind,
    label: root.operator,
    span: root.span,
    children: [createFormulaExplainNode(root.left), createFormulaExplainNode(root.right)],
    operator: root.operator,
  }
}

function dedupeFormulaContextKeys(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
): readonly string[] {
  const contextKeys: string[] = []
  collectFormulaContextKeys(root, functionRegistry, contextKeys)
  return Object.freeze(Array.from(new Set(contextKeys.map(key => key.trim()).filter(key => key.length > 0))))
}

export function parseDataGridFormulaExpression(
  formula: string,
  options: Pick<DataGridFormulaCompileOptions, "referenceParserOptions"> = {},
): DataGridFormulaParseResult {
  const normalizedFormula = normalizeFormulaText(formula)
  const tokens = tokenizeFormula(normalizedFormula, options.referenceParserOptions)
  const ast = parseFormula(tokens, options.referenceParserOptions)
  return { formula: normalizedFormula, tokens, ast }
}

export function diagnoseDataGridFormulaExpression(
  formula: string,
  options: Pick<DataGridFormulaCompileOptions, "functionRegistry" | "onFunctionOverride" | "referenceParserOptions"> = {},
): DataGridFormulaDiagnosticsResult {
  const normalizedFormula = normalizeFormulaText(formula)
  try {
    const tokens = tokenizeFormula(normalizedFormula, options.referenceParserOptions)
    const ast = parseFormula(tokens, options.referenceParserOptions)
    const functionRegistry = normalizeFormulaFunctionRegistry(options.functionRegistry, {
      onFunctionOverride: options.onFunctionOverride,
    })
    validateFormulaFunctions(ast, functionRegistry)
    return { ok: true, formula: normalizedFormula, diagnostics: [], tokens, ast }
  } catch (error) {
    return { ok: false, formula: normalizedFormula, diagnostics: [normalizeFormulaDiagnostic(error)] }
  }
}

export function explainDataGridFormulaExpression(
  formula: string,
  options: Pick<DataGridFormulaCompileOptions, "resolveDependencyToken" | "functionRegistry" | "onFunctionOverride" | "referenceParserOptions"> = {},
): DataGridFormulaExplainResult {
  const normalizedFormula = normalizeFormulaText(formula)
  const tokens = tokenizeFormula(normalizedFormula, options.referenceParserOptions)
  const ast = parseFormula(tokens, options.referenceParserOptions)
  const optimizedAst = foldFormulaConstants(ast)
  const identifiers = dedupeFormulaIdentifiers(optimizedAst)
  const functionRegistry = normalizeFormulaFunctionRegistry(options.functionRegistry, {
    onFunctionOverride: options.onFunctionOverride,
  })
  validateFormulaFunctions(optimizedAst, functionRegistry)
  const resolveDependencyToken = options.resolveDependencyToken
    ?? ((identifier: string): DataGridComputedDependencyToken => `field:${identifier}`)
  const dependencies = identifiers.map(identifier => normalizeFormulaExplainDependency(
    identifier,
    resolveDependencyToken(identifier),
  ))
  return {
    formula: normalizedFormula,
    tokens,
    ast: optimizedAst,
    identifiers,
    dependencies,
    contextKeys: dedupeFormulaContextKeys(optimizedAst, functionRegistry),
    tree: createFormulaExplainNode(optimizedAst),
  }
}

export function explainDataGridFormulaFieldDefinition(
  definition: {
    name: string
    field?: string
    formula: string
  },
  options: Pick<DataGridFormulaCompileOptions, "resolveDependencyToken" | "functionRegistry" | "onFunctionOverride"> = {},
): DataGridFormulaFieldExplainResult {
  const name = normalizeFormulaFieldName(definition.name, "Formula name")
  const field = normalizeFormulaFieldName(definition.field ?? name, "Formula target field")
  const explained = explainDataGridFormulaExpression(definition.formula, options)
  return {
    name,
    field,
    ...explained,
  }
}
