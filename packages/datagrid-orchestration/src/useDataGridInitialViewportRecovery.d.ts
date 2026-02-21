export interface UseDataGridInitialViewportRecoveryOptions {
    resolveShouldRecover: () => boolean;
    runRecoveryStep: () => void;
    maxAttempts?: number;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridInitialViewportRecoveryResult {
    scheduleRecovery: (reset?: boolean) => void;
    cancelRecovery: () => void;
    isRecoveryScheduled: () => boolean;
    getAttemptCount: () => number;
}
export declare function useDataGridInitialViewportRecovery(options: UseDataGridInitialViewportRecoveryOptions): UseDataGridInitialViewportRecoveryResult;
//# sourceMappingURL=useDataGridInitialViewportRecovery.d.ts.map