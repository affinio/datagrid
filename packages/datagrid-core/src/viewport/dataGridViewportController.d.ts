import { type DataGridColumnModel, type DataGridRowModel } from "../models";
import { type DataGridViewportSignals } from "./dataGridViewportSignals";
import type { ViewportMetricsSnapshot, DataGridViewportImperativeCallbacks, DataGridViewportControllerOptions, DataGridVirtualWindowSnapshot, ViewportIntegrationSnapshot, ViewportSyncTargets } from "./dataGridViewportTypes";
import type { ViewportSyncState } from "./dataGridViewportTypes";
export type { ViewportMetricsSnapshot, LayoutMeasurementSnapshot, ImperativeWindowUpdatePayload, ImperativeColumnUpdatePayload, ImperativeRowUpdatePayload, ImperativeScrollSyncPayload, DataGridViewportImperativeCallbacks, DataGridViewportControllerOptions, DataGridViewportRuntimeOverrides, DataGridVirtualWindowSnapshot, ViewportIntegrationSnapshot, ViewportSyncTargets, ViewportSyncState, } from "./dataGridViewportTypes";
export type { DataGridViewportState, RowPoolItem } from "./dataGridViewportSignals";
export interface DataGridViewportController<TRow = unknown> extends DataGridViewportSignals {
    attach(container: HTMLDivElement | null, header: HTMLElement | null): void;
    detach(): void;
    setRowModel(rowModel: DataGridRowModel<TRow> | null | undefined): void;
    setColumnModel(columnModel: DataGridColumnModel | null | undefined): void;
    setZoom(zoom: number): void;
    setVirtualizationEnabled(enabled: boolean): void;
    setRowHeightMode(mode: "fixed" | "auto"): void;
    setBaseRowHeight(height: number): void;
    setViewportMetrics(metrics: ViewportMetricsSnapshot | null): void;
    setIsLoading(loading: boolean): void;
    setImperativeCallbacks(callbacks: DataGridViewportImperativeCallbacks | null | undefined): void;
    setOnAfterScroll(callback: (() => void) | null | undefined): void;
    setOnNearBottom(callback: (() => void) | null | undefined): void;
    setDebugMode(enabled: boolean): void;
    handleScroll(event: Event): void;
    updateViewportHeight(): void;
    measureRowHeight(): void;
    cancelScrollRaf(): void;
    scrollToRow(index: number): void;
    scrollToColumn(key: string): void;
    isRowVisible(index: number): boolean;
    clampScrollTopValue(value: number): number;
    setViewportSyncTargets(targets: ViewportSyncTargets | null): void;
    getViewportSyncState(): ViewportSyncState;
    getVirtualWindow(): DataGridVirtualWindowSnapshot;
    getIntegrationSnapshot(): ViewportIntegrationSnapshot;
    refresh(force?: boolean): void;
    dispose(): void;
}
export declare function createDataGridViewportController<TRow = unknown>(options: DataGridViewportControllerOptions<TRow>): DataGridViewportController<TRow>;
//# sourceMappingURL=dataGridViewportController.d.ts.map