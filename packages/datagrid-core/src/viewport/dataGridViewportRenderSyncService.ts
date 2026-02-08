import { applyViewportSyncTransforms, resetViewportSyncTransforms } from "./scrollSync"
import type { ViewportSyncState, ViewportSyncTargets } from "./dataGridViewportTypes"

export interface DataGridViewportRenderSyncServiceOptions {
  syncState: ViewportSyncState
  resolveNextState: (overrides?: Partial<ViewportSyncState>) => ViewportSyncState
  onTargetsChanged?: (targets: ViewportSyncTargets | null) => void
}

export interface DataGridViewportRenderSyncService {
  getTargets(): ViewportSyncTargets | null
  getLatestTargets(): ViewportSyncTargets | null
  setTargets(targets: ViewportSyncTargets | null): void
  reapplyLatestTargets(): void
  clearCurrentTargets(): void
  updatePinnedOffsets(offsets: { left: number; right: number }): void
  dispose(): void
}

function alignOverlayRootWithScrollHost(targets: ViewportSyncTargets | null) {
  const host = targets?.scrollHost
  const overlayRoot = targets?.overlayRoot
  if (!host || !overlayRoot) {
    return
  }
  if (overlayRoot.parentElement !== host && typeof host.appendChild === "function") {
    host.appendChild(overlayRoot)
  }
}

export function createDataGridViewportRenderSyncService(
  options: DataGridViewportRenderSyncServiceOptions,
): DataGridViewportRenderSyncService {
  const { syncState, resolveNextState, onTargetsChanged } = options

  let targets: ViewportSyncTargets | null = null
  let latestTargets: ViewportSyncTargets | null = null

  const applySyncState = (nextTargets: ViewportSyncTargets | null) => {
    if (!nextTargets) {
      resetViewportSyncTransforms(null, syncState)
      onTargetsChanged?.(null)
      return
    }
    alignOverlayRootWithScrollHost(nextTargets)
    applyViewportSyncTransforms(nextTargets, syncState, resolveNextState())
    onTargetsChanged?.(nextTargets)
  }

  return {
    getTargets() {
      return targets
    },
    getLatestTargets() {
      return latestTargets
    },
    setTargets(nextTargets: ViewportSyncTargets | null) {
      latestTargets = nextTargets
      if (targets === nextTargets) {
        if (nextTargets) {
          applyViewportSyncTransforms(nextTargets, syncState, resolveNextState())
        }
        onTargetsChanged?.(nextTargets)
        return
      }
      targets = nextTargets
      applySyncState(targets)
    },
    reapplyLatestTargets() {
      if (!latestTargets) {
        return
      }
      targets = latestTargets
      applySyncState(targets)
    },
    clearCurrentTargets() {
      if (!targets) {
        onTargetsChanged?.(null)
        return
      }
      resetViewportSyncTransforms(targets, syncState)
      targets = null
      onTargetsChanged?.(null)
    },
    updatePinnedOffsets(offsets: { left: number; right: number }) {
      const nextPinnedLeft = Math.max(0, Number.isFinite(offsets.left) ? offsets.left : 0)
      const nextPinnedRight = Math.max(0, Number.isFinite(offsets.right) ? offsets.right : 0)
      const pendingUpdate =
        syncState.pinnedOffsetLeft !== nextPinnedLeft ||
        syncState.pinnedOffsetRight !== nextPinnedRight

      if (!pendingUpdate) {
        return
      }

      if (targets) {
        const nextState = resolveNextState({
          pinnedOffsetLeft: nextPinnedLeft,
          pinnedOffsetRight: nextPinnedRight,
        })
        applyViewportSyncTransforms(targets, syncState, nextState)
      }

      syncState.pinnedOffsetLeft = nextPinnedLeft
      syncState.pinnedOffsetRight = nextPinnedRight
    },
    dispose() {
      latestTargets = null
      if (!targets) {
        onTargetsChanged?.(null)
        return
      }
      resetViewportSyncTransforms(targets, syncState)
      targets = null
      onTargetsChanged?.(null)
    },
  }
}
