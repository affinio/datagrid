import type { DataGridViewportHostEnvironment, DataGridViewportResizeObserver } from "./viewportHostEnvironment";
export interface ViewportClock {
    now(): number;
}
export declare function createMonotonicClock(globalRef?: typeof globalThis): ViewportClock;
export interface DefaultHostEnvironmentOptions {
    scrollListenerOptions?: AddEventListenerOptions;
    scrollRemoveOptions?: boolean | EventListenerOptions;
    resizeObserverFactory?: (callback: () => void) => DataGridViewportResizeObserver | null;
}
export declare function createNoopResizeObserver(): DataGridViewportResizeObserver;
export declare function createDefaultHostEnvironment(globalRef?: typeof globalThis, options?: DefaultHostEnvironmentOptions): DataGridViewportHostEnvironment;
//# sourceMappingURL=dataGridViewportConfig.d.ts.map