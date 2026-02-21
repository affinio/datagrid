export function normalizeDataGridGroupValue(value) {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : "(empty)";
}
export function useDataGridGroupMetaOrchestration(options) {
    const starts = new Set();
    const values = new Map();
    const counts = new Map();
    if (options.groupBy === "none") {
        return { starts, values, counts, groups: 0 };
    }
    let previousGroupValue = null;
    let currentStartRowId = null;
    for (const row of options.rows) {
        const rowId = String(options.resolveRowId(row));
        const currentGroupValue = normalizeDataGridGroupValue(options.resolveGroupValue(row, options.groupBy));
        if (previousGroupValue === null || currentGroupValue !== previousGroupValue) {
            starts.add(rowId);
            values.set(rowId, currentGroupValue);
            counts.set(rowId, 1);
            previousGroupValue = currentGroupValue;
            currentStartRowId = rowId;
            continue;
        }
        if (!currentStartRowId) {
            continue;
        }
        counts.set(currentStartRowId, (counts.get(currentStartRowId) ?? 0) + 1);
    }
    return { starts, values, counts, groups: starts.size };
}
export function isDataGridGroupStartRow(snapshot, rowId) {
    return snapshot.starts.has(String(rowId));
}
export function resolveDataGridGroupBadgeText(snapshot, rowId) {
    const normalizedRowId = String(rowId);
    const groupValue = snapshot.values.get(normalizedRowId) ?? "";
    const count = snapshot.counts.get(normalizedRowId) ?? 0;
    return `${groupValue} (${count})`;
}
export function resolveDataGridGroupBySummary(groupBy) {
    return groupBy === "none" ? "none" : String(groupBy);
}
