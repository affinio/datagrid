function readByPathSegments(value, segments) {
    if (segments.length === 0 || typeof value !== "object" || value === null) {
        return undefined;
    }
    let current = value;
    for (const segment of segments) {
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= current.length) {
                return undefined;
            }
            current = current[index];
            continue;
        }
        if (typeof current !== "object" || current === null || !(segment in current)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
function compileRowFieldReader(key, field) {
    const resolvedField = field && field.trim().length > 0 ? field.trim() : key.trim();
    if (!resolvedField) {
        return () => undefined;
    }
    const segments = resolvedField.includes(".")
        ? resolvedField.split(".").filter(Boolean)
        : [];
    return (rowNode) => {
        const source = rowNode.data;
        const directValue = typeof source === "object" && source !== null
            ? source[resolvedField]
            : undefined;
        if (typeof directValue !== "undefined") {
            return directValue;
        }
        if (segments.length === 0) {
            return undefined;
        }
        return readByPathSegments(source, segments);
    };
}
function toComparableNumber(value) {
    if (value == null) {
        return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function compareUnknown(left, right) {
    if (left == null && right == null) {
        return 0;
    }
    if (left == null) {
        return 1;
    }
    if (right == null) {
        return -1;
    }
    const leftNumber = toComparableNumber(left);
    const rightNumber = toComparableNumber(right);
    if (leftNumber != null && rightNumber != null) {
        return leftNumber - rightNumber;
    }
    return String(left).localeCompare(String(right));
}
function normalizeNumber(value) {
    return toComparableNumber(value);
}
function coerceForOp(op, value, coerce) {
    if (typeof coerce === "function") {
        return coerce(value);
    }
    if (op === "sum" || op === "avg") {
        return normalizeNumber(value);
    }
    if (op === "min" || op === "max") {
        const numeric = normalizeNumber(value);
        if (numeric != null) {
            return numeric;
        }
        if (value == null) {
            return null;
        }
        return String(value);
    }
    return value;
}
function compileColumnSpec(spec) {
    const key = spec.key.trim();
    if (key.length === 0) {
        return null;
    }
    const op = spec.op;
    const readValue = compileRowFieldReader(spec.key, spec.field);
    if (op === "custom") {
        const createState = typeof spec.createState === "function" ? spec.createState : (() => null);
        const add = typeof spec.add === "function" ? spec.add : (() => { });
        const finalize = typeof spec.finalize === "function" ? spec.finalize : ((state) => state);
        const merge = typeof spec.merge === "function" ? spec.merge : undefined;
        return {
            key,
            op,
            readValue,
            createState,
            add: (state, value, row) => {
                add(state, value, row);
            },
            merge: merge
                ? ((state, childState) => {
                    merge(state, childState);
                })
                : undefined,
            remove: spec.remove,
            finalize: (state) => finalize(state),
        };
    }
    const readAggregatedValue = (row) => {
        const raw = readValue(row);
        return coerceForOp(op, raw, spec.coerce);
    };
    let createBuiltInState;
    let addBuiltInValue;
    let mergeBuiltInState;
    let finalize;
    switch (op) {
        case "sum":
            createBuiltInState = () => ({ value: 0 });
            addBuiltInValue = (state, value) => {
                const candidate = normalizeNumber(value);
                if (candidate != null) {
                    ;
                    state.value += candidate;
                }
            };
            mergeBuiltInState = (state, childState) => {
                ;
                state.value += childState.value;
            };
            finalize = state => state.value;
            break;
        case "avg":
            createBuiltInState = () => ({ sum: 0, count: 0 });
            addBuiltInValue = (state, value) => {
                const candidate = normalizeNumber(value);
                if (candidate != null) {
                    const avgState = state;
                    avgState.sum += candidate;
                    avgState.count += 1;
                }
            };
            mergeBuiltInState = (state, childState) => {
                const target = state;
                const child = childState;
                target.sum += child.sum;
                target.count += child.count;
            };
            finalize = state => {
                const avgState = state;
                return avgState.count > 0 ? avgState.sum / avgState.count : null;
            };
            break;
        case "count":
            createBuiltInState = () => ({ value: 0 });
            addBuiltInValue = (state) => {
                ;
                state.value += 1;
            };
            mergeBuiltInState = (state, childState) => {
                ;
                state.value += childState.value;
            };
            finalize = state => state.value;
            break;
        case "countNonNull":
            createBuiltInState = () => ({ value: 0 });
            addBuiltInValue = (state, value) => {
                // countNonNull is intentionally evaluated after `coerce`/readValue normalization.
                if (value != null) {
                    ;
                    state.value += 1;
                }
            };
            mergeBuiltInState = (state, childState) => {
                ;
                state.value += childState.value;
            };
            finalize = state => state.value;
            break;
        case "min":
            createBuiltInState = () => ({ value: null });
            addBuiltInValue = (state, value) => {
                if (value == null) {
                    return;
                }
                const current = state;
                if (current.value == null || compareUnknown(value, current.value) < 0) {
                    current.value = value;
                }
            };
            mergeBuiltInState = (state, childState) => {
                const childValue = childState.value;
                if (childValue == null) {
                    return;
                }
                const current = state;
                if (current.value == null || compareUnknown(childValue, current.value) < 0) {
                    current.value = childValue;
                }
            };
            finalize = state => state.value ?? null;
            break;
        case "max":
            createBuiltInState = () => ({ value: null });
            addBuiltInValue = (state, value) => {
                if (value == null) {
                    return;
                }
                const current = state;
                if (current.value == null || compareUnknown(value, current.value) > 0) {
                    current.value = value;
                }
            };
            mergeBuiltInState = (state, childState) => {
                const childValue = childState.value;
                if (childValue == null) {
                    return;
                }
                const current = state;
                if (current.value == null || compareUnknown(childValue, current.value) > 0) {
                    current.value = childValue;
                }
            };
            finalize = state => state.value ?? null;
            break;
        case "first":
            createBuiltInState = () => ({ hasValue: false, value: undefined });
            addBuiltInValue = (state, value) => {
                const firstState = state;
                if (!firstState.hasValue) {
                    firstState.hasValue = true;
                    firstState.value = value;
                }
            };
            mergeBuiltInState = (state, childState) => {
                const target = state;
                const child = childState;
                if (!target.hasValue && child.hasValue) {
                    target.hasValue = true;
                    target.value = child.value;
                }
            };
            finalize = state => {
                const firstState = state;
                return firstState.hasValue ? firstState.value : null;
            };
            break;
        case "last":
            createBuiltInState = () => ({ hasValue: false, value: undefined });
            addBuiltInValue = (state, value) => {
                const lastState = state;
                lastState.hasValue = true;
                lastState.value = value;
            };
            mergeBuiltInState = (state, childState) => {
                const target = state;
                const child = childState;
                if (child.hasValue) {
                    target.hasValue = true;
                    target.value = child.value;
                }
            };
            finalize = state => {
                const lastState = state;
                return lastState.hasValue ? lastState.value : null;
            };
            break;
        default:
            return null;
    }
    return {
        key,
        op,
        readValue: readAggregatedValue,
        createState: createBuiltInState,
        add: (state, value, _row) => addBuiltInValue(state, value),
        merge: (state, childState) => mergeBuiltInState(state, childState),
        finalize,
    };
}
function createStates(columns) {
    return columns.map(column => column.createState());
}
function finalizeStates(columns, states) {
    const aggregates = {};
    for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        if (!column) {
            continue;
        }
        const state = states[index];
        aggregates[column.key] = column.finalize(state);
    }
    return aggregates;
}
function addLeafToStates(columns, states, row) {
    for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        if (!column) {
            continue;
        }
        const state = states[index];
        const value = column.readValue(row);
        column.add(state, value, row);
    }
}
function mergeStates(columns, targetStates, childStates) {
    for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        if (!column?.merge) {
            continue;
        }
        const targetState = targetStates[index];
        const childState = childStates[index];
        column.merge(targetState, childState);
    }
}
function compileAggregationColumns(model) {
    if (!model || !Array.isArray(model.columns) || model.columns.length === 0) {
        return [];
    }
    const compiled = [];
    for (const spec of model.columns) {
        const column = compileColumnSpec(spec);
        if (!column) {
            continue;
        }
        compiled.push(column);
    }
    return compiled;
}
function isIncrementalAggregationOp(op) {
    return op === "sum" || op === "count" || op === "countNonNull" || op === "avg";
}
export function createDataGridAggregationEngine(initialModel = null) {
    let model = initialModel;
    let compiledColumns = compileAggregationColumns(model);
    const isIncrementalSupported = () => {
        if (compiledColumns.length === 0) {
            return false;
        }
        return compiledColumns.every(column => isIncrementalAggregationOp(column.op));
    };
    const createEmptyGroupState = () => {
        if (!isIncrementalSupported()) {
            return null;
        }
        const state = {};
        for (const column of compiledColumns) {
            if (column.op === "avg") {
                state[column.key] = { sum: 0, count: 0 };
            }
            else {
                state[column.key] = 0;
            }
        }
        return state;
    };
    const createLeafContribution = (row) => {
        if (!isIncrementalSupported() || row.kind !== "leaf") {
            return null;
        }
        const contribution = {};
        for (const column of compiledColumns) {
            const value = column.readValue(row);
            if (column.op === "sum") {
                contribution[column.key] = normalizeNumber(value) ?? 0;
                continue;
            }
            if (column.op === "count") {
                contribution[column.key] = 1;
                continue;
            }
            if (column.op === "countNonNull") {
                contribution[column.key] = value == null ? 0 : 1;
                continue;
            }
            const numeric = normalizeNumber(value);
            contribution[column.key] = numeric == null
                ? { sum: 0, count: 0 }
                : { sum: numeric, count: 1 };
        }
        return contribution;
    };
    const applyContributionDelta = (groupState, previous, next) => {
        if (!isIncrementalSupported()) {
            return;
        }
        for (const column of compiledColumns) {
            if (column.op === "avg") {
                const target = (groupState[column.key] ?? { sum: 0, count: 0 });
                const previousValue = (previous?.[column.key] ?? { sum: 0, count: 0 });
                const nextValue = (next?.[column.key] ?? { sum: 0, count: 0 });
                target.sum += (nextValue.sum ?? 0) - (previousValue.sum ?? 0);
                target.count += (nextValue.count ?? 0) - (previousValue.count ?? 0);
                groupState[column.key] = target;
                continue;
            }
            const current = Number(groupState[column.key] ?? 0);
            const previousValue = Number(previous?.[column.key] ?? 0);
            const nextValue = Number(next?.[column.key] ?? 0);
            groupState[column.key] = current + (nextValue - previousValue);
        }
    };
    const finalizeGroupState = (groupState) => {
        if (!isIncrementalSupported()) {
            return {};
        }
        const aggregates = {};
        for (const column of compiledColumns) {
            if (column.op === "avg") {
                const state = (groupState[column.key] ?? { sum: 0, count: 0 });
                aggregates[column.key] = state.count > 0 ? state.sum / state.count : null;
                continue;
            }
            aggregates[column.key] = Number(groupState[column.key] ?? 0);
        }
        return aggregates;
    };
    return {
        setModel(nextModel) {
            model = nextModel;
            compiledColumns = compileAggregationColumns(model);
        },
        getModel: () => model,
        getCompiledColumns: () => compiledColumns,
        isIncrementalAggregationSupported: isIncrementalSupported,
        createEmptyGroupState,
        createLeafContribution,
        applyContributionDelta,
        finalizeGroupState,
        computeAggregatesForLeaves(rows) {
            if (compiledColumns.length === 0 || rows.length === 0) {
                return {};
            }
            const states = createStates(compiledColumns);
            for (const row of rows) {
                if (row.kind !== "leaf") {
                    continue;
                }
                addLeafToStates(compiledColumns, states, row);
            }
            return finalizeStates(compiledColumns, states);
        },
        computeAggregatesForGroupedRows(projectedRows) {
            const aggregatesByGroupKey = new Map();
            if (compiledColumns.length === 0 || projectedRows.length === 0) {
                return aggregatesByGroupKey;
            }
            const canUseMergedStackPath = compiledColumns.every(column => typeof column.merge === "function");
            const stack = [];
            const flush = (minLevel = -1) => {
                while (stack.length > 0) {
                    const current = stack[stack.length - 1];
                    if (!current || current.level < minLevel) {
                        break;
                    }
                    stack.pop();
                    aggregatesByGroupKey.set(current.groupKey, finalizeStates(compiledColumns, current.states));
                    if (canUseMergedStackPath) {
                        const parent = stack[stack.length - 1];
                        if (parent) {
                            mergeStates(compiledColumns, parent.states, current.states);
                        }
                    }
                }
            };
            for (const row of projectedRows) {
                if (row.kind === "group") {
                    const groupKey = row.groupMeta?.groupKey;
                    if (!groupKey) {
                        continue;
                    }
                    const level = Number.isFinite(row.groupMeta?.level)
                        ? Math.max(0, Math.trunc(row.groupMeta?.level))
                        : 0;
                    flush(level);
                    stack.push({
                        groupKey,
                        level,
                        states: createStates(compiledColumns),
                    });
                    continue;
                }
                if (stack.length === 0) {
                    continue;
                }
                if (canUseMergedStackPath) {
                    const leafTarget = stack[stack.length - 1];
                    if (leafTarget) {
                        addLeafToStates(compiledColumns, leafTarget.states, row);
                    }
                    continue;
                }
                for (const entry of stack) {
                    addLeafToStates(compiledColumns, entry.states, row);
                }
            }
            flush(-1);
            return aggregatesByGroupKey;
        },
    };
}
