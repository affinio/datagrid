// Recursive descent parser for the formula language. Diagnostics/explain
// orchestration is re-exported here so syntax-facing consumers have one entrypoint.
import type { DataGridFormulaAstNode } from "./ast.js"
import type { DataGridFormulaToken } from "./tokenizer.js"
import {
  createFormulaSourceSpan,
  throwFormulaError,
} from "./ast.js"
import { parseDataGridFormulaIdentifier } from "./tokenizer.js"

export type {
  DataGridFormulaParseResult,
  DataGridFormulaDiagnosticsResult,
  DataGridFormulaExplainDependencyDomain,
  DataGridFormulaExplainDependency,
  DataGridFormulaExplainResult,
  DataGridFormulaFieldExplainResult,
} from "./analysis.js"

export {
  parseDataGridFormulaExpression,
  diagnoseDataGridFormulaExpression,
  explainDataGridFormulaExpression,
  explainDataGridFormulaFieldDefinition,
} from "./analysis.js"

export function parseFormula(tokens: readonly DataGridFormulaToken[]): DataGridFormulaAstNode {
  let cursor = 0

  const peek = (): DataGridFormulaToken | undefined => tokens[cursor]
  const consume = (): DataGridFormulaToken | undefined => {
    const next = tokens[cursor]
    if (!next) {
      return undefined
    }
    cursor += 1
    return next
  }

  const parseExpression = (): DataGridFormulaAstNode => parseOr()

  const parsePrimary = (): DataGridFormulaAstNode => {
    const token = consume()
    if (!token) {
      throwFormulaError("Unexpected end of formula.", createFormulaSourceSpan(0, 0))
    }
    if (token.kind === "number") {
      return {
        kind: "number",
        value: token.value,
        span: createFormulaSourceSpan(token.position, token.end),
      }
    }
    if (token.kind === "string") {
      return {
        kind: "literal",
        value: token.value,
        span: createFormulaSourceSpan(token.position, token.end),
      }
    }
    if (token.kind === "identifier") {
      const next = peek()
      if (!next || next.kind !== "paren" || next.value !== "(") {
        const keyword = token.value.toUpperCase()
        if (keyword === "TRUE") {
          return {
            kind: "literal",
            value: true,
            span: createFormulaSourceSpan(token.position, token.end),
          }
        }
        if (keyword === "FALSE") {
          return {
            kind: "literal",
            value: false,
            span: createFormulaSourceSpan(token.position, token.end),
          }
        }
        if (keyword === "NULL") {
          return {
            kind: "literal",
            value: null,
            span: createFormulaSourceSpan(token.position, token.end),
          }
        }
        const parsedIdentifier = parseDataGridFormulaIdentifier(token.value)
        return {
          kind: "identifier",
          name: parsedIdentifier.name,
          referenceName: parsedIdentifier.referenceName,
          rowSelector: parsedIdentifier.rowSelector,
          span: createFormulaSourceSpan(token.position, token.end),
        }
      }
      consume()
      const args: DataGridFormulaAstNode[] = []
      const possibleClose = peek()
      if (possibleClose && possibleClose.kind === "paren" && possibleClose.value === ")") {
        consume()
        return {
          kind: "call",
          name: token.value,
          args,
          span: createFormulaSourceSpan(token.position, possibleClose.end),
        }
      }
      while (true) {
        args.push(parseExpression())
        const delimiter = peek()
        if (!delimiter || delimiter.kind !== "comma") {
          break
        }
        consume()
      }
      const close = consume()
      if (!close || close.kind !== "paren" || close.value !== ")") {
        throwFormulaError(
          `Missing ')' for function call '${token.value}' at position ${token.position + 1}.`,
          createFormulaSourceSpan(token.position, token.end),
        )
      }
      return {
        kind: "call",
        name: token.value,
        args,
        span: createFormulaSourceSpan(token.position, close.end),
      }
    }
    if (token.kind === "paren" && token.value === "(") {
      const nested = parseExpression()
      const close = consume()
      if (!close || close.kind !== "paren" || close.value !== ")") {
        throwFormulaError(
          `Missing ')' for group at position ${token.position + 1}.`,
          createFormulaSourceSpan(token.position, token.end),
        )
      }
      return nested
    }
    throwFormulaError(
      `Unexpected token at position ${token.position + 1}.`,
      createFormulaSourceSpan(token.position, token.end),
    )
  }

  const parseUnary = (): DataGridFormulaAstNode => {
    const token = peek()
    if (
      token
      && token.kind === "operator"
      && (token.value === "-" || token.value === "+" || token.value === "NOT")
    ) {
      consume()
      const value = parseUnary()
      return {
        kind: "unary",
        operator: token.value,
        value,
        span: createFormulaSourceSpan(token.position, value.span.end),
      }
    }
    return parsePrimary()
  }

  const parseMulDiv = (): DataGridFormulaAstNode => {
    let node = parseUnary()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || (token.value !== "*" && token.value !== "/")) {
        break
      }
      consume()
      const right = parseUnary()
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseAddSub = (): DataGridFormulaAstNode => {
    let node = parseMulDiv()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || (token.value !== "+" && token.value !== "-")) {
        break
      }
      consume()
      const right = parseMulDiv()
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseComparison = (): DataGridFormulaAstNode => {
    let node = parseAddSub()
    while (true) {
      const token = peek()
      if (
        !token
        || token.kind !== "operator"
        || (
          token.value !== ">"
          && token.value !== "<"
          && token.value !== ">="
          && token.value !== "<="
          && token.value !== "=="
          && token.value !== "!="
        )
      ) {
        break
      }
      consume()
      const right = parseAddSub()
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseAnd = (): DataGridFormulaAstNode => {
    let node = parseComparison()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || token.value !== "AND") {
        break
      }
      consume()
      const right = parseComparison()
      node = {
        kind: "binary",
        operator: "AND",
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseOr = (): DataGridFormulaAstNode => {
    let node = parseAnd()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || token.value !== "OR") {
        break
      }
      consume()
      const right = parseAnd()
      node = {
        kind: "binary",
        operator: "OR",
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const root = parseExpression()
  if (cursor < tokens.length) {
    const token = tokens[cursor]
    if (!token) {
      throwFormulaError("Unexpected trailing expression.", createFormulaSourceSpan(0, 0))
    }
    throwFormulaError(
      `Unexpected token at position ${token.position + 1}.`,
      createFormulaSourceSpan(token.position, token.end),
    )
  }
  return root
}
