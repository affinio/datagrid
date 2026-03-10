import type {
  DataGridProjectionInvalidationReason,
  DataGridProjectionDiagnostics,
  DataGridProjectionFormulaDiagnostics,
  DataGridProjectionMemoryDiagnostics,
  DataGridProjectionRowCounts,
  DataGridProjectionStageTimes,
  DataGridProjectionStage,
  DataGridRowNode,
} from "../rowModel.js"
import { resolveClientProjectionInvalidationStages } from "../projection/projectionStages.js"

export interface DataGridClientRowRuntimeState<T> {
  rows: DataGridRowNode<T>[]
  filteredRowsProjection: DataGridRowNode<T>[]
  sortedRowsProjection: DataGridRowNode<T>[]
  groupedRowsProjection: DataGridRowNode<T>[]
  pivotedRowsProjection: DataGridRowNode<T>[]
  aggregatedRowsProjection: DataGridRowNode<T>[]
  paginatedRowsProjection: DataGridRowNode<T>[]
  revision: number
  rowRevision: number
  sortRevision: number
  filterRevision: number
  groupRevision: number
  projectionCycleVersion: number
  projectionRecomputeVersion: number
  lastInvalidationReasons: DataGridProjectionInvalidationReason[]
  lastRecomputeHadActual: boolean
  lastRecomputedStages: DataGridProjectionStage[]
  lastBlockedStages: DataGridProjectionStage[]
  lastStageTimes: DataGridProjectionStageTimes
  projectionFormulaDiagnostics: DataGridProjectionFormulaDiagnostics | null
}

export interface DataGridProjectionCycleCommitMeta {
  hadActualRecompute: boolean
  recomputedStages?: readonly DataGridProjectionStage[]
  blockedStages?: readonly DataGridProjectionStage[]
  stageTimes?: DataGridProjectionStageTimes
}

export interface DataGridClientRowRuntimeStateStore<T> {
  state: DataGridClientRowRuntimeState<T>
  bumpRowRevision: () => number
  bumpSortRevision: () => number
  bumpFilterRevision: () => number
  bumpGroupRevision: () => number
  setProjectionInvalidation: (
    reasons: readonly DataGridProjectionInvalidationReason[],
  ) => void
  commitProjectionCycle: (
    meta: boolean | DataGridProjectionCycleCommitMeta,
  ) => number
  setProjectionFormulaDiagnostics: (
    diagnostics: DataGridProjectionFormulaDiagnostics | null,
  ) => void
  getProjectionDiagnostics: (
    getStaleStages: () => readonly DataGridProjectionStage[],
    sourceRowCount: number,
    sourceRowIndexSize: number,
    pivotColumnCount: number,
  ) => DataGridProjectionDiagnostics
}

function cloneProjectionFormulaDiagnostics(
  diagnostics: DataGridProjectionFormulaDiagnostics,
): DataGridProjectionFormulaDiagnostics {
  return {
    recomputedFields: [...diagnostics.recomputedFields],
    runtimeErrorCount: diagnostics.runtimeErrorCount,
    runtimeErrors: [...diagnostics.runtimeErrors],
    ...(diagnostics.compileCache
      ? {
        compileCache: { ...diagnostics.compileCache },
      }
      : {}),
  }
}

function cloneStageTimes(stageTimes: DataGridProjectionStageTimes): DataGridProjectionStageTimes {
  return { ...stageTimes }
}

function buildProjectionRowCounts<T>(
  state: DataGridClientRowRuntimeState<T>,
  sourceRowCount: number,
): DataGridProjectionRowCounts {
  return {
    source: sourceRowCount,
    afterCompute: sourceRowCount,
    afterFilter: state.filteredRowsProjection.length,
    afterSort: state.sortedRowsProjection.length,
    afterGroup: state.groupedRowsProjection.length,
    afterPivot: state.pivotedRowsProjection.length,
    afterAggregate: state.aggregatedRowsProjection.length,
    afterPaginate: state.paginatedRowsProjection.length,
    visible: state.rows.length,
  }
}

function sumStageTimes(stageTimes: DataGridProjectionStageTimes): number {
  let totalTime = 0
  for (const value of Object.values(stageTimes)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      totalTime += value
    }
  }
  return Math.round(totalTime * 1000) / 1000
}

function countGroupBuckets<T>(rows: readonly DataGridRowNode<T>[]): number {
  let groupBuckets = 0
  for (const row of rows) {
    if (row.kind === "group") {
      groupBuckets += 1
    }
  }
  return groupBuckets
}

