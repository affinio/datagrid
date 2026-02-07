import type { TableViewportHostEnvironment, TableViewportResizeObserver } from "./viewportHostEnvironment";
export interface ViewportClock {
    now(): number;
}
export declare function createMonotonicClock(globalRef?: typeof globalThis): ViewportClock;
export interface DefaultHostEnvironmentOptions {
    scrollListenerOptions?: AddEventListenerOptions;
    scrollRemoveOptions?: boolean | EventListenerOptions;
    resizeObserverFactory?: (callback: () => void) => TableViewportResizeObserver | null;
}
export declare function createNoopResizeObserver(): TableViewportResizeObserver;
export declare function createDefaultHostEnvironment(globalRef?: typeof globalThis, options?: DefaultHostEnvironmentOptions): TableViewportHostEnvironment;
//# sourceMappingURL=tableViewportConfig.d.ts.map