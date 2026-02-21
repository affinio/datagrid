function normalizeText(value) {
    if (value == null) {
        return "";
    }
    return String(value);
}
function normalizeOperator(operator) {
    return typeof operator === "string" ? operator.trim().toLowerCase() : "equals";
}
function normalizeConditionType(type) {
    if (type === "number" || type === "date" || type === "set" || type === "boolean" || type === "text") {
        return type;
    }
    return "text";
}
function toComparableNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (/[T:-]/.test(trimmed)) {
            const parsedDate = Date.parse(trimmed);
            if (Number.isFinite(parsedDate)) {
                return parsedDate;
            }
        }
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function toBoolean(value) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (value === 1)
            return true;
        if (value === 0)
            return false;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "y", "on"].includes(normalized)) {
            return true;
        }
        if (["false", "0", "no", "n", "off"].includes(normalized)) {
            return false;
        }
    }
    return null;
}
function toArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map(chunk => chunk.trim())
            .filter(Boolean);
    }
    return [value];
}
function isNullish(value) {
    return value === null || typeof value === "undefined";
}
function isEmpty(value) {
    if (isNullish(value)) {
        return true;
    }
    if (typeof value === "string") {
        return value.trim().length === 0;
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    return false;
}
function compareUnknown(left, right) {
    if (left == null && right == null) {
        return 0;
    }
    if (left == null) {
        return -1;
    }
    if (right == null) {
        return 1;
    }
    const leftNumber = toComparableNumber(left);
    const rightNumber = toComparableNumber(right);
    if (leftNumber != null && rightNumber != null) {
        return leftNumber - rightNumber;
    }
    const leftText = normalizeText(left);
    const rightText = normalizeText(right);
    return leftText.localeCompare(rightText);
}
function evaluateCondition(condition, candidate) {
    const operator = normalizeOperator(condition.operator);
    const type = normalizeConditionType(condition.type);
    if (operator === "is-empty" || operator === "empty") {
        return isEmpty(candidate);
    }
    if (operator === "not-empty" || operator === "is-not-empty") {
        return !isEmpty(candidate);
    }
    if (operator === "is-null" || operator === "null") {
        return isNullish(candidate);
    }
    if (operator === "not-null" || operator === "is-not-null") {
        return !isNullish(candidate);
    }
    if (type === "boolean") {
        const left = toBoolean(candidate);
        if (operator === "is-true") {
            return left === true;
        }
        if (operator === "is-false") {
            return left === false;
        }
        const right = toBoolean(condition.value);
        if (right == null || left == null) {
            return false;
        }
        if (operator === "ne" || operator === "not-equals" || operator === "notequals" || operator === "is-not") {
            return left !== right;
        }
        return left === right;
    }
    if (type === "number" || type === "date") {
        const left = toComparableNumber(candidate);
        if (left == null) {
            return false;
        }
        const right = toComparableNumber(condition.value);
        const right2 = toComparableNumber(condition.value2);
        if ((operator === "between" || operator === "range") && right != null && right2 != null) {
            const min = Math.min(right, right2);
            const max = Math.max(right, right2);
            return left >= min && left <= max;
        }
        if (operator === "in" || operator === "not-in" || operator === "notin") {
            const candidates = toArray(condition.value)
                .map(value => toComparableNumber(value))
                .filter((value) => value != null);
            const has = candidates.includes(left);
            if (operator === "in") {
                return has;
            }
            return !has;
        }
        if (right == null) {
            return false;
        }
        if (operator === "eq" || operator === "equals" || operator === "is") {
            return left === right;
        }
        if (operator === "ne" || operator === "not-equals" || operator === "notequals" || operator === "is-not") {
            return left !== right;
        }
        if (operator === "gt" || operator === ">") {
            return left > right;
        }
        if (operator === "gte" || operator === ">=") {
            return left >= right;
        }
        if (operator === "lt" || operator === "<") {
            return left < right;
        }
        if (operator === "lte" || operator === "<=") {
            return left <= right;
        }
        return false;
    }
    if (type === "set") {
        const normalizedSet = new Set(toArray(condition.value)
            .map(value => normalizeText(value).toLowerCase()));
        const candidateValues = Array.isArray(candidate)
            ? candidate.map(value => normalizeText(value).toLowerCase())
            : [normalizeText(candidate).toLowerCase()];
        const hasMatch = candidateValues.some(value => normalizedSet.has(value));
        if (operator === "has-all" || operator === "all") {
            if (normalizedSet.size === 0) {
                return false;
            }
            return Array.from(normalizedSet).every(value => candidateValues.includes(value));
        }
        if (operator === "contains" ||
            operator === "has-any" ||
            operator === "any" ||
            operator === "in" ||
            operator === "eq" ||
            operator === "equals" ||
            operator === "is") {
            return hasMatch;
        }
        if (operator === "not-in" || operator === "notin" || operator === "ne" || operator === "is-not") {
            return !hasMatch;
        }
        return hasMatch;
    }
    const left = normalizeText(candidate).toLowerCase();
    const right = normalizeText(condition.value).toLowerCase();
    if (operator === "in" || operator === "not-in" || operator === "notin") {
        const candidates = toArray(condition.value)
            .map(value => normalizeText(value).toLowerCase());
        const has = candidates.includes(left);
        if (operator === "in") {
            return has;
        }
        return !has;
    }
    if (operator === "eq" || operator === "equals" || operator === "is") {
        return left === right;
    }
    if (operator === "ne" || operator === "not-equals" || operator === "notequals" || operator === "is-not") {
        return left !== right;
    }
    if (operator === "contains") {
        return left.includes(right);
    }
    if (operator === "startswith" || operator === "starts-with") {
        return left.startsWith(right);
    }
    if (operator === "endswith" || operator === "ends-with") {
        return left.endsWith(right);
    }
    if (operator === "regex" || operator === "matches") {
        try {
            const expression = new RegExp(normalizeText(condition.value), "i");
            return expression.test(normalizeText(candidate));
        }
        catch {
            return false;
        }
    }
    if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
        const compared = compareUnknown(candidate, condition.value);
        if (operator === "gt")
            return compared > 0;
        if (operator === "gte")
            return compared >= 0;
        if (operator === "lt")
            return compared < 0;
        return compared <= 0;
    }
    return true;
}
function normalizeClauseJoin(join) {
    return String(join ?? "and").toLowerCase() === "or" ? "or" : "and";
}
function normalizeClause(key, type, clause) {
    return {
        kind: "condition",
        key,
        type,
        operator: normalizeOperator(clause.operator),
        value: clause.value,
        value2: clause.value2,
    };
}
function normalizeGroupOperator(operator) {
    return String(operator ?? "and").toLowerCase() === "or" ? "or" : "and";
}
function normalizeCondition(input) {
    const key = typeof input.key === "string" ? input.key.trim() : "";
    if (!key) {
        return null;
    }
    return {
        kind: "condition",
        key,
        field: typeof input.field === "string" && input.field.trim().length > 0 ? input.field.trim() : undefined,
        type: normalizeConditionType(input.type),
        operator: normalizeOperator(input.operator),
        value: input.value,
        value2: input.value2,
    };
}
function normalizeGroup(input) {
    const children = (Array.isArray(input.children) ? input.children : [])
        .map(child => normalizeDataGridAdvancedFilterExpression(child))
        .filter((child) => child != null);
    if (children.length === 0) {
        return null;
    }
    if (children.length === 1) {
        const only = children[0];
        if (only && only.kind === "group") {
            return {
                kind: "group",
                operator: normalizeGroupOperator(input.operator),
                children: only.children,
            };
        }
    }
    return {
        kind: "group",
        operator: normalizeGroupOperator(input.operator),
        children,
    };
}
function normalizeNot(input) {
    const child = normalizeDataGridAdvancedFilterExpression(input.child);
    if (!child) {
        return null;
    }
    return {
        kind: "not",
        child,
    };
}
export function normalizeDataGridAdvancedFilterExpression(expression) {
    if (!expression || typeof expression !== "object") {
        return null;
    }
    if (expression.kind === "condition") {
        return normalizeCondition(expression);
    }
    if (expression.kind === "group") {
        return normalizeGroup(expression);
    }
    if (expression.kind === "not") {
        return normalizeNot(expression);
    }
    return null;
}
export function buildDataGridAdvancedFilterExpressionFromLegacyFilters(advancedFilters) {
    if (!advancedFilters) {
        return null;
    }
    const perColumnExpressions = [];
    for (const [key, advanced] of Object.entries(advancedFilters)) {
        if (!advanced || !Array.isArray(advanced.clauses) || advanced.clauses.length === 0) {
            continue;
        }
        let current = normalizeClause(key, advanced.type, advanced.clauses[0]);
        for (let index = 1; index < advanced.clauses.length; index += 1) {
            const clause = advanced.clauses[index];
            if (!clause) {
                continue;
            }
            const next = normalizeClause(key, advanced.type, clause);
            const join = normalizeClauseJoin(clause.join);
            if (!current) {
                current = next;
                continue;
            }
            current = {
                kind: "group",
                operator: join,
                children: [current, next],
            };
        }
        const normalized = normalizeDataGridAdvancedFilterExpression(current);
        if (normalized) {
            perColumnExpressions.push(normalized);
        }
    }
    if (perColumnExpressions.length === 0) {
        return null;
    }
    if (perColumnExpressions.length === 1) {
        return perColumnExpressions[0];
    }
    return {
        kind: "group",
        operator: "and",
        children: perColumnExpressions,
    };
}
export function evaluateDataGridAdvancedFilterExpression(expression, resolve) {
    const normalized = normalizeDataGridAdvancedFilterExpression(expression);
    if (!normalized) {
        return true;
    }
    if (normalized.kind === "condition") {
        const candidate = resolve(normalized);
        return evaluateCondition(normalized, candidate);
    }
    if (normalized.kind === "not") {
        return !evaluateDataGridAdvancedFilterExpression(normalized.child, resolve);
    }
    if (normalized.operator === "or") {
        for (const child of normalized.children) {
            if (evaluateDataGridAdvancedFilterExpression(child, resolve)) {
                return true;
            }
        }
        return false;
    }
    for (const child of normalized.children) {
        if (!evaluateDataGridAdvancedFilterExpression(child, resolve)) {
            return false;
        }
    }
    return true;
}
export function cloneDataGridFilterSnapshot(input) {
    if (!input) {
        return null;
    }
    return {
        columnFilters: Object.fromEntries(Object.entries(input.columnFilters ?? {}).map(([key, values]) => [key, [...values]])),
        advancedFilters: Object.fromEntries(Object.entries(input.advancedFilters ?? {}).map(([key, condition]) => [
            key,
            {
                ...condition,
                clauses: Array.isArray(condition?.clauses)
                    ? condition.clauses.map(clause => ({ ...clause }))
                    : [],
            },
        ])),
        advancedExpression: cloneDataGridAdvancedFilterExpression(input.advancedExpression ?? null),
    };
}
function cloneDataGridAdvancedFilterExpression(expression) {
    if (!expression || typeof expression !== "object") {
        return null;
    }
    if (expression.kind === "condition") {
        return { ...expression };
    }
    if (expression.kind === "not") {
        return {
            ...expression,
            child: cloneDataGridAdvancedFilterExpression(expression.child) ?? expression.child,
        };
    }
    if (expression.kind === "group") {
        const children = Array.isArray(expression.children)
            ? expression.children
                .map(child => cloneDataGridAdvancedFilterExpression(child))
                .filter((child) => child != null)
            : [];
        return {
            ...expression,
            children,
        };
    }
    return null;
}
