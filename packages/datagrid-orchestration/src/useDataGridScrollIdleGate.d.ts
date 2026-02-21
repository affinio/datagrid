export interface UseDataGridScrollIdleGateOptions {
    resolveIdleDelayMs?: () => number;
    setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>;
    clearTimeout?: (handle: ReturnType<typeof globalThis.setTimeout>) => void;
}
export interface UseDataGridScrollIdleGateResult {
    markScrollActivity: () => void;
    isScrollActive: () => boolean;
    runWhenScrollIdle: (callback: () => void) => void;
    dispose: () => void;
}
export declare function useDataGridScrollIdleGate(options?: UseDataGridScrollIdleGateOptions): UseDataGridScrollIdleGateResult;
//# sourceMappingURL=useDataGridScrollIdleGate.d.ts.map