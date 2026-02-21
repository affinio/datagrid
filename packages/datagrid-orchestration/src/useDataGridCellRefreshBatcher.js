function createRafScheduler() {
    if (typeof globalThis.requestAnimationFrame === "function") {
        return {
            schedule: cb => globalThis.requestAnimationFrame(() => cb()),
            cancel: handle => {
                if (typeof handle === "number") {
                    globalThis.cancelAnimationFrame(handle);
                }
            },
        };
    }
    return {
        schedule: cb => globalThis.setTimeout(cb, 16),
        cancel: handle => globalThis.clearTimeout(handle),
    };
}
export function useDataGridCellRefreshBatcher(api, options = {}) {
    const scheduler = createRafScheduler();
    const pendingByRow = new Map();
    let frameHandle = null;
    const pendingReasons = new Set();
    const normalizeReason = (value) => {
        if (typeof value !== "string") {
            return "";
        }
        return value.trim();
    };
    const resolveCallReason = (refreshOptions) => {
        return normalizeReason(refreshOptions?.reason) || normalizeReason(options.defaultOptions?.reason);
    };
    const resolvePendingFlushOptions = () => {
        if (pendingReasons.size === 0) {
            return undefined;
        }
        return {
            reason: Array.from(pendingReasons).join(","),
        };
    };
    const resolvePositiveInteger = (value, fallback) => {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        const normalized = Math.trunc(value ?? fallback);
        return normalized > 0 ? normalized : fallback;
    };
    const resolveNonNegativeNumber = (value, fallback) => {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        return Math.max(0, value ?? fallback);
    };
    const resolveNow = () => {
        if (typeof globalThis.performance?.now === "function") {
            return globalThis.performance.now();
        }
        return Date.now();
    };
    const maxBatchSize = resolvePositiveInteger(options.maxBatchSize, Number.POSITIVE_INFINITY);
    const frameBudgetMs = resolveNonNegativeNumber(options.frameBudgetMs, Number.POSITIVE_INFINITY);
    const normalizeRowKey = (rowKey) => {
        if (typeof rowKey === "number") {
            return `n:${rowKey}`;
        }
        return `s:${rowKey}`;
    };
    const normalizeColumnKey = (columnKey) => {
        if (typeof columnKey !== "string") {
            return null;
        }
        const normalized = columnKey.trim();
        return normalized.length > 0 ? normalized : null;
    };
    const doFlush = () => {
        frameHandle = null;
        if (pendingByRow.size === 0) {
            pendingReasons.clear();
            return;
        }
        const startedAt = resolveNow();
        const ranges = [];
        let cellsCount = 0;
        for (const [pendingKey, pending] of pendingByRow.entries()) {
            if (pending.columnKeys.size === 0) {
                pendingByRow.delete(pendingKey);
                continue;
            }
            ranges.push({
                rowKey: pending.rowKey,
                columnKeys: Array.from(pending.columnKeys),
            });
            cellsCount += pending.columnKeys.size;
            pendingByRow.delete(pendingKey);
            if (ranges.length >= maxBatchSize) {
                break;
            }
            if (resolveNow() - startedAt >= frameBudgetMs) {
                break;
            }
        }
        if (ranges.length === 0) {
            pendingReasons.clear();
            return;
        }
        const flushOptions = resolvePendingFlushOptions();
        api.refreshCellsByRanges(ranges, flushOptions);
        options.onBatchFlush?.(ranges.length, cellsCount);
        if (pendingByRow.size > 0) {
            scheduleFlush();
            return;
        }
        pendingReasons.clear();
    };
    const scheduleFlush = () => {
        if (frameHandle != null) {
            return;
        }
        frameHandle = scheduler.schedule(() => doFlush());
    };
    const queueByRanges = (ranges, refreshOptions) => {
        const callReason = resolveCallReason(refreshOptions);
        if (callReason) {
            pendingReasons.add(callReason);
        }
        for (const range of ranges) {
            const pendingRowKey = normalizeRowKey(range.rowKey);
            const pending = pendingByRow.get(pendingRowKey) ?? {
                rowKey: range.rowKey,
                columnKeys: new Set(),
            };
            for (const rawColumnKey of range.columnKeys) {
                const columnKey = normalizeColumnKey(rawColumnKey);
                if (!columnKey) {
                    continue;
                }
                pending.columnKeys.add(columnKey);
            }
            if (pending.columnKeys.size > 0) {
                pendingByRow.set(pendingRowKey, pending);
            }
        }
        const shouldFlushImmediate = refreshOptions?.immediate ?? options.immediate ?? false;
        if (shouldFlushImmediate) {
            if (frameHandle != null) {
                scheduler.cancel(frameHandle);
                frameHandle = null;
            }
            doFlush();
            return;
        }
        scheduleFlush();
    };
    const queueByRowKeys = (rowKeys, columnKeys, refreshOptions) => {
        queueByRanges(rowKeys.map(rowKey => ({ rowKey, columnKeys })), refreshOptions);
    };
    return {
        queueByRowKeys,
        queueByRanges,
        flush: doFlush,
        dispose() {
            pendingByRow.clear();
            pendingReasons.clear();
            if (frameHandle != null) {
                scheduler.cancel(frameHandle);
                frameHandle = null;
            }
        },
    };
}