function buildProjectionMemoryDiagnostics<T>(
  state: DataGridClientRowRuntimeState<T>,
  sourceRowIndexSize: number,
  pivotColumnCount: number,
): DataGridProjectionMemoryDiagnostics {
  const bytesPerEntry = 32
  return {
    rowIndexBytes: sourceRowIndexSize * bytesPerEntry,
    sortBufferBytes: state.sortedRowsProjection.length * bytesPerEntry,
    groupBuckets: countGroupBuckets(state.groupedRowsProjection),
    pivotCells: state.pivotedRowsProjection.length * pivotColumnCount,
  }
}

export function createClientRowRuntimeStateStore<T>(): DataGridClientRowRuntimeStateStore<T> {
  const state: DataGridClientRowRuntimeState<T> = {
    rows: [],
    filteredRowsProjection: [],
    sortedRowsProjection: [],
    groupedRowsProjection: [],
    pivotedRowsProjection: [],
    aggregatedRowsProjection: [],
    paginatedRowsProjection: [],
    revision: 0,
    rowRevision: 0,
    sortRevision: 0,
    filterRevision: 0,
    groupRevision: 0,
    projectionCycleVersion: 0,
    projectionRecomputeVersion: 0,
    lastInvalidationReasons: [],
    lastRecomputeHadActual: false,
    lastRecomputedStages: [],
    lastBlockedStages: [],
    lastStageTimes: {},
    projectionFormulaDiagnostics: null,
  }

  return {
    state,
    bumpRowRevision: () => {
      state.rowRevision += 1
      return state.rowRevision
    },
    bumpSortRevision: () => {
      state.sortRevision += 1
      return state.sortRevision
    },
    bumpFilterRevision: () => {
      state.filterRevision += 1
      return state.filterRevision
    },
    bumpGroupRevision: () => {
      state.groupRevision += 1
      return state.groupRevision
    },
    setProjectionInvalidation: (reasons) => {
      state.lastInvalidationReasons = Array.from(new Set(reasons))
    },
    commitProjectionCycle: (meta) => {
      const resolvedMeta = typeof meta === "boolean"
        ? { hadActualRecompute: meta }
        : meta
      state.projectionCycleVersion += 1
      if (resolvedMeta.hadActualRecompute) {
        state.projectionRecomputeVersion += 1
      }
      state.lastRecomputeHadActual = resolvedMeta.hadActualRecompute
      state.lastRecomputedStages = [...(resolvedMeta.recomputedStages ?? [])]
      state.lastBlockedStages = [...(resolvedMeta.blockedStages ?? [])]
      state.lastStageTimes = cloneStageTimes(resolvedMeta.stageTimes ?? {})
      state.revision += 1
      return state.revision
    },
    setProjectionFormulaDiagnostics: (diagnostics) => {
      state.projectionFormulaDiagnostics = diagnostics
        ? cloneProjectionFormulaDiagnostics(diagnostics)
        : null
    },
    getProjectionDiagnostics: (getStaleStages, sourceRowCount, sourceRowIndexSize, pivotColumnCount) => {
      const lastInvalidationReasons = [...state.lastInvalidationReasons]
      const lastStageTimes = cloneStageTimes(state.lastStageTimes)
      const rowCounts = buildProjectionRowCounts(state, sourceRowCount)
      const totalTime = sumStageTimes(lastStageTimes)
      const memory = buildProjectionMemoryDiagnostics(state, sourceRowIndexSize, pivotColumnCount)
      return {
        version: state.projectionCycleVersion,
        cycleVersion: state.projectionCycleVersion,
        recomputeVersion: state.projectionRecomputeVersion,
        staleStages: getStaleStages(),
        lastInvalidationReasons,
        lastInvalidatedStages: resolveClientProjectionInvalidationStages(lastInvalidationReasons),
        lastRecomputeHadActual: state.lastRecomputeHadActual,
        lastRecomputedStages: [...state.lastRecomputedStages],
        lastBlockedStages: [...state.lastBlockedStages],
        pipeline: {
          rowCounts,
        },
        ...(Object.keys(lastStageTimes).length > 0
          ? {
              performance: {
                totalTime,
                stageTimes: lastStageTimes,
              },
            }
          : {}),
        memory,
        ...(state.projectionFormulaDiagnostics
          ? { formula: cloneProjectionFormulaDiagnostics(state.projectionFormulaDiagnostics) }
          : {}),
      }
    },
  }
}
