import type {
  DataGridAdvancedFilterExpression,
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridRowId,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
} from "./rowModel.js"
import type { DataGridDependencyGraph } from "./dependencyGraph.js"
import {
  DATAGRID_CLIENT_PATCH_STAGE_IDS,
  type DataGridClientPatchStage,
  type DataGridClientProjectionStage,
} from "./projectionStages.js"
import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  normalizeDataGridAdvancedFilterExpression,
} from "./advancedFilter.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function resolveAdvancedExpression(
  filterModel: DataGridFilterSnapshot | null,
): DataGridAdvancedFilterExpression | null {
  if (!filterModel) {
    return null
  }
  const explicit = normalizeDataGridAdvancedFilterExpression(filterModel.advancedExpression ?? null)
  if (explicit) {
    return explicit
  }
  return buildDataGridAdvancedFilterExpressionFromLegacyFilters(filterModel.advancedFilters)
}

function collectAdvancedExpressionFields(
  expression: DataGridAdvancedFilterExpression | null,
  fields: Set<string>,
): void {
  if (!expression) {
    return
  }
  if (expression.kind === "condition") {
    const key = (expression.field ?? expression.key ?? "").trim()
    if (key.length > 0) {
      fields.add(key)
    }
    return
  }
  if (expression.kind === "not") {
    collectAdvancedExpressionFields(expression.child, fields)
    return
  }
  for (const child of expression.children) {
    collectAdvancedExpressionFields(child, fields)
  }
}

export function collectFilterModelFields(filterModel: DataGridFilterSnapshot | null): Set<string> {
  const fields = new Set<string>()
  if (!filterModel) {
    return fields
  }
  for (const [key, values] of Object.entries(filterModel.columnFilters ?? {})) {
    const hasValueSet = Array.isArray(values)
      ? values.length > 0
      : values.kind === "valueSet"
        ? values.tokens.length > 0
        : true
    if (!hasValueSet) {
      continue
    }
    const normalized = key.trim()
    if (normalized.length > 0) {
      fields.add(normalized)
    }
  }
  const expression = resolveAdvancedExpression(filterModel)
  collectAdvancedExpressionFields(expression, fields)
  return fields
}

export function collectSortModelFields(sortModel: readonly DataGridSortState[]): Set<string> {
  const fields = new Set<string>()
  for (const descriptor of sortModel) {
    const normalized = (descriptor.field ?? descriptor.key ?? "").trim()
    if (normalized.length > 0) {
      fields.add(normalized)
    }
    for (const dependencyField of descriptor.dependencyFields ?? []) {
      const dependency = dependencyField.trim()
      if (dependency.length > 0) {
        fields.add(dependency)
      }
    }
  }
  return fields
}

export function collectGroupByFields(groupBy: DataGridGroupBySpec | null): Set<string> {
  const fields = new Set<string>()
  for (const field of groupBy?.fields ?? []) {
    const normalized = field.trim()
    if (normalized.length > 0) {
      fields.add(normalized)
    }
  }
  return fields
}

export function collectAggregationModelFields<T>(
  aggregationModel: DataGridAggregationModel<T> | null,
): Set<string> {
  const fields = new Set<string>()
  if (!aggregationModel) {
    return fields
  }
  for (const column of aggregationModel.columns ?? []) {
    const directField = (column.field ?? "").trim()
    if (directField.length > 0) {
      fields.add(directField)
      continue
    }
    const keyField = (column.key ?? "").trim()
    if (keyField.length > 0) {
      fields.add(keyField)
    }
  }
  return fields
}

export function collectTreeDataDependencyFields<T>(
  treeData: DataGridTreeDataResolvedSpec<T> | null,
): Set<string> {
  const fields = new Set<string>()
  for (const field of treeData?.dependencyFields ?? []) {
    const normalized = field.trim()
    if (normalized.length > 0) {
      fields.add(normalized)
    }
  }
  return fields
}

export function collectChangedFieldsFromPatches<T>(
  updatesById: ReadonlyMap<DataGridRowId, Partial<T>>,
): Set<string> {
  const fields = new Set<string>()
  for (const patch of updatesById.values()) {
    if (!isRecord(patch)) {
      continue
    }
    for (const key of Object.keys(patch)) {
      const normalized = key.trim()
      if (normalized.length > 0) {
        fields.add(normalized)
      }
    }
  }
  return fields
}

