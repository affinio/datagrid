export type DataGridScrollPerfQuality = "unknown" | "good" | "degraded";
export interface DataGridScrollPerfSnapshot {
    active: boolean;
    frameCount: number;
    droppedFrames: number;
    longTaskFrames: number;
    avgFrameMs: number;
    fps: number;
    quality: DataGridScrollPerfQuality;
}
export interface UseDataGridScrollPerfTelemetryOptions {
    resolveIdleDelayMs?: () => number;
    resolveDroppedFrameThresholdMs?: () => number;
    resolveLongTaskThresholdMs?: () => number;
    resolveGoodFpsThreshold?: () => number;
    resolveMaxDropRate?: () => number;
    resolveMinFrameSample?: () => number;
    onSnapshotChange?: (snapshot: DataGridScrollPerfSnapshot) => void;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
    setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>;
    clearTimeout?: (handle: ReturnType<typeof globalThis.setTimeout>) => void;
}
export interface UseDataGridScrollPerfTelemetryResult {
    markScrollActivity: () => void;
    getSnapshot: () => DataGridScrollPerfSnapshot;
    dispose: () => void;
}
export declare function useDataGridScrollPerfTelemetry(options?: UseDataGridScrollPerfTelemetryOptions): UseDataGridScrollPerfTelemetryResult;
//# sourceMappingURL=useDataGridScrollPerfTelemetry.d.ts.map