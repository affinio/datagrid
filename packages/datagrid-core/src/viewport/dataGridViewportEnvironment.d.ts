import type { DataGridViewportHostEnvironment } from "./viewportHostEnvironment";
import type { DataGridViewportRange } from "../models/rowModel";
import type { DataGridViewportRowHeightSample } from "./viewportHostEnvironment";
export interface ContainerMetrics {
    clientHeight: number;
    clientWidth: number;
    scrollHeight: number;
    scrollWidth: number;
    scrollTop: number;
    scrollLeft: number;
}
export declare function sampleContainerMetrics(hostEnvironment: DataGridViewportHostEnvironment, recordLayoutRead: (count?: number) => void, container: HTMLDivElement): ContainerMetrics;
export declare function sampleHeaderHeight(hostEnvironment: DataGridViewportHostEnvironment, recordLayoutRead: (count?: number) => void, header: HTMLElement | null): number;
export declare function sampleBoundingRect(hostEnvironment: DataGridViewportHostEnvironment, recordLayoutRead: (count?: number) => void, target: HTMLElement): DOMRect | null;
export declare function resolveDomStats(hostEnvironment: DataGridViewportHostEnvironment, container: HTMLElement | null): {
    rowLayers: number;
    cells: number;
    fillers: number;
};
export declare function sampleVisibleRowHeights(hostEnvironment: DataGridViewportHostEnvironment, recordLayoutRead: (count?: number) => void, container: HTMLElement | null, range: DataGridViewportRange): readonly DataGridViewportRowHeightSample[];
//# sourceMappingURL=dataGridViewportEnvironment.d.ts.map