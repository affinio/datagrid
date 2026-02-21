export interface UseDataGridResizeClickGuardOptions {
    guardDurationMs?: number;
    resolveNow?: () => number;
    resolveDocument?: () => Document | null;
    setTimeoutFn?: (handler: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
    clearTimeoutFn?: (timer: ReturnType<typeof setTimeout>) => void;
}
export interface UseDataGridResizeClickGuardResult {
    armResizeGuard: () => void;
    releaseResizeGuard: () => void;
    isResizeActive: () => boolean;
    shouldBlockClick: () => boolean;
    onHeaderClickCapture: (event: MouseEvent) => void;
    dispose: () => void;
}
export declare function useDataGridResizeClickGuard(options?: UseDataGridResizeClickGuardOptions): UseDataGridResizeClickGuardResult;
//# sourceMappingURL=useDataGridResizeClickGuard.d.ts.map