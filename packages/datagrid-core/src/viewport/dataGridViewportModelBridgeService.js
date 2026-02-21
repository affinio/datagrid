import { isSameGroupExpansionSnapshot, isSameGroupBySpec, } from "../models/rowModel";
const DEFAULT_ROW_ENTRY_CACHE_LIMIT = 1024;
const CORE_COLUMN_KEYS = new Set(["key", "label", "width", "minWidth", "maxWidth", "visible", "pin", "meta"]);
function areSortModelsEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right || left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        const leftEntry = left[index];
        const rightEntry = right[index];
        if (!leftEntry || !rightEntry) {
            return false;
        }
        if (leftEntry.key !== rightEntry.key) {
            return false;
        }
        if ((leftEntry.field ?? null) !== (rightEntry.field ?? null)) {
            return false;
        }
        if (leftEntry.direction !== rightEntry.direction) {
            return false;
        }
    }
    return true;
}
function areFilterValuesEqual(left, right, depth = 0) {
    if (Object.is(left, right)) {
        return true;
    }
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() === right.getTime();
    }
    if (!left || !right || typeof left !== "object" || typeof right !== "object") {
        return false;
    }
    if (depth > 4) {
        return false;
    }
    if (Array.isArray(left)) {
        if (!Array.isArray(right) || left.length !== right.length) {
            return false;
        }
        for (let index = 0; index < left.length; index += 1) {
            if (!areFilterValuesEqual(left[index], right[index], depth + 1)) {
                return false;
            }
        }
        return true;
    }
    if (Array.isArray(right)) {
        return false;
    }
    const leftRecord = left;
    const rightRecord = right;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(rightRecord, key)) {
            return false;
        }
        if (!areFilterValuesEqual(leftRecord[key], rightRecord[key], depth + 1)) {
            return false;
        }
    }
    return true;
}
function areFilterModelsEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    const leftColumnFilters = left.columnFilters ?? {};
    const rightColumnFilters = right.columnFilters ?? {};
    const leftColumnKeys = Object.keys(leftColumnFilters);
    const rightColumnKeys = Object.keys(rightColumnFilters);
    if (leftColumnKeys.length !== rightColumnKeys.length) {
        return false;
    }
    for (const key of leftColumnKeys) {
        if (!Object.prototype.hasOwnProperty.call(rightColumnFilters, key)) {
            return false;
        }
        const leftValues = leftColumnFilters[key] ?? [];
        const rightValues = rightColumnFilters[key] ?? [];
        if (leftValues.length !== rightValues.length) {
            return false;
        }
        for (let index = 0; index < leftValues.length; index += 1) {
            if (leftValues[index] !== rightValues[index]) {
                return false;
            }
        }
    }
    const leftAdvanced = left.advancedFilters ?? {};
    const rightAdvanced = right.advancedFilters ?? {};
    const leftAdvancedKeys = Object.keys(leftAdvanced);
    const rightAdvancedKeys = Object.keys(rightAdvanced);
    if (leftAdvancedKeys.length !== rightAdvancedKeys.length) {
        return false;
    }
    for (const key of leftAdvancedKeys) {
        if (!Object.prototype.hasOwnProperty.call(rightAdvanced, key)) {
            return false;
        }
        const leftFilter = leftAdvanced[key];
        const rightFilter = rightAdvanced[key];
        if (!leftFilter || !rightFilter) {
            return false;
        }
        if (leftFilter.type !== rightFilter.type) {
            return false;
        }
        const leftClauses = Array.isArray(leftFilter.clauses) ? leftFilter.clauses : [];
        const rightClauses = Array.isArray(rightFilter.clauses) ? rightFilter.clauses : [];
        if (leftClauses.length !== rightClauses.length) {
            return false;
        }
        for (let index = 0; index < leftClauses.length; index += 1) {
            const leftClause = leftClauses[index];
            const rightClause = rightClauses[index];
            if (!leftClause || !rightClause) {
                return false;
            }
            if (leftClause.operator !== rightClause.operator) {
                return false;
            }
            if ((leftClause.join ?? null) !== (rightClause.join ?? null)) {
                return false;
            }
            if (!areFilterValuesEqual(leftClause.value, rightClause.value)) {
                return false;
            }
            if (!areFilterValuesEqual(leftClause.value2, rightClause.value2)) {
                return false;
            }
        }
    }
    return true;
}
function areGroupBySpecsEqual(left, right) {
    return isSameGroupBySpec(left, right);
}
function areGroupExpansionSnapshotsEqual(left, right) {
    return isSameGroupExpansionSnapshot(left, right);
}
export function createDataGridViewportModelBridgeService(options) {
    const { fallbackRowModel, fallbackColumnModel, onInvalidate } = options;
    const rowEntryCacheLimit = Number.isFinite(options.rowEntryCacheLimit) && options.rowEntryCacheLimit > 0
        ? Math.max(1, Math.trunc(options.rowEntryCacheLimit))
        : DEFAULT_ROW_ENTRY_CACHE_LIMIT;
    let activeRowModel = options.initialRowModel ?? fallbackRowModel;
    let activeColumnModel = options.initialColumnModel ?? fallbackColumnModel;
    let activeRowModelUnsubscribe = null;
    let activeColumnModelUnsubscribe = null;
    let lastRowModelSnapshot = null;
    let rowCountCache = 0;
    let rowCountCacheDirty = true;
    const rowEntryCache = new Map();
    let columnModelColumnsCache = [];
    let columnModelCacheDirty = true;
    let columnProjectionCache = new Map();
    const normalizeViewportRange = (range) => {
        if (!range) {
            return null;
        }
        const rawStart = Number.isFinite(range.start) ? Math.trunc(range.start) : 0;
        const rawEnd = Number.isFinite(range.end) ? Math.trunc(range.end) : rawStart;
        const start = Math.max(0, Math.min(rawStart, rawEnd));
        const end = Math.max(start, Math.max(rawStart, rawEnd));
        return { start, end };
    };
    const emitInvalidation = (reason, rowRange = null, scope = "structural") => {
        onInvalidate({
            reason,
            scope,
            axes: {
                rows: reason !== "columns",
                columns: reason !== "rows",
            },
            rowRange: reason === "rows" || reason === "both" ? normalizeViewportRange(rowRange) : null,
        });
    };
    const markRowModelCacheDirty = () => {
        rowCountCacheDirty = true;
        rowEntryCache.clear();
    };
    const markColumnModelCacheDirty = () => {
        columnModelCacheDirty = true;
    };
    const bindRowModel = (model) => {
        if (activeRowModel === model && activeRowModelUnsubscribe) {
            markRowModelCacheDirty();
            emitInvalidation("rows", lastRowModelSnapshot?.viewportRange ?? activeRowModel.getSnapshot().viewportRange, "structural");
            return;
        }
        activeRowModelUnsubscribe?.();
        activeRowModel = model;
        lastRowModelSnapshot = activeRowModel.getSnapshot();
        activeRowModelUnsubscribe = activeRowModel.subscribe(snapshot => {
            const previous = lastRowModelSnapshot;
            lastRowModelSnapshot = snapshot;
            const hasComparableRevision = (typeof snapshot.revision === "number" &&
                typeof previous?.revision === "number");
            const isStableStructuralState = Boolean(previous) &&
                snapshot.rowCount === previous?.rowCount &&
                snapshot.loading === previous?.loading &&
                snapshot.error === previous?.error &&
                areSortModelsEqual(snapshot.sortModel, previous?.sortModel) &&
                areFilterModelsEqual(snapshot.filterModel, previous?.filterModel) &&
                areGroupBySpecsEqual(snapshot.groupBy, previous?.groupBy) &&
                areGroupExpansionSnapshotsEqual(snapshot.groupExpansion, previous?.groupExpansion);
            const isViewportOnlyUpdate = Boolean(previous) && (hasComparableRevision
                ? snapshot.revision === previous?.revision && isStableStructuralState
                : isStableStructuralState);
            if (!isViewportOnlyUpdate) {
                markRowModelCacheDirty();
            }
            else {
                // Viewport range churn is controller-owned and should not enqueue a new
                // bridge invalidation cycle. This avoids redundant heavy passes.
                return;
            }
            const scope = isStableStructuralState ? "content" : "structural";
            emitInvalidation("rows", snapshot.viewportRange, scope);
        });
        markRowModelCacheDirty();
        emitInvalidation("rows", lastRowModelSnapshot?.viewportRange, "structural");
    };
    const bindColumnModel = (model) => {
        if (activeColumnModel === model && activeColumnModelUnsubscribe) {
            markColumnModelCacheDirty();
            emitInvalidation("columns");
            return;
        }
        activeColumnModelUnsubscribe?.();
        activeColumnModel = model;
        activeColumnModelUnsubscribe = activeColumnModel.subscribe(() => {
            markColumnModelCacheDirty();
            emitInvalidation("columns");
        });
        markColumnModelCacheDirty();
        emitInvalidation("columns");
    };
    const toVisibleRow = (node) => {
        const stickyTop = node.state.pinned === "top" ? true : undefined;
        const stickyBottom = node.state.pinned === "bottom" ? true : undefined;
        return {
            row: node.data,
            rowId: node.rowKey,
            originalIndex: node.sourceIndex,
            displayIndex: node.displayIndex,
            stickyTop,
            stickyBottom,
        };
    };
    const toDataGridColumn = (snapshotColumn) => {
        const columnDef = snapshotColumn.column;
        const legacyPassthrough = Object.fromEntries(Object.entries(columnDef)
            .filter(([key]) => !CORE_COLUMN_KEYS.has(key)));
        const meta = columnDef.meta && typeof columnDef.meta === "object"
            ? columnDef.meta
            : undefined;
        const label = typeof columnDef.label === "string" ? columnDef.label : snapshotColumn.key;
        const widthValue = snapshotColumn.width == null ? columnDef.width : snapshotColumn.width;
        const normalizedWidth = Number.isFinite(widthValue) ? widthValue : undefined;
        return {
            ...legacyPassthrough,
            ...(meta ?? {}),
            key: snapshotColumn.key,
            label,
            visible: snapshotColumn.visible,
            pin: snapshotColumn.pin,
            width: normalizedWidth,
        };
    };
    const readRowCache = (index) => {
        if (!rowEntryCache.has(index)) {
            return undefined;
        }
        const cached = rowEntryCache.get(index);
        // LRU touch: move to tail.
        rowEntryCache.delete(index);
        rowEntryCache.set(index, cached);
        return cached;
    };
    const writeRowCache = (index, row) => {
        if (rowEntryCache.has(index)) {
            rowEntryCache.delete(index);
        }
        rowEntryCache.set(index, row);
        while (rowEntryCache.size > rowEntryCacheLimit) {
            const oldestKey = rowEntryCache.keys().next().value;
            if (typeof oldestKey === "undefined") {
                break;
            }
            rowEntryCache.delete(oldestKey);
        }
    };
    const getRowCount = () => {
        const nextCount = Math.max(0, activeRowModel.getRowCount());
        if (!rowCountCacheDirty && rowCountCache === nextCount) {
            return rowCountCache;
        }
        if (rowCountCache !== nextCount) {
            rowEntryCache.clear();
        }
        rowCountCache = nextCount;
        rowCountCacheDirty = false;
        return rowCountCache;
    };
    const getRow = (index) => {
        const rowCount = getRowCount();
        if (rowCount <= 0 || !Number.isFinite(index)) {
            return undefined;
        }
        const normalizedIndex = Math.trunc(index);
        if (normalizedIndex < 0 || normalizedIndex >= rowCount) {
            return undefined;
        }
        const cached = readRowCache(normalizedIndex);
        if (typeof cached !== "undefined" || rowEntryCache.has(normalizedIndex)) {
            return cached;
        }
        const row = activeRowModel.getRow(normalizedIndex);
        const normalized = row ? toVisibleRow(row) : undefined;
        writeRowCache(normalizedIndex, normalized);
        return normalized;
    };
    const getRowsInRange = (range) => {
        const rowCount = getRowCount();
        if (rowCount <= 0) {
            return [];
        }
        const rawStart = Number.isFinite(range.start) ? Math.trunc(range.start) : 0;
        const rawEnd = Number.isFinite(range.end) ? Math.trunc(range.end) : rawStart;
        const start = Math.max(0, Math.min(rowCount - 1, rawStart));
        const end = Math.max(start, Math.min(rowCount - 1, rawEnd));
        const rows = activeRowModel.getRowsInRange({ start, end });
        if (!rows.length) {
            return [];
        }
        const resolvedRows = [];
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index];
            if (!row) {
                continue;
            }
            const rowIndex = Number.isFinite(row.displayIndex)
                ? Math.trunc(row.displayIndex)
                : Math.trunc(row.originalIndex);
            const cached = readRowCache(rowIndex);
            if (typeof cached !== "undefined") {
                resolvedRows.push(cached);
                continue;
            }
            const mapped = toVisibleRow(row);
            resolvedRows.push(mapped);
            if (rowIndex >= start && rowIndex <= end) {
                writeRowCache(rowIndex, mapped);
            }
        }
        return resolvedRows;
    };
    const materializeColumns = () => {
        if (!columnModelCacheDirty) {
            return columnModelColumnsCache;
        }
        const snapshot = activeColumnModel.getSnapshot();
        const nextProjectionCache = new Map();
        const nextColumns = [];
        for (let index = 0; index < snapshot.columns.length; index += 1) {
            const snapshotColumn = snapshot.columns[index];
            if (!snapshotColumn?.visible) {
                continue;
            }
            const columnDef = snapshotColumn.column;
            const label = typeof columnDef.label === "string" ? columnDef.label : snapshotColumn.key;
            const widthValue = snapshotColumn.width == null ? columnDef.width : snapshotColumn.width;
            const normalizedWidth = Number.isFinite(widthValue) ? widthValue : undefined;
            const previous = columnProjectionCache.get(snapshotColumn.key);
            const canReuse = Boolean(previous) &&
                previous?.columnRef === columnDef &&
                previous?.visible === snapshotColumn.visible &&
                previous?.pin === snapshotColumn.pin &&
                previous?.width === normalizedWidth &&
                previous?.label === label;
            const mapped = canReuse && previous ? previous.mapped : toDataGridColumn(snapshotColumn);
            nextColumns.push(mapped);
            nextProjectionCache.set(snapshotColumn.key, {
                columnRef: columnDef,
                visible: snapshotColumn.visible,
                pin: snapshotColumn.pin,
                width: normalizedWidth,
                label,
                mapped,
            });
        }
        let columnsUnchanged = nextColumns.length === columnModelColumnsCache.length;
        if (columnsUnchanged) {
            for (let index = 0; index < nextColumns.length; index += 1) {
                if (nextColumns[index] !== columnModelColumnsCache[index]) {
                    columnsUnchanged = false;
                    break;
                }
            }
        }
        columnModelColumnsCache = columnsUnchanged ? columnModelColumnsCache : nextColumns;
        columnProjectionCache = nextProjectionCache;
        columnModelCacheDirty = false;
        return columnModelColumnsCache;
    };
    bindRowModel(activeRowModel);
    bindColumnModel(activeColumnModel);
    return {
        setRowModel(model) {
            bindRowModel(model ?? fallbackRowModel);
        },
        setColumnModel(model) {
            bindColumnModel(model ?? fallbackColumnModel);
        },
        getActiveRowModel() {
            return activeRowModel;
        },
        getActiveColumnModel() {
            return activeColumnModel;
        },
        getRowCount,
        getRow,
        getRowsInRange,
        materializeColumns,
        dispose() {
            activeRowModelUnsubscribe?.();
            activeRowModelUnsubscribe = null;
            activeColumnModelUnsubscribe?.();
            activeColumnModelUnsubscribe = null;
            rowCountCache = 0;
            rowCountCacheDirty = true;
            rowEntryCache.clear();
            columnModelColumnsCache = [];
            columnModelCacheDirty = true;
            columnProjectionCache.clear();
        },
    };
}
