const DATAGRID_TREE_DATA_DEFAULT_ORPHAN_POLICY = "root";
const DATAGRID_TREE_DATA_DEFAULT_CYCLE_POLICY = "ignore-edge";
const DATAGRID_TREE_DATA_DEFAULT_FILTER_MODE = "include-parents";
function normalizeTreeDataOrphanPolicy(value) {
    if (value === "root" || value === "drop" || value === "error") {
        return value;
    }
    return DATAGRID_TREE_DATA_DEFAULT_ORPHAN_POLICY;
}
function normalizeTreeDataCyclePolicy(value) {
    if (value === "ignore-edge" || value === "error") {
        return value;
    }
    return DATAGRID_TREE_DATA_DEFAULT_CYCLE_POLICY;
}
function normalizeTreeDataFilterMode(value) {
    if (value === "leaf-only" || value === "include-parents" || value === "include-descendants") {
        return value;
    }
    return DATAGRID_TREE_DATA_DEFAULT_FILTER_MODE;
}
function normalizeTreeDataDependencyFields(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const unique = new Set();
    for (const entry of value) {
        if (typeof entry !== "string") {
            continue;
        }
        const normalized = entry.trim();
        if (normalized.length === 0 || unique.has(normalized)) {
            continue;
        }
        unique.add(normalized);
    }
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
}
export function normalizeTreeDataSpec(treeData) {
    if (!treeData) {
        return null;
    }
    const orphanPolicy = normalizeTreeDataOrphanPolicy(treeData.orphanPolicy);
    const cyclePolicy = normalizeTreeDataCyclePolicy(treeData.cyclePolicy);
    const filterMode = normalizeTreeDataFilterMode(treeData.filterMode);
    const dependencyFields = normalizeTreeDataDependencyFields(treeData.dependencyFields);
    const expandedByDefault = Boolean(treeData.expandedByDefault);
    if (treeData.mode === "path") {
        if (typeof treeData.getParentId !== "undefined") {
            return null;
        }
        if (typeof treeData.getDataPath !== "function") {
            return null;
        }
        return {
            mode: "path",
            getDataPath: treeData.getDataPath,
            expandedByDefault,
            orphanPolicy,
            cyclePolicy,
            filterMode,
            dependencyFields,
        };
    }
    if (treeData.mode === "parent") {
        if (typeof treeData.getDataPath !== "undefined") {
            return null;
        }
        if (typeof treeData.getParentId !== "function") {
            return null;
        }
        const rootParentId = treeData.rootParentId === null ||
            typeof treeData.rootParentId === "undefined"
            ? null
            : assertDataGridRowId(treeData.rootParentId, "Invalid treeData.rootParentId");
        return {
            mode: "parent",
            getParentId: treeData.getParentId,
            rootParentId,
            expandedByDefault,
            orphanPolicy,
            cyclePolicy,
            filterMode,
            dependencyFields,
        };
    }
    return null;
}
export function cloneTreeDataSpec(treeData) {
    const normalized = normalizeTreeDataSpec(treeData);
    if (!normalized) {
        return null;
    }
    if (normalized.mode === "path") {
        return {
            mode: "path",
            getDataPath: normalized.getDataPath,
            expandedByDefault: normalized.expandedByDefault,
            orphanPolicy: normalized.orphanPolicy,
            cyclePolicy: normalized.cyclePolicy,
            filterMode: normalized.filterMode,
            dependencyFields: [...normalized.dependencyFields],
        };
    }
    return {
        mode: "parent",
        getParentId: normalized.getParentId,
        rootParentId: normalized.rootParentId,
        expandedByDefault: normalized.expandedByDefault,
        orphanPolicy: normalized.orphanPolicy,
        cyclePolicy: normalized.cyclePolicy,
        filterMode: normalized.filterMode,
        dependencyFields: [...normalized.dependencyFields],
    };
}
export function isSameTreeDataSpec(left, right) {
    const normalizedLeft = normalizeTreeDataSpec(left);
    const normalizedRight = normalizeTreeDataSpec(right);
    if (!normalizedLeft && !normalizedRight) {
        return true;
    }
    if (!normalizedLeft || !normalizedRight) {
        return false;
    }
    if (normalizedLeft.mode !== normalizedRight.mode) {
        return false;
    }
    if (normalizedLeft.expandedByDefault !== normalizedRight.expandedByDefault) {
        return false;
    }
    if (normalizedLeft.orphanPolicy !== normalizedRight.orphanPolicy) {
        return false;
    }
    if (normalizedLeft.cyclePolicy !== normalizedRight.cyclePolicy) {
        return false;
    }
    if (normalizedLeft.filterMode !== normalizedRight.filterMode) {
        return false;
    }
    if (normalizedLeft.dependencyFields.length !== normalizedRight.dependencyFields.length) {
        return false;
    }
    for (let index = 0; index < normalizedLeft.dependencyFields.length; index += 1) {
        if (normalizedLeft.dependencyFields[index] !== normalizedRight.dependencyFields[index]) {
            return false;
        }
    }
    if (normalizedLeft.mode === "path" && normalizedRight.mode === "path") {
        return normalizedLeft.getDataPath === normalizedRight.getDataPath;
    }
    if (normalizedLeft.mode === "parent" && normalizedRight.mode === "parent") {
        return (normalizedLeft.getParentId === normalizedRight.getParentId &&
            normalizedLeft.rootParentId === normalizedRight.rootParentId);
    }
    return false;
}
export function normalizeGroupBySpec(groupBy) {
    if (!groupBy) {
        return null;
    }
    const normalizedFields = Array.isArray(groupBy.fields) ? (() => {
        const unique = new Set();
        for (const fieldValue of groupBy.fields) {
            if (typeof fieldValue !== "string") {
                continue;
            }
            const field = fieldValue.trim();
            if (field.length === 0 || unique.has(field)) {
                continue;
            }
            unique.add(field);
        }
        return Array.from(unique);
    })() : [];
    if (normalizedFields.length === 0) {
        return null;
    }
    return {
        fields: normalizedFields,
        expandedByDefault: Boolean(groupBy.expandedByDefault),
    };
}
export function cloneGroupBySpec(groupBy) {
    if (!groupBy) {
        return null;
    }
    return {
        fields: [...groupBy.fields],
        expandedByDefault: Boolean(groupBy.expandedByDefault),
    };
}
function normalizeGroupKey(groupKey) {
    if (typeof groupKey !== "string") {
        return null;
    }
    const normalized = groupKey.trim();
    return normalized.length > 0 ? normalized : null;
}
export function buildGroupExpansionSnapshot(groupBy, toggledGroupKeys) {
    const normalizedGroupBy = normalizeGroupBySpec(groupBy);
    const expandedByDefault = Boolean(normalizedGroupBy?.expandedByDefault);
    const keysSource = toggledGroupKeys instanceof Set ? Array.from(toggledGroupKeys) : [...toggledGroupKeys];
    const unique = new Set();
    for (const rawKey of keysSource) {
        const key = normalizeGroupKey(rawKey);
        if (key) {
            unique.add(key);
        }
    }
    return {
        expandedByDefault,
        toggledGroupKeys: Array.from(unique),
    };
}
export function isSameGroupExpansionSnapshot(left, right) {
    const normalizedLeft = left ?? { expandedByDefault: false, toggledGroupKeys: [] };
    const normalizedRight = right ?? { expandedByDefault: false, toggledGroupKeys: [] };
    if (normalizedLeft.expandedByDefault !== normalizedRight.expandedByDefault) {
        return false;
    }
    if (normalizedLeft.toggledGroupKeys.length !== normalizedRight.toggledGroupKeys.length) {
        return false;
    }
    for (let index = 0; index < normalizedLeft.toggledGroupKeys.length; index += 1) {
        if (normalizedLeft.toggledGroupKeys[index] !== normalizedRight.toggledGroupKeys[index]) {
            return false;
        }
    }
    return true;
}
export function isGroupExpanded(expansion, groupKey, precomputedToggledGroupKeys) {
    const key = normalizeGroupKey(groupKey);
    if (!key) {
        return false;
    }
    const normalized = expansion ?? { expandedByDefault: false, toggledGroupKeys: [] };
    const toggled = precomputedToggledGroupKeys ?? new Set(normalized.toggledGroupKeys);
    return normalized.expandedByDefault ? !toggled.has(key) : toggled.has(key);
}
export function toggleGroupExpansionKey(toggledGroupKeys, groupKey) {
    const key = normalizeGroupKey(groupKey);
    if (!key) {
        return false;
    }
    if (toggledGroupKeys.has(key)) {
        toggledGroupKeys.delete(key);
    }
    else {
        toggledGroupKeys.add(key);
    }
    return true;
}
export function setGroupExpansionKey(toggledGroupKeys, groupKey, expandedByDefault, expanded) {
    const key = normalizeGroupKey(groupKey);
    if (!key) {
        return false;
    }
    const currentlyExpanded = expandedByDefault ? !toggledGroupKeys.has(key) : toggledGroupKeys.has(key);
    if (currentlyExpanded === expanded) {
        return false;
    }
    if (expandedByDefault) {
        if (expanded) {
            toggledGroupKeys.delete(key);
        }
        else {
            toggledGroupKeys.add(key);
        }
        return true;
    }
    if (expanded) {
        toggledGroupKeys.add(key);
    }
    else {
        toggledGroupKeys.delete(key);
    }
    return true;
}
export function isSameGroupBySpec(left, right) {
    const normalizedLeft = normalizeGroupBySpec(left);
    const normalizedRight = normalizeGroupBySpec(right);
    if (!normalizedLeft && !normalizedRight) {
        return true;
    }
    if (!normalizedLeft || !normalizedRight) {
        return false;
    }
    if (normalizedLeft.expandedByDefault !== normalizedRight.expandedByDefault) {
        return false;
    }
    if (normalizedLeft.fields.length !== normalizedRight.fields.length) {
        return false;
    }
    for (let index = 0; index < normalizedLeft.fields.length; index += 1) {
        if (normalizedLeft.fields[index] !== normalizedRight.fields[index]) {
            return false;
        }
    }
    return true;
}
export function normalizeViewportRange(range, rowCount) {
    const safeCount = Number.isFinite(rowCount) ? Math.max(0, Math.trunc(rowCount)) : 0;
    const maxIndex = Math.max(0, safeCount - 1);
    const start = Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0;
    const endRaw = Number.isFinite(range.end) ? Math.max(0, Math.trunc(range.end)) : start;
    const end = Math.max(start, endRaw);
    if (safeCount <= 0) {
        return { start: 0, end: 0 };
    }
    return {
        start: Math.min(start, maxIndex),
        end: Math.min(end, maxIndex),
    };
}
function normalizePaginationPageSize(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const normalized = Math.max(0, Math.trunc(value));
    return normalized;
}
function normalizePaginationPage(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.trunc(value));
}
export function normalizePaginationInput(input) {
    return {
        pageSize: normalizePaginationPageSize(input?.pageSize),
        currentPage: normalizePaginationPage(input?.currentPage),
    };
}
export function buildPaginationSnapshot(totalRowCount, input) {
    const normalizedTotal = Number.isFinite(totalRowCount) ? Math.max(0, Math.trunc(totalRowCount)) : 0;
    const normalizedInput = normalizePaginationInput(input);
    const enabled = normalizedInput.pageSize > 0;
    if (!enabled) {
        return {
            enabled: false,
            pageSize: 0,
            currentPage: 0,
            pageCount: normalizedTotal > 0 ? 1 : 0,
            totalRowCount: normalizedTotal,
            startIndex: normalizedTotal > 0 ? 0 : -1,
            endIndex: normalizedTotal > 0 ? normalizedTotal - 1 : -1,
        };
    }
    const pageCount = Math.ceil(normalizedTotal / normalizedInput.pageSize);
    const maxPage = Math.max(0, pageCount - 1);
    const currentPage = Math.min(normalizedInput.currentPage, maxPage);
    const startIndex = normalizedTotal > 0
        ? currentPage * normalizedInput.pageSize
        : -1;
    const endIndex = normalizedTotal > 0
        ? Math.min(normalizedTotal - 1, startIndex + normalizedInput.pageSize - 1)
        : -1;
    return {
        enabled: true,
        pageSize: normalizedInput.pageSize,
        currentPage,
        pageCount,
        totalRowCount: normalizedTotal,
        startIndex,
        endIndex,
    };
}
function isDataGridRowId(value) {
    return typeof value === "string" || typeof value === "number";
}
function assertDataGridRowId(value, context) {
    if (!isDataGridRowId(value)) {
        throw new Error(`[DataGrid] ${context}. Expected row id to be string|number.`);
    }
    return value;
}
function normalizePinnedState(state) {
    if (state?.pinned === "top") {
        return "top";
    }
    if (state?.pinned === "bottom") {
        return "bottom";
    }
    return "none";
}
function resolveRowKind(node) {
    const kind = node.kind;
    if (kind === "group") {
        return "group";
    }
    if (kind === "leaf") {
        return "leaf";
    }
    const state = node.state;
    return state?.group ? "group" : "leaf";
}
function normalizeGroupMeta(value, fallbackRowKey) {
    const normalizedKey = String(value?.groupKey ?? fallbackRowKey);
    const normalizedField = typeof value?.groupField === "string" ? value.groupField : "";
    const normalizedValue = typeof value?.groupValue === "string" ? value.groupValue : normalizedKey;
    const level = Number.isFinite(value?.level) ? Math.max(0, Math.trunc(value?.level)) : 0;
    const childrenCount = Number.isFinite(value?.childrenCount)
        ? Math.max(0, Math.trunc(value?.childrenCount))
        : 0;
    const aggregates = (value?.aggregates && typeof value.aggregates === "object" && !Array.isArray(value.aggregates))
        ? ({ ...value.aggregates })
        : undefined;
    return {
        groupKey: normalizedKey,
        groupField: normalizedField,
        groupValue: normalizedValue,
        level,
        childrenCount,
        ...(aggregates ? { aggregates } : {}),
    };
}
function resolveRowState(node, rowKind) {
    const state = node.state;
    return {
        selected: Boolean(state?.selected),
        group: rowKind === "group" || Boolean(state?.group),
        pinned: normalizePinnedState(state),
        expanded: Boolean(state?.expanded),
    };
}
function resolveSourceIndex(node, fallbackIndex) {
    const rowNode = node;
    if (Number.isFinite(rowNode.sourceIndex)) {
        return Math.max(0, Math.trunc(rowNode.sourceIndex));
    }
    if (Number.isFinite(rowNode.originalIndex)) {
        return Math.max(0, Math.trunc(rowNode.originalIndex));
    }
    return Math.max(0, Math.trunc(fallbackIndex));
}
function resolveDisplayIndex(node, fallbackIndex) {
    const rowNode = node;
    if (Number.isFinite(rowNode.displayIndex)) {
        return Math.max(0, Math.trunc(rowNode.displayIndex));
    }
    return Math.max(0, Math.trunc(fallbackIndex));
}
function resolveRowData(node) {
    const rowNode = node;
    if (typeof rowNode.data !== "undefined") {
        return rowNode.data;
    }
    if (typeof node.row !== "undefined") {
        return node.row;
    }
    return node;
}
function resolveRowKey(node) {
    const rowNode = node;
    if (typeof rowNode.rowKey !== "undefined") {
        return assertDataGridRowId(rowNode.rowKey, "Invalid rowKey");
    }
    if (typeof rowNode.rowId !== "undefined") {
        return assertDataGridRowId(rowNode.rowId, "Invalid rowId");
    }
    throw new Error("[DataGrid] Missing row identity. Provide rowKey/rowId or configure a row id resolver in the row model.");
}
export function withResolvedRowIdentity(node, index, resolveRowId) {
    if (typeof node.rowKey !== "undefined") {
        return node;
    }
    if (typeof node.rowId !== "undefined") {
        return node;
    }
    if (typeof resolveRowId !== "function") {
        return node;
    }
    const rowData = resolveRowData(node);
    const rowId = assertDataGridRowId(resolveRowId(rowData, index), "Invalid row id returned by resolver");
    if (typeof node === "object" && node !== null) {
        return { ...node, rowId };
    }
    return { row: rowData, rowId };
}
export function normalizeRowNode(node, fallbackIndex) {
    const data = resolveRowData(node);
    const sourceIndex = resolveSourceIndex(node, fallbackIndex);
    const displayIndex = resolveDisplayIndex(node, sourceIndex);
    const rowKind = resolveRowKind(node);
    const state = resolveRowState(node, rowKind);
    const rowKey = resolveRowKey(node);
    const groupMeta = rowKind === "group"
        ? normalizeGroupMeta(node.groupMeta, rowKey)
        : undefined;
    return {
        kind: rowKind,
        data,
        row: data,
        rowKey,
        rowId: rowKey,
        originalIndex: sourceIndex,
        sourceIndex,
        displayIndex,
        state,
        groupMeta,
    };
}
export function isDataGridGroupRowNode(node) {
    return node.kind === "group";
}
export function isDataGridLeafRowNode(node) {
    return node.kind === "leaf";
}
export function getDataGridRowRenderMeta(node) {
    if (node.kind !== "group") {
        return {
            level: 0,
            isGroup: false,
        };
    }
    const level = Number.isFinite(node.groupMeta?.level)
        ? Math.max(0, Math.trunc(node.groupMeta?.level))
        : 0;
    const childrenCount = Number.isFinite(node.groupMeta?.childrenCount)
        ? Math.max(0, Math.trunc(node.groupMeta?.childrenCount))
        : 0;
    return {
        level,
        isGroup: true,
        isExpanded: Boolean(node.state.expanded),
        hasChildren: childrenCount > 0,
    };
}
