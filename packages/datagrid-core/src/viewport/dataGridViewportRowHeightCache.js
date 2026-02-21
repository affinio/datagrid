const DEFAULT_LIMIT = 512;
const MIN_HEIGHT = 8;
const MAX_HEIGHT = 640;
function normalizeLimit(limit) {
    if (!Number.isFinite(limit)) {
        return DEFAULT_LIMIT;
    }
    return Math.max(1, Math.trunc(limit));
}
function normalizeHeight(height) {
    if (!Number.isFinite(height)) {
        return null;
    }
    const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Number(height)));
    return Number.isFinite(clamped) ? clamped : null;
}
function normalizeFallbackHeight(fallback) {
    if (!Number.isFinite(fallback) || fallback <= 0) {
        return 32;
    }
    const normalized = normalizeHeight(fallback);
    return normalized ?? 32;
}
function normalizeIndex(index) {
    if (!Number.isFinite(index)) {
        return null;
    }
    const normalized = Math.trunc(index);
    return normalized >= 0 ? normalized : null;
}
function normalizeRange(range) {
    if (!range) {
        return null;
    }
    const start = normalizeIndex(range.start);
    const end = normalizeIndex(range.end);
    if (start == null || end == null) {
        return null;
    }
    return {
        start: Math.min(start, end),
        end: Math.max(start, end),
    };
}
export function createDataGridViewportRowHeightCache(options = {}) {
    const limit = normalizeLimit(options.limit);
    const entries = new Map();
    let total = 0;
    const deleteKey = (index) => {
        const previous = entries.get(index);
        if (previous == null) {
            return false;
        }
        total -= previous;
        entries.delete(index);
        return true;
    };
    const setKey = (index, height) => {
        const previous = entries.get(index);
        if (previous != null) {
            if (Math.abs(previous - height) < 0.01) {
                entries.delete(index);
                entries.set(index, previous);
                return false;
            }
            total -= previous;
            entries.delete(index);
        }
        entries.set(index, height);
        total += height;
        while (entries.size > limit) {
            const oldest = entries.keys().next().value;
            if (oldest == null) {
                break;
            }
            deleteKey(oldest);
        }
        return true;
    };
    return {
        limit,
        clear() {
            entries.clear();
            total = 0;
        },
        deleteRange(range) {
            const normalizedRange = normalizeRange(range);
            if (!normalizedRange) {
                return;
            }
            const { start, end } = normalizedRange;
            for (const index of entries.keys()) {
                if (index < start || index > end) {
                    continue;
                }
                deleteKey(index);
            }
        },
        ingest(measurements) {
            if (!Array.isArray(measurements) || measurements.length === 0) {
                return false;
            }
            let changed = false;
            for (const measurement of measurements) {
                const index = normalizeIndex(measurement.index);
                const height = normalizeHeight(measurement.height);
                if (index == null || height == null) {
                    continue;
                }
                if (setKey(index, height)) {
                    changed = true;
                }
            }
            return changed;
        },
        resolveEstimatedHeight(fallback) {
            if (entries.size <= 0) {
                return normalizeFallbackHeight(fallback);
            }
            const average = total / entries.size;
            const normalized = normalizeHeight(average);
            return normalized ?? normalizeFallbackHeight(fallback);
        },
        getSnapshot() {
            const size = entries.size;
            if (size <= 0) {
                return {
                    size: 0,
                    limit,
                    average: 0,
                    min: 0,
                    max: 0,
                };
            }
            let min = Number.POSITIVE_INFINITY;
            let max = Number.NEGATIVE_INFINITY;
            for (const value of entries.values()) {
                if (value < min) {
                    min = value;
                }
                if (value > max) {
                    max = value;
                }
            }
            return {
                size,
                limit,
                average: total / size,
                min: Number.isFinite(min) ? min : 0,
                max: Number.isFinite(max) ? max : 0,
            };
        },
    };
}
