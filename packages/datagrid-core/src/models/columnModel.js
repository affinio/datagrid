function normalizePin(pin) {
    if (pin === "left" || pin === "right") {
        return pin;
    }
    return "none";
}
function normalizeWidth(width) {
    if (!Number.isFinite(width)) {
        return null;
    }
    return Math.max(0, Math.trunc(width));
}
function normalizeColumnKey(key, index) {
    if (typeof key !== "string") {
        throw new Error(`[DataGridColumnModel] column key at index ${index} must be a non-empty string.`);
    }
    const normalized = key.trim();
    if (normalized.length === 0) {
        throw new Error(`[DataGridColumnModel] column key at index ${index} must be a non-empty string.`);
    }
    return normalized;
}
export function createDataGridColumnModel(options = {}) {
    let disposed = false;
    const listeners = new Set();
    const columnsByKey = new Map();
    let order = [];
    let snapshotDirty = true;
    let snapshotCache = null;
    function ensureActive() {
        if (disposed) {
            throw new Error("DataGridColumnModel has been disposed");
        }
    }
    function materializeSnapshot() {
        if (!snapshotDirty && snapshotCache) {
            return snapshotCache;
        }
        const columns = order
            .map(key => {
            const state = columnsByKey.get(key);
            if (!state) {
                return null;
            }
            return {
                key,
                visible: state.visible,
                pin: state.pin,
                width: state.width,
                column: state.column,
            };
        })
            .filter((entry) => entry !== null);
        snapshotCache = {
            columns,
            order: [...order],
            visibleColumns: columns.filter(column => column.visible),
        };
        snapshotDirty = false;
        return snapshotCache;
    }
    function markSnapshotDirty() {
        snapshotDirty = true;
        snapshotCache = null;
    }
    function emit() {
        if (disposed || listeners.size === 0) {
            return;
        }
        const snapshot = materializeSnapshot();
        for (const listener of listeners) {
            listener(snapshot);
        }
    }
    function setColumnsValue(columns) {
        columnsByKey.clear();
        order = [];
        const seen = new Set();
        columns.forEach((column, index) => {
            if (!column || typeof column !== "object") {
                throw new Error(`[DataGridColumnModel] column definition at index ${index} must be an object.`);
            }
            const key = normalizeColumnKey(column.key, index);
            if (seen.has(key)) {
                throw new Error(`[DataGridColumnModel] duplicate column key "${key}" is not allowed.`);
            }
            seen.add(key);
            const normalizedColumn = key === column.key
                ? column
                : { ...column, key };
            columnsByKey.set(key, {
                column: normalizedColumn,
                visible: column.visible !== false,
                pin: normalizePin(column.pin),
                width: normalizeWidth(column.width),
            });
            order.push(key);
        });
        markSnapshotDirty();
        emit();
    }
    setColumnsValue(Array.isArray(options.columns) ? options.columns : []);
    return {
        getSnapshot() {
            return materializeSnapshot();
        },
        getColumn(key) {
            const state = columnsByKey.get(key);
            if (!state) {
                return undefined;
            }
            return {
                key,
                visible: state.visible,
                pin: state.pin,
                width: state.width,
                column: state.column,
            };
        },
        setColumns(columns) {
            ensureActive();
            setColumnsValue(Array.isArray(columns) ? columns : []);
        },
        setColumnOrder(keys) {
            ensureActive();
            const nextOrder = [];
            const seen = new Set();
            for (const key of keys) {
                if (!columnsByKey.has(key) || seen.has(key)) {
                    continue;
                }
                seen.add(key);
                nextOrder.push(key);
            }
            for (const key of order) {
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                nextOrder.push(key);
            }
            if (nextOrder.length === order.length) {
                let unchanged = true;
                for (let index = 0; index < nextOrder.length; index += 1) {
                    if (nextOrder[index] !== order[index]) {
                        unchanged = false;
                        break;
                    }
                }
                if (unchanged) {
                    return;
                }
            }
            order = nextOrder;
            markSnapshotDirty();
            emit();
        },
        setColumnVisibility(key, visible) {
            ensureActive();
            const state = columnsByKey.get(key);
            if (!state || state.visible === visible) {
                return;
            }
            state.visible = visible;
            markSnapshotDirty();
            emit();
        },
        setColumnWidth(key, width) {
            ensureActive();
            const state = columnsByKey.get(key);
            if (!state) {
                return;
            }
            const nextWidth = normalizeWidth(width);
            if (state.width === nextWidth) {
                return;
            }
            state.width = nextWidth;
            markSnapshotDirty();
            emit();
        },
        setColumnPin(key, pin) {
            ensureActive();
            const state = columnsByKey.get(key);
            if (!state) {
                return;
            }
            const nextPin = normalizePin(pin);
            if (state.pin === nextPin) {
                return;
            }
            state.pin = nextPin;
            markSnapshotDirty();
            emit();
        },
        subscribe(listener) {
            if (disposed) {
                return () => { };
            }
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            listeners.clear();
            columnsByKey.clear();
            order = [];
            snapshotDirty = true;
            snapshotCache = null;
        },
    };
}
