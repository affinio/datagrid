import type {
  DataGridProjectionInvalidationReason,
  DataGridProjectionDiagnostics,
  DataGridProjectionFormulaDiagnostics,
  DataGridProjectionStage,
  DataGridRowNode,
} from "./rowModel.js"
import { resolveClientProjectionInvalidationStages } from "./projectionStages.js"

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
  projectionFormulaDiagnostics: DataGridProjectionFormulaDiagnostics | null
}

export interface DataGridProjectionCycleCommitMeta {
  hadActualRecompute: boolean
  recomputedStages?: readonly DataGridProjectionStage[]
  blockedStages?: readonly DataGridProjectionStage[]
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
  ) => DataGridProjectionDiagnostics
}

function cloneProjectionFormulaDiagnostics(
  diagnostics: DataGridProjectionFormulaDiagnostics,
): DataGridProjectionFormulaDiagnostics {
  return {
    recomputedFields: [...diagnostics.recomputedFields],
    runtimeErrorCount: diagnostics.runtimeErrorCount,
    runtimeErrors: [...diagnostics.runtimeErrors],
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
      state.revision += 1
      return state.revision
    },
    setProjectionFormulaDiagnostics: (diagnostics) => {
      state.projectionFormulaDiagnostics = diagnostics
        ? cloneProjectionFormulaDiagnostics(diagnostics)
        : null
    },
    getProjectionDiagnostics: (getStaleStages) => {
      const lastInvalidationReasons = [...state.lastInvalidationReasons]
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
        ...(state.projectionFormulaDiagnostics
          ? { formula: cloneProjectionFormulaDiagnostics(state.projectionFormulaDiagnostics) }
          : {}),
      }
    },
  }
}