export function doFieldPathsIntersect(
  changedFields: ReadonlySet<string>,
  dependencyFields: ReadonlySet<string>,
): boolean {
  if (changedFields.size === 0 || dependencyFields.size === 0) {
    return false
  }
  for (const changed of changedFields) {
    for (const dependency of dependencyFields) {
      if (
        changed === dependency ||
        changed.startsWith(`${dependency}.`) ||
        dependency.startsWith(`${changed}.`)
      ) {
        return true
      }
    }
  }
  return false
}

export interface DataGridPatchStageImpact {
  filterActive: boolean
  sortActive: boolean
  groupActive: boolean
  aggregationActive: boolean
  affectsFilter: boolean
  affectsSort: boolean
  affectsGroup: boolean
  affectsAggregation: boolean
}

export interface DataGridPatchCacheEvictionPlan {
  clearSortValueCache: boolean
  evictSortValueRowIds: readonly DataGridRowId[]
  invalidateTreeProjectionCaches: boolean
  patchTreeProjectionCacheRowsByIdentity: boolean
}

export interface DataGridPatchChangeSet {
  changedFields: ReadonlySet<string>
  affectedFields: ReadonlySet<string>
  changedRowIds: readonly DataGridRowId[]
  stageImpact: DataGridPatchStageImpact
  cacheEvictionPlan: DataGridPatchCacheEvictionPlan
}

export interface AnalyzeRowPatchChangeSetInput<T> {
  updatesById: ReadonlyMap<DataGridRowId, Partial<T>>
  dependencyGraph: Pick<DataGridDependencyGraph, "getAffectedFields" | "affectsAny">
  filterActive: boolean
  sortActive: boolean
  groupActive: boolean
  aggregationActive: boolean
  filterFields: ReadonlySet<string>
  sortFields: ReadonlySet<string>
  groupFields: ReadonlySet<string>
  aggregationFields: ReadonlySet<string>
  treeDataDependencyFields: ReadonlySet<string>
  hasTreeData: boolean
}

export function analyzeRowPatchChangeSet<T>(
  input: AnalyzeRowPatchChangeSetInput<T>,
): DataGridPatchChangeSet {
  const changedFields = collectChangedFieldsFromPatches(input.updatesById)
  const affectedFields = input.dependencyGraph.getAffectedFields(changedFields)
  const changedRowIds = Array.from(input.updatesById.keys())

  const affectsFilter = input.filterActive && (
    input.filterFields.size === 0
      ? true
      : input.dependencyGraph.affectsAny(affectedFields, input.filterFields)
  )
  const affectsSort = input.sortActive && (
    input.sortFields.size === 0
      ? true
      : input.dependencyGraph.affectsAny(affectedFields, input.sortFields)
  )
  const affectsGroup = input.groupActive && (
    input.hasTreeData
      ? (
          input.treeDataDependencyFields.size === 0
            ? true
            : input.dependencyGraph.affectsAny(affectedFields, input.treeDataDependencyFields)
        )
      : (
          input.groupFields.size === 0
            ? true
            : input.dependencyGraph.affectsAny(affectedFields, input.groupFields)
      )
  )
  const affectsAggregation = input.aggregationActive && (
    input.aggregationFields.size === 0
      ? true
      : input.dependencyGraph.affectsAny(affectedFields, input.aggregationFields)
  )

  const clearSortValueCache = input.sortActive && affectsSort && input.sortFields.size === 0
  const evictSortValueRowIds = input.sortActive && affectsSort && input.sortFields.size > 0
    ? changedRowIds
    : []
  const invalidateTreeProjectionCaches = input.hasTreeData && (affectsGroup || affectsFilter || affectsSort)
  const patchTreeProjectionCacheRowsByIdentity = input.hasTreeData && !invalidateTreeProjectionCaches

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
  }
}

export interface BuildPatchProjectionExecutionPlanInput {
  changeSet: DataGridPatchChangeSet
  recomputePolicy: DataGridPatchRecomputePolicy
  staleStages: ReadonlySet<DataGridClientProjectionStage>
  allStages: readonly DataGridClientProjectionStage[]
  expandStages: (stages: readonly DataGridClientProjectionStage[]) => ReadonlySet<DataGridClientProjectionStage>
  stageRules?: readonly DataGridPatchStageRule[]
}

