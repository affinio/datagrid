import { isGroupExpanded, } from "./rowModel.js";
function enforceCacheCap(cache, maxSize) {
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
        cache.clear();
        return;
    }
    while (cache.size > maxSize) {
        const next = cache.keys().next();
        if (next.done) {
            break;
        }
        cache.delete(next.value);
    }
}
function buildGroupKey(segments) {
    let encoded = "group:";
    for (const segment of segments) {
        encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`;
    }
    return encoded;
}
export function buildGroupedRowsProjection(options) {
    const { inputRows, groupBy, expansionSnapshot, readRowField, normalizeText, normalizeLeafRow, groupValueCache, groupValueCounters, maxGroupValueCacheSize, } = options;
    const fields = groupBy.fields;
    const expansionToggledKeys = new Set(expansionSnapshot.toggledGroupKeys);
    if (fields.length === 0) {
        return inputRows.map(row => normalizeLeafRow(row));
    }
    const resolveGroupedValue = (row, field) => {
        const cacheKey = `${String(row.rowId)}::${field}`;
        const cache = groupValueCache;
        const cached = cache?.get(cacheKey);
        if (typeof cached !== "undefined") {
            if (cache) {
                cache.delete(cacheKey);
                cache.set(cacheKey, cached);
            }
            if (groupValueCounters) {
                groupValueCounters.hits += 1;
            }
            return cached;
        }
        const computed = normalizeText(readRowField(row, field));
        if (cache) {
            cache.set(cacheKey, computed);
            enforceCacheCap(cache, maxGroupValueCacheSize ?? 0);
            if (groupValueCounters) {
                groupValueCounters.misses += 1;
            }
        }
        return computed;
    };
    const projectLevel = (rowIndexesAtLevel, level, path) => {
        if (level >= fields.length) {
            const projectedLeaves = [];
            for (const rowIndex of rowIndexesAtLevel) {
                const row = inputRows[rowIndex];
                if (!row) {
                    continue;
                }
                projectedLeaves.push(normalizeLeafRow(row));
            }
            return projectedLeaves;
        }
        const field = fields[level] ?? "";
        const buckets = new Map();
        for (const rowIndex of rowIndexesAtLevel) {
            const row = inputRows[rowIndex];
            if (!row) {
                continue;
            }
            const value = resolveGroupedValue(row, field);
            const bucket = buckets.get(value);
            if (bucket) {
                bucket.push(rowIndex);
                continue;
            }
            buckets.set(value, [rowIndex]);
        }
        const projected = [];
        for (const [value, bucketRowIndexes] of buckets.entries()) {
            const nextPath = [...path, { field, value }];
            const groupKey = buildGroupKey(nextPath);
            const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys);
            const representative = inputRows[bucketRowIndexes[0] ?? -1];
            const children = projectLevel(bucketRowIndexes, level + 1, nextPath);
            const groupNode = {
                kind: "group",
                data: {
                    __group: true,
                    groupKey,
                    field,
                    value,
                    level,
                },
                row: {
                    __group: true,
                    groupKey,
                    field,
                    value,
                    level,
                },
                rowKey: groupKey,
                rowId: groupKey,
                sourceIndex: representative?.sourceIndex ?? 0,
                originalIndex: representative?.originalIndex ?? 0,
                displayIndex: -1,
                state: {
                    selected: false,
                    group: true,
                    pinned: "none",
                    expanded,
                },
                groupMeta: {
                    groupKey,
                    groupField: field,
                    groupValue: value,
                    level,
                    childrenCount: bucketRowIndexes.length,
                },
            };
            projected.push(groupNode);
            if (expanded) {
                projected.push(...children);
            }
        }
        return projected;
    };
    const allRowIndexes = inputRows.map((_, index) => index);
    return projectLevel(allRowIndexes, 0, []);
}
