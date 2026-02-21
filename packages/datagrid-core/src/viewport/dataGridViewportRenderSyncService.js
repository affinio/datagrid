import { applyViewportSyncTransforms, resetViewportSyncTransforms } from "./scrollSync";
function alignOverlayRootWithScrollHost(targets) {
    const host = targets?.scrollHost;
    const overlayRoot = targets?.overlayRoot;
    if (!host || !overlayRoot) {
        return;
    }
    if (overlayRoot.parentElement !== host && typeof host.appendChild === "function") {
        host.appendChild(overlayRoot);
    }
}
export function createDataGridViewportRenderSyncService(options) {
    const { syncState, resolveNextState, onTargetsChanged } = options;
    let targets = null;
    let latestTargets = null;
    const applySyncState = (nextTargets) => {
        if (!nextTargets) {
            resetViewportSyncTransforms(null, syncState);
            onTargetsChanged?.(null);
            return;
        }
        alignOverlayRootWithScrollHost(nextTargets);
        applyViewportSyncTransforms(nextTargets, syncState, resolveNextState());
        onTargetsChanged?.(nextTargets);
    };
    return {
        getTargets() {
            return targets;
        },
        getLatestTargets() {
            return latestTargets;
        },
        setTargets(nextTargets) {
            latestTargets = nextTargets;
            if (targets === nextTargets) {
                if (nextTargets) {
                    applyViewportSyncTransforms(nextTargets, syncState, resolveNextState());
                }
                onTargetsChanged?.(nextTargets);
                return;
            }
            targets = nextTargets;
            applySyncState(targets);
        },
        reapplyLatestTargets() {
            if (!latestTargets) {
                return;
            }
            targets = latestTargets;
            applySyncState(targets);
        },
        clearCurrentTargets() {
            if (!targets) {
                onTargetsChanged?.(null);
                return;
            }
            resetViewportSyncTransforms(targets, syncState);
            targets = null;
            onTargetsChanged?.(null);
        },
        updatePinnedOffsets(offsets) {
            const nextPinnedLeft = Math.max(0, Number.isFinite(offsets.left) ? offsets.left : 0);
            const nextPinnedRight = Math.max(0, Number.isFinite(offsets.right) ? offsets.right : 0);
            const pendingUpdate = syncState.pinnedOffsetLeft !== nextPinnedLeft ||
                syncState.pinnedOffsetRight !== nextPinnedRight;
            if (!pendingUpdate) {
                return;
            }
            if (targets) {
                const nextState = resolveNextState({
                    pinnedOffsetLeft: nextPinnedLeft,
                    pinnedOffsetRight: nextPinnedRight,
                });
                applyViewportSyncTransforms(targets, syncState, nextState);
            }
            syncState.pinnedOffsetLeft = nextPinnedLeft;
            syncState.pinnedOffsetRight = nextPinnedRight;
        },
        dispose() {
            latestTargets = null;
            if (!targets) {
                onTargetsChanged?.(null);
                return;
            }
            resetViewportSyncTransforms(targets, syncState);
            targets = null;
            onTargetsChanged?.(null);
        },
    };
}
