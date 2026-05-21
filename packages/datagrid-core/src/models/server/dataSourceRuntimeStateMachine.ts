export type DataSourceRuntimePhase =
  | "idle"
  | "initial-loading"
  | "refreshing"
  | "invalidating"
  | "prefetching"
  | "optimistic-mutating"
  | "stale-retained"
  | "error"

export interface DataSourceRuntimeStateInput {
  readonly cachedRows: number
  readonly criticalInFlight: boolean
  readonly criticalAffectsLoading: boolean
  readonly backgroundInFlight: boolean
  readonly invalidating: boolean
  readonly optimisticMutating: boolean
  readonly staleRetainedRows: number
  readonly error: Error | null
  readonly disposed: boolean
}

export interface DataSourceRuntimeStateSnapshot {
  readonly phase: DataSourceRuntimePhase
  readonly loading: boolean
  readonly initialLoading: boolean
  readonly refreshing: boolean
}

export function resolveDataSourceRuntimeState(
  input: DataSourceRuntimeStateInput,
): DataSourceRuntimeStateSnapshot {
  if (input.disposed) {
    return {
      phase: "idle",
      loading: false,
      initialLoading: false,
      refreshing: false,
    }
  }

  const hasVisibleCache = input.cachedRows > 0
  const criticalLoading = input.criticalInFlight && input.criticalAffectsLoading
  const initialLoading = !hasVisibleCache && criticalLoading
  const refreshing = hasVisibleCache && criticalLoading
  const loading = initialLoading || refreshing

  if (initialLoading) {
    return {
      phase: "initial-loading",
      loading,
      initialLoading,
      refreshing,
    }
  }

  if (input.error) {
    return {
      phase: "error",
      loading,
      initialLoading,
      refreshing,
    }
  }

  if (refreshing) {
    return {
      phase: "refreshing",
      loading,
      initialLoading,
      refreshing,
    }
  }

  if (input.invalidating) {
    return {
      phase: "invalidating",
      loading,
      initialLoading,
      refreshing,
    }
  }

  if (input.optimisticMutating) {
    return {
      phase: "optimistic-mutating",
      loading,
      initialLoading,
      refreshing,
    }
  }

  if (input.staleRetainedRows > 0) {
    return {
      phase: "stale-retained",
      loading,
      initialLoading,
      refreshing,
    }
  }

  if (input.backgroundInFlight) {
    return {
      phase: "prefetching",
      loading,
      initialLoading,
      refreshing,
    }
  }

  return {
    phase: "idle",
    loading,
    initialLoading,
    refreshing,
  }
}
