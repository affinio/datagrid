function normalizeRowIds(rowIds) {
    const next = new Set();
    for (const rowId of rowIds) {
        const normalized = String(rowId ?? "").trim();
        if (normalized.length > 0) {
            next.add(normalized);
        }
    }
    return next;
}
function setsEqual(left, right) {
    if (left.size !== right.size) {
        return false;
    }
    for (const value of left) {
        if (!right.has(value)) {
            return false;
        }
    }
    return true;
}
export function useDataGridRowSelectionModel(options) {
    const clearSelectionWhenSourceRowsEmpty = options.clearSelectionWhenSourceRowsEmpty ?? true;
    let selection = normalizeRowIds(options.initialSelection ?? []);
    let anchorIndex = null;
    function emitSelection(next) {
        if (setsEqual(selection, next)) {
            return;
        }
        selection = next;
        options.onSelectionChange?.(selection);
    }
    function resolveFilteredRowIds() {
        const fromOptions = options.resolveFilteredRowIds?.();
        if (Array.isArray(fromOptions)) {
            return fromOptions;
        }
        const rows = options.resolveFilteredRows();
        return rows.map((row, index) => options.resolveRowId(row, index));
    }
    function resolveSafeIndex(index, size) {
        if (size <= 0) {
            return 0;
        }
        const normalized = Math.trunc(Number.isFinite(index) ? index : 0);
        return Math.max(0, Math.min(size - 1, normalized));
    }
    function toggleRowById(rowId, selected) {
        const normalizedId = String(rowId ?? "").trim();
        if (normalizedId.length === 0) {
            return;
        }
        const next = new Set(selection);
        const shouldSelect = typeof selected === "boolean" ? selected : !next.has(normalizedId);
        if (shouldSelect) {
            next.add(normalizedId);
        }
        else {
            next.delete(normalizedId);
        }
        emitSelection(next);
    }
    function applyShiftRange(toIndex, selected) {
        const filteredRowIds = resolveFilteredRowIds();
        if (!filteredRowIds.length) {
            return;
        }
        const clampedTo = resolveSafeIndex(toIndex, filteredRowIds.length);
        const anchor = anchorIndex === null
            ? clampedTo
            : resolveSafeIndex(anchorIndex, filteredRowIds.length);
        const from = Math.min(anchor, clampedTo);
        const to = Math.max(anchor, clampedTo);
        const next = new Set(selection);
        for (let index = from; index <= to; index += 1) {
            const rowId = filteredRowIds[index];
            if (!rowId) {
                continue;
            }
            if (selected) {
                next.add(rowId);
            }
            else {
                next.delete(rowId);
            }
        }
        anchorIndex = clampedTo;
        emitSelection(next);
    }
    function toggleRowAtFilteredIndex(index, selected, gesture) {
        const filteredRowIds = resolveFilteredRowIds();
        if (!filteredRowIds.length) {
            return;
        }
        const clampedIndex = resolveSafeIndex(index, filteredRowIds.length);
        if (gesture?.shiftKey && anchorIndex !== null) {
            applyShiftRange(clampedIndex, selected);
            return;
        }
        const rowId = filteredRowIds[clampedIndex];
        if (!rowId) {
            return;
        }
        anchorIndex = clampedIndex;
        toggleRowById(rowId, selected);
    }
    function toggleSelectAllFiltered(selected) {
        const filteredRowIds = resolveFilteredRowIds();
        const next = new Set(selection);
        filteredRowIds.forEach((rowId) => {
            if (!rowId) {
                return;
            }
            if (selected) {
                next.add(rowId);
            }
            else {
                next.delete(rowId);
            }
        });
        if (!selected) {
            anchorIndex = null;
        }
        emitSelection(next);
    }
    function reconcileWithRows(allRows) {
        if (selection.size === 0) {
            return;
        }
        const sourceRows = allRows ?? options.resolveAllRows?.() ?? [];
        if (!sourceRows.length) {
            if (clearSelectionWhenSourceRowsEmpty) {
                anchorIndex = null;
                emitSelection(new Set());
            }
            return;
        }
        const allowed = new Set();
        sourceRows.forEach((row, index) => {
            allowed.add(options.resolveRowId(row, index));
        });
        const next = new Set();
        selection.forEach((rowId) => {
            if (allowed.has(rowId)) {
                next.add(rowId);
            }
        });
        emitSelection(next);
    }
    return {
        getSelection: () => selection,
        replaceSelection: (rowIds) => {
            emitSelection(normalizeRowIds(rowIds));
            if (selection.size === 0) {
                anchorIndex = null;
            }
        },
        clearSelection: () => {
            anchorIndex = null;
            emitSelection(new Set());
        },
        isSelected: rowId => selection.has(String(rowId ?? "")),
        toggleRowById,
        toggleRowAtFilteredIndex,
        applyShiftRange,
        toggleSelectAllFiltered,
        setAnchorIndex: (index) => {
            anchorIndex = index === null ? null : Math.max(0, Math.trunc(index));
        },
        getAnchorIndex: () => anchorIndex,
        reconcileWithRows,
    };
}
