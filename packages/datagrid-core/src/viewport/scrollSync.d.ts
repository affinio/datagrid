import type { ViewportSyncState, ViewportSyncTargets } from "./tableViewportTypes";
export interface ViewportSyncAdapter {
    getSyncTargets(): ViewportSyncTargets | null;
    getAppliedState(): ViewportSyncState;
}
export declare function applyViewportSyncTransforms(adapter: ViewportSyncAdapter | null, next: ViewportSyncState): void;
export declare function applyViewportSyncTransforms(targets: ViewportSyncTargets | null, state: ViewportSyncState, next: ViewportSyncState): void;
export declare function resetViewportSyncTransforms(targets: ViewportSyncTargets | null, state: ViewportSyncState): void;
//# sourceMappingURL=scrollSync.d.ts.map