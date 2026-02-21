import { DATAGRID_CLIENT_PATCH_STAGE_IDS, } from "./projectionStages.js";
import { buildDataGridAdvancedFilterExpressionFromLegacyFilters, normalizeDataGridAdvancedFilterExpression, } from "./advancedFilter.js";
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
export function resolveAdvancedExpression(filterModel) {
    if (!filterModel) {
        return null;
    }
    const explicit = normalizeDataGridAdvancedFilterExpression(filterModel.advancedExpression ?? null);
    if (explicit) {
        return explicit;
    }
    return buildDataGridAdvancedFilterExpressionFromLegacyFilters(filterModel.advancedFilters);
}
function collectAdvancedExpressionFields(expression, fields) {
    if (!expression) {
        return;
    }
    if (expression.kind === "condition") {
        const key = (expression.field ?? expression.key ?? "").trim();
        if (key.length > 0) {
            fields.add(key);
        }
        return;
    }
    if (expression.kind === "not") {
        collectAdvancedExpressionFields(expression.child, fields);
        return;
    }
    for (const child of expression.children) {
        collectAdvancedExpressionFields(child, fields);
    }
}
export function collectFilterModelFields(filterModel) {
    const fields = new Set();
    if (!filterModel) {
        return fields;
    }
    for (const [key, values] of Object.entries(filterModel.columnFilters ?? {})) {
        if (!Array.isArray(values) || values.length === 0) {
            continue;
        }
        const normalized = key.trim();
        if (normalized.length > 0) {
            fields.add(normalized);
        }
    }
    const expression = resolveAdvancedExpression(filterModel);
    collectAdvancedExpressionFields(expression, fields);
    return fields;
}
export function collectSortModelFields(sortModel) {
    const fields = new Set();
    for (const descriptor of sortModel) {
        const normalized = (descriptor.field ?? descriptor.key ?? "").trim();
        if (normalized.length > 0) {
            fields.add(normalized);
        }
        for (const dependencyField of descriptor.dependencyFields ?? []) {
            const dependency = dependencyField.trim();
            if (dependency.length > 0) {
                fields.add(dependency);
            }
        }
    }
    return fields;
}
export function collectGroupByFields(groupBy) {
    const fields = new Set();
    for (const field of groupBy?.fields ?? []) {
        const normalized = field.trim();
        if (normalized.length > 0) {
            fields.add(normalized);
        }
    }
    return fields;
}
export function collectAggregationModelFields(aggregationModel) {
    const fields = new Set();
    if (!aggregationModel) {
        return fields;
    }
    for (const column of aggregationModel.columns ?? []) {
        const directField = (column.field ?? "").trim();
        if (directField.length > 0) {
            fields.add(directField);
            continue;
        }
        const keyField = (column.key ?? "").trim();
        if (keyField.length > 0) {
            fields.add(keyField);
        }
    }
    return fields;
}
export function collectTreeDataDependencyFields(treeData) {
    const fields = new Set();
    for (const field of treeData?.dependencyFields ?? []) {
        const normalized = field.trim();
        if (normalized.length > 0) {
            fields.add(normalized);
        }
    }
    return fields;
}
export function collectChangedFieldsFromPatches(updatesById) {
    const fields = new Set();
    for (const patch of updatesById.values()) {
        if (!isRecord(patch)) {
            continue;
        }
        for (const key of Object.keys(patch)) {
            const normalized = key.trim();
            if (normalized.length > 0) {
                fields.add(normalized);
            }
        }
    }
    return fields;
}
export function doFieldPathsIntersect(changedFields, dependencyFields) {
    if (changedFields.size === 0 || dependencyFields.size === 0) {
        return false;
    }
    for (const changed of changedFields) {
        for (const dependency of dependencyFields) {
            if (changed === dependency ||
                changed.startsWith(`${dependency}.`) ||
                dependency.startsWith(`${changed}.`)) {
                return true;
            }
        }
    }
    return false;
}
export function analyzeRowPatchChangeSet(input) {
    const changedFields = collectChangedFieldsFromPatches(input.updatesById);
    const affectedFields = input.dependencyGraph.getAffectedFields(changedFields);
    const changedRowIds = Array.from(input.updatesById.keys());
    const affectsFilter = input.filterActive && (input.filterFields.size === 0
        ? true
        : input.dependencyGraph.affectsAny(affectedFields, input.filterFields));
    const affectsSort = input.sortActive && (input.sortFields.size === 0
        ? true
        : input.dependencyGraph.affectsAny(affectedFields, input.sortFields));
    const affectsGroup = input.groupActive && (input.hasTreeData
        ? (input.treeDataDependencyFields.size === 0
            ? true
            : input.dependencyGraph.affectsAny(affectedFields, input.treeDataDependencyFields))
        : (input.groupFields.size === 0
            ? true
            : input.dependencyGraph.affectsAny(affectedFields, input.groupFields)));
    const affectsAggregation = input.aggregationActive && (input.aggregationFields.size === 0
        ? true
        : input.dependencyGraph.affectsAny(affectedFields, input.aggregationFields));
    const clearSortValueCache = input.sortActive && affectsSort && input.sortFields.size === 0;
    const evictSortValueRowIds = input.sortActive && affectsSort && input.sortFields.size > 0
        ? changedRowIds
        : [];
    const invalidateTreeProjectionCaches = input.hasTreeData && (affectsGroup || affectsFilter || affectsSort);
    const patchTreeProjectionCacheRowsByIdentity = input.hasTreeData && !invalidateTreeProjectionCaches;
    return {
        changedFields,
        affectedFields,
        changedRowIds,
        stageImpact: {
            filterActive: input.filterActive,
            sortActive: input.sortActive,
            groupActive: input.groupActive,
            aggregationActive: input.aggregationActive,
            affectsFilter,
            affectsSort,
            affectsGroup,
            affectsAggregation,
        },
        cacheEvictionPlan: {
            clearSortValueCache,
            evictSortValueRowIds,
            invalidateTreeProjectionCaches,
            patchTreeProjectionCacheRowsByIdentity,
        },
    };
}
const DATAGRID_PATCH_STAGE_RULE_MAP = {
    filter: {
        invalidate: (changeSet) => changeSet.stageImpact.affectsFilter,
        allowRecompute: (policy) => policy.filter,
    },
    sort: {
        invalidate: (changeSet) => changeSet.stageImpact.affectsSort,
        allowRecompute: (policy) => policy.sort,
    },
    group: {
        invalidate: (changeSet) => changeSet.stageImpact.affectsGroup,
        allowRecompute: (policy) => policy.group,
    },
    aggregate: {
        invalidate: (changeSet) => changeSet.stageImpact.affectsAggregation,
        allowRecompute: (policy) => policy.group,
    },
};
export function createDefaultPatchStageRules() {
    return DATAGRID_CLIENT_PATCH_STAGE_IDS.map((stageId) => {
        const rule = DATAGRID_PATCH_STAGE_RULE_MAP[stageId];
        return {
            id: stageId,
            invalidate: rule.invalidate,
            allowRecompute: rule.allowRecompute,
        };
    });
}
export const DATAGRID_DEFAULT_PATCH_STAGE_RULES = createDefaultPatchStageRules();
export function buildPatchProjectionExecutionPlan(input) {
    const stageRules = input.stageRules ?? DATAGRID_DEFAULT_PATCH_STAGE_RULES;
    const requestedStages = [];
    for (const stageRule of stageRules) {
        if (stageRule.invalidate(input.changeSet)) {
            requestedStages.push(stageRule.id);
        }
    }
    const recomputeRoots = [];
    for (const stageRule of stageRules) {
        const affected = stageRule.invalidate(input.changeSet);
        const allowRecompute = stageRule.allowRecompute(input.recomputePolicy);
        if (affected && allowRecompute) {
            recomputeRoots.push(stageRule.id);
            continue;
        }
        if (!affected && allowRecompute && input.staleStages.has(stageRule.id)) {
            recomputeRoots.push(stageRule.id);
        }
    }
    const recomputeAllowed = new Set(input.expandStages(recomputeRoots));
    for (const stageRule of stageRules) {
        const affected = stageRule.invalidate(input.changeSet);
        const allowRecompute = stageRule.allowRecompute(input.recomputePolicy);
        if (affected && !allowRecompute) {
            recomputeAllowed.delete(stageRule.id);
        }
    }
    const blockedStages = [];
    for (const stage of input.allStages) {
        if (!recomputeAllowed.has(stage)) {
            blockedStages.push(stage);
        }
    }
    return {
        requestedStages,
        blockedStages,
    };
}
