function rangesEqual(a, b) {
    if (!a || !b) {
        return false;
    }
    return (a.startRow === b.startRow &&
        a.endRow === b.endRow &&
        a.startColumn === b.startColumn &&
        a.endColumn === b.endColumn);
}
function snapOverlayValue(value, resolveDevicePixelRatio) {
    const rawDpr = resolveDevicePixelRatio?.() ?? 1;
    const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
    return Math.round(value * dpr) / dpr;
}
function clampOverlayRange(range, options) {
    if (!range) {
        return null;
    }
    const maxRow = options.rowTotal - 1;
    const maxColumn = options.colTotal - 1;
    if (maxRow < 0 || maxColumn < 0) {
        return null;
    }
    const startRow = Math.max(0, Math.min(maxRow, Math.trunc(range.startRow)));
    const endRow = Math.max(startRow, Math.min(maxRow, Math.trunc(range.endRow)));
    const startColumn = Math.max(0, Math.min(maxColumn, Math.trunc(range.startColumn)));
    const endColumn = Math.max(startColumn, Math.min(maxColumn, Math.trunc(range.endColumn)));
    return {
        startRow,
        endRow,
        startColumn,
        endColumn,
    };
}
function buildScrollOverlaySegments(range, keyPrefix, headerHeight, rowHeight, resolveRowHeight, resolveRowOffset, orderedColumns, orderedColumnMetrics, resolveDevicePixelRatio) {
    if (!range) {
        return [];
    }
    const resolveOffset = (rowIndex) => {
        if (resolveRowOffset) {
            return resolveRowOffset(rowIndex);
        }
        if (resolveRowHeight) {
            let offset = 0;
            for (let index = 0; index < rowIndex; index += 1) {
                offset += resolveRowHeight(index);
            }
            return offset;
        }
        return rowIndex * rowHeight;
    };
    const resolveSpanHeight = (start, end) => {
        if (!resolveRowHeight) {
            return (end - start + 1) * rowHeight;
        }
        let height = 0;
        for (let index = start; index <= end; index += 1) {
            height += resolveRowHeight(index);
        }
        return height;
    };
    const top = headerHeight + resolveOffset(range.startRow);
    const height = resolveSpanHeight(range.startRow, range.endRow);
    const segments = [];
    let currentMode = null;
    let currentStart = range.startColumn;
    for (let index = range.startColumn; index <= range.endColumn; index += 1) {
        const column = orderedColumns[index];
        const mode = column?.pin === "left" ? "pinned-left" : "scroll";
        if (!currentMode) {
            currentMode = mode;
            currentStart = index;
            continue;
        }
        if (mode === currentMode) {
            continue;
        }
        segments.push({ start: currentStart, end: index - 1, mode: currentMode });
        currentMode = mode;
        currentStart = index;
    }
    if (currentMode) {
        segments.push({ start: currentStart, end: range.endColumn, mode: currentMode });
    }
    return segments
        .map(segment => {
        if (segment.mode !== "scroll") {
            return null;
        }
        const startMetric = orderedColumnMetrics[segment.start];
        const endMetric = orderedColumnMetrics[segment.end];
        if (!startMetric || !endMetric) {
            return null;
        }
        const left = snapOverlayValue(startMetric.start, resolveDevicePixelRatio);
        const width = snapOverlayValue(endMetric.end - startMetric.start, resolveDevicePixelRatio);
        const snappedTop = snapOverlayValue(top, resolveDevicePixelRatio);
        const snappedHeight = snapOverlayValue(height, resolveDevicePixelRatio);
        return {
            key: `${keyPrefix}-${segment.mode}-${segment.start}-${segment.end}`,
            mode: "scroll",
            style: {
                top: `${Math.max(0, snappedTop)}px`,
                left: `${Math.max(0, left)}px`,
                width: `${Math.max(1, width)}px`,
                height: `${Math.max(1, snappedHeight)}px`,
            },
        };
    })
        .filter((segment) => segment !== null);
}
export function useDataGridSelectionOverlayOrchestration(options) {
    const rowTotal = Math.max(0, Math.trunc(options.virtualWindow.rowTotal));
    const colTotal = Math.max(0, Math.min(options.orderedColumns.length, Math.trunc(options.virtualWindow.colTotal)));
    const cellSelectionRange = clampOverlayRange(options.cellSelectionRange, { rowTotal, colTotal });
    const fillPreviewRange = clampOverlayRange(options.fillPreviewRange, { rowTotal, colTotal });
    const fillBaseRange = clampOverlayRange(options.fillBaseRange, { rowTotal, colTotal });
    const rangeMovePreviewRange = clampOverlayRange(options.rangeMovePreviewRange, { rowTotal, colTotal });
    const rangeMoveBaseRange = clampOverlayRange(options.rangeMoveBaseRange, { rowTotal, colTotal });
    const cellSelectionOverlaySegments = buildScrollOverlaySegments(cellSelectionRange, "selection", options.headerHeight, options.rowHeight, options.resolveRowHeight, options.resolveRowOffset, options.orderedColumns, options.orderedColumnMetrics, options.resolveDevicePixelRatio);
    const fillPreviewOverlaySegments = !fillPreviewRange ||
        !fillBaseRange ||
        rangesEqual(fillPreviewRange, fillBaseRange)
        ? []
        : buildScrollOverlaySegments(fillPreviewRange, "fill-preview", options.headerHeight, options.rowHeight, options.resolveRowHeight, options.resolveRowOffset, options.orderedColumns, options.orderedColumnMetrics, options.resolveDevicePixelRatio);
    const rangeMoveOverlaySegments = !options.isRangeMoving ||
        !rangeMovePreviewRange ||
        !rangeMoveBaseRange ||
        rangesEqual(rangeMovePreviewRange, rangeMoveBaseRange)
        ? []
        : buildScrollOverlaySegments(rangeMovePreviewRange, "move-preview", options.headerHeight, options.rowHeight, options.resolveRowHeight, options.resolveRowOffset, options.orderedColumns, options.orderedColumnMetrics, options.resolveDevicePixelRatio);
    return {
        cellSelectionOverlaySegments,
        fillPreviewOverlaySegments,
        rangeMoveOverlaySegments,
    };
}
