import { createDataGridSelectionSummary, } from "../selection/selectionSummary";
function normalizeRowRefreshKey(rowKey) {
    if (typeof rowKey === "number") {
        return `n:${rowKey}`;
    }
    return `s:${rowKey}`;
}
function normalizeRefreshColumnKey(columnKey) {
    if (typeof columnKey !== "string") {
        return null;
    }
    const normalized = columnKey.trim();
    return normalized.length > 0 ? normalized : null;
}
function createDeferredScheduler() {
    let nextHandleId = 1;
    const cancelledHandles = new Set();
    return {
        schedule(callback) {
            const handle = { id: nextHandleId };
            nextHandleId += 1;
            Promise.resolve().then(() => {
                if (cancelledHandles.has(handle.id)) {
                    cancelledHandles.delete(handle.id);
                    return;
                }
                callback();
            });
            return handle;
        },
        cancel(handle) {
            cancelledHandles.add(handle.id);
        },
    };
}
class DataGridCellRefreshRegistry {
    constructor(resolveVisibleEntries, scheduleFrame, cancelFrame) {
        Object.defineProperty(this, "resolveVisibleEntries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: resolveVisibleEntries
        });
        Object.defineProperty(this, "scheduleFrame", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: scheduleFrame
        });
        Object.defineProperty(this, "cancelFrame", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: cancelFrame
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "pendingRowsByKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "scheduledHandle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pendingReason", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nextBatchSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
    }
    queueByRowKeys(rowKeys, columnKeys, options) {
        this.queueByRanges(rowKeys.map(rowKey => ({ rowKey, columnKeys })), options);
    }
    queueByRanges(ranges, options) {
        for (const range of ranges) {
            const normalizedRowKey = normalizeRowRefreshKey(range.rowKey);
            const pendingRow = this.pendingRowsByKey.get(normalizedRowKey) ?? {
                rowKey: range.rowKey,
                columnKeys: new Set(),
            };
            for (const rawColumnKey of range.columnKeys) {
                const columnKey = normalizeRefreshColumnKey(rawColumnKey);
                if (!columnKey) {
                    continue;
                }
                pendingRow.columnKeys.add(columnKey);
            }
            if (pendingRow.columnKeys.size > 0) {
                this.pendingRowsByKey.set(normalizedRowKey, pendingRow);
            }
        }
        if (typeof options?.reason === "string" && options.reason.trim().length > 0) {
            this.pendingReason = options.reason;
        }
        if (options?.immediate) {
            this.flush();
            return;
        }
        this.schedule();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    dispose() {
        if (this.scheduledHandle != null) {
            this.cancelFrame(this.scheduledHandle);
            this.scheduledHandle = null;
        }
        this.pendingRowsByKey.clear();
        this.listeners.clear();
        this.pendingReason = undefined;
    }
    schedule() {
        if (this.scheduledHandle != null || this.pendingRowsByKey.size === 0) {
            return;
        }
        this.scheduledHandle = this.scheduleFrame(() => {
            this.scheduledHandle = null;
            this.flush();
        });
    }
    flush() {
        if (this.pendingRowsByKey.size === 0) {
            return;
        }
        const timestamp = this.nextBatchSequence;
        this.nextBatchSequence += 1;
        const pendingRows = Array.from(this.pendingRowsByKey.values());
        this.pendingRowsByKey.clear();
        const cells = this.resolveVisibleEntries(pendingRows);
        const reason = this.pendingReason;
        this.pendingReason = undefined;
        if (cells.length === 0 || this.listeners.size === 0) {
            return;
        }
        const batch = {
            timestamp,
            reason,
            cells,
        };
        for (const listener of this.listeners) {
            listener(batch);
        }
    }
}
function assertRowModelService(core) {
    const service = core.getService("rowModel");
    if (!service.model) {
        throw new Error('[DataGridApi] "rowModel" service must expose model: DataGridRowModel.');
    }
    return service;
}
function assertColumnModelService(core) {
    const service = core.getService("columnModel");
    if (!service.model) {
        throw new Error('[DataGridApi] "columnModel" service must expose model: DataGridColumnModel.');
    }
    return service;
}
function isCoreApiOptions(options) {
    return "core" in options;
}
function resolveApiDependencies(options) {
    if (isCoreApiOptions(options)) {
        const core = options.core;
        const rowModelService = assertRowModelService(core);
        const columnModelService = assertColumnModelService(core);
        const rowModel = rowModelService.model;
        const columnModel = columnModelService.model;
        return {
            lifecycle: core.lifecycle,
            init: () => core.init(),
            start: () => core.start(),
            stop: () => core.stop(),
            dispose: () => core.dispose(),
            rowModel,
            columnModel,
            getViewportService: () => core.getService("viewport"),
            getTransactionService: () => core.getService("transaction"),
            getSelectionService: () => core.getService("selection"),
        };
    }
    return {
        lifecycle: options.lifecycle,
        init: options.init,
        start: options.start,
        stop: options.stop,
        dispose: options.dispose,
        rowModel: options.rowModel,
        columnModel: options.columnModel,
        getViewportService: () => options.viewportService ?? null,
        getTransactionService: () => options.transactionService ?? null,
        getSelectionService: () => options.selectionService ?? null,
    };
}
function resolveSelectionCapability(service) {
    if (!service) {
        return null;
    }
    if (typeof service.getSelectionSnapshot !== "function" ||
        typeof service.setSelectionSnapshot !== "function" ||
        typeof service.clearSelection !== "function") {
        return null;
    }
    return {
        getSelectionSnapshot: service.getSelectionSnapshot,
        setSelectionSnapshot: service.setSelectionSnapshot,
        clearSelection: service.clearSelection,
    };
}
function resolveTransactionCapability(service) {
    if (!service) {
        return null;
    }
    if (typeof service.getTransactionSnapshot !== "function" ||
        typeof service.beginTransactionBatch !== "function" ||
        typeof service.commitTransactionBatch !== "function" ||
        typeof service.rollbackTransactionBatch !== "function" ||
        typeof service.applyTransaction !== "function" ||
        typeof service.canUndoTransaction !== "function" ||
        typeof service.canRedoTransaction !== "function" ||
        typeof service.undoTransaction !== "function" ||
        typeof service.redoTransaction !== "function") {
        return null;
    }
    return {
        getTransactionSnapshot: service.getTransactionSnapshot,
        beginTransactionBatch: service.beginTransactionBatch,
        commitTransactionBatch: service.commitTransactionBatch,
        rollbackTransactionBatch: service.rollbackTransactionBatch,
        applyTransaction: service.applyTransaction,
        canUndoTransaction: service.canUndoTransaction,
        canRedoTransaction: service.canRedoTransaction,
        undoTransaction: service.undoTransaction,
        redoTransaction: service.redoTransaction,
    };
}
function assertSelectionCapability(capability) {
    if (!capability) {
        throw new Error('[DataGridApi] "selection" service is present but does not implement selection capabilities.');
    }
    return capability;
}
function assertTransactionCapability(capability) {
    if (!capability) {
        throw new Error('[DataGridApi] "transaction" service is present but does not implement transaction capabilities.');
    }
    return capability;
}
function resolvePatchCapability(rowModel) {
    const candidate = rowModel;
    if (typeof candidate.patchRows !== "function") {
        return null;
    }
    return {
        patchRows: candidate.patchRows.bind(rowModel),
    };
}
function resolveSortFilterBatchCapability(rowModel) {
    const candidate = rowModel;
    if (typeof candidate.setSortAndFilterModel !== "function") {
        return null;
    }
    return {
        setSortAndFilterModel: candidate.setSortAndFilterModel.bind(rowModel),
    };
}
function assertPatchCapability(capability) {
    if (!capability) {
        throw new Error('[DataGridApi] rowModel does not implement patchRows capability.');
    }
    return capability;
}
export function createDataGridApi(options) {
    const deps = resolveApiDependencies(options);
    const { lifecycle, init, start, stop, dispose, rowModel, columnModel, getViewportService, getSelectionService, getTransactionService, } = deps;
    const resolveCurrentSelectionCapability = () => resolveSelectionCapability(getSelectionService());
    const resolveCurrentTransactionCapability = () => resolveTransactionCapability(getTransactionService());
    const resolveCurrentPatchCapability = () => resolvePatchCapability(rowModel);
    const resolveCurrentSortFilterBatchCapability = () => resolveSortFilterBatchCapability(rowModel);
    const deferredScheduler = createDeferredScheduler();
    let autoReapply = false;
    const resolveVisibleCellRefreshEntries = (pendingRows) => {
        if (pendingRows.length === 0) {
            return [];
        }
        const rowSnapshot = rowModel.getSnapshot();
        const viewportRows = rowModel.getRowsInRange(rowSnapshot.viewportRange);
        if (viewportRows.length === 0) {
            return [];
        }
        const visibleRowIndexByKey = new Map();
        for (const row of viewportRows) {
            visibleRowIndexByKey.set(normalizeRowRefreshKey(row.rowId), row.displayIndex);
        }
        const columnSnapshot = columnModel.getSnapshot();
        const visibleColumnMetaByKey = new Map();
        for (let index = 0; index < columnSnapshot.visibleColumns.length; index += 1) {
            const column = columnSnapshot.visibleColumns[index];
            if (!column) {
                continue;
            }
            visibleColumnMetaByKey.set(column.key, {
                columnIndex: index,
                pin: column.pin,
            });
        }
        const dedupe = new Set();
        const cells = [];
        for (const pendingRow of pendingRows) {
            const rowIndex = visibleRowIndexByKey.get(normalizeRowRefreshKey(pendingRow.rowKey));
            if (typeof rowIndex !== "number") {
                continue;
            }
            for (const columnKey of pendingRow.columnKeys) {
                const columnMeta = visibleColumnMetaByKey.get(columnKey);
                if (!columnMeta) {
                    continue;
                }
                const dedupeKey = `${normalizeRowRefreshKey(pendingRow.rowKey)}|${columnKey}`;
                if (dedupe.has(dedupeKey)) {
                    continue;
                }
                dedupe.add(dedupeKey);
                cells.push({
                    rowKey: pendingRow.rowKey,
                    rowIndex,
                    columnKey,
                    columnIndex: columnMeta.columnIndex,
                    pin: columnMeta.pin,
                });
            }
        }
        cells.sort((left, right) => {
            if (left.rowIndex !== right.rowIndex) {
                return left.rowIndex - right.rowIndex;
            }
            return left.columnIndex - right.columnIndex;
        });
        return cells;
    };
    const cellRefreshRegistry = new DataGridCellRefreshRegistry(resolveVisibleCellRefreshEntries, deferredScheduler.schedule, deferredScheduler.cancel);
    return {
        lifecycle,
        init,
        start,
        stop,
        dispose() {
            cellRefreshRegistry.dispose();
            return dispose();
        },
        getRowModelSnapshot() {
            return rowModel.getSnapshot();
        },
        getRowCount() {
            return rowModel.getRowCount();
        },
        getRow(index) {
            return rowModel.getRow(index);
        },
        getRowsInRange(range) {
            return rowModel.getRowsInRange(range);
        },
        setViewportRange(range) {
            rowModel.setViewportRange(range);
            getViewportService()?.setViewportRange?.(range);
        },
        getPaginationSnapshot() {
            return rowModel.getSnapshot().pagination;
        },
        setPagination(pagination) {
            rowModel.setPagination(pagination);
        },
        setPageSize(pageSize) {
            rowModel.setPageSize(pageSize);
        },
        setCurrentPage(page) {
            rowModel.setCurrentPage(page);
        },
        setSortModel(sortModel) {
            rowModel.setSortModel(sortModel);
        },
        setFilterModel(filterModel) {
            rowModel.setFilterModel(filterModel);
        },
        setSortAndFilterModel(input) {
            const capability = resolveCurrentSortFilterBatchCapability();
            if (capability) {
                capability.setSortAndFilterModel(input);
                return;
            }
            rowModel.setFilterModel(input.filterModel);
            rowModel.setSortModel(input.sortModel);
        },
        setGroupBy(groupBy) {
            rowModel.setGroupBy(groupBy);
        },
        setAggregationModel(aggregationModel) {
            rowModel.setAggregationModel(aggregationModel);
        },
        getAggregationModel() {
            return rowModel.getAggregationModel();
        },
        setGroupExpansion(expansion) {
            rowModel.setGroupExpansion(expansion);
        },
        toggleGroup(groupKey) {
            rowModel.toggleGroup(groupKey);
        },
        expandGroup(groupKey) {
            rowModel.expandGroup(groupKey);
        },
        collapseGroup(groupKey) {
            rowModel.collapseGroup(groupKey);
        },
        expandAllGroups() {
            rowModel.expandAllGroups();
        },
        collapseAllGroups() {
            rowModel.collapseAllGroups();
        },
        refresh(options) {
            return rowModel.refresh(options?.reset ? "reset" : undefined);
        },
        reapplyView() {
            return rowModel.refresh("reapply");
        },
        hasPatchSupport() {
            return resolveCurrentPatchCapability() !== null;
        },
        patchRows(updates, options) {
            const capability = assertPatchCapability(resolveCurrentPatchCapability());
            capability.patchRows(updates, options);
        },
        applyEdits(updates, options) {
            const capability = assertPatchCapability(resolveCurrentPatchCapability());
            const shouldReapply = typeof options?.reapply === "boolean"
                ? options.reapply
                : autoReapply;
            capability.patchRows(updates, {
                recomputeSort: shouldReapply,
                recomputeFilter: shouldReapply,
                recomputeGroup: shouldReapply,
                emit: options?.emit,
            });
        },
        setAutoReapply(value) {
            autoReapply = Boolean(value);
        },
        getAutoReapply() {
            return autoReapply;
        },
        refreshCellsByRowKeys(rowKeys, columnKeys, options) {
            cellRefreshRegistry.queueByRowKeys(rowKeys, columnKeys, options);
        },
        refreshCellsByRanges(ranges, options) {
            cellRefreshRegistry.queueByRanges(ranges, options);
        },
        onCellsRefresh(listener) {
            return cellRefreshRegistry.subscribe(listener);
        },
        getColumnModelSnapshot() {
            return columnModel.getSnapshot();
        },
        getColumn(key) {
            return columnModel.getColumn(key);
        },
        setColumns(columns) {
            columnModel.setColumns(columns);
        },
        setColumnOrder(keys) {
            columnModel.setColumnOrder(keys);
        },
        setColumnVisibility(key, visible) {
            columnModel.setColumnVisibility(key, visible);
        },
        setColumnWidth(key, width) {
            columnModel.setColumnWidth(key, width);
        },
        setColumnPin(key, pin) {
            columnModel.setColumnPin(key, pin);
        },
        hasTransactionSupport() {
            return resolveCurrentTransactionCapability() != null;
        },
        getTransactionSnapshot() {
            const transactionCapability = resolveCurrentTransactionCapability();
            if (!transactionCapability) {
                return null;
            }
            return transactionCapability.getTransactionSnapshot();
        },
        beginTransactionBatch(label) {
            const transaction = assertTransactionCapability(resolveCurrentTransactionCapability());
            return transaction.beginTransactionBatch(label);
        },
        commitTransactionBatch(batchId) {
            const transaction = assertTransactionCapability(resolveCurrentTransactionCapability());
            return transaction.commitTransactionBatch(batchId);
        },
        rollbackTransactionBatch(batchId) {
            const transaction = assertTransactionCapability(resolveCurrentTransactionCapability());
            return transaction.rollbackTransactionBatch(batchId);
        },
        applyTransaction(transactionInput) {
            const transaction = assertTransactionCapability(resolveCurrentTransactionCapability());
            return transaction.applyTransaction(transactionInput);
        },
        canUndoTransaction() {
            const transactionCapability = resolveCurrentTransactionCapability();
            if (!transactionCapability) {
                return false;
            }
            return transactionCapability.canUndoTransaction();
        },
        canRedoTransaction() {
            const transactionCapability = resolveCurrentTransactionCapability();
            if (!transactionCapability) {
                return false;
            }
            return transactionCapability.canRedoTransaction();
        },
        undoTransaction() {
            const transaction = assertTransactionCapability(resolveCurrentTransactionCapability());
            return transaction.undoTransaction();
        },
        redoTransaction() {
            const transaction = assertTransactionCapability(resolveCurrentTransactionCapability());
            return transaction.redoTransaction();
        },
        hasSelectionSupport() {
            return resolveCurrentSelectionCapability() != null;
        },
        getSelectionSnapshot() {
            const selectionCapability = resolveCurrentSelectionCapability();
            if (!selectionCapability) {
                return null;
            }
            return selectionCapability.getSelectionSnapshot();
        },
        setSelectionSnapshot(snapshot) {
            const selection = assertSelectionCapability(resolveCurrentSelectionCapability());
            selection.setSelectionSnapshot(snapshot);
        },
        clearSelection() {
            const selection = assertSelectionCapability(resolveCurrentSelectionCapability());
            selection.clearSelection();
        },
        summarizeSelection(options = {}) {
            const selectionCapability = resolveCurrentSelectionCapability();
            if (!selectionCapability) {
                return null;
            }
            const selectionSnapshot = selectionCapability.getSelectionSnapshot();
            if (!selectionSnapshot) {
                return null;
            }
            const columnSnapshot = columnModel.getSnapshot();
            const visibleColumns = columnSnapshot.visibleColumns;
            const getColumnKeyByIndex = options.getColumnKeyByIndex ?? ((columnIndex) => {
                return visibleColumns[columnIndex]?.key ?? null;
            });
            const scope = options.scope ?? "selected-loaded";
            const viewportRange = rowModel.getSnapshot().viewportRange;
            const includeRowIndex = scope === "selected-visible"
                ? (rowIndex) => rowIndex >= viewportRange.start && rowIndex <= viewportRange.end
                : undefined;
            return createDataGridSelectionSummary({
                selection: selectionSnapshot,
                scope,
                rowCount: rowModel.getRowCount(),
                includeRowIndex,
                getRow: rowIndex => rowModel.getRow(rowIndex),
                getColumnKeyByIndex,
                columns: options.columns,
                defaultAggregations: options.defaultAggregations,
            });
        },
    };
}
