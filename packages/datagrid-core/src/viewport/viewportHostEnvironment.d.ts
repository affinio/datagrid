import type { DataGridViewportRange } from "../models/rowModel";
export interface DataGridViewportResizeObserver {
    observe(target: Element): void;
    unobserve?(target: Element): void;
    disconnect(): void;
}
export interface DataGridViewportContainerMetrics {
    clientHeight: number;
    clientWidth: number;
    scrollHeight: number;
    scrollWidth: number;
    scrollTop: number;
    scrollLeft: number;
}
export interface DataGridViewportHeaderMetrics {
    height: number;
}
export interface DataGridViewportDomStats {
    rowLayers: number;
    cells: number;
    fillers: number;
}
export interface DataGridViewportRowHeightSample {
    index: number;
    height: number;
}
export interface DataGridViewportHostEnvironment {
    addScrollListener(target: EventTarget, listener: (event: Event) => void, options?: AddEventListenerOptions): void;
    removeScrollListener(target: EventTarget, listener: (event: Event) => void, options?: boolean | EventListenerOptions): void;
    createResizeObserver?(callback: () => void): DataGridViewportResizeObserver | null;
    removeResizeObserverTarget?(observer: DataGridViewportResizeObserver, target: Element): void;
    readContainerMetrics?(target: HTMLDivElement): DataGridViewportContainerMetrics | null;
    readHeaderMetrics?(target: HTMLElement | null): DataGridViewportHeaderMetrics | null;
    getBoundingClientRect?(target: HTMLElement): DOMRect | null;
    isEventFromContainer?(event: Event, container: HTMLElement): boolean;
    normalizeScrollLeft?(target: HTMLElement): number;
    queryDebugDomStats?(container: HTMLElement): DataGridViewportDomStats | null;
    readVisibleRowHeights?(container: HTMLElement, range: DataGridViewportRange): readonly DataGridViewportRowHeightSample[] | null;
}
//# sourceMappingURL=viewportHostEnvironment.d.ts.map