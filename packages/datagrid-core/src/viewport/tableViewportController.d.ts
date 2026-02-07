import type { UiTableColumn, VisibleRow } from "../types";
import { type TableViewportSignals } from "./tableViewportSignals";
import type { ViewportMetricsSnapshot, TableViewportImperativeCallbacks, TableViewportServerIntegration, TableViewportControllerOptions, ViewportSyncTargets } from "./tableViewportTypes";
export type { ViewportMetricsSnapshot, LayoutMeasurementSnapshot, ImperativeColumnUpdatePayload, ImperativeRowUpdatePayload, ImperativeScrollSyncPayload, TableViewportImperativeCallbacks, TableViewportServerIntegration, TableViewportControllerOptions, TableViewportRuntimeOverrides, ViewportSyncTargets, ViewportSyncState, } from "./tableViewportTypes";
export type { TableViewportState, RowPoolItem } from "./tableViewportSignals";
export interface TableViewportController extends TableViewportSignals {
    attach(container: HTMLDivElement | null, header: HTMLElement | null): void;
    detach(): void;
    setProcessedRows(rows: VisibleRow[]): void;
    setColumns(columns: UiTableColumn[]): void;
    setZoom(zoom: number): void;
    setVirtualizationEnabled(enabled: boolean): void;
    setRowHeightMode(mode: "fixed" | "auto"): void;
    setBaseRowHeight(height: number): void;
    setViewportMetrics(metrics: ViewportMetricsSnapshot | null): void;
    setIsLoading(loading: boolean): void;
    setImperativeCallbacks(callbacks: TableViewportImperativeCallbacks | null | undefined): void;
    setOnAfterScroll(callback: (() => void) | null | undefined): void;
    setOnNearBottom(callback: (() => void) | null | undefined): void;
    setServerIntegration(integration: TableViewportServerIntegration | null | undefined): void;
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
    refresh(force?: boolean): void;
    dispose(): void;
}
export declare function createTableViewportController(options: TableViewportControllerOptions): TableViewportController;
//# sourceMappingURL=tableViewportController.d.ts.map