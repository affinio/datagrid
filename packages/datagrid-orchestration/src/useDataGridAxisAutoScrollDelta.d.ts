export interface UseDataGridAxisAutoScrollDeltaOptions {
    edgePx: number;
    maxStepPx: number;
    maxIntensity?: number;
}
export interface UseDataGridAxisAutoScrollDeltaResult {
    resolveAxisAutoScrollDelta: (pointer: number, min: number, max: number) => number;
}
export declare function useDataGridAxisAutoScrollDelta(options: UseDataGridAxisAutoScrollDeltaOptions): UseDataGridAxisAutoScrollDeltaResult;
//# sourceMappingURL=useDataGridAxisAutoScrollDelta.d.ts.map