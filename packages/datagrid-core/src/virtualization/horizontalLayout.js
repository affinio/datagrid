import { resolveColumnWidth } from "./columnSizing";
export function computeColumnLayout(input) {
    const pinnedLeft = [];
    const pinnedRight = [];
    const scrollableColumns = [];
    const scrollableIndices = [];
    const scrollableWidths = [];
    const scrollableOffsets = [];
    let accumulatedWidth = 0;
    let pinnedLeftCursor = 0;
    let pinnedRightCursor = 0;
    const pinnedRightBuffer = [];
    input.columns.forEach((column, index) => {
        const pin = input.resolvePinMode(column);
        const width = resolveColumnWidth(column, input.zoom);
        const metric = { column, index, width, pin, offset: 0 };
        if (pin === "left") {
            metric.offset = pinnedLeftCursor;
            pinnedLeftCursor += width;
            pinnedLeft.push(metric);
            return;
        }
        if (pin === "right") {
            pinnedRightBuffer.push(metric);
            return;
        }
        scrollableColumns.push(column);
        scrollableIndices.push(index);
        scrollableOffsets.push(accumulatedWidth);
        scrollableWidths.push(width);
        accumulatedWidth += width;
    });
    if (pinnedRightBuffer.length) {
        for (let index = pinnedRightBuffer.length - 1; index >= 0; index -= 1) {
            const metric = pinnedRightBuffer[index];
            if (!metric) {
                continue;
            }
            metric.offset = pinnedRightCursor;
            pinnedRightCursor += metric.width;
            pinnedRight.unshift(metric);
        }
    }
    const scrollableMetrics = {
        widths: scrollableWidths,
        offsets: scrollableOffsets,
        totalWidth: accumulatedWidth,
    };
    const pinnedLeftWidth = pinnedLeft.reduce((sum, metric) => sum + metric.width, 0);
    const pinnedRightWidth = pinnedRight.reduce((sum, metric) => sum + metric.width, 0);
    return {
        zoom: input.zoom,
        pinnedLeft,
        pinnedRight,
        pinnedLeftWidth,
        pinnedRightWidth,
        scrollableColumns,
        scrollableIndices,
        scrollableMetrics,
    };
}
