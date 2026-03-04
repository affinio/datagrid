import type {
  DataGridAggregationModel,
  DataGridGroupBySpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
} from "./rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "./aggregationEngine.js"
import { computeGroupByAggregatesMap, patchGroupRowsAggregatesByGroupKey } from "./clientRowModelHelpers.js"
import { sortPivotProjectionRows } from "./clientRowPivotProjectionUtils.js"
import { sortLeafRows } from "./clientRowProjectionPrimitives.js"
import { patchProjectedRowsByIdentity } from "./clientRowRuntimeUtils.js"
import {
  rebuildGroupByIncrementalAggregationState,
  type GroupByIncrementalAggregationState,
} from "./incrementalAggregationRuntime.js"

export interface AggregateProjectionEngine<T> {
  setModel: (model: DataGridAggregationModel<T> | null) => void
  isIncrementalAggregationSupported: () => boolean
  createLeafContribution: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null
  createEmptyGroupState: () => DataGridIncrementalAggregationGroupState | null
  applyContributionDelta: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void
  finalizeGroupState: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>
  computeAggregatesForLeaves: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown>
}

export interface RunAggregateProjectionStageParams<T> {
  shouldRecompute: boolean
  rowRevision: number
  sortRevision: number
  filterRevision: number
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  previousAggregatedRowsProjection: readonly DataGridRowNode<T>[]
  groupedRowsProjection: readonly DataGridRowNode<T>[]
  pivotedRowsProjection: readonly DataGridRowNode<T>[]
  sortedRowsProjection: readonly DataGridRowNode<T>[]
  sourceRows: readonly DataGridRowNode<T>[]
  sortModel: readonly DataGridSortState[]
  groupBy: DataGridGroupBySpec | null
  pivotModelEnabled: boolean
  treeData: DataGridTreeDataResolvedSpec<T> | null
  aggregationModel: DataGridAggregationModel<T> | null
  aggregationEngine: AggregateProjectionEngine<T>
  groupByIncrementalAggregationState: GroupByIncrementalAggregationState
  resetGroupByIncrementalAggregationState: () => void
  readRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
  normalizeText: (value: unknown) => string
}

export interface RunAggregateProjectionStageResult<T> {
  aggregatedRowsProjection: DataGridRowNode<T>[]
  recomputed: boolean
}

