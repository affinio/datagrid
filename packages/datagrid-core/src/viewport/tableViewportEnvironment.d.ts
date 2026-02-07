import type { TableViewportHostEnvironment } from "./viewportHostEnvironment";
export interface ContainerMetrics {
    clientHeight: number;
    clientWidth: number;
    scrollHeight: number;
    scrollWidth: number;
    scrollTop: number;
    scrollLeft: number;
}
export declare function sampleContainerMetrics(hostEnvironment: TableViewportHostEnvironment, recordLayoutRead: (count?: number) => void, container: HTMLDivElement): ContainerMetrics;
export declare function sampleHeaderHeight(hostEnvironment: TableViewportHostEnvironment, recordLayoutRead: (count?: number) => void, header: HTMLElement | null): number;
export declare function sampleBoundingRect(hostEnvironment: TableViewportHostEnvironment, recordLayoutRead: (count?: number) => void, target: HTMLElement): DOMRect | null;
export declare function resolveDomStats(hostEnvironment: TableViewportHostEnvironment, container: HTMLElement | null): {
    rowLayers: number;
    cells: number;
    fillers: number;
};
//# sourceMappingURL=tableViewportEnvironment.d.ts.map