export interface DataGridPatchProjectionExecutionPlan {
  requestedStages: readonly DataGridClientProjectionStage[]
  blockedStages: readonly DataGridClientProjectionStage[]
}

export interface DataGridPatchRecomputePolicy {
  filter: boolean
  sort: boolean
  group: boolean
}

export interface DataGridPatchStageRule {
  id: DataGridClientProjectionStage
  invalidate: (changeSet: DataGridPatchChangeSet) => boolean
  allowRecompute: (policy: DataGridPatchRecomputePolicy) => boolean
}

type DataGridPatchStageRuleMap = Readonly<Record<
  DataGridClientPatchStage,
  Pick<DataGridPatchStageRule, "invalidate" | "allowRecompute">
>>

const DATAGRID_PATCH_STAGE_RULE_MAP: DataGridPatchStageRuleMap = {
  filter: {
    invalidate: (changeSet: DataGridPatchChangeSet) => changeSet.stageImpact.affectsFilter,
    allowRecompute: (policy: DataGridPatchRecomputePolicy) => policy.filter,
  },
  sort: {
    invalidate: (changeSet: DataGridPatchChangeSet) => changeSet.stageImpact.affectsSort,
    allowRecompute: (policy: DataGridPatchRecomputePolicy) => policy.sort,
  },
  group: {
    invalidate: (changeSet: DataGridPatchChangeSet) => changeSet.stageImpact.affectsGroup,
    allowRecompute: (policy: DataGridPatchRecomputePolicy) => policy.group,
  },
  aggregate: {
    invalidate: (changeSet: DataGridPatchChangeSet) => changeSet.stageImpact.affectsAggregation,
    allowRecompute: (policy: DataGridPatchRecomputePolicy) => policy.group,
  },
}

export function createDefaultPatchStageRules(): readonly DataGridPatchStageRule[] {
  return DATAGRID_CLIENT_PATCH_STAGE_IDS.map((stageId) => {
    const rule = DATAGRID_PATCH_STAGE_RULE_MAP[stageId]
    return {
      id: stageId,
      invalidate: rule.invalidate,
      allowRecompute: rule.allowRecompute,
    }
  })
}

export const DATAGRID_DEFAULT_PATCH_STAGE_RULES: readonly DataGridPatchStageRule[] = createDefaultPatchStageRules()

export function buildPatchProjectionExecutionPlan(
  input: BuildPatchProjectionExecutionPlanInput,
): DataGridPatchProjectionExecutionPlan {
  const stageRules = input.stageRules ?? DATAGRID_DEFAULT_PATCH_STAGE_RULES
  const requestedStages: DataGridClientProjectionStage[] = []
  for (const stageRule of stageRules) {
    if (stageRule.invalidate(input.changeSet)) {
      requestedStages.push(stageRule.id)
    }
  }

  const recomputeRoots: DataGridClientProjectionStage[] = []
  for (const stageRule of stageRules) {
    const affected = stageRule.invalidate(input.changeSet)
    const allowRecompute = stageRule.allowRecompute(input.recomputePolicy)
    if (affected && allowRecompute) {
      recomputeRoots.push(stageRule.id)
      continue
    }
    if (!affected && allowRecompute && input.staleStages.has(stageRule.id)) {
      recomputeRoots.push(stageRule.id)
    }
  }

  const recomputeAllowed = new Set<DataGridClientProjectionStage>(input.expandStages(recomputeRoots))
  for (const stageRule of stageRules) {
    const affected = stageRule.invalidate(input.changeSet)
    const allowRecompute = stageRule.allowRecompute(input.recomputePolicy)
    if (affected && !allowRecompute) {
      recomputeAllowed.delete(stageRule.id)
    }
  }

  const blockedStages: DataGridClientProjectionStage[] = []
  for (const stage of input.allStages) {
    if (!recomputeAllowed.has(stage)) {
      blockedStages.push(stage)
    }
  }

  return {
    requestedStages,
    blockedStages,
  }
}
