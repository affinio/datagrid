import { type CreateWritableSignal, type WritableSignal } from "../runtime/signals";
export interface ServerRowModelFetchResult<T> {
    rows: T[];
    total?: number;
}
export interface ServerRowModelOptions<T> {
    blockSize?: number;
    maxCacheBlocks?: number;
    preloadThreshold?: number;
    loadBlock: (args: {
        start: number;
        limit: number;
        signal: AbortSignal;
        background: boolean;
    }) => Promise<ServerRowModelFetchResult<T> | T[] | void> | ServerRowModelFetchResult<T> | T[] | void;
    onBlockLoaded?: (payload: {
        blockIndex: number;
        start: number;
        rows: readonly T[];
        total: number | null;
        background: boolean;
    }) => void;
    onError?: (payload: {
        blockIndex: number;
        start: number;
        error: Error;
        background: boolean;
    }) => void;
    onProgress?: (payload: {
        progress: number | null;
        total: number | null;
        loadedRows: number;
    }) => void;
    adaptivePrefetch?: boolean;
    adaptiveScrollTiming?: {
        fast?: number;
        slow?: number;
    };
}
export interface ServerRowModelDiagnostics {
    cacheBlocks: number;
    cachedRows: number;
    pendingBlocks: number;
    pendingRequests: number;
    abortedRequests: number;
    cacheHits: number;
    cacheMisses: number;
    effectivePreloadThreshold: number;
}
export interface ServerRowModelDebug<T> {
    cache: WritableSignal<Map<number, T[]>>;
    pending: Map<number, PendingFetch>;
    metrics: {
        cachedRowCount: WritableSignal<number>;
        pendingBlocks: WritableSignal<number>;
        pendingRequests: WritableSignal<number>;
        abortedRequests: WritableSignal<number>;
        cacheHits: WritableSignal<number>;
        cacheMisses: WritableSignal<number>;
        effectivePreloadThreshold: WritableSignal<number>;
    };
}
export interface ServerRowModelSignals<T> {
    rows: WritableSignal<T[]>;
    loading: WritableSignal<boolean>;
    error: WritableSignal<Error | null>;
    blocks: WritableSignal<Map<number, T[]>>;
    total: WritableSignal<number | null>;
    loadedRanges: WritableSignal<Array<{
        start: number;
        end: number;
    }>>;
    progress: WritableSignal<number | null>;
    blockErrors: WritableSignal<Map<number, Error>>;
    diagnostics: WritableSignal<ServerRowModelDiagnostics>;
}
export interface ServerRowModel<T> extends ServerRowModelSignals<T> {
    getRowAt: (index: number) => T | undefined;
    getRowCount: () => number;
    refreshBlock: (blockIndex: number) => Promise<void>;
    fetchBlock: (startIndex: number) => Promise<void>;
    reset: () => void;
    abortAll: () => void;
    dispose: () => void;
    __debug?: ServerRowModelDebug<T>;
}
export type Direction = -1 | 0 | 1;
export type PendingFetch = {
    controller: AbortController;
    promise: Promise<void>;
};
export interface ScheduledTaskHandle {
    cancel(): void;
}
export interface ServerRowModelRuntime {
    scheduleFrame(callback: () => void): ScheduledTaskHandle;
    scheduleTimeout(callback: () => void, delay: number): ScheduledTaskHandle;
    now(): number;
}
export interface CreateServerRowModelConfig {
    createSignal?: CreateWritableSignal<unknown>;
    progressDebounceMs?: number;
    runtime?: ServerRowModelRuntime;
}
export declare function createServerRowModel<T>(options: ServerRowModelOptions<T>, config?: CreateServerRowModelConfig): ServerRowModel<T>;
//# sourceMappingURL=serverRowModel.d.ts.map