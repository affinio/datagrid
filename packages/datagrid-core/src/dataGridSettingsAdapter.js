function cloneFallback(input, seen = new WeakMap()) {
    if (input === null || typeof input !== "object") {
        return input;
    }
    if (input instanceof Date) {
        return new Date(input.getTime());
    }
    if (input instanceof Map) {
        if (seen.has(input)) {
            return seen.get(input);
        }
        const cloned = new Map();
        seen.set(input, cloned);
        for (const [key, value] of input.entries()) {
            cloned.set(cloneFallback(key, seen), cloneFallback(value, seen));
        }
        return cloned;
    }
    if (input instanceof Set) {
        if (seen.has(input)) {
            return seen.get(input);
        }
        const cloned = new Set();
        seen.set(input, cloned);
        for (const value of input.values()) {
            cloned.add(cloneFallback(value, seen));
        }
        return cloned;
    }
    if (Array.isArray(input)) {
        if (seen.has(input)) {
            return seen.get(input);
        }
        const cloned = [];
        seen.set(input, cloned);
        for (const value of input) {
            cloned.push(cloneFallback(value, seen));
        }
        return cloned;
    }
    if (seen.has(input)) {
        return seen.get(input);
    }
    const prototype = Object.getPrototypeOf(input);
    const cloned = Object.create(prototype);
    seen.set(input, cloned);
    for (const [key, value] of Object.entries(input)) {
        cloned[key] = cloneFallback(value, seen);
    }
    return cloned;
}
function cloneValue(input) {
    const structuredCloneRef = globalThis.structuredClone;
    if (typeof structuredCloneRef === "function") {
        try {
            return structuredCloneRef(input);
        }
        catch {
            // Fall through to deterministic JS clone for non-cloneable payloads.
        }
    }
    return cloneFallback(input);
}
export function createInMemoryDataGridSettingsAdapter() {
    const state = new Map();
    const ensureState = (tableId) => {
        let entry = state.get(tableId);
        if (!entry) {
            entry = {
                columnWidths: {},
                pinState: {},
            };
            state.set(tableId, entry);
        }
        return entry;
    };
    return {
        setColumnState(tableId, stateSnapshot) {
            const entry = ensureState(tableId);
            if (!stateSnapshot) {
                entry.columnState = null;
                entry.columnWidths = {};
                entry.pinState = {};
                return;
            }
            const order = Array.isArray(stateSnapshot.order)
                ? stateSnapshot.order.filter(key => typeof key === "string" && key.length > 0)
                : [];
            const visibility = {};
            Object.entries(stateSnapshot.visibility ?? {}).forEach(([key, visible]) => {
                if (typeof key === "string" && key.length > 0 && typeof visible === "boolean") {
                    visibility[key] = visible;
                }
            });
            const widths = {};
            Object.entries(stateSnapshot.widths ?? {}).forEach(([key, width]) => {
                if (typeof key !== "string" || key.length === 0) {
                    return;
                }
                if (!Number.isFinite(width)) {
                    return;
                }
                widths[key] = Math.max(0, Math.trunc(width));
            });
            const pinning = {};
            Object.entries(stateSnapshot.pinning ?? {}).forEach(([key, pin]) => {
                if (typeof key !== "string" || key.length === 0) {
                    return;
                }
                if (pin === "left" || pin === "right" || pin === "none") {
                    pinning[key] = pin;
                }
            });
            entry.columnState = {
                order: [...order],
                visibility,
                widths,
                pinning,
            };
            entry.columnWidths = { ...widths };
            const pinState = {};
            Object.entries(pinning).forEach(([key, pin]) => {
                if (pin === "left" || pin === "right") {
                    pinState[key] = pin;
                }
            });
            entry.pinState = pinState;
        },
        getColumnState(tableId) {
            const entry = state.get(tableId);
            if (!entry) {
                return null;
            }
            const fromSnapshot = entry.columnState;
            if (fromSnapshot) {
                return cloneValue(fromSnapshot);
            }
            return {
                order: [],
                visibility: {},
                widths: { ...entry.columnWidths },
                pinning: Object.fromEntries(Object.entries(entry.pinState).map(([key, pin]) => [key, pin ?? "none"])),
            };
        },
        setColumnWidth(tableId, columnKey, width) {
            const entry = ensureState(tableId);
            entry.columnWidths[columnKey] = width;
            if (!entry.columnState) {
                entry.columnState = {
                    order: [],
                    visibility: {},
                    widths: {},
                    pinning: {},
                };
            }
            entry.columnState.widths[columnKey] = Math.max(0, Math.trunc(width));
        },
        getColumnWidth(tableId, columnKey) {
            return state.get(tableId)?.columnWidths[columnKey];
        },
        setSortState(tableId, sortState) {
            if (!sortState.length) {
                const entry = state.get(tableId);
                if (entry) {
                    delete entry.sortState;
                }
                return;
            }
            const entry = ensureState(tableId);
            entry.sortState = sortState.map(item => ({ ...item }));
        },
        getSortState(tableId) {
            const entry = state.get(tableId);
            return entry?.sortState ? entry.sortState.map(item => ({ ...item })) : undefined;
        },
        setFilterSnapshot(tableId, snapshot) {
            const entry = ensureState(tableId);
            if (!snapshot ||
                (Object.keys(snapshot.columnFilters ?? {}).length === 0 &&
                    Object.keys(snapshot.advancedFilters ?? {}).length === 0)) {
                entry.filterSnapshot = null;
                return;
            }
            entry.filterSnapshot = cloneValue(snapshot);
        },
        getFilterSnapshot(tableId) {
            const entry = state.get(tableId);
            if (!entry?.filterSnapshot)
                return null;
            return cloneValue(entry.filterSnapshot);
        },
        setPinState(tableId, columnKey, position) {
            const entry = ensureState(tableId);
            if (position === "none") {
                delete entry.pinState[columnKey];
                if (entry.columnState?.pinning) {
                    delete entry.columnState.pinning[columnKey];
                }
                return;
            }
            entry.pinState[columnKey] = position;
            if (!entry.columnState) {
                entry.columnState = {
                    order: [],
                    visibility: {},
                    widths: {},
                    pinning: {},
                };
            }
            entry.columnState.pinning[columnKey] = position;
        },
        getPinState(tableId) {
            const entry = state.get(tableId);
            if (!entry)
                return null;
            return { ...entry.pinState };
        },
        setGroupState(tableId, columns, expansion = {}) {
            const entry = ensureState(tableId);
            const uniqueColumns = Array.from(new Set(columns.filter(column => typeof column === "string" && column.length > 0)));
            if (!uniqueColumns.length) {
                entry.groupState = null;
                return;
            }
            const sanitizedExpansion = {};
            Object.entries(expansion).forEach(([key, value]) => {
                if (typeof value === "boolean") {
                    sanitizedExpansion[key] = value;
                }
            });
            entry.groupState = {
                columns: uniqueColumns,
                expansion: sanitizedExpansion,
            };
        },
        getGroupState(tableId) {
            const entry = state.get(tableId);
            if (!entry?.groupState)
                return null;
            return {
                columns: [...entry.groupState.columns],
                expansion: { ...entry.groupState.expansion },
            };
        },
        clearTable(tableId) {
            state.delete(tableId);
        },
    };
}
