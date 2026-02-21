import { type AxisVirtualizerState } from "../virtualization/axisVirtualizer";
import type { VisibleRow } from "../types";
import type { DataGridViewportDiagnostics } from "./dataGridViewportDiagnostics";
import type { DataGridViewportSignals } from "./dataGridViewportSignals";
import type { DataGridViewportImperativeCallbacks } from "./dataGridViewportTypes";
import type { ViewportClock } from "./dataGridViewportConfig";
import { type AxisVirtualizationConstants, type ViewportFrameBudget } from "./dataGridViewportConstants";
interface VisibleRangePayload {
    start: number;
    end: number;
}
export interface DataGridViewportVirtualizationOptions {
    signals: DataGridViewportSignals;
    diagnostics: DataGridViewportDiagnostics;
    clock: ViewportClock;
    frameBudget?: ViewportFrameBudget;
    verticalConfig?: AxisVirtualizationConstants;
}
export interface DataGridViewportVirtualizationUpdateArgs {
    resolveRow: (index: number) => VisibleRow | undefined;
    resolveRowsInRange?: (range: {
        start: number;
        end: number;
    }) => readonly VisibleRow[];
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
    imperativeCallbacks: DataGridViewportImperativeCallbacks;
}
export interface DataGridViewportVirtualizationResult {
    scrollTop: number;
    lastScrollTopSample: number;
    pendingScrollTop: number | null;
    visibleRange: VisibleRangePayload;
    syncedScrollTop: number | null;
    timestamp: number;
    pendingScrollWrite: number | null;
}
export interface DataGridViewportVirtualizationPrepared {
    state: AxisVirtualizerState<undefined>;
    scrollTop: number;
    lastScrollTopSample: number;
    pendingScrollTop: number | null;
    visibleRange: VisibleRangePayload;
    syncedScrollTop: number | null;
    timestamp: number;
    pendingScrollWrite: number | null;
}
export interface DataGridViewportVirtualizationApplyArgs {
    resolveRow: (index: number) => VisibleRow | undefined;
    resolveRowsInRange?: (range: {
        start: number;
        end: number;
    }) => readonly VisibleRow[];
    imperativeCallbacks: DataGridViewportImperativeCallbacks;
}
export interface DataGridViewportVirtualization {
    resetOverscan(timestamp: number): void;
    resetScrollState(timestamp: number): void;
    clampScrollTop(value: number): number;
    prepare(args: DataGridViewportVirtualizationUpdateArgs): DataGridViewportVirtualizationPrepared | null;
    applyPrepared(prepared: DataGridViewportVirtualizationPrepared, applyArgs: DataGridViewportVirtualizationApplyArgs): DataGridViewportVirtualizationResult;
    update(args: DataGridViewportVirtualizationUpdateArgs): DataGridViewportVirtualizationResult | null;
}
export declare function createDataGridViewportVirtualization(options: DataGridViewportVirtualizationOptions): DataGridViewportVirtualization;
export {};
//# sourceMappingURL=dataGridViewportVirtualization.d.ts.map