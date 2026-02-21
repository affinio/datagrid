function assertRowId(rowId) {
    if (typeof rowId === "string" || typeof rowId === "number") {
        return;
    }
    throw new Error("[DataGridEditModel] rowId must be string|number.");
}
function assertColumnKey(columnKey) {
    if (typeof columnKey === "string" && columnKey.length > 0) {
        return;
    }
    throw new Error("[DataGridEditModel] columnKey must be a non-empty string.");
}
function makeEditKey(rowId, columnKey) {
    return `${typeof rowId}:${String(rowId)}::${columnKey}`;
}
function compareRowId(a, b) {
    const typeA = typeof a;
    const typeB = typeof b;
    if (typeA !== typeB) {
        return typeA === "number" ? -1 : 1;
    }
    if (typeA === "number" && typeB === "number") {
        return a - b;
    }
    return String(a).localeCompare(String(b));
}
function sortEdits(edits) {
    return [...edits].sort((left, right) => {
        const byRow = compareRowId(left.rowId, right.rowId);
        if (byRow !== 0) {
            return byRow;
        }
        return left.columnKey.localeCompare(right.columnKey);
    });
}
export function createDataGridEditModel(options = {}) {
    const editStore = new Map();
    const listeners = new Set();
    let revision = 0;
    let disposed = false;
    function ensureActive() {
        if (disposed) {
            throw new Error("DataGridEditModel has been disposed");
        }
    }
    function materializeSnapshot() {
        return {
            revision,
            edits: sortEdits(Array.from(editStore.values())),
        };
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
    function normalizePatch(patch) {
        assertRowId(patch.rowId);
        assertColumnKey(patch.columnKey);
        return {
            rowId: patch.rowId,
            columnKey: patch.columnKey,
            value: patch.value,
            previousValue: patch.previousValue,
        };
    }
    function setEditInternal(patch) {
        const normalized = normalizePatch(patch);
        const key = makeEditKey(normalized.rowId, normalized.columnKey);
        const previous = editStore.get(key);
        const unchanged = previous &&
            previous.rowId === normalized.rowId &&
            previous.columnKey === normalized.columnKey &&
            previous.value === normalized.value &&
            previous.previousValue === normalized.previousValue;
        if (unchanged) {
            return false;
        }
        editStore.set(key, normalized);
        return true;
    }
    if (Array.isArray(options.initialEdits)) {
        for (const patch of options.initialEdits) {
            setEditInternal(patch);
        }
    }
    return {
        getSnapshot() {
            return materializeSnapshot();
        },
        getEdit(rowId, columnKey) {
            assertRowId(rowId);
            assertColumnKey(columnKey);
            return editStore.get(makeEditKey(rowId, columnKey));
        },
        setEdit(patch) {
            ensureActive();
            if (!setEditInternal(patch)) {
                return;
            }
            revision += 1;
            emit();
        },
        setEdits(patches) {
            ensureActive();
            if (!Array.isArray(patches) || patches.length === 0) {
                return;
            }
            let changed = false;
            for (const patch of patches) {
                if (setEditInternal(patch)) {
                    changed = true;
                }
            }
            if (!changed) {
                return;
            }
            revision += 1;
            emit();
        },
        clearEdit(rowId, columnKey) {
            ensureActive();
            assertRowId(rowId);
            assertColumnKey(columnKey);
            const key = makeEditKey(rowId, columnKey);
            if (!editStore.delete(key)) {
                return;
            }
            revision += 1;
            emit();
        },
        clearAll() {
            ensureActive();
            if (editStore.size === 0) {
                return;
            }
            editStore.clear();
            revision += 1;
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
            editStore.clear();
            revision = 0;
        },
    };
}
