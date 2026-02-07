export function createEmptyColumnSnapshot() {
    return {
        pinnedLeft: [],
        pinnedRight: [],
        visibleScrollable: [],
        visibleColumns: [],
        columnWidthMap: new Map(),
        leftPadding: 0,
        rightPadding: 0,
        totalScrollableWidth: 0,
        visibleScrollableWidth: 0,
        scrollableStart: 0,
        scrollableEnd: 0,
        visibleStart: 0,
        visibleEnd: 0,
        pinnedLeftWidth: 0,
        pinnedRightWidth: 0,
        metrics: { widths: [], offsets: [], totalWidth: 0 },
        containerWidthForColumns: 0,
        indexColumnWidth: 0,
        scrollDirection: 0,
    };
}
export function updateColumnSnapshot(options) {
    const { snapshot, meta, range, payload, getColumnKey, resolveColumnWidth } = options;
    const { start, end } = range;
    const visibleScrollableEntries = snapshot.visibleScrollable;
    const visibleColumnsEntries = snapshot.visibleColumns;
    const scrollableCount = Math.max(0, end - start);
    if (visibleScrollableEntries.length > scrollableCount) {
        visibleScrollableEntries.length = scrollableCount;
    }
    for (let localIndex = 0; localIndex < scrollableCount; localIndex += 1) {
        const idx = start + localIndex;
        const column = meta.scrollableColumns[idx];
        if (!column)
            continue;
        const widthValue = meta.metrics.widths[idx] ?? resolveColumnWidth(column, meta.zoom);
        const metric = visibleScrollableEntries[localIndex];
        const columnIndex = meta.scrollableIndices[idx] ?? idx;
        if (metric) {
            metric.column = column;
            metric.index = columnIndex;
            metric.width = widthValue;
            metric.pin = "none";
            metric.scrollableIndex = idx;
            metric.poolIndex = localIndex;
            metric.offset = meta.metrics.offsets[idx] ?? metric.offset ?? 0;
        }
        else {
            visibleScrollableEntries[localIndex] = {
                column,
                index: columnIndex,
                width: widthValue,
                pin: "none",
                scrollableIndex: idx,
                poolIndex: localIndex,
                offset: meta.metrics.offsets[idx] ?? 0,
            };
        }
    }
    visibleScrollableEntries.length = scrollableCount;
    const columnWidthMap = snapshot.columnWidthMap;
    if (columnWidthMap.size) {
        columnWidthMap.clear();
    }
    meta.pinnedLeft.forEach(metric => {
        columnWidthMap.set(getColumnKey(metric.column), metric.width);
    });
    meta.pinnedRight.forEach(metric => {
        columnWidthMap.set(getColumnKey(metric.column), metric.width);
    });
    meta.scrollableColumns.forEach((column, idx) => {
        const widthValue = meta.metrics.widths[idx] ?? resolveColumnWidth(column, meta.zoom);
        columnWidthMap.set(getColumnKey(column), widthValue);
    });
    const pinnedLeftEntries = snapshot.pinnedLeft;
    const pinnedRightEntries = snapshot.pinnedRight;
    pinnedLeftEntries.length = 0;
    pinnedRightEntries.length = 0;
    pinnedLeftEntries.push(...meta.pinnedLeft);
    pinnedRightEntries.push(...meta.pinnedRight);
    visibleColumnsEntries.length = 0;
    if (pinnedLeftEntries.length) {
        visibleColumnsEntries.push(...pinnedLeftEntries);
    }
    if (visibleScrollableEntries.length) {
        visibleColumnsEntries.push(...visibleScrollableEntries);
    }
    if (pinnedRightEntries.length) {
        visibleColumnsEntries.push(...pinnedRightEntries);
    }
    const visibleIndexes = visibleColumnsEntries.map(entry => entry.index);
    const visibleStartIndex = visibleIndexes.length ? Math.min(...visibleIndexes) : 0;
    const visibleEndIndex = visibleIndexes.length ? Math.max(...visibleIndexes) + 1 : 0;
    snapshot.leftPadding = payload.leftPadding;
    snapshot.rightPadding = payload.rightPadding;
    snapshot.totalScrollableWidth = meta.metrics.totalWidth;
    snapshot.visibleScrollableWidth = payload.visibleScrollableWidth;
    snapshot.scrollableStart = start;
    snapshot.scrollableEnd = end;
    snapshot.visibleStart = visibleStartIndex;
    snapshot.visibleEnd = visibleEndIndex;
    snapshot.pinnedLeftWidth = meta.pinnedLeftWidth;
    snapshot.pinnedRightWidth = meta.pinnedRightWidth;
    snapshot.metrics = meta.metrics;
    snapshot.containerWidthForColumns = meta.containerWidthForColumns;
    snapshot.indexColumnWidth = meta.indexColumnWidth;
    snapshot.scrollDirection = meta.scrollDirection;
    return { visibleStartIndex, visibleEndIndex };
}
