export type DataGridDependencyTokenDomain = "field" | "computed" | "meta"
export type DataGridDependencyToken =
  | `field:${string}`
  | `computed:${string}`
  | `meta:${string}`

export interface DataGridFieldNode {
  kind: "field"
  token: `field:${string}`
  path: string
}

export interface DataGridComputedNode {
  kind: "computed"
  token: `computed:${string}`
  name: string
}

export interface DataGridMetaNode {
  kind: "meta"
  token: `meta:${string}`
  key: string
}

export type DataGridDependencyNode =
  | DataGridFieldNode
  | DataGridComputedNode
  | DataGridMetaNode

export type DataGridDependencyEdgeKind = "structural" | "computed"

export interface DataGridDependencyEdge {
  kind: DataGridDependencyEdgeKind
  source: DataGridDependencyNode
  target: DataGridDependencyNode
}

export interface CreateDataGridDependencyEdgeInput {
  sourceToken: string
  targetToken: string
  kind?: DataGridDependencyEdgeKind
  sourceFallbackDomain?: DataGridDependencyTokenDomain
  targetFallbackDomain?: DataGridDependencyTokenDomain
}

function parseTokenParts(
  token: string,
  fallbackDomain: DataGridDependencyTokenDomain,
): {
  domain: DataGridDependencyTokenDomain
  value: string
} {
  const normalized = token.trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridDependencyModel] Dependency token must be non-empty.")
  }
  const separatorIndex = normalized.indexOf(":")
  if (separatorIndex <= 0) {
    return {
      domain: fallbackDomain,
      value: normalized,
    }
  }
  const domain = normalized.slice(0, separatorIndex).trim()
  const value = normalized.slice(separatorIndex + 1).trim()
  if (!isDataGridDependencyTokenDomain(domain)) {
    return {
      domain: fallbackDomain,
      value: normalized,
    }
  }
  if (value.length === 0) {
    throw new Error(`[DataGridDependencyModel] Dependency token '${normalized}' has empty payload.`)
  }
  return {
    domain,
    value,
  }
}

export function isDataGridDependencyTokenDomain(
  value: string,
): value is DataGridDependencyTokenDomain {
  return value === "field" || value === "computed" || value === "meta"
}

export function normalizeDataGridDependencyToken(
  token: string,
  fallbackDomain: DataGridDependencyTokenDomain = "field",
): DataGridDependencyToken {
  const parsed = parseTokenParts(token, fallbackDomain)
  return `${parsed.domain}:${parsed.value}`
}

export function parseDataGridDependencyNode(
  token: string,
  fallbackDomain: DataGridDependencyTokenDomain = "field",
): DataGridDependencyNode {
  const parsed = parseTokenParts(token, fallbackDomain)
  const domain = parsed.domain
  const value = parsed.value
  if (domain === "computed") {
    const computedToken: `computed:${string}` = `computed:${value}`
    return {
      kind: "computed",
      token: computedToken,
      name: value,
    }
  }
  if (domain === "meta") {
    const metaToken: `meta:${string}` = `meta:${value}`
    return {
      kind: "meta",
      token: metaToken,
      key: value,
    }
  }
  const fieldToken: `field:${string}` = `field:${value}`
  return {
    kind: "field",
    token: fieldToken,
    path: value,
  }
}

export function createDataGridDependencyEdge(
  input: CreateDataGridDependencyEdgeInput,
): DataGridDependencyEdge {
  const sourceFallbackDomain = input.sourceFallbackDomain ?? "field"
  const targetFallbackDomain = input.targetFallbackDomain ?? "field"
  return {
    kind: input.kind ?? "structural",
    source: parseDataGridDependencyNode(input.sourceToken, sourceFallbackDomain),
    target: parseDataGridDependencyNode(input.targetToken, targetFallbackDomain),
  }
}
