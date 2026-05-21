import type {
  DataGridProjectionInvalidationReason,
  DataGridRowModelRefreshReason,
} from "../rowModel.js"

export interface CreateClientRowRefreshHostRuntimeOptions {
  ensureActive: () => void
  setProjectionInvalidation: (reasons: readonly DataGridProjectionInvalidationReason[]) => void
  tryApplyFlatIdentityProjectionRefresh: () => boolean
  refreshComputeHost: () => void
  recomputeFromComputeStage: () => void
  emit: () => void
}

export interface ClientRowRefreshHostRuntime {
  bootstrapInitialProjection(): void
  refresh(reason?: DataGridRowModelRefreshReason): void
}

export function createClientRowRefreshHostRuntime(
  options: CreateClientRowRefreshHostRuntimeOptions,
): ClientRowRefreshHostRuntime {
  const runProjectionRefresh = (fallback: () => void): void => {
    if (!options.tryApplyFlatIdentityProjectionRefresh()) {
      fallback()
    }
  }

  return {
    bootstrapInitialProjection() {
      options.setProjectionInvalidation(["rowsChanged"])
      runProjectionRefresh(options.recomputeFromComputeStage)
    },
    refresh(reason) {
      options.ensureActive()
      options.setProjectionInvalidation(
        reason === "sort-change" ? ["sortChanged"] : ["manualRefresh"],
      )
      runProjectionRefresh(options.refreshComputeHost)
      options.emit()
    },
  }
}
