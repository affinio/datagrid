export const DATA_GRID_TEXT_FILTER_OPERATOR_OPTIONS = [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "starts-with", label: "Starts with" },
    { value: "in-list", label: "In list" },
    { value: "not-in-list", label: "Not in list" },
];
export const DATA_GRID_ENUM_FILTER_OPERATOR_OPTIONS = [
    { value: "is", label: "Is" },
    { value: "is-not", label: "Is not" },
    { value: "in-list", label: "In list" },
    { value: "not-in-list", label: "Not in list" },
];
export const DATA_GRID_NUMBER_FILTER_OPERATOR_OPTIONS = [
    { value: "equals", label: "=" },
    { value: "gt", label: ">" },
    { value: "gte", label: ">=" },
    { value: "lt", label: "<" },
    { value: "lte", label: "<=" },
    { value: "between", label: "Between" },
];
function defaultFilterOperator(kind) {
    if (kind === "number")
        return "equals";
    if (kind === "enum")
        return "is";
    return "contains";
}
function resolveDefaultInputValue(value) {
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }
    if (value && typeof value === "object") {
        const target = value.target;
        if (target && typeof target.value !== "undefined") {
            return String(target.value ?? "");
        }
    }
    return "";
}
function parseFilterValueList(raw) {
    const normalized = raw.trim();
    if (!normalized) {
        return [];
    }
    try {
        const parsed = JSON.parse(normalized);
        if (!Array.isArray(parsed)) {
            return [normalized];
        }
        return parsed
            .map(item => String(item ?? "").trim())
            .filter(Boolean);
    }
    catch {
        return [normalized];
    }
}
function matchTextFilter(value, operator, rawExpected) {
    const haystack = String(value ?? "").toLowerCase();
    const expected = rawExpected.toLowerCase();
    if (operator === "in-list" || operator === "not-in-list") {
        const list = parseFilterValueList(rawExpected).map(entry => entry.toLowerCase());
        const contains = list.includes(haystack);
        return operator === "not-in-list" ? !contains : contains;
    }
    if (operator === "equals") {
        return haystack === expected;
    }
    if (operator === "starts-with") {
        return haystack.startsWith(expected);
    }
    return haystack.includes(expected);
}
function matchEnumFilter(value, operator, rawExpected) {
    const current = String(value ?? "").toLowerCase();
    if (operator === "in-list" || operator === "not-in-list") {
        const list = parseFilterValueList(rawExpected).map(entry => entry.toLowerCase());
        const contains = list.includes(current);
        return operator === "not-in-list" ? !contains : contains;
    }
    const expected = rawExpected.toLowerCase();
    if (operator === "is-not") {
        return current !== expected;
    }
    return current === expected;
}
function matchNumberFilter(value, operator, rawExpected, rawExpected2) {
    const current = Number(value);
    const expected = Number(rawExpected);
    if (!Number.isFinite(current) || !Number.isFinite(expected)) {
        return false;
    }
    if (operator === "gt")
        return current > expected;
    if (operator === "gte")
        return current >= expected;
    if (operator === "lt")
        return current < expected;
    if (operator === "lte")
        return current <= expected;
    if (operator === "between") {
        const second = Number(rawExpected2);
        if (!Number.isFinite(second)) {
            return false;
        }
        const lower = Math.min(expected, second);
        const upper = Math.max(expected, second);
        return current >= lower && current <= upper;
    }
    return current === expected;
}
export function useDataGridColumnFilterOrchestration(options) {
    let activeFilterColumnKey = null;
    let columnFilterDraft = null;
    let appliedColumnFilters = {
        ...(options.initialAppliedFilters ?? {}),
    };
    const listeners = new Set();
    const resolveInputValue = options.resolveInputValue ?? resolveDefaultInputValue;
    function doesOperatorNeedSecondValue(kind, operator) {
        return kind === "number" && operator === "between";
    }
    function doesFilterDraftHaveRequiredValues(draft) {
        if (draft.operator === "in-list" || draft.operator === "not-in-list") {
            return parseFilterValueList(draft.value).length > 0;
        }
        if (!draft.value.trim()) {
            return false;
        }
        if (doesOperatorNeedSecondValue(draft.kind, draft.operator) && !draft.value2.trim()) {
            return false;
        }
        return true;
    }
    function resolveOperatorOptions(draft) {
        if (!draft) {
            return [];
        }
        if (draft.kind === "number") {
            return DATA_GRID_NUMBER_FILTER_OPERATOR_OPTIONS;
        }
        if (draft.kind === "enum") {
            return DATA_GRID_ENUM_FILTER_OPERATOR_OPTIONS;
        }
        return DATA_GRID_TEXT_FILTER_OPERATOR_OPTIONS;
    }
    function createSnapshot() {
        const activeColumnFilterCount = Object.keys(appliedColumnFilters).length;
        return {
            activeFilterColumnKey,
            columnFilterDraft,
            appliedColumnFilters,
            activeColumnFilterCount,
            hasColumnFilters: activeColumnFilterCount > 0,
            activeFilterColumnLabel: activeFilterColumnKey
                ? (options.resolveColumnLabel(activeFilterColumnKey) ?? activeFilterColumnKey)
                : "none",
            columnFilterOperatorOptions: resolveOperatorOptions(columnFilterDraft),
            activeColumnFilterEnumOptions: columnFilterDraft?.kind === "enum"
                ? options.resolveEnumFilterOptions(columnFilterDraft.columnKey)
                : [],
            canApplyActiveColumnFilter: columnFilterDraft ? doesFilterDraftHaveRequiredValues(columnFilterDraft) : false,
        };
    }
    function emit() {
        const snapshot = createSnapshot();
        listeners.forEach(listener => listener(snapshot));
    }
    function subscribe(listener) {
        listeners.add(listener);
        listener(createSnapshot());
        return () => {
            listeners.delete(listener);
        };
    }
    function closeColumnFilterPanel() {
        activeFilterColumnKey = null;
        columnFilterDraft = null;
        emit();
    }
    function openColumnFilter(columnKey) {
        if (options.isFilterableColumn && !options.isFilterableColumn(columnKey)) {
            return;
        }
        const kind = options.resolveColumnFilterKind(columnKey);
        const current = appliedColumnFilters[columnKey];
        const enumOptions = kind === "enum" ? options.resolveEnumFilterOptions(columnKey) : [];
        columnFilterDraft = {
            columnKey,
            kind,
            operator: current?.operator ?? defaultFilterOperator(kind),
            value: current?.value ?? (enumOptions[0] ?? ""),
            value2: current?.value2 ?? "",
        };
        activeFilterColumnKey = columnKey;
        emit();
    }
    function onHeaderFilterTriggerClick(columnKey) {
        if (activeFilterColumnKey === columnKey) {
            closeColumnFilterPanel();
            return;
        }
        openColumnFilter(columnKey);
    }
    function onFilterOperatorChange(value) {
        if (!columnFilterDraft) {
            return;
        }
        const nextOperator = String(value);
        columnFilterDraft = {
            ...columnFilterDraft,
            operator: nextOperator,
            value2: doesOperatorNeedSecondValue(columnFilterDraft.kind, nextOperator) ? columnFilterDraft.value2 : "",
        };
        emit();
    }
    function onFilterEnumValueChange(value) {
        if (!columnFilterDraft) {
            return;
        }
        columnFilterDraft = {
            ...columnFilterDraft,
            value: String(value),
        };
        emit();
    }
    function onFilterValueInput(value) {
        if (!columnFilterDraft) {
            return;
        }
        columnFilterDraft = {
            ...columnFilterDraft,
            value: resolveInputValue(value),
        };
        emit();
    }
    function onFilterSecondValueInput(value) {
        if (!columnFilterDraft) {
            return;
        }
        columnFilterDraft = {
            ...columnFilterDraft,
            value2: resolveInputValue(value),
        };
        emit();
    }
    function applyActiveColumnFilter() {
        if (!columnFilterDraft) {
            return;
        }
        const draft = columnFilterDraft;
        const next = { ...appliedColumnFilters };
        if (!doesFilterDraftHaveRequiredValues(draft)) {
            delete next[draft.columnKey];
            appliedColumnFilters = next;
            options.setLastAction?.(`Cleared filter for ${draft.columnKey}`);
            closeColumnFilterPanel();
            return;
        }
        next[draft.columnKey] = {
            kind: draft.kind,
            operator: draft.operator,
            value: draft.value.trim(),
            value2: draft.value2.trim() || undefined,
        };
        appliedColumnFilters = next;
        options.setLastAction?.(`Filter applied: ${draft.columnKey}`);
        closeColumnFilterPanel();
    }
    function resetActiveColumnFilter() {
        if (!columnFilterDraft) {
            return;
        }
        const next = { ...appliedColumnFilters };
        delete next[columnFilterDraft.columnKey];
        appliedColumnFilters = next;
        options.setLastAction?.(`Filter reset: ${columnFilterDraft.columnKey}`);
        closeColumnFilterPanel();
    }
    function clearAllColumnFilters() {
        if (!Object.keys(appliedColumnFilters).length) {
            closeColumnFilterPanel();
            return;
        }
        appliedColumnFilters = {};
        options.setLastAction?.("All column filters cleared");
        closeColumnFilterPanel();
    }
    function isColumnFilterActive(columnKey) {
        return Boolean(appliedColumnFilters[columnKey]);
    }
    function buildFilterSnapshot(filters) {
        const keys = Object.keys(filters);
        if (!keys.length) {
            return null;
        }
        return {
            columnFilters: {},
            advancedFilters: Object.fromEntries(keys.map(key => {
                const filter = filters[key];
                const type = filter?.kind === "number" ? "number" : "text";
                return [
                    key,
                    {
                        type,
                        clauses: [
                            {
                                operator: filter?.operator ?? "equals",
                                value: filter?.value ?? "",
                                value2: filter?.value2,
                            },
                        ],
                    },
                ];
            })),
        };
    }
    function rowMatchesColumnFilters(row, filters) {
        for (const [columnKey, filter] of Object.entries(filters)) {
            const value = options.resolveCellValue(row, columnKey);
            if (filter.kind === "number") {
                if (!matchNumberFilter(value, filter.operator, filter.value, filter.value2)) {
                    return false;
                }
                continue;
            }
            if (filter.kind === "enum") {
                if (!matchEnumFilter(value, filter.operator, filter.value)) {
                    return false;
                }
                continue;
            }
            if (!matchTextFilter(value, filter.operator, filter.value)) {
                return false;
            }
        }
        return true;
    }
    return {
        getSnapshot: createSnapshot,
        subscribe,
        isColumnFilterActive,
        openColumnFilter,
        onHeaderFilterTriggerClick,
        closeColumnFilterPanel,
        onFilterOperatorChange,
        onFilterEnumValueChange,
        onFilterValueInput,
        onFilterSecondValueInput,
        doesOperatorNeedSecondValue,
        doesFilterDraftHaveRequiredValues,
        applyActiveColumnFilter,
        resetActiveColumnFilter,
        clearAllColumnFilters,
        buildFilterSnapshot,
        rowMatchesColumnFilters,
    };
}
