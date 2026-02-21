import type { ViewportSyncState, ViewportSyncTargets } from "./dataGridViewportTypes";
export interface DataGridViewportRenderSyncServiceOptions {
    syncState: ViewportSyncState;
    resolveNextState: (overrides?: Partial<ViewportSyncState>) => ViewportSyncState;
    onTargetsChanged?: (targets: ViewportSyncTargets | null) => void;
}
export interface DataGridViewportRenderSyncService {
    getTargets(): ViewportSyncTargets | null;
    getLatestTargets(): ViewportSyncTargets | null;
    setTargets(targets: ViewportSyncTargets | null): void;
    reapplyLatestTargets(): void;
    clearCurrentTargets(): void;
    updatePinnedOffsets(offsets: {
        left: number;
        right: number;
    }): void;
    dispose(): void;
}
export declare function createDataGridViewportRenderSyncService(options: DataGridViewportRenderSyncServiceOptions): DataGridViewportRenderSyncService;
//# sourceMappingURL=dataGridViewportRenderSyncService.d.ts.map