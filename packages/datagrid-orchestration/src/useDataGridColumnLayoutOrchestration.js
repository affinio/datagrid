export function orderDataGridColumns(columns) {
    const left = [];
    const center = [];
    const right = [];
    for (const column of columns) {
        if (column.pin === "left") {
            left.push(column);
            continue;
        }
        if (column.pin === "right") {
            right.push(column);
            continue;
        }
        center.push(column);
    }
    return [...left, ...center, ...right];
}
export function buildDataGridColumnMetrics(columns, resolveColumnWidth) {
    let start = 0;
    return columns.map((column, columnIndex) => {
        const width = resolveColumnWidth(column);
        const metric = {
            key: column.key,
            columnIndex,
            start,
            width,
            end: start + width,
        };
        start += width;
        return metric;
    });
}
function buildStickyLeftOffsets(columns, resolveColumnWidth) {
    const offsets = new Map();
    let offset = 0;
    for (const column of columns) {
        if (column.pin !== "left")
            continue;
        offsets.set(column.key, offset);
        offset += resolveColumnWidth(column);
    }
    return offsets;
}
function buildStickyRightOffsets(columns, resolveColumnWidth) {
    const offsets = new Map();
    let offset = 0;
    for (let index = columns.length - 1; index >= 0; index -= 1) {
        const column = columns[index];
        if (!column || column.pin !== "right")
            continue;
        offsets.set(column.key, offset);
        offset += resolveColumnWidth(column);
    }
    return offsets;
}
function buildVisibleColumnsWindow(columns, virtualWindow) {
    if (!columns.length) {
        return { start: 0, end: 0, total: 0, keys: "none" };
    }
    const total = Math.max(0, Math.trunc(virtualWindow.colTotal));
    const safeTotal = Math.max(0, Math.min(columns.length, total));
    if (safeTotal === 0) {
        return { start: 0, end: 0, total: 0, keys: "none" };
    }
    const startIndex = Math.max(0, Math.min(safeTotal - 1, Math.trunc(virtualWindow.colStart)));
    const endIndex = Math.max(startIndex, Math.min(safeTotal - 1, Math.trunc(virtualWindow.colEnd)));
    return {
        start: startIndex + 1,
        end: endIndex + 1,
        total: safeTotal,
        keys: columns.slice(startIndex, endIndex + 1).map(column => column.key).join(" • ") || "none",
    };
}
export function resolveDataGridColumnCellStyle(snapshot, columnKey) {
    const leftOffset = snapshot.stickyLeftOffsets.get(columnKey);
    if (typeof leftOffset === "number") {
        return { left: `${leftOffset}px` };
    }
    const rightOffset = snapshot.stickyRightOffsets.get(columnKey);
    if (typeof rightOffset === "number") {
        return { right: `${rightOffset}px` };
    }
    return {};
}
export function isDataGridStickyColumn(snapshot, columnKey) {
    return snapshot.stickyLeftOffsets.has(columnKey) || snapshot.stickyRightOffsets.has(columnKey);
}
export function buildDataGridColumnLayers(snapshot) {
    const leftColumns = [];
    const scrollColumns = [];
    const rightColumns = [];
    const leftWidths = [];
    const scrollWidths = [];
    const rightWidths = [];
    for (let index = 0; index < snapshot.orderedColumns.length; index += 1) {
        const column = snapshot.orderedColumns[index];
        const metric = snapshot.orderedColumnMetrics[index];
        if (!column || !metric) {
            continue;
        }
        const width = Math.max(0, metric.width);
        if (column.pin === "left") {
            leftColumns.push(column);
            leftWidths.push(width);
            continue;
        }
        if (column.pin === "right") {
            rightColumns.push(column);
            rightWidths.push(width);
            continue;
        }
        scrollColumns.push(column);
        scrollWidths.push(width);
    }
    const layers = [
        {
            key: "left",
            columns: leftColumns,
            templateColumns: leftWidths.map(width => `${width}px`).join(" "),
            width: leftWidths.reduce((total, width) => total + width, 0),
        },
        {
            key: "scroll",
            columns: scrollColumns,
            templateColumns: scrollWidths.map(width => `${width}px`).join(" "),
            width: scrollWidths.reduce((total, width) => total + width, 0),
        },
        {
            key: "right",
            columns: rightColumns,
            templateColumns: rightWidths.map(width => `${width}px`).join(" "),
            width: rightWidths.reduce((total, width) => total + width, 0),
        },
    ];
    return layers.filter(layer => layer.key === "scroll" || layer.columns.length > 0);
}
export function resolveDataGridLayerTrackTemplate(layers) {
    return layers.map(layer => `${Math.max(0, layer.width)}px`).join(" ");
}
export function useDataGridColumnLayoutOrchestration(options) {
    const orderedColumns = orderDataGridColumns(options.columns);
    const orderedColumnMetrics = buildDataGridColumnMetrics(orderedColumns, options.resolveColumnWidth);
    return {
        orderedColumns,
        orderedColumnMetrics,
        templateColumns: orderedColumnMetrics.map(metric => `${metric.width}px`).join(" "),
        stickyLeftOffsets: buildStickyLeftOffsets(orderedColumns, options.resolveColumnWidth),
        stickyRightOffsets: buildStickyRightOffsets(orderedColumns, options.resolveColumnWidth),
        visibleColumnsWindow: buildVisibleColumnsWindow(orderedColumnMetrics, options.virtualWindow),
    };
}
