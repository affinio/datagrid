function parseFiniteNumber(draft) {
    const value = Number(draft);
    return Number.isFinite(value) ? value : null;
}
export function useDataGridEditableValuePolicy(options) {
    const policyKeys = new Set(Object.keys(options.strategies));
    const defaultClearable = options.defaultClearable ?? true;
    function hasEditablePolicy(columnKey) {
        return policyKeys.has(columnKey);
    }
    function resolveStrategy(columnKey) {
        return options.strategies[columnKey] ?? null;
    }
    function applyEditedValue(row, columnKey, draft) {
        const strategy = resolveStrategy(columnKey);
        if (!strategy) {
            return;
        }
        if (strategy.kind === "text") {
            strategy.apply(row, draft);
            return;
        }
        if (strategy.kind === "enum") {
            if (!strategy.isAllowed(draft)) {
                return;
            }
            strategy.apply(row, draft);
            return;
        }
        const parsed = strategy.parse ? strategy.parse(draft) : parseFiniteNumber(draft);
        if (parsed === null) {
            return;
        }
        strategy.apply(row, parsed);
    }
    function canApplyPastedValue(columnKey, draft) {
        const strategy = resolveStrategy(columnKey);
        if (!strategy) {
            return false;
        }
        if (strategy.kind === "text") {
            return strategy.canPaste ? strategy.canPaste(draft) : draft.trim().length > 0;
        }
        if (strategy.kind === "enum") {
            return strategy.isAllowed(draft);
        }
        const parsed = strategy.parse ? strategy.parse(draft) : parseFiniteNumber(draft);
        return parsed !== null;
    }
    function isColumnClearableForCut(columnKey) {
        const strategy = resolveStrategy(columnKey);
        if (!strategy || typeof strategy.clearable === "undefined") {
            return defaultClearable;
        }
        return strategy.clearable;
    }
    function clearEditedValue(row, columnKey) {
        const strategy = resolveStrategy(columnKey);
        if (!strategy) {
            return false;
        }
        if (strategy.clear) {
            return strategy.clear(row);
        }
        if (!isColumnClearableForCut(columnKey)) {
            return false;
        }
        if (strategy.kind === "text") {
            const record = row;
            const current = record[columnKey];
            if (current == null || String(current) === "") {
                return false;
            }
            record[columnKey] = "";
            return true;
        }
        if (strategy.kind === "number") {
            const record = row;
            const current = record[columnKey];
            if (typeof current !== "number" || current === 0) {
                return false;
            }
            record[columnKey] = 0;
            return true;
        }
        return false;
    }
    return {
        hasEditablePolicy,
        applyEditedValue,
        canApplyPastedValue,
        isColumnClearableForCut,
        clearEditedValue,
    };
}
