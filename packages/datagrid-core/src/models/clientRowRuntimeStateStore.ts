import type {
  DataGridProjectionDiagnostics,
  DataGridProjectionStage,
  DataGridRowNode,
} from "./rowModel.js"

export interface DataGridClientRowRuntimeState<T> {
  rows: DataGridRowNode<T>[]
  filteredRowsProjection: DataGridRowNode<T>[]
  sortedRowsProjection: DataGridRowNode<T>[]
  groupedRowsProjection: DataGridRowNode<T>[]
  aggregatedRowsProjection: DataGridRowNode<T>[]
  paginatedRowsProjection: DataGridRowNode<T>[]
  revision: number
  rowRevision: number
  sortRevision: number
  filterRevision: number
  groupRevision: number
  projectionCycleVersion: number
  projectionRecomputeVersion: number
}

export interface DataGridClientRowRuntimeStateStore<T> {
  state: DataGridClientRowRuntimeState<T>
  bumpRowRevision: () => number
  bumpSortRevision: () => number
  bumpFilterRevision: () => number
  bumpGroupRevision: () => number
  commitProjectionCycle: (hadActualRecompute: boolean) => number
  getProjectionDiagnostics: (
    getStaleStages: () => readonly DataGridProjectionStage[],
  ) => DataGridProjectionDiagnostics
}

export function createClientRowRuntimeStateStore<T>(): DataGridClientRowRuntimeStateStore<T> {
  const state: DataGridClientRowRuntimeState<T> = {
    rows: [],
    filteredRowsProjection: [],
    sortedRowsProjection: [],
    groupedRowsProjection: [],
    aggregatedRowsProjection: [],
    paginatedRowsProjection: [],
    revision: 0,
    rowRevision: 0,
    sortRevision: 0,
    filterRevision: 0,
    groupRevision: 0,
    projectionCycleVersion: 0,
    projectionRecomputeVersion: 0,
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
    commitProjectionCycle: (hadActualRecompute: boolean) => {
      state.projectionCycleVersion += 1
      if (hadActualRecompute) {
        state.projectionRecomputeVersion += 1
      }
      state.revision += 1
      return state.revision
    },
    getProjectionDiagnostics: (getStaleStages) => {
      return {
        version: state.projectionCycleVersion,
        cycleVersion: state.projectionCycleVersion,
        recomputeVersion: state.projectionRecomputeVersion,
        staleStages: getStaleStages(),
      }
    },
  }
}
