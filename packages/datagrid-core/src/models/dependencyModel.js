function parseTokenParts(token, fallbackDomain) {
    const normalized = token.trim();
    if (normalized.length === 0) {
        throw new Error("[DataGridDependencyModel] Dependency token must be non-empty.");
    }
    const separatorIndex = normalized.indexOf(":");
    if (separatorIndex <= 0) {
        return {
            domain: fallbackDomain,
            value: normalized,
        };
    }
    const domain = normalized.slice(0, separatorIndex).trim();
    const value = normalized.slice(separatorIndex + 1).trim();
    if (!isDataGridDependencyTokenDomain(domain)) {
        return {
            domain: fallbackDomain,
            value: normalized,
        };
    }
    if (value.length === 0) {
        throw new Error(`[DataGridDependencyModel] Dependency token '${normalized}' has empty payload.`);
    }
    return {
        domain,
        value,
    };
}
export function isDataGridDependencyTokenDomain(value) {
    return value === "field" || value === "computed" || value === "meta";
}
export function normalizeDataGridDependencyToken(token, fallbackDomain = "field") {
    const parsed = parseTokenParts(token, fallbackDomain);
    return `${parsed.domain}:${parsed.value}`;
}
export function parseDataGridDependencyNode(token, fallbackDomain = "field") {
    const parsed = parseTokenParts(token, fallbackDomain);
    const domain = parsed.domain;
    const value = parsed.value;
    if (domain === "computed") {
        const computedToken = `computed:${value}`;
        return {
            kind: "computed",
            token: computedToken,
            name: value,
        };
    }
    if (domain === "meta") {
        const metaToken = `meta:${value}`;
        return {
            kind: "meta",
            token: metaToken,
            key: value,
        };
    }
    const fieldToken = `field:${value}`;
    return {
        kind: "field",
        token: fieldToken,
        path: value,
    };
}
export function createDataGridDependencyEdge(input) {
    const sourceFallbackDomain = input.sourceFallbackDomain ?? "field";
    const targetFallbackDomain = input.targetFallbackDomain ?? "field";
    return {
        kind: input.kind ?? "structural",
        source: parseDataGridDependencyNode(input.sourceToken, sourceFallbackDomain),
        target: parseDataGridDependencyNode(input.targetToken, targetFallbackDomain),
    };
}
