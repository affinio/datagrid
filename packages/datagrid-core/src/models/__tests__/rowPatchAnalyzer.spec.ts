import { describe, expect, it } from "vitest"
import { createDataGridDependencyGraph } from "../dependencyGraph"
import {
  analyzeRowPatchChangeSet,
  buildPatchProjectionExecutionPlan,
  collectAggregationModelFields,
  type DataGridPatchStageRule,
} from "../rowPatchAnalyzer"

describe("rowPatchAnalyzer change-set", () => {
  it("collects aggregation dependency fields from field/key descriptors", () => {
    const fields = collectAggregationModelFields({
      basis: "filtered",
      columns: [
        { key: "score", op: "sum" },
        { key: "label", field: "meta.label", op: "count" },
      ],
    })

    expect(Array.from(fields.values())).toEqual(["score", "meta.label"])
  })

  it("derives sort impact and row-scoped sort cache eviction for specific sort fields", () => {
    const dependencyGraph = createDataGridDependencyGraph()
    const updatesById = new Map([
      ["r1", { tested_at: 200 }],
      ["r2", { tested_at: 100 }],
    ])

    const changeSet = analyzeRowPatchChangeSet({
      updatesById,
      dependencyGraph,
      filterActive: false,
      sortActive: true,
      groupActive: false,
      aggregationActive: true,
      filterFields: new Set<string>(),
      sortFields: new Set<string>(["tested_at"]),
      groupFields: new Set<string>(),
      aggregationFields: new Set<string>(["tested_at"]),
      treeDataDependencyFields: new Set<string>(),
      hasTreeData: false,
    })

    expect(changeSet.stageImpact.affectsSort).toBe(true)
    expect(changeSet.stageImpact.affectsAggregation).toBe(true)
    expect(changeSet.cacheEvictionPlan.clearSortValueCache).toBe(false)
    expect(changeSet.cacheEvictionPlan.evictSortValueRowIds).toEqual(["r1", "r2"])
    expect(changeSet.cacheEvictionPlan.invalidateTreeProjectionCaches).toBe(false)
  })

  it("patches tree projection cache by identity when tree dependencies are untouched", () => {
    const dependencyGraph = createDataGridDependencyGraph()
    const updatesById = new Map([
      ["r2", { label: "updated" }],
    ])

    const changeSet = analyzeRowPatchChangeSet({
      updatesById,
      dependencyGraph,
      filterActive: false,
      sortActive: false,
      groupActive: true,
      aggregationActive: false,
      filterFields: new Set<string>(),
      sortFields: new Set<string>(),
      groupFields: new Set<string>(),
      aggregationFields: new Set<string>(),
      treeDataDependencyFields: new Set<string>(["parentId"]),
      hasTreeData: true,
    })

    expect(changeSet.stageImpact.affectsGroup).toBe(false)
    expect(changeSet.cacheEvictionPlan.invalidateTreeProjectionCaches).toBe(false)
    expect(changeSet.cacheEvictionPlan.patchTreeProjectionCacheRowsByIdentity).toBe(true)
  })
})

describe("rowPatchAnalyzer projection plan", () => {
  type Stage = "filter" | "sort" | "group" | "aggregate" | "paginate" | "visible"
  const stageDependents: Readonly<Record<Stage, readonly Stage[]>> = {
    filter: ["sort", "group", "aggregate", "paginate", "visible"],
    sort: ["group", "aggregate", "paginate", "visible"],
    group: ["aggregate", "paginate", "visible"],
    aggregate: ["paginate", "visible"],
    paginate: ["visible"],
    visible: [],
  }
  const expandStages = (stages: readonly Stage[]) => {
    const expanded = new Set<Stage>()
    const walk = (stage: Stage) => {
      if (expanded.has(stage)) {
        return
      }
      expanded.add(stage)
      for (const dependent of stageDependents[stage]) {
        walk(dependent)
      }
    }
    for (const stage of stages) {
      walk(stage)
    }
    return expanded
  }

  it("requests affected stages and blocks all when recompute is disabled", () => {
    const plan = buildPatchProjectionExecutionPlan({
      changeSet: {
        changedFields: new Set<string>(["tested_at"]),
        affectedFields: new Set<string>(["tested_at"]),
        changedRowIds: ["r1"],
        stageImpact: {
          filterActive: false,
          sortActive: true,
          groupActive: false,
          aggregationActive: true,
          affectsFilter: false,
          affectsSort: true,
          affectsGroup: false,
          affectsAggregation: true,
        },
        cacheEvictionPlan: {
          clearSortValueCache: false,
          evictSortValueRowIds: ["r1"],
          invalidateTreeProjectionCaches: false,
          patchTreeProjectionCacheRowsByIdentity: false,
        },
      },
      recomputePolicy: {
        filter: true,
        sort: false,
        group: true,
      },
      staleStages: new Set(),
      allStages: ["filter", "sort", "group", "aggregate", "paginate", "visible"],
      expandStages,
    })

    expect(plan.requestedStages).toEqual(["sort", "aggregate"])
    expect(plan.blockedStages).toEqual(["filter", "sort", "group"])
  })

  it("unblocks full dependent chain when filter recompute is allowed", () => {
    const plan = buildPatchProjectionExecutionPlan({
      changeSet: {
        changedFields: new Set<string>(["owner"]),
        affectedFields: new Set<string>(["owner"]),
        changedRowIds: ["r1"],
        stageImpact: {
          filterActive: true,
          sortActive: true,
          groupActive: true,
          aggregationActive: true,
          affectsFilter: true,
          affectsSort: false,
          affectsGroup: false,
          affectsAggregation: false,
        },
        cacheEvictionPlan: {
          clearSortValueCache: false,
          evictSortValueRowIds: [],
          invalidateTreeProjectionCaches: false,
          patchTreeProjectionCacheRowsByIdentity: false,
        },
      },
      recomputePolicy: {
        filter: true,
        sort: true,
        group: true,
      },
      staleStages: new Set(),
      allStages: ["filter", "sort", "group", "aggregate", "paginate", "visible"],
      expandStages,
    })

    expect(plan.requestedStages).toEqual(["filter"])
    expect(plan.blockedStages).toEqual([])
  })

  it("supports declarative custom stage rules without changing planner logic", () => {
    const customRules: readonly DataGridPatchStageRule[] = [
      {
        id: "sort",
        invalidate: changeSet => changeSet.changedFields.has("manual"),
        allowRecompute: policy => policy.sort,
      },
      {
        id: "group",
        invalidate: () => false,
        allowRecompute: policy => policy.group,
      },
    ]
    const plan = buildPatchProjectionExecutionPlan({
      changeSet: {
        changedFields: new Set<string>(["manual"]),
        affectedFields: new Set<string>(["manual"]),
        changedRowIds: ["r1"],
        stageImpact: {
          filterActive: false,
          sortActive: true,
          groupActive: true,
          aggregationActive: false,
          affectsFilter: false,
          affectsSort: false,
          affectsGroup: false,
          affectsAggregation: false,
        },
        cacheEvictionPlan: {
          clearSortValueCache: false,
          evictSortValueRowIds: [],
          invalidateTreeProjectionCaches: false,
          patchTreeProjectionCacheRowsByIdentity: false,
        },
      },
      recomputePolicy: {
        filter: true,
        sort: true,
        group: true,
      },
      staleStages: new Set(),
      allStages: ["filter", "sort", "group", "aggregate", "paginate", "visible"],
      expandStages,
      stageRules: customRules,
    })

    expect(plan.requestedStages).toEqual(["sort"])
    expect(plan.blockedStages).toEqual(["filter"])
  })
})
