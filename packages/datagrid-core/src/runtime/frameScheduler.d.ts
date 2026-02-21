export interface FrameSchedulerHooks {
    onBeforeFrame?: (timestamp: number) => void;
    onRead?: (timestamp: number) => void;
    onCompute?: (timestamp: number) => void;
    onCommit?: (timestamp: number) => void;
}
export interface FrameScheduler {
    invalidate(): void;
    cancel(): void;
    flush(): void;
    dispose(): void;
}
export declare function createFrameScheduler(hooks?: FrameSchedulerHooks): FrameScheduler;
//# sourceMappingURL=frameScheduler.d.ts.map