export function useDataGridHeaderResizeOrchestration(options) {
    const resizeApplyMode = options.resizeApplyMode ?? "raf";
    const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback));
    const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle));
    let activeColumnResize = null;
    let pendingResizeClientX = null;
    let pendingResizeFrame = null;
    const listeners = new Set();
    function setActiveColumnResize(state) {
        activeColumnResize = state;
        listeners.forEach(listener => listener(state));
    }
    function subscribe(listener) {
        listeners.add(listener);
        listener(activeColumnResize);
        return () => {
            listeners.delete(listener);
        };
    }
    function clampColumnWidth(columnKey, width) {
        const minWidth = options.resolveColumnMinWidth(columnKey);
        const rounded = Math.round(width);
        return Math.max(minWidth, Math.min(options.autoSizeMaxWidth, rounded));
    }
    function resolveColumnCurrentWidth(columnKey) {
        const override = options.resolveColumnWidthOverride(columnKey);
        if (typeof override === "number") {
            return override;
        }
        const baseWidth = options.resolveColumnBaseWidth(columnKey);
        if (typeof baseWidth === "number") {
            return baseWidth;
        }
        return options.resolveColumnMinWidth(columnKey);
    }
    function setColumnWidth(columnKey, width) {
        options.applyColumnWidth(columnKey, clampColumnWidth(columnKey, width));
    }
    function cancelPendingResizeFrame() {
        if (pendingResizeFrame === null) {
            return;
        }
        cancelFrame(pendingResizeFrame);
        pendingResizeFrame = null;
    }
    function canUseRaf() {
        return resizeApplyMode === "raf" && typeof window !== "undefined";
    }
    function applyResizeFromClientX(clientX) {
        if (!activeColumnResize) {
            return false;
        }
        const delta = clientX - activeColumnResize.startClientX;
        const nextWidth = clampColumnWidth(activeColumnResize.columnKey, activeColumnResize.startWidth + delta);
        if (nextWidth === activeColumnResize.lastWidth) {
            return false;
        }
        setColumnWidth(activeColumnResize.columnKey, nextWidth);
        setActiveColumnResize({
            ...activeColumnResize,
            lastWidth: nextWidth,
        });
        return true;
    }
    function flushPendingResize() {
        if (pendingResizeClientX === null) {
            return false;
        }
        const nextClientX = pendingResizeClientX;
        pendingResizeClientX = null;
        return applyResizeFromClientX(nextClientX);
    }
    function schedulePendingResizeFlush() {
        if (!canUseRaf()) {
            flushPendingResize();
            return;
        }
        if (pendingResizeFrame !== null) {
            return;
        }
        pendingResizeFrame = requestFrame(() => {
            pendingResizeFrame = null;
            flushPendingResize();
        });
    }
    function sampleRowsForAutoSize(rows, maxSamples) {
        if (rows.length <= maxSamples) {
            return rows;
        }
        const step = Math.max(1, Math.floor(rows.length / maxSamples));
        const sample = [];
        for (let index = 0; index < rows.length && sample.length < maxSamples; index += step) {
            const row = rows[index];
            if (row) {
                sample.push(row);
            }
        }
        return sample;
    }
    function estimateColumnAutoWidth(columnKey) {
        const columnLabel = options.resolveColumnLabel(columnKey) ?? columnKey;
        const rows = sampleRowsForAutoSize(options.resolveRowsForAutoSize(), options.autoSizeSampleLimit);
        let maxTextLength = String(columnLabel).length;
        for (const row of rows) {
            const text = options.resolveCellText(row, columnKey);
            if (text.length > maxTextLength) {
                maxTextLength = text.length;
            }
        }
        const estimated = maxTextLength * options.autoSizeCharWidth + options.autoSizeHorizontalPadding;
        return clampColumnWidth(columnKey, estimated);
    }
    function onHeaderResizeHandleMouseDown(columnKey, event) {
        if (event.button !== 0 || !options.isColumnResizable(columnKey)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (options.isFillDragging()) {
            options.stopFillSelection(false);
        }
        if (options.isDragSelecting()) {
            options.stopDragSelection();
        }
        cancelPendingResizeFrame();
        pendingResizeClientX = null;
        const startWidth = resolveColumnCurrentWidth(columnKey);
        setActiveColumnResize({
            columnKey,
            startClientX: event.clientX,
            startWidth,
            lastWidth: startWidth,
        });
    }
    function onHeaderResizeHandleDoubleClick(columnKey, event) {
        if (!options.isColumnResizable(columnKey)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const nextWidth = estimateColumnAutoWidth(columnKey);
        setColumnWidth(columnKey, nextWidth);
        options.setLastAction(`Auto-sized ${columnKey} to ${nextWidth}px`);
    }
    function applyColumnResizeFromPointer(clientX) {
        if (!activeColumnResize) {
            return;
        }
        pendingResizeClientX = clientX;
        schedulePendingResizeFlush();
    }
    function stopColumnResize() {
        if (!activeColumnResize) {
            return;
        }
        flushPendingResize();
        cancelPendingResizeFrame();
        pendingResizeClientX = null;
        const state = activeColumnResize;
        setActiveColumnResize(null);
        options.setLastAction(`Resized ${state.columnKey} to ${state.lastWidth}px`);
    }
    function dispose() {
        cancelPendingResizeFrame();
        pendingResizeClientX = null;
        setActiveColumnResize(null);
    }
    return {
        getActiveColumnResize: () => activeColumnResize,
        isColumnResizing: () => activeColumnResize !== null,
        subscribe,
        setColumnWidth,
        estimateColumnAutoWidth,
        onHeaderResizeHandleMouseDown,
        onHeaderResizeHandleDoubleClick,
        applyColumnResizeFromPointer,
        stopColumnResize,
        dispose,
    };
}
