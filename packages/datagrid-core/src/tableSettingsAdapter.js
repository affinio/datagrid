export function createInMemoryTableSettingsAdapter() {
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
        setColumnWidth(tableId, columnKey, width) {
            const entry = ensureState(tableId);
            entry.columnWidths[columnKey] = width;
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
            entry.filterSnapshot = JSON.parse(JSON.stringify(snapshot));
        },
        getFilterSnapshot(tableId) {
            const entry = state.get(tableId);
            if (!entry?.filterSnapshot)
                return null;
            return JSON.parse(JSON.stringify(entry.filterSnapshot));
        },
        setPinState(tableId, columnKey, position) {
            const entry = ensureState(tableId);
            if (position === "none") {
                delete entry.pinState[columnKey];
                return;
            }
            entry.pinState[columnKey] = position;
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
