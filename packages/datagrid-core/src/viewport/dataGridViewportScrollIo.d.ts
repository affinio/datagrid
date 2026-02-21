import type { RafScheduler } from "../runtime/rafScheduler";
import type { DataGridViewportHostEnvironment, DataGridViewportResizeObserver } from "./viewportHostEnvironment";
import type { ViewportSyncState, ViewportSyncTargets } from "./dataGridViewportTypes";
type OnAfterScroll = (() => void) | null;
export interface DataGridViewportScrollStateAdapter {
    getContainer(): HTMLDivElement | null;
    setContainer(value: HTMLDivElement | null): void;
    getHeader(): HTMLElement | null;
    setHeader(value: HTMLElement | null): void;
    getSyncTargets(): ViewportSyncTargets | null;
    setSyncTargets(value: ViewportSyncTargets | null): void;
    getSyncState(): ViewportSyncState;
    getLastAppliedScroll(): {
        top: number;
        left: number;
    };
    setLastAppliedScroll(top: number, left: number): void;
    getLastHeavyScroll(): {
        top: number;
        left: number;
    };
    setLastHeavyScroll(top: number, left: number): void;
    isAttached(): boolean;
    setAttached(value: boolean): void;
    getResizeObserver(): DataGridViewportResizeObserver | null;
    setResizeObserver(value: DataGridViewportResizeObserver | null): void;
    getPendingScrollTop(): number | null;
    setPendingScrollTop(value: number | null): void;
    getPendingScrollLeft(): number | null;
    setPendingScrollLeft(value: number | null): void;
    getAfterScrollTaskId(): number | null;
    setAfterScrollTaskId(value: number | null): void;
    getScrollSyncTaskId(): number | null;
    setScrollSyncTaskId(value: number | null): void;
    getLastScrollSamples(): {
        top: number;
        left: number;
    };
    setLastScrollSamples(top: number, left: number): void;
    isPendingHorizontalSettle(): boolean;
    setPendingHorizontalSettle(value: boolean): void;
    isDriftCorrectionPending(): boolean;
    setDriftCorrectionPending(value: boolean): void;
    resetCachedMeasurements(): void;
    clearLayoutMeasurement(): void;
    resetScrollSamples(): void;
}
export interface DataGridViewportScrollIoOptions {
    hostEnvironment: DataGridViewportHostEnvironment;
    scheduler: RafScheduler;
    recordLayoutRead: (count?: number) => void;
    recordLayoutWrite?: (count?: number) => void;
    recordSyncScroll: () => void;
    queueHeavyUpdate: (force?: boolean) => void;
    resolveHeavyUpdateThresholds?: () => {
        vertical: number;
        horizontal: number;
    };
    getTimestamp?: () => number;
    maxHeavyIdleMs?: number;
    flushSchedulers: () => void;
    getOnAfterScroll: () => OnAfterScroll;
    onDetach?: () => void;
    state: DataGridViewportScrollStateAdapter;
    normalizeAndClampScroll?: boolean;
    clampScrollTop?: (value: number) => number;
    clampScrollLeft?: (value: number) => number;
    frameDurationMs: number;
    onResizeMetrics?: () => boolean | void;
    onScrollMetrics?: (metrics: {
        scrollTop: number;
        scrollLeft: number;
    }) => void;
    onScrollSyncFrame?: (metrics: {
        scrollTop: number;
        scrollLeft: number;
    }) => void;
}
export interface DataGridViewportScrollIo {
    attach(container: HTMLDivElement | null, header: HTMLElement | null): void;
    detach(): void;
    handleScroll(event: Event): void;
    applyProgrammaticScrollWrites(pending: {
        scrollTop?: number | null;
        scrollLeft?: number | null;
    }): void;
    scheduleAfterScroll(): void;
    cancelAfterScrollTask(): void;
    dispose(): void;
}
export declare function createDataGridViewportScrollIo(options: DataGridViewportScrollIoOptions): DataGridViewportScrollIo;
export {};
//# sourceMappingURL=dataGridViewportScrollIo.d.ts.map