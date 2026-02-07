import { type AxisVirtualizerState } from "../virtualization/axisVirtualizer";
import type { VisibleRow } from "../types";
import type { TableViewportDiagnostics } from "./tableViewportDiagnostics";
import type { TableViewportSignals } from "./tableViewportSignals";
import type { TableViewportImperativeCallbacks, TableViewportServerIntegration } from "./tableViewportTypes";
import type { ViewportClock } from "./tableViewportConfig";
import { type AxisVirtualizationConstants, type ViewportFrameBudget } from "./tableViewportConstants";
interface VisibleRangePayload {
    start: number;
    end: number;
}
export interface TableViewportVirtualizationOptions {
    signals: TableViewportSignals;
    diagnostics: TableViewportDiagnostics;
    clock: ViewportClock;
    frameBudget?: ViewportFrameBudget;
    verticalConfig?: AxisVirtualizationConstants;
}
export interface TableViewportVirtualizationUpdateArgs {
    rows: VisibleRow[];
    totalRowCount: number;
    viewportHeight: number;
    resolvedRowHeight: number;
    zoomFactor: number;
    virtualizationEnabled: boolean;
    pendingScrollTop: number;
    lastScrollTopSample: number;
    pendingScrollTopRequest: number | null;
    measuredScrollTopFromPending: boolean;
    cachedNativeScrollHeight: number;
    containerHeight: number;
    serverIntegration: TableViewportServerIntegration;
    imperativeCallbacks: TableViewportImperativeCallbacks;
}
export interface TableViewportVirtualizationResult {
    scrollTop: number;
    lastScrollTopSample: number;
    pendingScrollTop: number | null;
    visibleRange: VisibleRangePayload;
    syncedScrollTop: number | null;
    timestamp: number;
    pendingScrollWrite: number | null;
}
export interface TableViewportVirtualizationPrepared {
    state: AxisVirtualizerState<undefined>;
    scrollTop: number;
    lastScrollTopSample: number;
    pendingScrollTop: number | null;
    visibleRange: VisibleRangePayload;
    syncedScrollTop: number | null;
    timestamp: number;
    pendingScrollWrite: number | null;
}
export interface TableViewportVirtualizationApplyArgs {
    rows: VisibleRow[];
    serverIntegration: TableViewportServerIntegration;
    imperativeCallbacks: TableViewportImperativeCallbacks;
}
export interface TableViewportVirtualization {
    resetOverscan(timestamp: number): void;
    resetScrollState(timestamp: number): void;
    resetServerIntegration(): void;
    clampScrollTop(value: number): number;
    prepare(args: TableViewportVirtualizationUpdateArgs): TableViewportVirtualizationPrepared | null;
    applyPrepared(prepared: TableViewportVirtualizationPrepared, applyArgs: TableViewportVirtualizationApplyArgs): TableViewportVirtualizationResult;
    update(args: TableViewportVirtualizationUpdateArgs): TableViewportVirtualizationResult | null;
}
export declare function createTableViewportVirtualization(options: TableViewportVirtualizationOptions): TableViewportVirtualization;
export {};
//# sourceMappingURL=tableViewportVirtualization.d.ts.map