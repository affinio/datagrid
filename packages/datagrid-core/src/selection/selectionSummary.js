const DEFAULT_AGGREGATIONS = [
    "count",
    "countDistinct",
    "sum",
    "avg",
    "min",
    "max",
];
function readByPath(value, path) {
    if (!path || typeof value !== "object" || value === null) {
        return undefined;
    }
    const segments = path.split(".").filter(Boolean);
    let current = value;
    for (const segment of segments) {
        if (typeof current !== "object" || current === null || !(segment in current)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
function toComparableNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function toDistinctKey(value) {
    if (value == null) {
        return "null";
    }
    if (value instanceof Date) {
        return `date:${value.toISOString()}`;
    }
    const kind = typeof value;
    if (kind === "number" || kind === "string" || kind === "boolean" || kind === "bigint") {
        return `${kind}:${String(value)}`;
    }
    try {
        return `json:${JSON.stringify(value)}`;
    }
    catch {
        return `repr:${String(value)}`;
    }
}
function ensureColumnAccumulator(map, columnKey, aggregations) {
    const cached = map.get(columnKey);
    if (cached) {
        return cached;
    }
    const accumulator = {
        key: columnKey,
        selectedCellCount: 0,
        distinctValues: new Set(),
        numericCount: 0,
        numericSum: 0,
        numericMin: Number.POSITIVE_INFINITY,
        numericMax: Number.NEGATIVE_INFINITY,
        aggregations,
    };
    map.set(columnKey, accumulator);
    return accumulator;
}
function finalizeMetrics(accumulator) {
    const metrics = {
        count: null,
        countDistinct: null,
        sum: null,
        avg: null,
        min: null,
        max: null,
    };
    for (const aggregation of accumulator.aggregations) {
        if (aggregation === "count") {
            metrics.count = accumulator.selectedCellCount;
            continue;
        }
        if (aggregation === "countDistinct") {
            metrics.countDistinct = accumulator.distinctValues.size;
            continue;
        }
        if (aggregation === "sum") {
            metrics.sum = accumulator.numericCount > 0 ? accumulator.numericSum : null;
            continue;
        }
        if (aggregation === "avg") {
            metrics.avg = accumulator.numericCount > 0 ? accumulator.numericSum / accumulator.numericCount : null;
            continue;
        }
        if (aggregation === "min") {
            metrics.min = accumulator.numericCount > 0 ? accumulator.numericMin : null;
            continue;
        }
        if (aggregation === "max") {
            metrics.max = accumulator.numericCount > 0 ? accumulator.numericMax : null;
            continue;
        }
    }
    return metrics;
}
function normalizeAggregations(aggregations, fallback) {
    const source = Array.isArray(aggregations) && aggregations.length > 0 ? aggregations : fallback;
    const unique = new Set();
    for (const aggregation of source) {
        if (aggregation === "count" ||
            aggregation === "countDistinct" ||
            aggregation === "sum" ||
            aggregation === "avg" ||
            aggregation === "min" ||
            aggregation === "max") {
            unique.add(aggregation);
        }
    }
    return unique.size > 0 ? Array.from(unique) : [...DEFAULT_AGGREGATIONS];
}
function readDefaultCellValue(rowNode, columnKey) {
    const source = rowNode.data;
    if (typeof source !== "object" || source === null) {
        return undefined;
    }
    const direct = source[columnKey];
    if (typeof direct !== "undefined") {
        return direct;
    }
    return readByPath(source, columnKey);
}
export function createDataGridSelectionSummary(options) {
    const scope = options.scope ?? "selected-loaded";
    const selection = options.selection;
    if (!selection || !Array.isArray(selection.ranges) || selection.ranges.length === 0) {
        return {
            scope,
            isPartial: false,
            missingRowCount: 0,
            selectedCells: 0,
            selectedRows: 0,
            columns: {},
        };
    }
    const rowCount = Number.isFinite(options.rowCount) ? Math.max(0, Math.trunc(options.rowCount)) : 0;
    if (rowCount <= 0) {
        return {
            scope,
            isPartial: false,
            missingRowCount: 0,
            selectedCells: 0,
            selectedRows: 0,
            columns: {},
        };
    }
    const columnConfigMap = new Map();
    for (const column of options.columns ?? []) {
        if (typeof column.key !== "string" || column.key.trim().length === 0) {
            continue;
        }
        columnConfigMap.set(column.key, column);
    }
    const defaultAggregations = normalizeAggregations(options.defaultAggregations, DEFAULT_AGGREGATIONS);
    const seenCells = new Set();
    const seenRows = new Set();
    const accumulators = new Map();
    let missingRowCount = 0;
    for (const range of selection.ranges) {
        const startRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.min(range.startRow, range.endRow))));
        const endRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.max(range.startRow, range.endRow))));
        const startCol = Math.max(0, Math.trunc(Math.min(range.startCol, range.endCol)));
        const endCol = Math.max(0, Math.trunc(Math.max(range.startCol, range.endCol)));
        for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
            if (typeof options.includeRowIndex === "function" && !options.includeRowIndex(rowIndex)) {
                continue;
            }
            const rowNode = options.getRow(rowIndex);
            if (!rowNode) {
                missingRowCount += 1;
                continue;
            }
            for (let colIndex = startCol; colIndex <= endCol; colIndex += 1) {
                const cellKey = `${rowIndex}:${colIndex}`;
                if (seenCells.has(cellKey)) {
                    continue;
                }
                const columnKey = options.getColumnKeyByIndex(colIndex);
                if (typeof columnKey !== "string" || columnKey.length === 0) {
                    continue;
                }
                seenCells.add(cellKey);
                seenRows.add(rowIndex);
                const columnConfig = columnConfigMap.get(columnKey);
                const aggregations = normalizeAggregations(columnConfig?.aggregations, defaultAggregations);
                const accumulator = ensureColumnAccumulator(accumulators, columnKey, aggregations);
                const value = typeof columnConfig?.valueGetter === "function"
                    ? columnConfig.valueGetter(rowNode)
                    : readDefaultCellValue(rowNode, columnKey);
                accumulator.selectedCellCount += 1;
                accumulator.distinctValues.add(toDistinctKey(value));
                const numeric = toComparableNumber(value);
                if (numeric != null) {
                    accumulator.numericCount += 1;
                    accumulator.numericSum += numeric;
                    if (numeric < accumulator.numericMin) {
                        accumulator.numericMin = numeric;
                    }
                    if (numeric > accumulator.numericMax) {
                        accumulator.numericMax = numeric;
                    }
                }
            }
        }
    }
    const columns = {};
    for (const [columnKey, accumulator] of accumulators.entries()) {
        columns[columnKey] = {
            key: columnKey,
            selectedCellCount: accumulator.selectedCellCount,
            metrics: finalizeMetrics(accumulator),
        };
    }
    return {
        scope,
        isPartial: missingRowCount > 0,
        missingRowCount,
        selectedCells: seenCells.size,
        selectedRows: seenRows.size,
        columns,
    };
}