export function runAggregateProjectionStage<T>(
  params: RunAggregateProjectionStageParams<T>,
): RunAggregateProjectionStageResult<T> {
  const shouldRecomputeAggregate = params.shouldRecompute || params.previousAggregatedRowsProjection.length === 0
  if (!shouldRecomputeAggregate) {
    return {
      aggregatedRowsProjection: patchProjectedRowsByIdentity(params.previousAggregatedRowsProjection, params.sourceById),
      recomputed: false,
    }
  }

  const activeGroupBy = params.groupBy
  const activeAggregationModel = params.aggregationModel
  const hasAggregationModel = Boolean(activeAggregationModel && activeAggregationModel.columns.length > 0)

  if (params.pivotModelEnabled) {
    params.resetGroupByIncrementalAggregationState()
    return {
      aggregatedRowsProjection: params.sortModel.length > 0
        ? sortPivotProjectionRows(params.pivotedRowsProjection, params.sortModel, params.readRowField, params.normalizeText)
        : (params.pivotedRowsProjection as DataGridRowNode<T>[]),
      recomputed: true,
    }
  }

  if (params.treeData || !activeGroupBy || !hasAggregationModel || !activeAggregationModel) {
    params.resetGroupByIncrementalAggregationState()
    return {
      aggregatedRowsProjection: params.groupedRowsProjection as DataGridRowNode<T>[],
      recomputed: true,
    }
  }
  const activeGroupByFieldsKey = activeGroupBy.fields.join("\u0001")

  const canReuseExistingAggregates =
    params.groupByIncrementalAggregationState.aggregatesByGroupKey.size > 0
    && params.groupByIncrementalAggregationState.lastRowRevision === params.rowRevision
    && params.groupByIncrementalAggregationState.lastSortRevision === params.sortRevision
    && params.groupByIncrementalAggregationState.lastFilterRevision === params.filterRevision
    && params.groupByIncrementalAggregationState.lastAggregationModelRef === activeAggregationModel
    && params.groupByIncrementalAggregationState.lastGroupByFieldsKey === activeGroupByFieldsKey

  if (canReuseExistingAggregates) {
    return {
      aggregatedRowsProjection: patchGroupRowsAggregatesByGroupKey(
        params.groupedRowsProjection,
        groupKey => params.groupByIncrementalAggregationState.aggregatesByGroupKey.get(groupKey),
      ),
      // Must stay `true` for projection-engine stage bookkeeping:
      // returning `false` keeps the stage stale in requested/computed revisions.
      recomputed: true,
    }
  }

  params.aggregationEngine.setModel(activeAggregationModel)
  const aggregationBasis: "filtered" | "source" = activeAggregationModel.basis === "source"
    ? "source"
    : "filtered"
  const rowsForAggregation = aggregationBasis === "source"
    ? (params.sortModel.length > 0
        ? sortLeafRows(params.sourceRows, params.sortModel, (row, descriptors) => {
            const values = new Array<unknown>(descriptors.length)
            for (let index = 0; index < descriptors.length; index += 1) {
              const descriptor = descriptors[index]
              values[index] = descriptor
                ? params.readRowField(row, descriptor.key, descriptor.field)
                : undefined
            }
            return values
          })
        : (params.sourceRows as DataGridRowNode<T>[]))
    : params.sortedRowsProjection

  let aggregatesByGroupKey: Map<string, Record<string, unknown>>
  if (params.aggregationEngine.isIncrementalAggregationSupported()) {
    const incremental = rebuildGroupByIncrementalAggregationState(
      rowsForAggregation,
      activeGroupBy.fields,
      (row, field) => params.normalizeText(params.readRowField(row, field)),
      row => params.aggregationEngine.createLeafContribution(row),
      () => params.aggregationEngine.createEmptyGroupState(),
      (groupState, previous, next) => params.aggregationEngine.applyContributionDelta(groupState, previous, next),
      groupState => params.aggregationEngine.finalizeGroupState(groupState),
    )
    params.groupByIncrementalAggregationState.statesByGroupKey = incremental.statesByGroupKey
    params.groupByIncrementalAggregationState.aggregatesByGroupKey = incremental.aggregatesByGroupKey
    params.groupByIncrementalAggregationState.groupPathByRowId = incremental.groupPathByRowId
    params.groupByIncrementalAggregationState.leafContributionByRowId = incremental.leafContributionByRowId
    aggregatesByGroupKey = params.groupByIncrementalAggregationState.aggregatesByGroupKey
  } else {
    params.resetGroupByIncrementalAggregationState()
    aggregatesByGroupKey = computeGroupByAggregatesMap(
      rowsForAggregation,
      activeGroupBy,
      (row, field) => params.normalizeText(params.readRowField(row, field)),
      rows => params.aggregationEngine.computeAggregatesForLeaves(rows),
    )
    params.groupByIncrementalAggregationState.aggregatesByGroupKey = aggregatesByGroupKey
  }

  params.groupByIncrementalAggregationState.lastRowRevision = params.rowRevision
  params.groupByIncrementalAggregationState.lastSortRevision = params.sortRevision
  params.groupByIncrementalAggregationState.lastFilterRevision = params.filterRevision
  params.groupByIncrementalAggregationState.lastAggregationModelRef = activeAggregationModel
  params.groupByIncrementalAggregationState.lastGroupByFieldsKey = activeGroupByFieldsKey

  return {
    aggregatedRowsProjection: patchGroupRowsAggregatesByGroupKey(
      params.groupedRowsProjection,
      groupKey => aggregatesByGroupKey.get(groupKey),
    ),
    recomputed: true,
  }
}
