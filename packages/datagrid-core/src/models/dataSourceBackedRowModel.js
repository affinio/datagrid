import { buildGroupExpansionSnapshot, buildPaginationSnapshot, cloneGroupBySpec, isSameGroupExpansionSnapshot, isSameGroupBySpec, normalizePaginationInput, normalizeGroupBySpec, normalizeRowNode, normalizeViewportRange, setGroupExpansionKey, toggleGroupExpansionKey, } from "./rowModel.js";
import { cloneDataGridFilterSnapshot } from "./advancedFilter.js";
const DEFAULT_ROW_CACHE_LIMIT = 4096;
function cloneAggregationModel(input) {
    if (!input) {
        return null;
    }
    return {
        basis: input.basis,
        columns: input.columns.map(column => ({ ...column })),
    };
}
function isSameAggregationModel(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    if (left.basis !== right.basis || left.columns.length !== right.columns.length) {
        return false;
    }
    for (let index = 0; index < left.columns.length; index += 1) {
        const leftColumn = left.columns[index];
        const rightColumn = right.columns[index];
        if (!leftColumn ||
            !rightColumn ||
            leftColumn.key !== rightColumn.key ||
            leftColumn.field !== rightColumn.field ||
            leftColumn.op !== rightColumn.op) {
            return false;
        }
    }
    return true;
}
function isAbortError(error) {
    if (!error) {
        return false;
    }
    const named = error;
    return named.name === "AbortError";
}
function normalizeRequestedRange(range) {
    const start = Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0;
    const endCandidate = Number.isFinite(range.end) ? Math.max(0, Math.trunc(range.end)) : start;
    return {
        start,
        end: Math.max(start, endCandidate),
    };
}
function rangesOverlap(left, right) {
    return left.start <= right.end && right.start <= left.end;
}
function rangeContains(container, target) {
    return container.start <= target.start && container.end >= target.end;
}
function normalizeTotal(total) {
    if (!Number.isFinite(total)) {
        return null;
    }
    return Math.max(0, Math.trunc(total));
}
function serializePullState(value) {
    try {
        return JSON.stringify(value) ?? "";
    }
    catch {
        return "";
    }
}
function resolvePriorityRank(priority) {
    switch (priority) {
        case "critical":
            return 3;
        case "normal":
            return 2;
        case "background":
            return 1;
        default:
            return 0;
    }
}
function normalizeTreePullContext(treeData) {
    if (!treeData) {
        return null;
    }
    const seenGroupKeys = new Set();
    const groupKeys = [];
    for (const rawGroupKey of treeData.groupKeys ?? []) {
        if (typeof rawGroupKey !== "string") {
            continue;
        }
        const normalizedGroupKey = rawGroupKey.trim();
        if (normalizedGroupKey.length === 0 || seenGroupKeys.has(normalizedGroupKey)) {
            continue;
        }
        seenGroupKeys.add(normalizedGroupKey);
        groupKeys.push(normalizedGroupKey);
    }
    return {
        operation: treeData.operation,
        scope: treeData.scope,
        groupKeys,
    };
}
export function createDataSourceBackedRowModel(options) {
    const dataSource = options.dataSource;
    const resolveRowId = options.resolveRowId;
    let sortModel = options.initialSortModel ? [...options.initialSortModel] : [];
    let filterModel = cloneDataGridFilterSnapshot(options.initialFilterModel ?? null);
    let groupBy = normalizeGroupBySpec(options.initialGroupBy ?? null);
    let aggregationModel = null;
    let expansionExpandedByDefault = Boolean(groupBy?.expandedByDefault);
    let paginationInput = normalizePaginationInput(options.initialPagination ?? null);
    const toggledGroupKeys = new Set();
    let rowCount = Math.max(0, Math.trunc(options.initialTotal ?? 0));
    let loading = false;
    let error = null;
    let disposed = false;
    let revision = 0;
    let requestCounter = 0;
    let inFlight = null;
    let pendingPull = null;
    let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rowCount);
    const rowCacheLimit = Number.isFinite(options.rowCacheLimit) && options.rowCacheLimit > 0
        ? Math.max(1, Math.trunc(options.rowCacheLimit))
        : DEFAULT_ROW_CACHE_LIMIT;
    const rowCache = new Map();
    const listeners = new Set();
    const diagnostics = {
        pullRequested: 0,
        pullCompleted: 0,
        pullAborted: 0,
        pullDropped: 0,
        pullCoalesced: 0,
        pullDeferred: 0,
        rowCacheEvicted: 0,
        pushApplied: 0,
        invalidatedRows: 0,
        inFlight: false,
        hasPendingPull: false,
        rowCacheSize: 0,
        rowCacheLimit,
    };
    const unsubscribePush = typeof dataSource.subscribe === "function"
        ? dataSource.subscribe(event => {
            applyPushEvent(event);
        })
        : null;
    function enforceRowCacheLimit() {
        const protectedRange = toSourceRange(viewportRange);
        while (rowCache.size > rowCacheLimit) {
            let evictIndex;
            for (const cachedIndex of rowCache.keys()) {
                if (cachedIndex < protectedRange.start || cachedIndex > protectedRange.end) {
                    evictIndex = cachedIndex;
                    break;
                }
            }
            if (typeof evictIndex === "undefined") {
                evictIndex = rowCache.keys().next().value;
            }
            if (typeof evictIndex === "undefined") {
                break;
            }
            if (rowCache.delete(evictIndex)) {
                diagnostics.rowCacheEvicted += 1;
            }
        }
        diagnostics.rowCacheSize = rowCache.size;
    }
    function bumpRevision() {
        revision += 1;
    }
    function readRowCache(index) {
        if (!rowCache.has(index)) {
            return undefined;
        }
        const cached = rowCache.get(index);
        rowCache.delete(index);
        if (cached) {
            rowCache.set(index, cached);
        }
        return cached;
    }
    function writeRowCache(index, row) {
        if (rowCache.has(index)) {
            rowCache.delete(index);
        }
        rowCache.set(index, row);
        enforceRowCacheLimit();
        diagnostics.rowCacheSize = rowCache.size;
    }
    function pruneRowCacheByRowCount() {
        for (const index of rowCache.keys()) {
            if (index >= rowCount) {
                rowCache.delete(index);
            }
        }
        diagnostics.rowCacheSize = rowCache.size;
    }
    function ensureActive() {
        if (disposed) {
            throw new Error("DataSourceBackedRowModel has been disposed");
        }
    }
    function getPaginationSnapshot() {
        return buildPaginationSnapshot(rowCount, paginationInput);
    }
    function getVisibleRowCount() {
        const pagination = getPaginationSnapshot();
        if (!pagination.enabled) {
            return pagination.totalRowCount;
        }
        if (pagination.startIndex < 0 || pagination.endIndex < pagination.startIndex) {
            return 0;
        }
        return pagination.endIndex - pagination.startIndex + 1;
    }
    function toSourceIndex(index) {
        const pagination = getPaginationSnapshot();
        if (!pagination.enabled || pagination.startIndex < 0) {
            return index;
        }
        return pagination.startIndex + index;
    }
    function toSourceRange(range) {
        const visibleCount = getVisibleRowCount();
        if (visibleCount <= 0) {
            return { start: 0, end: 0 };
        }
        const normalized = normalizeViewportRange(range, visibleCount);
        return {
            start: toSourceIndex(normalized.start),
            end: toSourceIndex(normalized.end),
        };
    }
    function getSnapshot() {
        const pagination = getPaginationSnapshot();
        const visibleCount = getVisibleRowCount();
        viewportRange = normalizeViewportRange(viewportRange, visibleCount);
        return {
            revision,
            kind: "server",
            rowCount: visibleCount,
            loading,
            error,
            viewportRange,
            pagination,
            sortModel,
            filterModel: cloneDataGridFilterSnapshot(filterModel),
            groupBy: cloneGroupBySpec(groupBy),
            groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
        };
    }
    function getExpansionSpec() {
        if (!groupBy) {
            return null;
        }
        return {
            fields: groupBy.fields,
            expandedByDefault: expansionExpandedByDefault,
        };
    }
    function applyGroupExpansion(nextExpansion) {
        const expansionSpec = getExpansionSpec();
        if (!expansionSpec) {
            return false;
        }
        const normalizedSnapshot = buildGroupExpansionSnapshot({
            fields: expansionSpec.fields,
            expandedByDefault: nextExpansion?.expandedByDefault ?? expansionSpec.expandedByDefault,
        }, nextExpansion?.toggledGroupKeys ?? []);
        const currentSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys);
        if (isSameGroupExpansionSnapshot(currentSnapshot, normalizedSnapshot)) {
            return false;
        }
        expansionExpandedByDefault = normalizedSnapshot.expandedByDefault;
        toggledGroupKeys.clear();
        for (const groupKey of normalizedSnapshot.toggledGroupKeys) {
            toggledGroupKeys.add(groupKey);
        }
        return true;
    }
    function emit() {
        if (disposed || listeners.size === 0) {
            return;
        }
        const snapshot = getSnapshot();
        for (const listener of listeners) {
            listener(snapshot);
        }
    }
    function updateTotalFromRows(rows) {
        let maxIndex = -1;
        for (const entry of rows) {
            const index = Number.isFinite(entry.index) ? Math.max(0, Math.trunc(entry.index)) : -1;
            if (index > maxIndex) {
                maxIndex = index;
            }
        }
        if (maxIndex >= rowCount) {
            rowCount = maxIndex + 1;
        }
    }
    function normalizeRowEntry(entry) {
        const index = Number.isFinite(entry.index) ? Math.max(0, Math.trunc(entry.index)) : 0;
        const rowId = (() => {
            if (typeof entry.rowId === "string" || typeof entry.rowId === "number") {
                return entry.rowId;
            }
            if (typeof resolveRowId === "function") {
                return resolveRowId(entry.row, index);
            }
            const fallback = entry.row?.id;
            if (typeof fallback === "string" || typeof fallback === "number") {
                return fallback;
            }
            throw new Error(`[DataGrid] Missing row identity for data-source row at index ${index}. Provide rowId or resolveRowId.`);
        })();
        return {
            index,
            node: normalizeRowNode({
                row: entry.row,
                rowId,
                originalIndex: index,
                displayIndex: index,
                state: entry.state,
            }, index),
        };
    }
    function applyRows(rows) {
        if (rows.length === 0) {
            return false;
        }
        for (const entry of rows) {
            const normalized = normalizeRowEntry(entry);
            writeRowCache(normalized.index, normalized.node);
        }
        updateTotalFromRows(rows);
        return true;
    }
    function clearRange(range) {
        const normalized = normalizeRequestedRange(range);
        const bounded = normalizeViewportRange(normalized, rowCount);
        if (rowCount <= 0) {
            return;
        }
        let changed = false;
        for (let index = bounded.start; index <= bounded.end; index += 1) {
            if (rowCache.delete(index)) {
                diagnostics.invalidatedRows += 1;
                changed = true;
            }
        }
        if (changed) {
            bumpRevision();
        }
        diagnostics.rowCacheSize = rowCache.size;
    }
    function clearAll() {
        if (rowCache.size > 0) {
            bumpRevision();
        }
        diagnostics.invalidatedRows += rowCache.size;
        rowCache.clear();
        diagnostics.rowCacheSize = rowCache.size;
    }
    function abortInFlight() {
        if (!inFlight) {
            return;
        }
        if (!inFlight.controller.signal.aborted) {
            inFlight.controller.abort();
            diagnostics.pullAborted += 1;
        }
        inFlight = null;
        diagnostics.inFlight = false;
    }
    async function pullRange(range, reason, priority, treeData) {
        if (disposed) {
            return;
        }
        const requestRange = normalizeRequestedRange(range);
        const treePullContext = normalizeTreePullContext(treeData);
        const requestStateKey = serializePullState({
            sortModel,
            filterModel,
            groupBy,
            groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
        });
        const requestKey = serializePullState({
            range: requestRange,
            reason,
            priority,
            treeData: treePullContext,
            state: requestStateKey,
        });
        if (inFlight && !inFlight.controller.signal.aborted && inFlight.key === requestKey) {
            diagnostics.pullCoalesced += 1;
            return inFlight.promise;
        }
        if (reason === "viewport-change" &&
            inFlight &&
            !inFlight.controller.signal.aborted &&
            inFlight.stateKey === requestStateKey &&
            resolvePriorityRank(inFlight.priority) >= resolvePriorityRank(priority) &&
            rangeContains(inFlight.range, requestRange)) {
            diagnostics.pullCoalesced += 1;
            return inFlight.promise;
        }
        if (inFlight && !inFlight.controller.signal.aborted) {
            const nextRank = resolvePriorityRank(priority);
            const activeRank = resolvePriorityRank(inFlight.priority);
            if (nextRank < activeRank) {
                if (pendingPull && pendingPull.key === requestKey) {
                    diagnostics.pullCoalesced += 1;
                    return inFlight.promise;
                }
                const pendingRank = pendingPull ? resolvePriorityRank(pendingPull.priority) : -1;
                if (nextRank >= pendingRank) {
                    pendingPull = {
                        range: requestRange,
                        reason,
                        priority,
                        key: requestKey,
                        treeData: treePullContext,
                    };
                    diagnostics.hasPendingPull = true;
                }
                diagnostics.pullDeferred += 1;
                return inFlight.promise;
            }
        }
        abortInFlight();
        const requestId = requestCounter + 1;
        requestCounter = requestId;
        const controller = new AbortController();
        const requestPromise = (async () => {
            diagnostics.inFlight = true;
            diagnostics.pullRequested += 1;
            loading = true;
            error = null;
            emit();
            try {
                const result = await dataSource.pull({
                    range: requestRange,
                    priority,
                    reason,
                    signal: controller.signal,
                    sortModel,
                    filterModel,
                    groupBy: cloneGroupBySpec(groupBy),
                    groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
                    treeData: treePullContext,
                });
                if (disposed || !inFlight || inFlight.requestId !== requestId || controller.signal.aborted) {
                    diagnostics.pullDropped += 1;
                    return;
                }
                let changed = false;
                const previousRowCount = rowCount;
                const nextTotal = normalizeTotal(result.total);
                if (nextTotal != null) {
                    rowCount = nextTotal;
                    pruneRowCacheByRowCount();
                    changed = changed || rowCount !== previousRowCount;
                    viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount());
                }
                changed = applyRows(result.rows) || changed;
                if (changed) {
                    bumpRevision();
                }
                diagnostics.pullCompleted += 1;
            }
            catch (reasonError) {
                if (isAbortError(reasonError)) {
                    return;
                }
                error = reasonError instanceof Error ? reasonError : new Error(String(reasonError));
            }
            finally {
                if (inFlight && inFlight.requestId === requestId) {
                    inFlight = null;
                    diagnostics.inFlight = false;
                    if (!disposed && pendingPull) {
                        const next = pendingPull;
                        pendingPull = null;
                        diagnostics.hasPendingPull = false;
                        void pullRange(next.range, next.reason, next.priority, next.treeData);
                    }
                }
                loading = Boolean(inFlight);
                emit();
            }
        })();
        inFlight = {
            requestId,
            controller,
            key: requestKey,
            stateKey: requestStateKey,
            range: requestRange,
            promise: requestPromise,
            priority,
        };
        return requestPromise;
    }
    function applyPushInvalidation(invalidation) {
        if (invalidation.kind === "all") {
            clearAll();
            if (typeof dataSource.invalidate === "function") {
                void Promise.resolve(dataSource.invalidate(invalidation));
            }
            void pullRange(toSourceRange(viewportRange), "push-invalidation", "normal");
            return;
        }
        clearRange(invalidation.range);
        if (typeof dataSource.invalidate === "function") {
            void Promise.resolve(dataSource.invalidate(invalidation));
        }
        if (rangesOverlap(normalizeRequestedRange(invalidation.range), toSourceRange(viewportRange))) {
            void pullRange(toSourceRange(viewportRange), "push-invalidation", "normal");
        }
        else {
            emit();
        }
    }
    function applyPushEvent(event) {
        if (disposed) {
            return;
        }
        diagnostics.pushApplied += 1;
        if (event.type === "upsert") {
            let changed = applyRows(event.rows);
            const previousRowCount = rowCount;
            const nextTotal = normalizeTotal(event.total);
            if (nextTotal != null) {
                rowCount = nextTotal;
                pruneRowCacheByRowCount();
                changed = changed || rowCount !== previousRowCount;
                viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount());
            }
            if (changed) {
                bumpRevision();
            }
            emit();
            return;
        }
        if (event.type === "remove") {
            let changed = false;
            for (const rawIndex of event.indexes) {
                const index = Number.isFinite(rawIndex) ? Math.max(0, Math.trunc(rawIndex)) : -1;
                if (index >= 0) {
                    changed = rowCache.delete(index) || changed;
                }
            }
            diagnostics.rowCacheSize = rowCache.size;
            const previousRowCount = rowCount;
            const nextTotal = normalizeTotal(event.total);
            if (nextTotal != null) {
                rowCount = nextTotal;
                pruneRowCacheByRowCount();
                changed = changed || rowCount !== previousRowCount;
                viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount());
            }
            if (changed) {
                bumpRevision();
            }
            emit();
            return;
        }
        applyPushInvalidation(event.invalidation);
    }
    function createTreePullContext(operation, groupKeys, scope = "branch") {
        return {
            operation,
            scope,
            groupKeys: toUniqueGroupKeys(groupKeys),
        };
    }
    function toUniqueGroupKeys(groupKeys) {
        const seen = new Set();
        const normalized = [];
        for (const rawGroupKey of groupKeys) {
            if (typeof rawGroupKey !== "string") {
                continue;
            }
            const groupKey = rawGroupKey.trim();
            if (groupKey.length === 0 || seen.has(groupKey)) {
                continue;
            }
            seen.add(groupKey);
            normalized.push(groupKey);
        }
        return normalized;
    }
    return {
        kind: "server",
        dataSource,
        getSnapshot,
        getRowCount() {
            return getVisibleRowCount();
        },
        getRow(index) {
            if (!Number.isFinite(index)) {
                return undefined;
            }
            const normalized = Math.max(0, Math.trunc(index));
            const visibleCount = getVisibleRowCount();
            if (normalized >= visibleCount) {
                return undefined;
            }
            return readRowCache(toSourceIndex(normalized));
        },
        getRowsInRange(range) {
            const visibleCount = getVisibleRowCount();
            const normalized = normalizeViewportRange(range, visibleCount);
            if (visibleCount <= 0) {
                return [];
            }
            const rows = [];
            for (let index = normalized.start; index <= normalized.end; index += 1) {
                const row = readRowCache(toSourceIndex(index));
                if (row) {
                    rows.push(row);
                }
            }
            return rows;
        },
        setViewportRange(range) {
            ensureActive();
            const requested = normalizeRequestedRange(range);
            const visibleCount = getVisibleRowCount();
            const nextViewport = visibleCount > 0 ? normalizeViewportRange(requested, visibleCount) : requested;
            const unchanged = nextViewport.start === viewportRange.start &&
                nextViewport.end === viewportRange.end;
            viewportRange = nextViewport;
            if (unchanged) {
                const sourceViewport = toSourceRange(nextViewport);
                let hasFullRange = true;
                for (let index = sourceViewport.start; index <= sourceViewport.end; index += 1) {
                    if (!rowCache.has(index)) {
                        hasFullRange = false;
                        break;
                    }
                }
                if (hasFullRange) {
                    return;
                }
            }
            void pullRange(toSourceRange(nextViewport), "viewport-change", "critical");
            emit();
        },
        setPagination(nextPagination) {
            ensureActive();
            const normalized = normalizePaginationInput(nextPagination);
            if (normalized.pageSize === paginationInput.pageSize &&
                normalized.currentPage === paginationInput.currentPage) {
                return;
            }
            paginationInput = normalized;
            viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount());
            bumpRevision();
            emit();
        },
        setPageSize(pageSize) {
            ensureActive();
            const normalizedPageSize = normalizePaginationInput({ pageSize: pageSize ?? 0, currentPage: 0 }).pageSize;
            if (normalizedPageSize === paginationInput.pageSize) {
                return;
            }
            paginationInput = {
                pageSize: normalizedPageSize,
                currentPage: 0,
            };
            viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount());
            bumpRevision();
            emit();
        },
        setCurrentPage(page) {
            ensureActive();
            const normalizedPage = normalizePaginationInput({
                pageSize: paginationInput.pageSize,
                currentPage: page,
            }).currentPage;
            if (normalizedPage === paginationInput.currentPage) {
                return;
            }
            paginationInput = {
                ...paginationInput,
                currentPage: normalizedPage,
            };
            viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount());
            bumpRevision();
            emit();
        },
        setSortModel(nextSortModel) {
            ensureActive();
            sortModel = Array.isArray(nextSortModel) ? [...nextSortModel] : [];
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "sort-change", "critical");
            emit();
        },
        setFilterModel(nextFilterModel) {
            ensureActive();
            filterModel = cloneDataGridFilterSnapshot(nextFilterModel ?? null);
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "filter-change", "critical");
            emit();
        },
        setGroupBy(nextGroupBy) {
            ensureActive();
            const normalized = normalizeGroupBySpec(nextGroupBy);
            if (isSameGroupBySpec(groupBy, normalized)) {
                return;
            }
            groupBy = normalized;
            expansionExpandedByDefault = Boolean(normalized?.expandedByDefault);
            toggledGroupKeys.clear();
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical", createTreePullContext("set-group-by", [], "all"));
            emit();
        },
        setAggregationModel(nextAggregationModel) {
            ensureActive();
            const normalized = cloneAggregationModel(nextAggregationModel ?? null);
            if (isSameAggregationModel(aggregationModel, normalized)) {
                return;
            }
            aggregationModel = normalized;
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical");
            emit();
        },
        getAggregationModel() {
            return cloneAggregationModel(aggregationModel);
        },
        setGroupExpansion(expansion) {
            ensureActive();
            if (!applyGroupExpansion(expansion)) {
                return;
            }
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical", createTreePullContext("set-group-expansion", expansion?.toggledGroupKeys ?? [], "all"));
            emit();
        },
        toggleGroup(groupKey) {
            ensureActive();
            if (!getExpansionSpec()) {
                return;
            }
            if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
                return;
            }
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical", createTreePullContext("toggle-group", [groupKey]));
            emit();
        },
        expandGroup(groupKey) {
            ensureActive();
            if (!getExpansionSpec()) {
                return;
            }
            if (!setGroupExpansionKey(toggledGroupKeys, groupKey, false, true)) {
                return;
            }
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical", createTreePullContext("expand-group", [groupKey]));
            emit();
        },
        collapseGroup(groupKey) {
            ensureActive();
            if (!getExpansionSpec()) {
                return;
            }
            if (!setGroupExpansionKey(toggledGroupKeys, groupKey, false, false)) {
                return;
            }
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical", createTreePullContext("collapse-group", [groupKey]));
            emit();
        },
        expandAllGroups() {
            ensureActive();
            if (!getExpansionSpec()) {
                return;
            }
            if (expansionExpandedByDefault && toggledGroupKeys.size === 0) {
                return;
            }
            expansionExpandedByDefault = true;
            toggledGroupKeys.clear();
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical", createTreePullContext("expand-all-groups", [], "all"));
            emit();
        },
        collapseAllGroups() {
            ensureActive();
            if (!getExpansionSpec()) {
                return;
            }
            if (!expansionExpandedByDefault && toggledGroupKeys.size === 0) {
                return;
            }
            expansionExpandedByDefault = false;
            toggledGroupKeys.clear();
            bumpRevision();
            clearAll();
            void pullRange(toSourceRange(viewportRange), "group-change", "critical", createTreePullContext("collapse-all-groups", [], "all"));
            emit();
        },
        async refresh(reason) {
            ensureActive();
            if (reason === "reset") {
                clearAll();
                if (typeof dataSource.invalidate === "function") {
                    await dataSource.invalidate({ kind: "all", reason: "reset" });
                }
            }
            await pullRange(toSourceRange(viewportRange), "refresh", "critical");
        },
        invalidateRange(range) {
            ensureActive();
            const sourceRange = toSourceRange(range);
            const invalidation = { kind: "range", range: sourceRange, reason: "model-range" };
            clearRange(sourceRange);
            if (typeof dataSource.invalidate === "function") {
                void Promise.resolve(dataSource.invalidate(invalidation));
            }
            if (rangesOverlap(normalizeRequestedRange(sourceRange), toSourceRange(viewportRange))) {
                void pullRange(toSourceRange(viewportRange), "invalidation", "normal");
            }
            else {
                emit();
            }
        },
        invalidateAll() {
            ensureActive();
            clearAll();
            if (typeof dataSource.invalidate === "function") {
                void Promise.resolve(dataSource.invalidate({ kind: "all", reason: "model-all" }));
            }
            void pullRange(toSourceRange(viewportRange), "invalidation", "normal");
        },
        getBackpressureDiagnostics() {
            diagnostics.inFlight = Boolean(inFlight);
            diagnostics.hasPendingPull = Boolean(pendingPull);
            diagnostics.rowCacheSize = rowCache.size;
            return { ...diagnostics };
        },
        subscribe(listener) {
            if (disposed) {
                return () => { };
            }
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            abortInFlight();
            listeners.clear();
            rowCache.clear();
            pendingPull = null;
            diagnostics.inFlight = false;
            diagnostics.hasPendingPull = false;
            diagnostics.rowCacheSize = 0;
            unsubscribePush?.();
        },
    };
}
