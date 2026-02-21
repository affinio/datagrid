import { buildGroupExpansionSnapshot, buildPaginationSnapshot, cloneGroupBySpec, isGroupExpanded, isSameGroupExpansionSnapshot, isSameGroupBySpec, normalizeRowNode, normalizeGroupBySpec, normalizePaginationInput, normalizeTreeDataSpec, normalizeViewportRange, setGroupExpansionKey, toggleGroupExpansionKey, withResolvedRowIdentity, } from "./rowModel.js";
import { createClientRowProjectionEngine, expandClientProjectionStages, } from "./clientRowProjectionEngine.js";
import { createClientRowProjectionOrchestrator } from "./clientRowProjectionOrchestrator.js";
import { DATAGRID_CLIENT_ALL_PROJECTION_STAGES } from "./projectionStages.js";
import { buildGroupedRowsProjection } from "./groupProjectionController.js";
import { createDataGridAggregationEngine, } from "./aggregationEngine.js";
import { cloneDataGridFilterSnapshot as cloneFilterSnapshot, evaluateDataGridAdvancedFilterExpression, } from "./advancedFilter.js";
import { analyzeRowPatchChangeSet, collectAggregationModelFields, buildPatchProjectionExecutionPlan, collectFilterModelFields, collectGroupByFields, collectSortModelFields, collectTreeDataDependencyFields, resolveAdvancedExpression, } from "./rowPatchAnalyzer.js";
import { createDataGridProjectionPolicy, } from "./projectionPolicy.js";
import { createClientRowRuntimeStateStore } from "./clientRowRuntimeStateStore.js";
import { createClientRowLifecycle } from "./clientRowLifecycle.js";
function readByPath(value, path) {
    if (!path || typeof value !== "object" || value === null) {
        return undefined;
    }
    const segments = path.split(".").filter(Boolean);
    let current = value;
    for (const segment of segments) {
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= current.length) {
                return undefined;
            }
            current = current[index];
            continue;
        }
        if (typeof current !== "object" || current === null || !(segment in current)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
function readRowField(rowNode, key, field) {
    const source = rowNode.data;
    const resolvedField = field && field.trim().length > 0 ? field : key;
    if (!resolvedField) {
        return undefined;
    }
    const directValue = typeof source === "object" && source !== null
        ? source[resolvedField]
        : undefined;
    if (typeof directValue !== "undefined") {
        return directValue;
    }
    return readByPath(source, resolvedField);
}
function normalizeText(value) {
    if (value == null) {
        return "";
    }
    return String(value);
}
function createGroupedRowKey(segments) {
    let encoded = "group:";
    for (const segment of segments) {
        encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`;
    }
    return encoded;
}
function computeGroupByAggregatesMap(inputRows, groupBy, resolveGroupValue, computeAggregates) {
    const aggregatesByGroupKey = new Map();
    const fields = groupBy.fields;
    if (fields.length === 0 || inputRows.length === 0) {
        return aggregatesByGroupKey;
    }
    const projectLevel = (rows, level, path) => {
        if (level >= fields.length || rows.length === 0) {
            return;
        }
        const field = fields[level] ?? "";
        const buckets = new Map();
        for (const row of rows) {
            const value = resolveGroupValue(row, field);
            const bucket = buckets.get(value);
            if (bucket) {
                bucket.push(row);
            }
            else {
                buckets.set(value, [row]);
            }
        }
        for (const [value, bucketRows] of buckets.entries()) {
            const nextPath = [...path, { field, value }];
            const groupKey = createGroupedRowKey(nextPath);
            const aggregates = computeAggregates(bucketRows);
            if (Object.keys(aggregates).length > 0) {
                aggregatesByGroupKey.set(groupKey, { ...aggregates });
            }
            projectLevel(bucketRows, level + 1, nextPath);
        }
    };
    projectLevel(inputRows, 0, []);
    return aggregatesByGroupKey;
}
function computeGroupByIncrementalAggregation(inputRows, groupBy, resolveGroupValue, createLeafContribution, createEmptyGroupState, applyContributionDelta, finalizeGroupState) {
    const statesByGroupKey = new Map();
    const aggregatesByGroupKey = new Map();
    const groupPathByRowId = new Map();
    const leafContributionByRowId = new Map();
    const fields = groupBy.fields;
    if (fields.length === 0 || inputRows.length === 0) {
        return {
            statesByGroupKey,
            aggregatesByGroupKey,
            groupPathByRowId,
            leafContributionByRowId,
        };
    }
    const projectLevel = (rows, level, path) => {
        if (level >= fields.length || rows.length === 0) {
            return;
        }
        const field = fields[level] ?? "";
        const buckets = new Map();
        for (const row of rows) {
            const value = resolveGroupValue(row, field);
            const bucket = buckets.get(value);
            if (bucket) {
                bucket.push(row);
            }
            else {
                buckets.set(value, [row]);
            }
        }
        for (const [value, bucketRows] of buckets.entries()) {
            const nextPath = [...path, { field, value }];
            const groupKey = createGroupedRowKey(nextPath);
            const state = createEmptyGroupState();
            if (!state) {
                continue;
            }
            for (const row of bucketRows) {
                if (row.kind !== "leaf") {
                    continue;
                }
                const contribution = createLeafContribution(row);
                if (!contribution) {
                    continue;
                }
                leafContributionByRowId.set(row.rowId, contribution);
                const existingPath = groupPathByRowId.get(row.rowId);
                if (existingPath) {
                    existingPath.push(groupKey);
                }
                else {
                    groupPathByRowId.set(row.rowId, [groupKey]);
                }
                applyContributionDelta(state, null, contribution);
            }
            statesByGroupKey.set(groupKey, state);
            const aggregates = finalizeGroupState(state);
            if (Object.keys(aggregates).length > 0) {
                aggregatesByGroupKey.set(groupKey, aggregates);
            }
            projectLevel(bucketRows, level + 1, nextPath);
        }
    };
    projectLevel(inputRows, 0, []);
    return {
        statesByGroupKey,
        aggregatesByGroupKey,
        groupPathByRowId,
        leafContributionByRowId,
    };
}
function patchGroupRowsAggregatesByGroupKey(rows, resolveAggregates) {
    const patched = [];
    for (const row of rows) {
        if (row.kind !== "group" || !row.groupMeta?.groupKey) {
            patched.push(row);
            continue;
        }
        const nextAggregates = resolveAggregates(row.groupMeta.groupKey);
        if (!nextAggregates || Object.keys(nextAggregates).length === 0) {
            if (!row.groupMeta.aggregates) {
                patched.push(row);
                continue;
            }
            const { aggregates: _dropAggregates, ...groupMeta } = row.groupMeta;
            patched.push({
                ...row,
                groupMeta,
            });
            continue;
        }
        if (areSameAggregateRecords(row.groupMeta.aggregates, nextAggregates)) {
            patched.push(row);
            continue;
        }
        patched.push({
            ...row,
            groupMeta: {
                ...row.groupMeta,
                aggregates: { ...nextAggregates },
            },
        });
    }
    return patched;
}
function cloneAggregationModel(input) {
    if (!input || !Array.isArray(input.columns)) {
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
    if (left.basis !== right.basis) {
        return false;
    }
    if (left.columns.length !== right.columns.length) {
        return false;
    }
    for (let index = 0; index < left.columns.length; index += 1) {
        const leftColumn = left.columns[index];
        const rightColumn = right.columns[index];
        if (!leftColumn || !rightColumn) {
            return false;
        }
        if (leftColumn.key !== rightColumn.key ||
            leftColumn.field !== rightColumn.field ||
            leftColumn.op !== rightColumn.op ||
            leftColumn.createState !== rightColumn.createState ||
            leftColumn.add !== rightColumn.add ||
            leftColumn.remove !== rightColumn.remove ||
            leftColumn.finalize !== rightColumn.finalize ||
            leftColumn.coerce !== rightColumn.coerce) {
            return false;
        }
    }
    return true;
}
function areSameAggregateRecords(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (const key of leftKeys) {
        if (!(key in right) || left[key] !== right[key]) {
            return false;
        }
    }
    return true;
}
function normalizeColumnFilterEntries(columnFilters) {
    const normalized = [];
    for (const [rawKey, rawValues] of Object.entries(columnFilters ?? {})) {
        if (!Array.isArray(rawValues) || rawValues.length === 0) {
            continue;
        }
        const key = rawKey.trim();
        if (key.length === 0) {
            continue;
        }
        const seen = new Set();
        const values = [];
        for (const rawValue of rawValues) {
            const value = normalizeText(rawValue);
            if (seen.has(value)) {
                continue;
            }
            seen.add(value);
            values.push(value);
        }
        if (values.length === 0) {
            continue;
        }
        normalized.push({ key, values });
    }
    return normalized;
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
function createFilterPredicate(filterModel) {
    if (!filterModel) {
        return () => true;
    }
    const columnFilters = normalizeColumnFilterEntries((filterModel.columnFilters ?? {})).map(entry => {
        return [entry.key, new Set(entry.values)];
    });
    const advancedExpression = resolveAdvancedExpression(filterModel);
    return (rowNode) => {
        for (const [key, valueSet] of columnFilters) {
            const candidate = normalizeText(readRowField(rowNode, key));
            if (!valueSet.has(candidate)) {
                return false;
            }
        }
        if (advancedExpression) {
            return evaluateDataGridAdvancedFilterExpression(advancedExpression, condition => {
                return readRowField(rowNode, condition.key, condition.field);
            });
        }
        return true;
    };
}
function hasActiveFilterModel(filterModel) {
    if (!filterModel) {
        return false;
    }
    const columnFilters = Object.values(filterModel.columnFilters ?? {});
    if (columnFilters.some(values => Array.isArray(values) && values.length > 0)) {
        return true;
    }
    const advancedKeys = Object.keys(filterModel.advancedFilters ?? {});
    if (advancedKeys.length > 0) {
        return true;
    }
    return resolveAdvancedExpression(filterModel) !== null;
}
function alwaysMatchesFilter(_row) {
    return true;
}
function shouldUseFilteredRowsForTreeSort(treeData, filterModel) {
    if (!treeData || treeData.mode !== "path" || !hasActiveFilterModel(filterModel)) {
        return false;
    }
    return (treeData.filterMode === "leaf-only"
        || treeData.filterMode === "include-parents"
        || treeData.filterMode === "include-descendants");
}
function serializeSortValueModelForCache(sortModel, options = {}) {
    if (!Array.isArray(sortModel) || sortModel.length === 0) {
        return "__none__";
    }
    const includeDirection = options.includeDirection !== false;
    return sortModel
        .map(descriptor => {
        const dependencyFields = Array.isArray(descriptor.dependencyFields)
            ? [...descriptor.dependencyFields].map(value => String(value).trim()).filter(Boolean).sort().join(",")
            : "";
        const direction = includeDirection ? descriptor.direction ?? "asc" : "";
        return `${descriptor.key}:${descriptor.field ?? ""}:${direction}:${dependencyFields}`;
    })
        .join("|");
}
function stableSerializeUnknown(value) {
    if (value == null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableSerializeUnknown).join(",")}]`;
    }
    const entries = Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerializeUnknown(nested)}`);
    return `{${entries.join(",")}}`;
}
function normalizeFilterValuesForSignature(values) {
    const normalized = [];
    const seen = new Set();
    for (const value of values) {
        const token = normalizeText(value);
        if (seen.has(token)) {
            continue;
        }
        seen.add(token);
        normalized.push(token);
    }
    return normalized.sort((left, right) => left.localeCompare(right));
}
function serializeFilterModelForSignature(filterModel) {
    if (!filterModel) {
        return "__none__";
    }
    const normalizedColumnFilters = {};
    for (const [rawKey, values] of Object.entries(filterModel.columnFilters ?? {})) {
        if (!Array.isArray(values) || values.length === 0) {
            continue;
        }
        const key = rawKey.trim();
        if (!key) {
            continue;
        }
        normalizedColumnFilters[key] = normalizeFilterValuesForSignature(values);
    }
    const normalizedAdvancedFilters = {};
    for (const [rawKey, advancedFilter] of Object.entries(filterModel.advancedFilters ?? {})) {
        const key = rawKey.trim();
        if (!key) {
            continue;
        }
        normalizedAdvancedFilters[key] = advancedFilter;
    }
    return stableSerializeUnknown({
        columnFilters: normalizedColumnFilters,
        advancedFilters: normalizedAdvancedFilters,
        advancedExpression: resolveAdvancedExpression(filterModel),
    });
}
function isSameSortModel(left, right) {
    return serializeSortValueModelForCache(left, { includeDirection: true })
        === serializeSortValueModelForCache(right, { includeDirection: true });
}
function isSameFilterModel(left, right) {
    return serializeFilterModelForSignature(left) === serializeFilterModelForSignature(right);
}
function compareUnknown(left, right) {
    if (left == null && right == null) {
        return 0;
    }
    if (left == null) {
        return 1;
    }
    if (right == null) {
        return -1;
    }
    const leftNumber = toComparableNumber(left);
    const rightNumber = toComparableNumber(right);
    if (leftNumber != null && rightNumber != null) {
        return leftNumber - rightNumber;
    }
    const leftText = normalizeText(left);
    const rightText = normalizeText(right);
    return leftText.localeCompare(rightText);
}
function sortLeafRows(rows, sortModel, resolveSortValues) {
    const descriptors = Array.isArray(sortModel) ? sortModel.filter(Boolean) : [];
    if (descriptors.length === 0) {
        return [...rows];
    }
    const decorated = rows.map((row, index) => ({
        row,
        index,
        sortValues: resolveSortValues
            ? resolveSortValues(row, descriptors)
            : descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field)),
    }));
    decorated.sort((left, right) => {
        for (let descriptorIndex = 0; descriptorIndex < descriptors.length; descriptorIndex += 1) {
            const descriptor = descriptors[descriptorIndex];
            if (!descriptor) {
                continue;
            }
            const direction = descriptor.direction === "desc" ? -1 : 1;
            const leftValue = left.sortValues[descriptorIndex];
            const rightValue = right.sortValues[descriptorIndex];
            const compared = compareUnknown(leftValue, rightValue);
            if (compared !== 0) {
                return compared * direction;
            }
        }
        const rowIdDelta = compareUnknown(left.row.rowId, right.row.rowId);
        if (rowIdDelta !== 0) {
            return rowIdDelta;
        }
        const sourceDelta = left.row.sourceIndex - right.row.sourceIndex;
        if (sourceDelta !== 0) {
            return sourceDelta;
        }
        return left.index - right.index;
    });
    return decorated.map(entry => entry.row);
}
function isDataGridRowId(value) {
    return typeof value === "string" || typeof value === "number";
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function applyRowDataPatch(current, patch) {
    if (!isRecord(current) || !isRecord(patch)) {
        return patch;
    }
    let changed = false;
    const next = Object.create(Object.getPrototypeOf(current));
    Object.defineProperties(next, Object.getOwnPropertyDescriptors(current));
    for (const [key, value] of Object.entries(patch)) {
        if (Object.is(next[key], value)) {
            continue;
        }
        next[key] = value;
        changed = true;
    }
    return changed ? next : current;
}
function mergeRowPatch(left, right) {
    if (isRecord(left) && isRecord(right)) {
        return {
            ...left,
            ...right,
        };
    }
    return right;
}
function buildRowIdIndex(inputRows) {
    const byId = new Map();
    for (const row of inputRows) {
        byId.set(row.rowId, row);
    }
    return byId;
}
function remapRowsByIdentity(inputRows, byId) {
    const remapped = [];
    for (const row of inputRows) {
        const replacement = byId.get(row.rowId);
        if (replacement) {
            remapped.push(replacement);
        }
    }
    return remapped;
}
function preserveRowOrder(previousRows, nextRows) {
    if (previousRows.length === 0) {
        return [...nextRows];
    }
    const nextById = buildRowIdIndex(nextRows);
    const seen = new Set();
    const projected = [];
    for (const row of previousRows) {
        const candidate = nextById.get(row.rowId);
        if (!candidate || seen.has(candidate.rowId)) {
            continue;
        }
        projected.push(candidate);
        seen.add(candidate.rowId);
    }
    for (const row of nextRows) {
        if (seen.has(row.rowId)) {
            continue;
        }
        projected.push(row);
        seen.add(row.rowId);
    }
    return projected;
}
function patchProjectedRowsByIdentity(inputRows, byId) {
    const patched = [];
    for (const row of inputRows) {
        const next = byId.get(row.rowId);
        if (!next) {
            patched.push(row);
            continue;
        }
        if (row.data === next.data && row.row === next.row) {
            patched.push(row);
            continue;
        }
        patched.push({
            ...row,
            data: next.data,
            row: next.row,
        });
    }
    return patched;
}
function createRowVersionIndex(rows) {
    const versions = new Map();
    for (const row of rows) {
        versions.set(row.rowId, 0);
    }
    return versions;
}
function rebuildRowVersionIndex(previous, rows) {
    const versions = new Map();
    for (const row of rows) {
        versions.set(row.rowId, previous.has(row.rowId)
            ? ((previous.get(row.rowId) ?? 0) + 1)
            : 0);
    }
    return versions;
}
function bumpRowVersions(versions, rowIds) {
    for (const rowId of rowIds) {
        versions.set(rowId, (versions.get(rowId) ?? 0) + 1);
    }
}
function pruneSortCacheRows(cache, rows) {
    const activeRowIds = new Set();
    for (const row of rows) {
        activeRowIds.add(row.rowId);
    }
    for (const rowId of cache.keys()) {
        if (!activeRowIds.has(rowId)) {
            cache.delete(rowId);
        }
    }
}
function enforceCacheCap(cache, maxSize) {
    if (maxSize <= 0 || cache.size <= maxSize) {
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
function normalizeTreePathSegments(raw) {
    const segments = [];
    for (const value of raw) {
        const normalized = String(value).trim();
        if (normalized.length === 0) {
            continue;
        }
        segments.push(normalized);
    }
    return segments;
}
function patchTreePathProjectionCacheRowsByIdentity(cache, sourceById, changedRowIds = []) {
    cache.rootLeaves = patchProjectedRowsByIdentity(cache.rootLeaves, sourceById);
    cache.leafOnlyRows = patchProjectedRowsByIdentity(cache.leafOnlyRows, sourceById);
    const patchBranch = (branch) => {
        branch.leaves = patchProjectedRowsByIdentity(branch.leaves, sourceById);
        for (const child of branch.groups.values()) {
            patchBranch(child);
        }
    };
    for (const branch of cache.rootGroups.values()) {
        patchBranch(branch);
    }
    for (const rowId of changedRowIds) {
        const branchPath = cache.branchPathByLeafRowId.get(rowId);
        if (!branchPath) {
            continue;
        }
        for (const branchKey of branchPath) {
            cache.dirtyBranchKeys.add(branchKey);
        }
    }
    return cache;
}
function patchTreeParentProjectionCacheRowsByIdentity(cache, sourceById, changedRowIds = []) {
    for (const [rowId, row] of cache.rowById.entries()) {
        const next = sourceById.get(rowId);
        if (!next || (next.data === row.data && next.row === row.row)) {
            continue;
        }
        cache.rowById.set(rowId, normalizeLeafRow(next));
    }
    for (const rowId of changedRowIds) {
        let cursor = rowId;
        while (cursor != null) {
            cache.dirtyBranchRootIds.add(cursor);
            cursor = cache.parentById.get(cursor) ?? null;
        }
    }
    return cache;
}
function createTreePathGroupKey(segments) {
    let encoded = "tree:path:";
    for (const segment of segments) {
        encoded += `${segment.length}:${segment}`;
    }
    return encoded;
}
function buildTreePathProjectionCache(inputRows, treeData, rowMatchesFilter, computeAggregates, aggregationBasis = "filtered", createLeafContribution, createEmptyGroupState, applyContributionDelta, finalizeGroupState) {
    const diagnostics = {
        orphans: 0,
        cycles: 0,
    };
    const rootGroups = new Map();
    const branchByKey = new Map();
    const branchParentByKey = new Map();
    const branchPathByLeafRowId = new Map();
    const rootLeaves = [];
    const matchedLeafRowIds = new Set();
    const leafOnlyRows = [];
    const aggregatesByGroupKey = new Map();
    const leafContributionById = (computeAggregates || createLeafContribution)
        ? new Map()
        : undefined;
    const aggregateStateByGroupKey = (createLeafContribution &&
        createEmptyGroupState &&
        applyContributionDelta &&
        finalizeGroupState)
        ? new Map()
        : undefined;
    const dirtyBranchKeys = new Set();
    for (const row of inputRows) {
        const normalizedLeaf = normalizeLeafRow(row);
        const path = normalizeTreePathSegments(treeData.getDataPath(normalizedLeaf.data, normalizedLeaf.sourceIndex));
        const matches = rowMatchesFilter(normalizedLeaf);
        if (matches) {
            matchedLeafRowIds.add(normalizedLeaf.rowId);
            leafOnlyRows.push(normalizedLeaf);
        }
        if (path.length === 0) {
            rootLeaves.push(normalizedLeaf);
            continue;
        }
        let currentGroups = rootGroups;
        const traversed = [];
        const keySegments = [];
        for (let level = 0; level < path.length; level += 1) {
            const value = path[level] ?? "";
            keySegments.push(value);
            const groupKey = createTreePathGroupKey(keySegments);
            const existing = currentGroups.get(value);
            if (existing) {
                traversed.push(existing);
                currentGroups = existing.groups;
                continue;
            }
            const parentBranch = traversed[traversed.length - 1];
            const next = {
                key: groupKey,
                value,
                level,
                groups: new Map(),
                leaves: [],
                matchedLeaves: 0,
            };
            currentGroups.set(value, next);
            branchByKey.set(groupKey, next);
            branchParentByKey.set(groupKey, parentBranch ? parentBranch.key : null);
            traversed.push(next);
            currentGroups = next.groups;
        }
        const target = traversed[traversed.length - 1];
        if (target) {
            target.leaves.push(normalizedLeaf);
            branchPathByLeafRowId.set(normalizedLeaf.rowId, traversed.map(branch => branch.key));
        }
        if (leafContributionById && createLeafContribution && (aggregationBasis === "source" || matches)) {
            const contribution = createLeafContribution(normalizedLeaf);
            if (contribution) {
                leafContributionById.set(normalizedLeaf.rowId, contribution);
            }
        }
        for (const branch of traversed) {
            if (matches) {
                branch.matchedLeaves += 1;
            }
        }
    }
    if (aggregateStateByGroupKey &&
        leafContributionById &&
        createEmptyGroupState &&
        applyContributionDelta &&
        finalizeGroupState) {
        const collectBranchContributions = (branch) => {
            const contributions = [];
            for (const child of branch.groups.values()) {
                contributions.push(...collectBranchContributions(child));
            }
            for (const leaf of branch.leaves) {
                if (aggregationBasis !== "source" && !matchedLeafRowIds.has(leaf.rowId)) {
                    continue;
                }
                const contribution = leafContributionById.get(leaf.rowId);
                if (contribution) {
                    contributions.push(contribution);
                }
            }
            const groupState = createEmptyGroupState();
            if (!groupState) {
                return contributions;
            }
            for (const contribution of contributions) {
                applyContributionDelta(groupState, null, contribution);
            }
            aggregateStateByGroupKey.set(branch.key, groupState);
            const aggregates = finalizeGroupState(groupState);
            if (Object.keys(aggregates).length > 0) {
                aggregatesByGroupKey.set(branch.key, { ...aggregates });
            }
            return contributions;
        };
        for (const branch of rootGroups.values()) {
            collectBranchContributions(branch);
        }
    }
    else if (computeAggregates) {
        const collectBranchLeaves = (branch) => {
            const leafRows = [];
            for (const child of branch.groups.values()) {
                leafRows.push(...collectBranchLeaves(child));
            }
            for (const leaf of branch.leaves) {
                if (aggregationBasis === "source" || matchedLeafRowIds.has(leaf.rowId)) {
                    leafRows.push(leaf);
                }
            }
            if (leafRows.length === 0) {
                return leafRows;
            }
            const aggregates = computeAggregates(leafRows);
            if (aggregates && Object.keys(aggregates).length > 0) {
                aggregatesByGroupKey.set(branch.key, { ...aggregates });
            }
            return leafRows;
        };
        for (const branch of rootGroups.values()) {
            collectBranchLeaves(branch);
        }
    }
    return {
        diagnostics,
        rootGroups,
        branchByKey,
        branchParentByKey,
        branchPathByLeafRowId,
        rootLeaves,
        matchedLeafRowIds,
        leafOnlyRows,
        aggregatesByGroupKey,
        aggregateStateByGroupKey,
        leafContributionById,
        dirtyBranchKeys,
    };
}
function createTreePathGroupNode(branch, expanded, aggregates) {
    const rowData = {
        __tree: true,
        key: branch.key,
        value: branch.value,
        level: branch.level,
    };
    return {
        kind: "group",
        data: rowData,
        row: rowData,
        rowKey: branch.key,
        rowId: branch.key,
        sourceIndex: 0,
        originalIndex: 0,
        displayIndex: -1,
        state: {
            selected: false,
            group: true,
            pinned: "none",
            expanded,
        },
        groupMeta: {
            groupKey: branch.key,
            groupField: "path",
            groupValue: branch.value,
            level: branch.level,
            childrenCount: branch.matchedLeaves,
            ...(aggregates ? { aggregates } : {}),
        },
    };
}
function appendTreePathBranch(cache, branch, expansionSnapshot, expansionToggledKeys, output) {
    // Path mode filter markers are leaf-driven. Synthetic path groups do not evaluate
    // row predicates directly, so include-parents/include-descendants share the same
    // branch visibility rule: keep ancestor chain for matched leaves.
    if (branch.matchedLeaves <= 0) {
        return;
    }
    const expanded = isGroupExpanded(expansionSnapshot, branch.key, expansionToggledKeys);
    output.push(createTreePathGroupNode(branch, expanded, cache.aggregatesByGroupKey.get(branch.key)));
    if (!expanded) {
        return;
    }
    appendTreePathBranchChildren(cache, branch, expansionSnapshot, expansionToggledKeys, output);
}
function appendTreePathBranchChildren(cache, branch, expansionSnapshot, expansionToggledKeys, output) {
    for (const child of branch.groups.values()) {
        appendTreePathBranch(cache, child, expansionSnapshot, expansionToggledKeys, output);
    }
    for (const leaf of branch.leaves) {
        if (cache.matchedLeafRowIds.has(leaf.rowId)) {
            output.push(leaf);
        }
    }
}
function materializeTreePathProjection(cache, expansionSnapshot, filterMode, precomputedExpansionToggledKeys) {
    if (filterMode === "leaf-only") {
        return {
            rows: cache.leafOnlyRows,
            diagnostics: cache.diagnostics,
        };
    }
    const projected = [];
    const expansionToggledKeys = precomputedExpansionToggledKeys ?? new Set(expansionSnapshot.toggledGroupKeys);
    for (const branch of cache.rootGroups.values()) {
        appendTreePathBranch(cache, branch, expansionSnapshot, expansionToggledKeys, projected);
    }
    for (const leaf of cache.rootLeaves) {
        if (cache.matchedLeafRowIds.has(leaf.rowId)) {
            projected.push(leaf);
        }
    }
    return {
        rows: projected,
        diagnostics: cache.diagnostics,
    };
}
function buildTreeProjectionCacheKey(treeCacheRevision, filterRevision, sortRevision, treeData) {
    return [
        treeCacheRevision,
        filterRevision,
        sortRevision,
        treeData.mode,
        treeData.filterMode,
    ].join(":");
}
function isTreePathSpec(treeData) {
    return treeData.mode === "path";
}
function projectTreeDataRowsFromCache(inputRows, treeData, expansionSnapshot, expansionToggledKeys, rowMatchesFilter, pathCacheState, parentCacheState, cacheKey, computeAggregates, aggregationBasis = "filtered", createLeafContribution, createEmptyGroupState, applyContributionDelta, finalizeGroupState) {
    if (isTreePathSpec(treeData)) {
        const nextPathCacheState = pathCacheState?.key === cacheKey
            ? pathCacheState
            : {
                key: cacheKey,
                cache: buildTreePathProjectionCache(inputRows, treeData, rowMatchesFilter, computeAggregates, aggregationBasis, createLeafContribution, createEmptyGroupState, applyContributionDelta, finalizeGroupState),
            };
        return {
            result: materializeTreePathProjection(nextPathCacheState.cache, expansionSnapshot, treeData.filterMode, expansionToggledKeys),
            pathCache: nextPathCacheState,
            parentCache: parentCacheState,
        };
    }
    const nextParentCacheState = parentCacheState?.key === cacheKey
        ? parentCacheState
        : {
            key: cacheKey,
            cache: buildTreeParentProjectionCache(inputRows, treeData, rowMatchesFilter, computeAggregates, aggregationBasis, createLeafContribution, createEmptyGroupState, applyContributionDelta, finalizeGroupState),
        };
    return {
        result: materializeTreeParentProjection(nextParentCacheState.cache, expansionSnapshot, expansionToggledKeys),
        pathCache: pathCacheState,
        parentCache: nextParentCacheState,
    };
}
function createTreeParentGroupKey(rowId) {
    return `tree:parent:${String(rowId)}`;
}
function buildTreeParentProjectionCache(inputRows, treeData, rowMatchesFilter, computeAggregates, aggregationBasis = "filtered", createLeafContribution, createEmptyGroupState, applyContributionDelta, finalizeGroupState) {
    const diagnostics = {
        orphans: 0,
        cycles: 0,
    };
    const rowById = new Map();
    for (const row of inputRows) {
        rowById.set(row.rowId, normalizeLeafRow(row));
    }
    const rawParentById = new Map();
    const dropped = new Set();
    for (const row of inputRows) {
        const rowId = row.rowId;
        const resolved = treeData.getParentId(row.data, row.sourceIndex);
        let parentId = resolved == null
            ? null
            : (isDataGridRowId(resolved) ? resolved : null);
        if (treeData.rootParentId != null && parentId === treeData.rootParentId) {
            parentId = null;
        }
        if (parentId != null && !rowById.has(parentId)) {
            diagnostics.orphans += 1;
            if (treeData.orphanPolicy === "drop") {
                dropped.add(rowId);
                continue;
            }
            if (treeData.orphanPolicy === "error") {
                throw new Error(`[DataGridTreeData] Orphan row '${String(rowId)}' has missing parent '${String(parentId)}'.`);
            }
            parentId = null;
        }
        if (parentId === rowId) {
            diagnostics.cycles += 1;
            if (treeData.cyclePolicy === "error") {
                throw new Error(`[DataGridTreeData] Self-cycle for row '${String(rowId)}'.`);
            }
            parentId = null;
        }
        rawParentById.set(rowId, parentId);
    }
    for (const row of inputRows) {
        if (dropped.has(row.rowId)) {
            continue;
        }
        const rowId = row.rowId;
        let parentId = rawParentById.get(rowId) ?? null;
        if (parentId == null) {
            continue;
        }
        const visited = new Set([rowId]);
        let cursor = parentId;
        while (cursor != null) {
            if (visited.has(cursor)) {
                diagnostics.cycles += 1;
                if (treeData.cyclePolicy === "error") {
                    throw new Error(`[DataGridTreeData] Cycle detected for row '${String(rowId)}'.`);
                }
                parentId = null;
                break;
            }
            visited.add(cursor);
            cursor = rawParentById.get(cursor) ?? null;
        }
        if (parentId == null) {
            rawParentById.set(rowId, null);
        }
    }
    const childrenById = new Map();
    const pushChild = (parentId, rowId) => {
        const bucket = childrenById.get(parentId);
        if (bucket) {
            bucket.push(rowId);
            return;
        }
        childrenById.set(parentId, [rowId]);
    };
    for (const row of inputRows) {
        if (dropped.has(row.rowId)) {
            continue;
        }
        const parentId = rawParentById.get(row.rowId) ?? null;
        pushChild(parentId, row.rowId);
    }
    const matchedIds = new Set();
    for (const row of inputRows) {
        if (dropped.has(row.rowId)) {
            continue;
        }
        if (rowMatchesFilter(row)) {
            matchedIds.add(row.rowId);
        }
    }
    const includeIds = new Set();
    const includeWithAncestors = (rowId) => {
        includeIds.add(rowId);
        let cursor = rawParentById.get(rowId) ?? null;
        while (cursor != null) {
            includeIds.add(cursor);
            cursor = rawParentById.get(cursor) ?? null;
        }
    };
    const includeDescendants = (rowId) => {
        const stack = [rowId];
        const visited = new Set();
        while (stack.length > 0) {
            const current = stack.pop();
            if (typeof current === "undefined" || visited.has(current)) {
                continue;
            }
            visited.add(current);
            includeIds.add(current);
            const children = childrenById.get(current) ?? [];
            for (const childId of children) {
                stack.push(childId);
            }
        }
    };
    if (treeData.filterMode === "leaf-only") {
        for (const rowId of matchedIds) {
            const children = childrenById.get(rowId) ?? [];
            if (children.length === 0) {
                includeIds.add(rowId);
            }
        }
    }
    else if (treeData.filterMode === "include-descendants") {
        for (const rowId of matchedIds) {
            includeWithAncestors(rowId);
            includeDescendants(rowId);
        }
    }
    else {
        for (const rowId of matchedIds) {
            includeWithAncestors(rowId);
        }
    }
    if (includeIds.size === 0) {
        return {
            diagnostics,
            rowById,
            parentById: new Map(),
            includedChildrenById: new Map(),
            groupRowIdByGroupKey: new Map(),
            rootIncluded: [],
            aggregatesByGroupRowId: new Map(),
            aggregateStateByGroupRowId: new Map(),
            leafContributionById: (computeAggregates || createLeafContribution)
                ? new Map()
                : undefined,
            dirtyBranchRootIds: new Set(),
        };
    }
    const parentById = new Map();
    for (const rowId of includeIds) {
        parentById.set(rowId, rawParentById.get(rowId) ?? null);
    }
    const includedChildrenById = new Map();
    for (const rowId of includeIds) {
        const children = childrenById.get(rowId) ?? [];
        if (children.length === 0) {
            continue;
        }
        const includedChildren = children.filter(childId => includeIds.has(childId));
        if (includedChildren.length > 0) {
            includedChildrenById.set(rowId, includedChildren);
        }
    }
    const rootIncluded = [];
    for (const row of inputRows) {
        const rowId = row.rowId;
        if (!includeIds.has(rowId)) {
            continue;
        }
        const parentId = rawParentById.get(rowId) ?? null;
        if (parentId == null || !includeIds.has(parentId)) {
            rootIncluded.push(rowId);
        }
    }
    const groupRowIdByGroupKey = new Map();
    for (const [rowId, children] of includedChildrenById.entries()) {
        if (children.length === 0) {
            continue;
        }
        groupRowIdByGroupKey.set(createTreeParentGroupKey(rowId), rowId);
    }
    const aggregatesByGroupRowId = new Map();
    const aggregateStateByGroupRowId = (createLeafContribution &&
        createEmptyGroupState &&
        applyContributionDelta &&
        finalizeGroupState)
        ? new Map()
        : undefined;
    const leafContributionById = (computeAggregates || createLeafContribution)
        ? new Map()
        : undefined;
    if (aggregateStateByGroupRowId &&
        leafContributionById &&
        createLeafContribution &&
        createEmptyGroupState &&
        applyContributionDelta &&
        finalizeGroupState) {
        const aggregateChildrenById = aggregationBasis === "source"
            ? childrenById
            : includedChildrenById;
        const collectLeafContributions = (rowId) => {
            const children = aggregateChildrenById.get(rowId) ?? [];
            if (children.length === 0) {
                const leaf = rowById.get(rowId);
                if (!leaf) {
                    return [];
                }
                const contribution = createLeafContribution(leaf);
                if (!contribution) {
                    return [];
                }
                leafContributionById.set(rowId, contribution);
                return [contribution];
            }
            const contributions = [];
            for (const childId of children) {
                contributions.push(...collectLeafContributions(childId));
            }
            const groupState = createEmptyGroupState();
            if (!groupState) {
                return contributions;
            }
            for (const contribution of contributions) {
                applyContributionDelta(groupState, null, contribution);
            }
            aggregateStateByGroupRowId.set(rowId, groupState);
            const aggregates = finalizeGroupState(groupState);
            if (Object.keys(aggregates).length > 0) {
                aggregatesByGroupRowId.set(rowId, { ...aggregates });
            }
            return contributions;
        };
        for (const rootId of rootIncluded) {
            collectLeafContributions(rootId);
        }
    }
    else if (computeAggregates) {
        const aggregateChildrenById = aggregationBasis === "source"
            ? childrenById
            : includedChildrenById;
        const leafRowsById = new Map();
        for (const [rowId, row] of rowById.entries()) {
            if ((aggregateChildrenById.get(rowId) ?? []).length === 0) {
                leafRowsById.set(rowId, row);
                if (leafContributionById) {
                    leafContributionById.set(rowId, {});
                }
            }
        }
        const leafMemo = new Map();
        const collectLeafRows = (rowId) => {
            const cached = leafMemo.get(rowId);
            if (cached) {
                return cached;
            }
            const children = aggregateChildrenById.get(rowId) ?? [];
            if (children.length === 0) {
                const leaf = leafRowsById.get(rowId);
                const leafRows = leaf ? [leaf] : [];
                leafMemo.set(rowId, leafRows);
                return leafRows;
            }
            const leafRows = [];
            for (const childId of children) {
                leafRows.push(...collectLeafRows(childId));
            }
            const aggregates = computeAggregates(leafRows);
            if (aggregates && Object.keys(aggregates).length > 0) {
                aggregatesByGroupRowId.set(rowId, { ...aggregates });
            }
            leafMemo.set(rowId, leafRows);
            return leafRows;
        };
        for (const rootId of rootIncluded) {
            collectLeafRows(rootId);
        }
    }
    return {
        diagnostics,
        rowById,
        parentById,
        includedChildrenById,
        groupRowIdByGroupKey,
        rootIncluded,
        aggregatesByGroupRowId,
        aggregateStateByGroupRowId,
        leafContributionById,
        dirtyBranchRootIds: new Set(),
    };
}
function createTreeParentGroupNode(row, rowId, level, childrenCount, expanded, aggregates) {
    return {
        ...row,
        kind: "group",
        state: {
            ...row.state,
            group: true,
            expanded,
        },
        groupMeta: {
            groupKey: createTreeParentGroupKey(rowId),
            groupField: "parent",
            groupValue: String(rowId),
            level,
            childrenCount,
            ...(aggregates ? { aggregates } : {}),
        },
    };
}
function appendTreeParentRow(cache, rowId, level, expansionSnapshot, expansionToggledKeys, output) {
    const row = cache.rowById.get(rowId);
    if (!row) {
        return;
    }
    const children = cache.includedChildrenById.get(rowId) ?? [];
    if (children.length === 0) {
        output.push(row);
        return;
    }
    const groupKey = createTreeParentGroupKey(rowId);
    const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys);
    output.push(createTreeParentGroupNode(row, rowId, level, children.length, expanded, cache.aggregatesByGroupRowId.get(rowId)));
    if (!expanded) {
        return;
    }
    appendTreeParentRowChildren(cache, rowId, level, expansionSnapshot, expansionToggledKeys, output);
}
function appendTreeParentRowChildren(cache, rowId, level, expansionSnapshot, expansionToggledKeys, output) {
    const children = cache.includedChildrenById.get(rowId) ?? [];
    for (const childId of children) {
        appendTreeParentRow(cache, childId, level + 1, expansionSnapshot, expansionToggledKeys, output);
    }
}
function materializeTreeParentProjection(cache, expansionSnapshot, precomputedExpansionToggledKeys) {
    if (cache.rootIncluded.length === 0) {
        return {
            rows: [],
            diagnostics: cache.diagnostics,
        };
    }
    const projected = [];
    const expansionToggledKeys = precomputedExpansionToggledKeys ?? new Set(expansionSnapshot.toggledGroupKeys);
    for (const rootId of cache.rootIncluded) {
        appendTreeParentRow(cache, rootId, 0, expansionSnapshot, expansionToggledKeys, projected);
    }
    return {
        rows: projected,
        diagnostics: cache.diagnostics,
    };
}
function resolveSingleExpansionDelta(previousSnapshot, nextSnapshot) {
    if (previousSnapshot.expandedByDefault !== nextSnapshot.expandedByDefault) {
        return null;
    }
    const previous = new Set(previousSnapshot.toggledGroupKeys);
    const next = new Set(nextSnapshot.toggledGroupKeys);
    let changedKey = null;
    let changedCount = 0;
    for (const key of previous) {
        if (!next.has(key)) {
            changedCount += 1;
            if (changedCount > 1) {
                return null;
            }
            changedKey = key;
        }
    }
    for (const key of next) {
        if (!previous.has(key)) {
            changedCount += 1;
            if (changedCount > 1) {
                return null;
            }
            changedKey = key;
        }
    }
    return changedCount === 1 ? changedKey : null;
}
function projectionSegmentMatches(rows, startIndex, expectedRows) {
    if (startIndex < 0 || startIndex + expectedRows.length > rows.length) {
        return false;
    }
    for (let index = 0; index < expectedRows.length; index += 1) {
        const current = rows[startIndex + index];
        const expected = expectedRows[index];
        if (!current || !expected) {
            return false;
        }
        if (current.rowId !== expected.rowId || current.kind !== expected.kind) {
            return false;
        }
    }
    return true;
}
function buildGroupRowIndexByRowId(rows) {
    const indexByRowId = new Map();
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row || row.kind !== "group") {
            continue;
        }
        indexByRowId.set(row.rowId, index);
    }
    return indexByRowId;
}
function resolveGroupRowIndexByRowId(rows, groupRowId, groupIndexByRowId) {
    const indexed = groupIndexByRowId?.get(groupRowId);
    if (typeof indexed === "number") {
        const candidate = rows[indexed];
        if (candidate?.kind === "group" && candidate.rowId === groupRowId) {
            return indexed;
        }
    }
    return rows.findIndex(row => row.kind === "group" && row.rowId === groupRowId);
}
function tryProjectTreePathSubtreeToggle(rows, cacheState, treeData, previousExpansionSnapshot, nextExpansionSnapshot, groupIndexByRowId) {
    if (treeData.filterMode === "leaf-only") {
        return null;
    }
    const changedGroupKey = resolveSingleExpansionDelta(previousExpansionSnapshot, nextExpansionSnapshot);
    if (!changedGroupKey) {
        return null;
    }
    const branch = cacheState.cache.branchByKey.get(changedGroupKey);
    if (!branch || branch.matchedLeaves <= 0) {
        return null;
    }
    const previousExpanded = isGroupExpanded(previousExpansionSnapshot, changedGroupKey, new Set(previousExpansionSnapshot.toggledGroupKeys));
    const nextExpanded = isGroupExpanded(nextExpansionSnapshot, changedGroupKey, new Set(nextExpansionSnapshot.toggledGroupKeys));
    const groupIndex = resolveGroupRowIndexByRowId(rows, changedGroupKey, groupIndexByRowId);
    if (groupIndex < 0) {
        return null;
    }
    const previousDescendants = [];
    const previousExpandedKeys = new Set(previousExpansionSnapshot.toggledGroupKeys);
    if (previousExpanded) {
        appendTreePathBranchChildren(cacheState.cache, branch, previousExpansionSnapshot, previousExpandedKeys, previousDescendants);
    }
    const nextDescendants = [];
    const nextExpandedKeys = new Set(nextExpansionSnapshot.toggledGroupKeys);
    if (nextExpanded) {
        appendTreePathBranchChildren(cacheState.cache, branch, nextExpansionSnapshot, nextExpandedKeys, nextDescendants);
    }
    const replaceStart = groupIndex + 1;
    if (!projectionSegmentMatches(rows, replaceStart, previousDescendants)) {
        return null;
    }
    const nextRows = rows.slice();
    const currentGroup = nextRows[groupIndex];
    if (currentGroup && currentGroup.kind === "group") {
        nextRows[groupIndex] = {
            ...currentGroup,
            state: {
                ...currentGroup.state,
                expanded: nextExpanded,
            },
        };
    }
    nextRows.splice(replaceStart, previousDescendants.length, ...nextDescendants);
    return {
        rows: nextRows,
        diagnostics: cacheState.cache.diagnostics,
    };
}
function tryProjectTreeParentSubtreeToggle(rows, cacheState, previousExpansionSnapshot, nextExpansionSnapshot, groupIndexByRowId) {
    const changedGroupKey = resolveSingleExpansionDelta(previousExpansionSnapshot, nextExpansionSnapshot);
    if (!changedGroupKey) {
        return null;
    }
    const rowId = cacheState.cache.groupRowIdByGroupKey.get(changedGroupKey);
    if (typeof rowId === "undefined") {
        return null;
    }
    const previousExpanded = isGroupExpanded(previousExpansionSnapshot, changedGroupKey, new Set(previousExpansionSnapshot.toggledGroupKeys));
    const nextExpanded = isGroupExpanded(nextExpansionSnapshot, changedGroupKey, new Set(nextExpansionSnapshot.toggledGroupKeys));
    const groupIndex = resolveGroupRowIndexByRowId(rows, rowId, groupIndexByRowId);
    if (groupIndex < 0) {
        return null;
    }
    const groupRow = rows[groupIndex];
    const baseLevel = groupRow?.groupMeta?.level;
    if (typeof baseLevel !== "number") {
        return null;
    }
    const previousDescendants = [];
    const previousExpandedKeys = new Set(previousExpansionSnapshot.toggledGroupKeys);
    if (previousExpanded) {
        appendTreeParentRowChildren(cacheState.cache, rowId, baseLevel, previousExpansionSnapshot, previousExpandedKeys, previousDescendants);
    }
    const nextDescendants = [];
    const nextExpandedKeys = new Set(nextExpansionSnapshot.toggledGroupKeys);
    if (nextExpanded) {
        appendTreeParentRowChildren(cacheState.cache, rowId, baseLevel, nextExpansionSnapshot, nextExpandedKeys, nextDescendants);
    }
    const replaceStart = groupIndex + 1;
    if (!projectionSegmentMatches(rows, replaceStart, previousDescendants)) {
        return null;
    }
    const nextRows = rows.slice();
    const currentGroup = nextRows[groupIndex];
    if (currentGroup && currentGroup.kind === "group") {
        nextRows[groupIndex] = {
            ...currentGroup,
            state: {
                ...currentGroup.state,
                expanded: nextExpanded,
            },
        };
    }
    nextRows.splice(replaceStart, previousDescendants.length, ...nextDescendants);
    return {
        rows: nextRows,
        diagnostics: cacheState.cache.diagnostics,
    };
}
function normalizeLeafRow(row) {
    if (row.kind === "leaf" && row.state.group === false) {
        return row;
    }
    return {
        ...row,
        kind: "leaf",
        state: {
            ...row.state,
            group: false,
        },
        groupMeta: undefined,
    };
}
function assignDisplayIndexes(rows) {
    const projected = [];
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row) {
            continue;
        }
        if (row.displayIndex === index) {
            projected.push(row);
        }
        else {
            projected.push({
                ...row,
                displayIndex: index,
            });
        }
    }
    return projected;
}
function reindexSourceRows(rows) {
    const normalized = [];
    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (!row) {
            continue;
        }
        normalized.push({
            ...row,
            sourceIndex: index,
            originalIndex: index,
            displayIndex: index,
        });
    }
    return normalized;
}
function createEmptyTreeDataDiagnostics(overrides) {
    return {
        orphans: 0,
        cycles: 0,
        duplicates: 0,
        lastError: null,
        ...overrides,
    };
}
function findDuplicateRowIds(rows) {
    const seen = new Set();
    const duplicates = new Set();
    for (const row of rows) {
        const rowId = row.rowId;
        if (seen.has(rowId)) {
            duplicates.add(rowId);
            continue;
        }
        seen.add(rowId);
    }
    return [...duplicates];
}
export function createClientRowModel(options = {}) {
    const structuredCloneRef = globalThis.structuredClone;
    const cloneSortModel = (input) => input.map(item => ({ ...item }));
    const cloneFilterModel = (input) => {
        if (!input) {
            return null;
        }
        if (typeof structuredCloneRef === "function") {
            try {
                return structuredCloneRef(input);
            }
            catch {
                // Fall through to deterministic JS clone for non-cloneable payloads.
            }
        }
        return cloneFilterSnapshot(input);
    };
    const resolveRowId = options.resolveRowId;
    const treeData = normalizeTreeDataSpec(options.initialTreeData ?? null);
    const projectionPolicy = options.projectionPolicy ?? createDataGridProjectionPolicy({
        performanceMode: options.performanceMode,
        dependencies: options.fieldDependencies,
    });
    if (options.projectionPolicy && Array.isArray(options.fieldDependencies)) {
        for (const dependency of options.fieldDependencies) {
            projectionPolicy.dependencyGraph.registerDependency(dependency.sourceField, dependency.dependentField);
        }
    }
    let treeDataDiagnostics = treeData ? createEmptyTreeDataDiagnostics() : null;
    const normalizeSourceRows = (inputRows) => {
        const normalized = Array.isArray(inputRows)
            ? reindexSourceRows(inputRows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index)))
            : [];
        if (!treeData) {
            return normalized;
        }
        const duplicates = findDuplicateRowIds(normalized);
        if (duplicates.length === 0) {
            return normalized;
        }
        const message = `[DataGridTreeData] Duplicate rowId detected (${duplicates.map(value => String(value)).join(", ")}).`;
        treeDataDiagnostics = createEmptyTreeDataDiagnostics({
            duplicates: duplicates.length,
            lastError: message,
            orphans: treeDataDiagnostics?.orphans ?? 0,
            cycles: treeDataDiagnostics?.cycles ?? 0,
        });
        throw new Error(message);
    };
    let sourceRows = normalizeSourceRows(options.rows ?? []);
    const runtimeStateStore = createClientRowRuntimeStateStore();
    const runtimeState = runtimeStateStore.state;
    let sortModel = options.initialSortModel ? cloneSortModel(options.initialSortModel) : [];
    let filterModel = cloneFilterModel(options.initialFilterModel ?? null);
    let groupBy = treeData
        ? null
        : normalizeGroupBySpec(options.initialGroupBy ?? null);
    let aggregationModel = cloneAggregationModel(options.initialAggregationModel ?? null);
    const aggregationEngine = createDataGridAggregationEngine(aggregationModel);
    let expansionExpandedByDefault = Boolean(treeData?.expandedByDefault ?? groupBy?.expandedByDefault);
    let paginationInput = normalizePaginationInput(options.initialPagination ?? null);
    let pagination = buildPaginationSnapshot(0, paginationInput);
    const toggledGroupKeys = new Set();
    let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, runtimeState.rows.length);
    const lifecycle = createClientRowLifecycle();
    let cachedFilterPredicateKey = "__none__";
    let cachedFilterPredicate = null;
    let rowVersionById = createRowVersionIndex(sourceRows);
    const sortValueCache = new Map();
    let sortValueCacheKey = "__none__";
    const groupValueCache = new Map();
    let groupValueCacheKey = "__none__";
    const derivedCacheDiagnostics = {
        revisions: {
            row: runtimeState.rowRevision,
            sort: runtimeState.sortRevision,
            filter: runtimeState.filterRevision,
            group: runtimeState.groupRevision,
        },
        filterPredicateHits: 0,
        filterPredicateMisses: 0,
        sortValueHits: 0,
        sortValueMisses: 0,
        groupValueHits: 0,
        groupValueMisses: 0,
    };
    let treeCacheRevision = 0;
    let treePathProjectionCacheState = null;
    let treeParentProjectionCacheState = null;
    let groupByAggregateStateByGroupKey = new Map();
    let groupByAggregatesByGroupKey = new Map();
    let groupByAggregatePathByRowId = new Map();
    let groupByLeafContributionByRowId = new Map();
    let groupedProjectionGroupIndexByRowId = new Map();
    let lastTreeProjectionCacheKey = null;
    let lastTreeExpansionSnapshot = null;
    const projectionEngine = createClientRowProjectionEngine();
    function ensureActive() {
        lifecycle.ensureActive();
    }
    function invalidateTreeProjectionCaches() {
        treeCacheRevision += 1;
        treePathProjectionCacheState = null;
        treeParentProjectionCacheState = null;
        lastTreeProjectionCacheKey = null;
        lastTreeExpansionSnapshot = null;
    }
    function patchTreeProjectionCacheRowsByIdentity(changedRowIds = []) {
        if (!treeData || (!treePathProjectionCacheState && !treeParentProjectionCacheState)) {
            return;
        }
        const sourceById = buildRowIdIndex(sourceRows);
        if (treePathProjectionCacheState) {
            treePathProjectionCacheState = {
                key: treePathProjectionCacheState.key,
                cache: patchTreePathProjectionCacheRowsByIdentity(treePathProjectionCacheState.cache, sourceById, changedRowIds),
            };
        }
        if (treeParentProjectionCacheState) {
            treeParentProjectionCacheState = {
                key: treeParentProjectionCacheState.key,
                cache: patchTreeParentProjectionCacheRowsByIdentity(treeParentProjectionCacheState.cache, sourceById, changedRowIds),
            };
        }
    }
    function resetGroupByIncrementalAggregationState() {
        groupByAggregateStateByGroupKey = new Map();
        groupByAggregatesByGroupKey = new Map();
        groupByAggregatePathByRowId = new Map();
        groupByLeafContributionByRowId = new Map();
    }
    function patchRuntimeGroupAggregates(resolveAggregates) {
        runtimeState.groupedRowsProjection = patchGroupRowsAggregatesByGroupKey(runtimeState.groupedRowsProjection, resolveAggregates);
        runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(runtimeState.aggregatedRowsProjection, resolveAggregates);
        runtimeState.paginatedRowsProjection = patchGroupRowsAggregatesByGroupKey(runtimeState.paginatedRowsProjection, resolveAggregates);
        runtimeState.rows = patchGroupRowsAggregatesByGroupKey(runtimeState.rows, resolveAggregates);
    }
    function applyIncrementalGroupByAggregationDelta(changedRowIds, previousRowsById) {
        if (groupByAggregateStateByGroupKey.size === 0 ||
            groupByAggregatePathByRowId.size === 0 ||
            !aggregationEngine.isIncrementalAggregationSupported()) {
            return false;
        }
        const sourceById = buildRowIdIndex(sourceRows);
        const dirtyGroupKeys = new Set();
        for (const rowId of changedRowIds) {
            const groupPath = groupByAggregatePathByRowId.get(rowId);
            if (!groupPath || groupPath.length === 0) {
                continue;
            }
            const previousRow = previousRowsById.get(rowId);
            const previousContribution = groupByLeafContributionByRowId.get(rowId)
                ?? (previousRow ? aggregationEngine.createLeafContribution(previousRow) : null);
            const nextRow = sourceById.get(rowId);
            const nextContribution = nextRow
                ? aggregationEngine.createLeafContribution(nextRow)
                : null;
            if (nextContribution) {
                groupByLeafContributionByRowId.set(rowId, nextContribution);
            }
            else {
                groupByLeafContributionByRowId.delete(rowId);
            }
            for (const groupKey of groupPath) {
                const state = groupByAggregateStateByGroupKey.get(groupKey);
                if (!state) {
                    continue;
                }
                aggregationEngine.applyContributionDelta(state, previousContribution ?? null, nextContribution);
                dirtyGroupKeys.add(groupKey);
            }
        }
        if (dirtyGroupKeys.size === 0) {
            return false;
        }
        for (const groupKey of dirtyGroupKeys) {
            const state = groupByAggregateStateByGroupKey.get(groupKey);
            if (!state) {
                continue;
            }
            const aggregates = aggregationEngine.finalizeGroupState(state);
            if (Object.keys(aggregates).length > 0) {
                groupByAggregatesByGroupKey.set(groupKey, aggregates);
            }
            else {
                groupByAggregatesByGroupKey.delete(groupKey);
            }
        }
        patchRuntimeGroupAggregates(groupKey => groupByAggregatesByGroupKey.get(groupKey));
        return true;
    }
    function applyIncrementalTreePathAggregationDelta(changedRowIds, previousRowsById) {
        const cache = treePathProjectionCacheState?.cache;
        if (!cache ||
            !cache.aggregateStateByGroupKey ||
            !cache.leafContributionById ||
            !aggregationEngine.isIncrementalAggregationSupported()) {
            return false;
        }
        const sourceById = buildRowIdIndex(sourceRows);
        const dirtyGroupKeys = new Set();
        for (const rowId of changedRowIds) {
            const groupPath = cache.branchPathByLeafRowId.get(rowId);
            if (!groupPath || groupPath.length === 0) {
                continue;
            }
            const previousRow = previousRowsById.get(rowId);
            const previousContribution = cache.leafContributionById.get(rowId)
                ?? (previousRow ? aggregationEngine.createLeafContribution(previousRow) : null);
            const nextRow = sourceById.get(rowId);
            const nextContribution = nextRow
                ? aggregationEngine.createLeafContribution(nextRow)
                : null;
            if (nextContribution) {
                cache.leafContributionById.set(rowId, nextContribution);
            }
            else {
                cache.leafContributionById.delete(rowId);
            }
            for (const groupKey of groupPath) {
                const state = cache.aggregateStateByGroupKey.get(groupKey);
                if (!state) {
                    continue;
                }
                aggregationEngine.applyContributionDelta(state, previousContribution ?? null, nextContribution);
                dirtyGroupKeys.add(groupKey);
                cache.dirtyBranchKeys.add(groupKey);
            }
        }
        if (dirtyGroupKeys.size === 0) {
            return false;
        }
        for (const groupKey of dirtyGroupKeys) {
            const state = cache.aggregateStateByGroupKey.get(groupKey);
            if (!state) {
                continue;
            }
            const aggregates = aggregationEngine.finalizeGroupState(state);
            if (Object.keys(aggregates).length > 0) {
                cache.aggregatesByGroupKey.set(groupKey, aggregates);
            }
            else {
                cache.aggregatesByGroupKey.delete(groupKey);
            }
        }
        patchRuntimeGroupAggregates(groupKey => cache.aggregatesByGroupKey.get(groupKey));
        cache.dirtyBranchKeys.clear();
        return true;
    }
    function applyIncrementalTreeParentAggregationDelta(changedRowIds, previousRowsById) {
        const cache = treeParentProjectionCacheState?.cache;
        if (!cache ||
            !cache.aggregateStateByGroupRowId ||
            !cache.leafContributionById ||
            !aggregationEngine.isIncrementalAggregationSupported()) {
            return false;
        }
        const sourceById = buildRowIdIndex(sourceRows);
        const dirtyGroupRowIds = new Set();
        for (const rowId of changedRowIds) {
            const previousRow = previousRowsById.get(rowId);
            const previousContribution = cache.leafContributionById.get(rowId)
                ?? (previousRow ? aggregationEngine.createLeafContribution(previousRow) : null);
            const nextRow = sourceById.get(rowId);
            const nextContribution = nextRow
                ? aggregationEngine.createLeafContribution(nextRow)
                : null;
            if (nextContribution) {
                cache.leafContributionById.set(rowId, nextContribution);
            }
            else {
                cache.leafContributionById.delete(rowId);
            }
            let cursor = rowId;
            while (cursor != null) {
                const state = cache.aggregateStateByGroupRowId.get(cursor);
                if (state) {
                    aggregationEngine.applyContributionDelta(state, previousContribution ?? null, nextContribution);
                    dirtyGroupRowIds.add(cursor);
                    cache.dirtyBranchRootIds.add(cursor);
                }
                cursor = cache.parentById.get(cursor) ?? null;
            }
        }
        if (dirtyGroupRowIds.size === 0) {
            return false;
        }
        for (const rowId of dirtyGroupRowIds) {
            const state = cache.aggregateStateByGroupRowId.get(rowId);
            if (!state) {
                continue;
            }
            const aggregates = aggregationEngine.finalizeGroupState(state);
            if (Object.keys(aggregates).length > 0) {
                cache.aggregatesByGroupRowId.set(rowId, aggregates);
            }
            else {
                cache.aggregatesByGroupRowId.delete(rowId);
            }
        }
        patchRuntimeGroupAggregates(groupKey => {
            const groupRowId = cache.groupRowIdByGroupKey.get(groupKey);
            if (typeof groupRowId === "undefined") {
                return undefined;
            }
            return cache.aggregatesByGroupRowId.get(groupRowId);
        });
        cache.dirtyBranchRootIds.clear();
        return true;
    }
    function applyIncrementalAggregationPatch(changeSet, previousRowsById) {
        if (!aggregationModel || aggregationModel.columns.length === 0) {
            return false;
        }
        if (!changeSet.stageImpact.affectsAggregation ||
            changeSet.stageImpact.affectsFilter ||
            changeSet.stageImpact.affectsSort ||
            changeSet.stageImpact.affectsGroup) {
            return false;
        }
        aggregationEngine.setModel(aggregationModel);
        if (!aggregationEngine.isIncrementalAggregationSupported()) {
            return false;
        }
        if (treeData) {
            return applyIncrementalTreePathAggregationDelta(changeSet.changedRowIds, previousRowsById)
                || applyIncrementalTreeParentAggregationDelta(changeSet.changedRowIds, previousRowsById);
        }
        if (!groupBy) {
            return false;
        }
        return applyIncrementalGroupByAggregationDelta(changeSet.changedRowIds, previousRowsById);
    }
    function resolveFilterPredicate() {
        const filterKey = String(runtimeState.filterRevision);
        return filterKey === cachedFilterPredicateKey && cachedFilterPredicate
            ? (() => {
                derivedCacheDiagnostics.filterPredicateHits += 1;
                return cachedFilterPredicate;
            })()
            : (() => {
                const next = createFilterPredicate(filterModel);
                cachedFilterPredicateKey = filterKey;
                cachedFilterPredicate = next;
                derivedCacheDiagnostics.filterPredicateMisses += 1;
                return next;
            })();
    }
    function runFilterStage(context) {
        const shouldRecomputeFilter = context.shouldRecompute || runtimeState.filteredRowsProjection.length === 0;
        let filteredRowIds = new Set();
        if (shouldRecomputeFilter) {
            const filterPredicate = context.filterPredicate ?? resolveFilterPredicate();
            const nextFilteredRows = [];
            for (const row of sourceRows) {
                if (!filterPredicate(row)) {
                    continue;
                }
                nextFilteredRows.push(row);
                filteredRowIds.add(row.rowId);
            }
            runtimeState.filteredRowsProjection = nextFilteredRows;
        }
        else {
            runtimeState.filteredRowsProjection = remapRowsByIdentity(runtimeState.filteredRowsProjection, context.sourceById);
            for (const row of runtimeState.filteredRowsProjection) {
                filteredRowIds.add(row.rowId);
            }
        }
        return {
            filteredRowIds,
            recomputed: shouldRecomputeFilter,
        };
    }
    function runSortStage(context) {
        const rowsForSort = treeData
            ? (shouldUseFilteredRowsForTreeSort(treeData, filterModel)
                ? runtimeState.filteredRowsProjection
                : sourceRows)
            : runtimeState.filteredRowsProjection;
        const shouldRecomputeSort = context.shouldRecompute || runtimeState.sortedRowsProjection.length === 0;
        if (shouldRecomputeSort) {
            const shouldCacheSortValues = projectionPolicy.shouldCacheSortValues();
            const maxSortValueCacheSize = projectionPolicy.maxSortValueCacheSize(sourceRows.length);
            const sortKey = serializeSortValueModelForCache(sortModel, { includeDirection: false });
            if (sortKey !== sortValueCacheKey || !shouldCacheSortValues || maxSortValueCacheSize <= 0) {
                sortValueCache.clear();
                sortValueCacheKey = sortKey;
            }
            runtimeState.sortedRowsProjection = sortLeafRows(rowsForSort, sortModel, (row, descriptors) => {
                if (!shouldCacheSortValues || maxSortValueCacheSize <= 0) {
                    derivedCacheDiagnostics.sortValueMisses += 1;
                    return descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field));
                }
                const currentRowVersion = rowVersionById.get(row.rowId) ?? 0;
                const cached = sortValueCache.get(row.rowId);
                if (cached && cached.rowVersion === currentRowVersion) {
                    sortValueCache.delete(row.rowId);
                    sortValueCache.set(row.rowId, cached);
                    derivedCacheDiagnostics.sortValueHits += 1;
                    return cached.values;
                }
                const resolved = descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field));
                sortValueCache.set(row.rowId, {
                    rowVersion: currentRowVersion,
                    values: resolved,
                });
                enforceCacheCap(sortValueCache, maxSortValueCacheSize);
                derivedCacheDiagnostics.sortValueMisses += 1;
                return resolved;
            });
        }
        else {
            runtimeState.sortedRowsProjection = preserveRowOrder(runtimeState.sortedRowsProjection, rowsForSort);
        }
        return shouldRecomputeSort;
    }
    function runGroupStage(context) {
        const expansionSpec = getExpansionSpec();
        const expansionSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys);
        const nextGroupValueCacheKey = groupBy
            ? `${runtimeState.rowRevision}:${runtimeState.groupRevision}:${groupBy.fields.join("|")}`
            : "__none__";
        const groupValueCounters = {
            hits: derivedCacheDiagnostics.groupValueHits,
            misses: derivedCacheDiagnostics.groupValueMisses,
        };
        let groupedResult = null;
        let recomputedGroupStage = false;
        if (treeData) {
            const treeCacheKey = buildTreeProjectionCacheKey(treeCacheRevision, runtimeState.filterRevision, runtimeState.sortRevision, treeData);
            const shouldRecomputeGroup = context.shouldRecompute || runtimeState.groupedRowsProjection.length === 0;
            if (shouldRecomputeGroup) {
                const aggregationBasis = aggregationModel?.basis === "source"
                    ? "source"
                    : "filtered";
                let treeRowsForProjection = runtimeState.sortedRowsProjection;
                let treeRowMatchesFilter = context.rowMatchesFilter;
                if (isTreePathSpec(treeData) &&
                    shouldUseFilteredRowsForTreeSort(treeData, filterModel) &&
                    aggregationBasis !== "source") {
                    if (runtimeState.sortedRowsProjection.length === runtimeState.filteredRowsProjection.length) {
                        treeRowMatchesFilter = alwaysMatchesFilter;
                    }
                    else {
                        const filteredSortedRows = [];
                        for (const row of runtimeState.sortedRowsProjection) {
                            if (!context.rowMatchesFilter(row)) {
                                continue;
                            }
                            filteredSortedRows.push(row);
                        }
                        treeRowsForProjection = filteredSortedRows;
                        treeRowMatchesFilter = alwaysMatchesFilter;
                    }
                }
                const hasTreeAggregationModel = Boolean(aggregationModel && aggregationModel.columns.length > 0);
                if (hasTreeAggregationModel) {
                    aggregationEngine.setModel(aggregationModel);
                }
                const computeTreeAggregates = hasTreeAggregationModel
                    ? ((rows) => aggregationEngine.computeAggregatesForLeaves(rows))
                    : undefined;
                const supportsIncrementalTreeAggregation = hasTreeAggregationModel
                    && aggregationEngine.isIncrementalAggregationSupported();
                const createTreeLeafContribution = supportsIncrementalTreeAggregation
                    ? ((row) => aggregationEngine.createLeafContribution(row))
                    : undefined;
                const createTreeGroupState = supportsIncrementalTreeAggregation
                    ? (() => aggregationEngine.createEmptyGroupState())
                    : undefined;
                const applyTreeContributionDelta = supportsIncrementalTreeAggregation
                    ? ((groupState, previous, next) => {
                        aggregationEngine.applyContributionDelta(groupState, previous, next);
                    })
                    : undefined;
                const finalizeTreeGroupState = supportsIncrementalTreeAggregation
                    ? ((groupState) => aggregationEngine.finalizeGroupState(groupState))
                    : undefined;
                if (context.shouldRecompute &&
                    runtimeState.groupedRowsProjection.length > 0 &&
                    lastTreeProjectionCacheKey === treeCacheKey &&
                    lastTreeExpansionSnapshot) {
                    if (treeData.mode === "path" && treePathProjectionCacheState?.key === treeCacheKey) {
                        groupedResult = tryProjectTreePathSubtreeToggle(runtimeState.groupedRowsProjection, treePathProjectionCacheState, treeData, lastTreeExpansionSnapshot, expansionSnapshot, groupedProjectionGroupIndexByRowId);
                    }
                    else if (treeData.mode === "parent" && treeParentProjectionCacheState?.key === treeCacheKey) {
                        groupedResult = tryProjectTreeParentSubtreeToggle(runtimeState.groupedRowsProjection, treeParentProjectionCacheState, lastTreeExpansionSnapshot, expansionSnapshot, groupedProjectionGroupIndexByRowId);
                    }
                }
                if (!groupedResult) {
                    try {
                        const projected = projectTreeDataRowsFromCache(treeRowsForProjection, treeData, expansionSnapshot, toggledGroupKeys, treeRowMatchesFilter, treePathProjectionCacheState, treeParentProjectionCacheState, treeCacheKey, computeTreeAggregates, aggregationBasis, createTreeLeafContribution, createTreeGroupState, applyTreeContributionDelta, finalizeTreeGroupState);
                        groupedResult = projected.result;
                        treePathProjectionCacheState = projected.pathCache;
                        treeParentProjectionCacheState = projected.parentCache;
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        treeDataDiagnostics = createEmptyTreeDataDiagnostics({
                            duplicates: treeDataDiagnostics?.duplicates ?? 0,
                            lastError: message,
                        });
                        throw error;
                    }
                }
                runtimeState.groupedRowsProjection = groupedResult.rows;
                lastTreeProjectionCacheKey = treeCacheKey;
                lastTreeExpansionSnapshot = expansionSnapshot;
                recomputedGroupStage = true;
            }
            else {
                runtimeState.groupedRowsProjection = patchProjectedRowsByIdentity(runtimeState.groupedRowsProjection, context.sourceById);
            }
            if (shouldRecomputeGroup || groupedResult) {
                treeDataDiagnostics = createEmptyTreeDataDiagnostics({
                    duplicates: 0,
                    lastError: null,
                    orphans: groupedResult?.diagnostics.orphans ?? 0,
                    cycles: groupedResult?.diagnostics.cycles ?? 0,
                });
            }
        }
        else if (groupBy) {
            const shouldRecomputeGroup = context.shouldRecompute || runtimeState.groupedRowsProjection.length === 0;
            if (shouldRecomputeGroup) {
                const shouldCacheGroupValues = projectionPolicy.shouldCacheGroupValues();
                const maxGroupValueCacheSize = projectionPolicy.maxGroupValueCacheSize(sourceRows.length);
                if (nextGroupValueCacheKey !== groupValueCacheKey) {
                    groupValueCache.clear();
                    groupValueCacheKey = nextGroupValueCacheKey;
                }
                if (!shouldCacheGroupValues || maxGroupValueCacheSize <= 0) {
                    groupValueCache.clear();
                }
                runtimeState.groupedRowsProjection = buildGroupedRowsProjection({
                    inputRows: runtimeState.sortedRowsProjection,
                    groupBy,
                    expansionSnapshot,
                    readRowField: (row, key, field) => readRowField(row, key, field),
                    normalizeText,
                    normalizeLeafRow,
                    groupValueCache: shouldCacheGroupValues && maxGroupValueCacheSize > 0
                        ? groupValueCache
                        : undefined,
                    groupValueCounters: shouldCacheGroupValues && maxGroupValueCacheSize > 0
                        ? groupValueCounters
                        : undefined,
                    maxGroupValueCacheSize: shouldCacheGroupValues && maxGroupValueCacheSize > 0
                        ? maxGroupValueCacheSize
                        : undefined,
                });
                if (shouldCacheGroupValues) {
                    enforceCacheCap(groupValueCache, maxGroupValueCacheSize);
                }
                recomputedGroupStage = true;
            }
            else {
                runtimeState.groupedRowsProjection = patchProjectedRowsByIdentity(runtimeState.groupedRowsProjection, context.sourceById);
            }
        }
        else {
            runtimeState.groupedRowsProjection = runtimeState.sortedRowsProjection;
            recomputedGroupStage = context.shouldRecompute;
        }
        if (recomputedGroupStage) {
            groupedProjectionGroupIndexByRowId = buildGroupRowIndexByRowId(runtimeState.groupedRowsProjection);
        }
        derivedCacheDiagnostics.groupValueHits = groupValueCounters.hits;
        derivedCacheDiagnostics.groupValueMisses = groupValueCounters.misses;
        return recomputedGroupStage;
    }
    function runPaginateStage(context) {
        const shouldRecomputePaginate = context.shouldRecompute || runtimeState.paginatedRowsProjection.length === 0;
        if (shouldRecomputePaginate) {
            pagination = buildPaginationSnapshot(runtimeState.aggregatedRowsProjection.length, paginationInput);
            if (pagination.enabled && pagination.startIndex >= 0 && pagination.endIndex >= pagination.startIndex) {
                runtimeState.paginatedRowsProjection = runtimeState.aggregatedRowsProjection.slice(pagination.startIndex, pagination.endIndex + 1);
            }
            else {
                runtimeState.paginatedRowsProjection = runtimeState.aggregatedRowsProjection;
            }
        }
        else {
            runtimeState.paginatedRowsProjection = patchProjectedRowsByIdentity(runtimeState.paginatedRowsProjection, context.sourceById);
        }
        return shouldRecomputePaginate;
    }
    function runAggregateStage(context) {
        const shouldRecomputeAggregate = context.shouldRecompute || runtimeState.aggregatedRowsProjection.length === 0;
        if (!shouldRecomputeAggregate) {
            runtimeState.aggregatedRowsProjection = patchProjectedRowsByIdentity(runtimeState.aggregatedRowsProjection, context.sourceById);
            return false;
        }
        const activeGroupBy = groupBy;
        const activeAggregationModel = aggregationModel;
        const hasAggregationModel = Boolean(activeAggregationModel && activeAggregationModel.columns.length > 0);
        if (treeData || !activeGroupBy || !hasAggregationModel || !activeAggregationModel) {
            resetGroupByIncrementalAggregationState();
            runtimeState.aggregatedRowsProjection = runtimeState.groupedRowsProjection;
            return true;
        }
        aggregationEngine.setModel(activeAggregationModel);
        const aggregationBasis = activeAggregationModel.basis === "source"
            ? "source"
            : "filtered";
        const sourceRowsForAggregation = sortModel.length > 0
            ? sortLeafRows(sourceRows, sortModel, (row, descriptors) => {
                return descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field));
            })
            : sourceRows;
        const rowsForAggregation = aggregationBasis === "source"
            ? sourceRowsForAggregation
            : runtimeState.sortedRowsProjection;
        let aggregatesByGroupKey;
        if (aggregationEngine.isIncrementalAggregationSupported()) {
            const incremental = computeGroupByIncrementalAggregation(rowsForAggregation, activeGroupBy, (row, field) => normalizeText(readRowField(row, field)), row => aggregationEngine.createLeafContribution(row), () => aggregationEngine.createEmptyGroupState(), (groupState, previous, next) => aggregationEngine.applyContributionDelta(groupState, previous, next), groupState => aggregationEngine.finalizeGroupState(groupState));
            groupByAggregateStateByGroupKey = incremental.statesByGroupKey;
            groupByAggregatesByGroupKey = incremental.aggregatesByGroupKey;
            groupByAggregatePathByRowId = incremental.groupPathByRowId;
            groupByLeafContributionByRowId = incremental.leafContributionByRowId;
            aggregatesByGroupKey = groupByAggregatesByGroupKey;
        }
        else {
            resetGroupByIncrementalAggregationState();
            aggregatesByGroupKey = computeGroupByAggregatesMap(rowsForAggregation, activeGroupBy, (row, field) => normalizeText(readRowField(row, field)), rows => aggregationEngine.computeAggregatesForLeaves(rows));
            groupByAggregatesByGroupKey = new Map(aggregatesByGroupKey);
        }
        runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(runtimeState.groupedRowsProjection, groupKey => aggregatesByGroupKey.get(groupKey));
        return true;
    }
    function runVisibleStage(context) {
        const shouldRecomputeVisible = context.shouldRecompute || runtimeState.rows.length === 0;
        if (shouldRecomputeVisible) {
            runtimeState.rows = assignDisplayIndexes(runtimeState.paginatedRowsProjection);
        }
        else {
            runtimeState.rows = patchProjectedRowsByIdentity(runtimeState.rows, context.sourceById);
        }
        return shouldRecomputeVisible;
    }
    function finalizeProjectionRecompute(meta) {
        paginationInput = {
            pageSize: pagination.pageSize,
            currentPage: pagination.currentPage,
        };
        viewportRange = normalizeViewportRange(viewportRange, runtimeState.rows.length);
        derivedCacheDiagnostics.revisions = {
            row: runtimeState.rowRevision,
            sort: runtimeState.sortRevision,
            filter: runtimeState.filterRevision,
            group: runtimeState.groupRevision,
        };
        runtimeStateStore.commitProjectionCycle(meta.hadActualRecompute);
    }
    const projectionStageHandlers = {
        buildSourceById: () => buildRowIdIndex(sourceRows),
        getCurrentFilteredRowIds: () => {
            const rowIds = new Set();
            for (const row of runtimeState.filteredRowsProjection) {
                rowIds.add(row.rowId);
            }
            return rowIds;
        },
        resolveFilterPredicate,
        runFilterStage,
        runSortStage,
        runGroupStage,
        runAggregateStage,
        runPaginateStage,
        runVisibleStage,
        finalizeProjectionRecompute,
    };
    const projectionOrchestrator = createClientRowProjectionOrchestrator(projectionEngine, projectionStageHandlers);
    function getProjectionDiagnostics() {
        return runtimeStateStore.getProjectionDiagnostics(() => projectionOrchestrator.getStaleStages());
    }
    function getSnapshot() {
        viewportRange = normalizeViewportRange(viewportRange, runtimeState.rows.length);
        const expansionSpec = getExpansionSpec();
        return {
            revision: runtimeState.revision,
            kind: "client",
            rowCount: runtimeState.rows.length,
            loading: false,
            error: null,
            ...(treeData ? { treeDataDiagnostics: createEmptyTreeDataDiagnostics(treeDataDiagnostics ?? undefined) } : {}),
            projection: getProjectionDiagnostics(),
            viewportRange,
            pagination,
            sortModel: cloneSortModel(sortModel),
            filterModel: cloneFilterModel(filterModel),
            groupBy: treeData ? null : cloneGroupBySpec(groupBy),
            groupExpansion: buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys),
        };
    }
    function emit() {
        lifecycle.emit(getSnapshot);
    }
    function getExpansionSpec() {
        if (treeData) {
            return {
                fields: ["__tree__"],
                expandedByDefault: expansionExpandedByDefault,
            };
        }
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
    projectionOrchestrator.recomputeFromStage("filter");
    return {
        kind: "client",
        getSnapshot,
        getRowCount() {
            return runtimeState.rows.length;
        },
        getRow(index) {
            if (!Number.isFinite(index)) {
                return undefined;
            }
            return runtimeState.rows[Math.max(0, Math.trunc(index))];
        },
        getRowsInRange(range) {
            const normalized = normalizeViewportRange(range, runtimeState.rows.length);
            if (runtimeState.rows.length === 0) {
                return [];
            }
            return runtimeState.rows.slice(normalized.start, normalized.end + 1);
        },
        setRows(nextRows) {
            ensureActive();
            const nextSourceRows = normalizeSourceRows(nextRows ?? []);
            rowVersionById = rebuildRowVersionIndex(rowVersionById, nextSourceRows);
            sourceRows = nextSourceRows;
            pruneSortCacheRows(sortValueCache, sourceRows);
            runtimeStateStore.bumpRowRevision();
            resetGroupByIncrementalAggregationState();
            invalidateTreeProjectionCaches();
            projectionOrchestrator.recomputeFromStage("filter");
            emit();
        },
        patchRows(updates, options = {}) {
            ensureActive();
            if (!Array.isArray(updates) || updates.length === 0) {
                return;
            }
            const updatesById = new Map();
            for (const update of updates) {
                if (!update || !isDataGridRowId(update.rowId) || typeof update.data === "undefined" || update.data === null) {
                    continue;
                }
                const existing = updatesById.get(update.rowId);
                if (existing) {
                    updatesById.set(update.rowId, mergeRowPatch(existing, update.data));
                    continue;
                }
                updatesById.set(update.rowId, update.data);
            }
            if (updatesById.size === 0) {
                return;
            }
            let changed = false;
            const changedRowIds = [];
            const changedUpdatesById = new Map();
            const previousRowsById = new Map();
            sourceRows = sourceRows.map(row => {
                const patch = updatesById.get(row.rowId);
                if (!patch) {
                    return row;
                }
                const nextData = applyRowDataPatch(row.data, patch);
                if (nextData === row.data) {
                    return row;
                }
                changed = true;
                changedRowIds.push(row.rowId);
                changedUpdatesById.set(row.rowId, patch);
                previousRowsById.set(row.rowId, row);
                return {
                    ...row,
                    data: nextData,
                    row: nextData,
                };
            });
            if (!changed || changedUpdatesById.size === 0) {
                return;
            }
            bumpRowVersions(rowVersionById, changedRowIds);
            runtimeStateStore.bumpRowRevision();
            const filterActive = hasActiveFilterModel(filterModel);
            const sortActive = sortModel.length > 0;
            const groupActive = Boolean(treeData) || Boolean(groupBy);
            const aggregationActive = Boolean(aggregationModel && aggregationModel.columns.length > 0);
            const allowFilterRecompute = options.recomputeFilter === true;
            const allowSortRecompute = options.recomputeSort === true;
            const allowGroupRecompute = options.recomputeGroup === true;
            const filterFields = filterActive ? collectFilterModelFields(filterModel) : new Set();
            const sortFields = sortActive ? collectSortModelFields(sortModel) : new Set();
            const groupFields = groupActive && !treeData ? collectGroupByFields(groupBy) : new Set();
            const aggregationFields = aggregationActive ? collectAggregationModelFields(aggregationModel) : new Set();
            const treeDataDependencyFields = treeData ? collectTreeDataDependencyFields(treeData) : new Set();
            const changeSet = analyzeRowPatchChangeSet({
                updatesById: changedUpdatesById,
                dependencyGraph: projectionPolicy.dependencyGraph,
                filterActive,
                sortActive,
                groupActive,
                aggregationActive,
                filterFields,
                sortFields,
                groupFields,
                aggregationFields,
                treeDataDependencyFields,
                hasTreeData: Boolean(treeData),
            });
            if (changeSet.cacheEvictionPlan.clearSortValueCache) {
                sortValueCache.clear();
            }
            else if (changeSet.cacheEvictionPlan.evictSortValueRowIds.length > 0) {
                for (const rowId of changeSet.cacheEvictionPlan.evictSortValueRowIds) {
                    sortValueCache.delete(rowId);
                }
            }
            if (changeSet.cacheEvictionPlan.invalidateTreeProjectionCaches) {
                invalidateTreeProjectionCaches();
            }
            else if (changeSet.cacheEvictionPlan.patchTreeProjectionCacheRowsByIdentity) {
                patchTreeProjectionCacheRowsByIdentity(changedRowIds);
            }
            const appliedIncrementalAggregation = !allowGroupRecompute
                && applyIncrementalAggregationPatch(changeSet, previousRowsById);
            const effectiveChangeSet = appliedIncrementalAggregation
                ? {
                    ...changeSet,
                    stageImpact: {
                        ...changeSet.stageImpact,
                        affectsAggregation: false,
                    },
                }
                : changeSet;
            const staleStagesBeforeRequest = new Set(projectionOrchestrator.getStaleStages());
            const allStages = DATAGRID_CLIENT_ALL_PROJECTION_STAGES;
            const projectionExecutionPlan = buildPatchProjectionExecutionPlan({
                changeSet: effectiveChangeSet,
                recomputePolicy: {
                    filter: allowFilterRecompute,
                    sort: allowSortRecompute,
                    group: allowGroupRecompute,
                },
                staleStages: staleStagesBeforeRequest,
                allStages,
                expandStages: expandClientProjectionStages,
            });
            // Always request a projection refresh pass so every stage can patch row identity
            // even when no expensive stage recompute is needed.
            projectionOrchestrator.recomputeWithExecutionPlan(projectionExecutionPlan);
            if (options.emit !== false) {
                emit();
            }
        },
        reorderRows(input) {
            ensureActive();
            const length = sourceRows.length;
            if (length <= 1) {
                return false;
            }
            if (!Number.isFinite(input.fromIndex) || !Number.isFinite(input.toIndex)) {
                return false;
            }
            const fromIndex = Math.max(0, Math.min(length - 1, Math.trunc(input.fromIndex)));
            const count = Number.isFinite(input.count) ? Math.max(1, Math.trunc(input.count)) : 1;
            const maxCount = Math.max(1, Math.min(count, length - fromIndex));
            const toIndexRaw = Math.max(0, Math.min(length, Math.trunc(input.toIndex)));
            const rows = sourceRows.slice();
            const moved = rows.splice(fromIndex, maxCount);
            if (moved.length === 0) {
                return false;
            }
            const adjustedTarget = toIndexRaw > fromIndex ? Math.max(0, toIndexRaw - moved.length) : toIndexRaw;
            rows.splice(adjustedTarget, 0, ...moved);
            sourceRows = reindexSourceRows(rows);
            runtimeStateStore.bumpRowRevision();
            invalidateTreeProjectionCaches();
            projectionOrchestrator.recomputeFromStage("filter");
            emit();
            return true;
        },
        setViewportRange(range) {
            ensureActive();
            const nextRange = normalizeViewportRange(range, runtimeState.rows.length);
            if (nextRange.start === viewportRange.start && nextRange.end === viewportRange.end) {
                return;
            }
            viewportRange = nextRange;
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
            projectionOrchestrator.recomputeFromStage("paginate");
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
            projectionOrchestrator.recomputeFromStage("paginate");
            emit();
        },
        setCurrentPage(page) {
            ensureActive();
            const normalizedPage = normalizePaginationInput({ pageSize: paginationInput.pageSize, currentPage: page }).currentPage;
            if (normalizedPage === paginationInput.currentPage) {
                return;
            }
            paginationInput = {
                ...paginationInput,
                currentPage: normalizedPage,
            };
            projectionOrchestrator.recomputeFromStage("paginate");
            emit();
        },
        setSortModel(nextSortModel) {
            ensureActive();
            const normalizedSortModel = Array.isArray(nextSortModel) ? cloneSortModel(nextSortModel) : [];
            if (isSameSortModel(sortModel, normalizedSortModel)) {
                return;
            }
            sortModel = normalizedSortModel;
            runtimeStateStore.bumpSortRevision();
            projectionOrchestrator.recomputeFromStage("sort");
            emit();
        },
        setFilterModel(nextFilterModel) {
            ensureActive();
            const normalizedFilterModel = cloneFilterModel(nextFilterModel ?? null);
            if (isSameFilterModel(filterModel, normalizedFilterModel)) {
                return;
            }
            filterModel = normalizedFilterModel;
            runtimeStateStore.bumpFilterRevision();
            projectionOrchestrator.recomputeFromStage("filter");
            emit();
        },
        setSortAndFilterModel(input) {
            ensureActive();
            const normalizedSortModel = Array.isArray(input?.sortModel) ? cloneSortModel(input.sortModel) : [];
            const normalizedFilterModel = cloneFilterModel(input?.filterModel ?? null);
            const sortChanged = !isSameSortModel(sortModel, normalizedSortModel);
            const filterChanged = !isSameFilterModel(filterModel, normalizedFilterModel);
            if (!sortChanged && !filterChanged) {
                return;
            }
            sortModel = normalizedSortModel;
            filterModel = normalizedFilterModel;
            if (filterChanged) {
                runtimeStateStore.bumpFilterRevision();
            }
            if (sortChanged) {
                runtimeStateStore.bumpSortRevision();
            }
            projectionOrchestrator.recomputeFromStage(filterChanged ? "filter" : "sort");
            emit();
        },
        setGroupBy(nextGroupBy) {
            ensureActive();
            if (treeData) {
                return;
            }
            const normalized = normalizeGroupBySpec(nextGroupBy);
            if (isSameGroupBySpec(groupBy, normalized)) {
                return;
            }
            groupBy = normalized;
            expansionExpandedByDefault = Boolean(normalized?.expandedByDefault);
            toggledGroupKeys.clear();
            runtimeStateStore.bumpGroupRevision();
            projectionOrchestrator.recomputeFromStage("group");
            emit();
        },
        setAggregationModel(nextAggregationModel) {
            ensureActive();
            const normalized = cloneAggregationModel(nextAggregationModel ?? null);
            if (isSameAggregationModel(aggregationModel, normalized)) {
                return;
            }
            aggregationModel = normalized;
            if (treeData) {
                invalidateTreeProjectionCaches();
                projectionOrchestrator.recomputeFromStage("group");
            }
            else {
                projectionOrchestrator.recomputeFromStage("aggregate");
            }
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
            runtimeStateStore.bumpGroupRevision();
            projectionOrchestrator.recomputeFromStage("group");
            emit();
        },
        toggleGroup(groupKey) {
            ensureActive();
            const expansionSpec = getExpansionSpec();
            if (!expansionSpec) {
                return;
            }
            if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
                return;
            }
            runtimeStateStore.bumpGroupRevision();
            projectionOrchestrator.recomputeFromStage("group");
            emit();
        },
        expandGroup(groupKey) {
            ensureActive();
            const expansionSpec = getExpansionSpec();
            if (!expansionSpec) {
                return;
            }
            if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, true)) {
                return;
            }
            runtimeStateStore.bumpGroupRevision();
            projectionOrchestrator.recomputeFromStage("group");
            emit();
        },
        collapseGroup(groupKey) {
            ensureActive();
            const expansionSpec = getExpansionSpec();
            if (!expansionSpec) {
                return;
            }
            if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, false)) {
                return;
            }
            runtimeStateStore.bumpGroupRevision();
            projectionOrchestrator.recomputeFromStage("group");
            emit();
        },
        expandAllGroups() {
            ensureActive();
            const expansionSpec = getExpansionSpec();
            if (!expansionSpec) {
                return;
            }
            if (expansionExpandedByDefault && toggledGroupKeys.size === 0) {
                return;
            }
            expansionExpandedByDefault = true;
            toggledGroupKeys.clear();
            runtimeStateStore.bumpGroupRevision();
            projectionOrchestrator.recomputeFromStage("group");
            emit();
        },
        collapseAllGroups() {
            ensureActive();
            const expansionSpec = getExpansionSpec();
            if (!expansionSpec) {
                return;
            }
            if (!expansionExpandedByDefault && toggledGroupKeys.size === 0) {
                return;
            }
            expansionExpandedByDefault = false;
            toggledGroupKeys.clear();
            runtimeStateStore.bumpGroupRevision();
            projectionOrchestrator.recomputeFromStage("group");
            emit();
        },
        refresh(_reason) {
            ensureActive();
            projectionOrchestrator.refresh();
            emit();
        },
        subscribe(listener) {
            return lifecycle.subscribe(listener);
        },
        getDerivedCacheDiagnostics() {
            return {
                revisions: { ...derivedCacheDiagnostics.revisions },
                filterPredicateHits: derivedCacheDiagnostics.filterPredicateHits,
                filterPredicateMisses: derivedCacheDiagnostics.filterPredicateMisses,
                sortValueHits: derivedCacheDiagnostics.sortValueHits,
                sortValueMisses: derivedCacheDiagnostics.sortValueMisses,
                groupValueHits: derivedCacheDiagnostics.groupValueHits,
                groupValueMisses: derivedCacheDiagnostics.groupValueMisses,
            };
        },
        dispose() {
            if (!lifecycle.dispose()) {
                return;
            }
            sourceRows = [];
            runtimeState.rows = [];
            runtimeState.filteredRowsProjection = [];
            runtimeState.sortedRowsProjection = [];
            runtimeState.groupedRowsProjection = [];
            runtimeState.aggregatedRowsProjection = [];
            runtimeState.paginatedRowsProjection = [];
            rowVersionById.clear();
            resetGroupByIncrementalAggregationState();
            groupedProjectionGroupIndexByRowId.clear();
            sortValueCache.clear();
            groupValueCache.clear();
            invalidateTreeProjectionCaches();
            cachedFilterPredicate = null;
            cachedFilterPredicateKey = "__none__";
        },
    };
}
