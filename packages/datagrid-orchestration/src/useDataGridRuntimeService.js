import { createDataGridRuntime } from "./createDataGridRuntime";
function isMutableRowsModel(model) {
    return typeof model.setRows === "function";
}
function normalizeCount(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.trunc(value));
}
function normalizeRange(start, end, total) {
    if (total <= 0) {
        return { start: 0, end: 0 };
    }
    const safeStart = Math.max(0, Math.min(total - 1, normalizeCount(start)));
    const safeEnd = Math.max(safeStart, Math.min(total - 1, normalizeCount(end)));
    return {
        start: safeStart,
        end: safeEnd,
    };
}
function cloneVirtualWindow(snapshot) {
    if (!snapshot) {
        return null;
    }
    return {
        rowStart: snapshot.rowStart,
        rowEnd: snapshot.rowEnd,
        rowTotal: snapshot.rowTotal,
        colStart: snapshot.colStart,
        colEnd: snapshot.colEnd,
        colTotal: snapshot.colTotal,
        overscan: {
            top: snapshot.overscan.top,
            bottom: snapshot.overscan.bottom,
            left: snapshot.overscan.left,
            right: snapshot.overscan.right,
        },
    };
}
function isSameVirtualWindow(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return (left.rowStart === right.rowStart &&
        left.rowEnd === right.rowEnd &&
        left.rowTotal === right.rowTotal &&
        left.colStart === right.colStart &&
        left.colEnd === right.colEnd &&
        left.colTotal === right.colTotal &&
        left.overscan.top === right.overscan.top &&
        left.overscan.bottom === right.overscan.bottom &&
        left.overscan.left === right.overscan.left &&
        left.overscan.right === right.overscan.right);
}
export function useDataGridRuntimeService(options) {
    const runtime = createDataGridRuntime(options);
    const { rowModel, columnModel, core, api } = runtime;
    let started = false;
    let disposed = false;
    const virtualWindowListeners = new Set();
    const resolveVirtualWindowFromViewportService = () => {
        const viewportService = core.getService("viewport");
        const rawWindow = viewportService.getVirtualWindow?.();
        if (!rawWindow || typeof rawWindow !== "object") {
            return null;
        }
        const value = rawWindow;
        const rowTotal = normalizeCount(value.rowTotal);
        const colTotal = normalizeCount(value.colTotal);
        const rowRange = normalizeRange(value.rowStart, value.rowEnd, rowTotal);
        const colRange = normalizeRange(value.colStart, value.colEnd, colTotal);
        const overscanSource = value.overscan;
        return {
            rowStart: rowRange.start,
            rowEnd: rowRange.end,
            rowTotal,
            colStart: colRange.start,
            colEnd: colRange.end,
            colTotal,
            overscan: {
                top: normalizeCount(overscanSource?.top),
                bottom: normalizeCount(overscanSource?.bottom),
                left: normalizeCount(overscanSource?.left),
                right: normalizeCount(overscanSource?.right),
            },
        };
    };
    const buildFallbackVirtualWindow = () => {
        const rowSnapshot = rowModel.getSnapshot();
        const rowTotal = normalizeCount(rowSnapshot.rowCount);
        const rowRange = normalizeRange(rowSnapshot.viewportRange.start, rowSnapshot.viewportRange.end, rowTotal);
        const colTotal = normalizeCount(columnModel.getSnapshot().visibleColumns.length);
        const colRange = normalizeRange(0, Math.max(0, colTotal - 1), colTotal);
        return {
            rowStart: rowRange.start,
            rowEnd: rowRange.end,
            rowTotal,
            colStart: colRange.start,
            colEnd: colRange.end,
            colTotal,
            overscan: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
            },
        };
    };
    const resolveVirtualWindowSnapshot = () => (resolveVirtualWindowFromViewportService() ?? buildFallbackVirtualWindow());
    let virtualWindowSnapshot = resolveVirtualWindowSnapshot();
    const emitVirtualWindow = () => {
        for (const listener of virtualWindowListeners) {
            listener(cloneVirtualWindow(virtualWindowSnapshot));
        }
    };
    const recomputeVirtualWindow = () => {
        const nextSnapshot = resolveVirtualWindowSnapshot();
        if (isSameVirtualWindow(virtualWindowSnapshot, nextSnapshot)) {
            return;
        }
        virtualWindowSnapshot = nextSnapshot;
        emitVirtualWindow();
    };
    const unsubscribeRowModel = rowModel.subscribe(() => {
        recomputeVirtualWindow();
    });
    const unsubscribeColumnModelForWindow = columnModel.subscribe(() => {
        recomputeVirtualWindow();
    });
    function getColumnSnapshot() {
        return api.getColumnModelSnapshot();
    }
    function subscribeColumnSnapshot(listener) {
        listener(getColumnSnapshot());
        const unsubscribe = columnModel.subscribe(next => {
            listener(next);
        });
        return () => {
            unsubscribe();
        };
    }
    function setRows(rows) {
        if (!isMutableRowsModel(rowModel)) {
            return;
        }
        rowModel.setRows(rows);
        recomputeVirtualWindow();
    }
    function patchRows(updates, options) {
        if (!isMutableRowsModel(rowModel) || typeof rowModel.patchRows !== "function") {
            return;
        }
        rowModel.patchRows(updates, options);
        recomputeVirtualWindow();
    }
    function setColumns(columns) {
        columnModel.setColumns(columns);
        recomputeVirtualWindow();
    }
    async function start() {
        if (disposed || started) {
            return;
        }
        await api.start();
        started = true;
        recomputeVirtualWindow();
    }
    function stop() {
        if (disposed) {
            return;
        }
        unsubscribeRowModel();
        unsubscribeColumnModelForWindow();
        virtualWindowListeners.clear();
        void core.dispose();
        started = false;
        disposed = true;
    }
    function syncRowsInRange(range) {
        api.setViewportRange(range);
        const rows = api.getRowsInRange(range);
        recomputeVirtualWindow();
        return rows;
    }
    function getVirtualWindowSnapshot() {
        return cloneVirtualWindow(virtualWindowSnapshot);
    }
    function subscribeVirtualWindow(listener) {
        listener(getVirtualWindowSnapshot());
        virtualWindowListeners.add(listener);
        return () => {
            virtualWindowListeners.delete(listener);
        };
    }
    return {
        rowModel,
        columnModel,
        core,
        api,
        getColumnSnapshot,
        subscribeColumnSnapshot,
        getVirtualWindowSnapshot,
        subscribeVirtualWindow,
        setRows,
        patchRows,
        setColumns,
        start,
        stop,
        syncRowsInRange,
        isStarted: () => started,
        isDisposed: () => disposed,
    };
}
