import type { AxisVirtualizer, AxisVirtualizerState } from "../virtualization/axisVirtualizer";
import type { HorizontalOverscanController } from "../virtualization/dynamicOverscan";
import type { ColumnVirtualizationSnapshot } from "../virtualization/columnSnapshot";
import type { HorizontalVirtualizerMeta, HorizontalVirtualizerPayload } from "../virtualization/horizontalVirtualizer";
import type { DataGridColumn } from "../types";
import type { DataGridViewportHorizontalMeta } from "./dataGridViewportHorizontalMeta";
import type { ImperativeColumnUpdatePayload } from "./dataGridViewportTypes";
export interface HorizontalUpdateCallbacks {
    applyColumnSnapshot: (meta: DataGridViewportHorizontalMeta, start: number, end: number, payload: HorizontalVirtualizerPayload) => void;
    logHorizontalDebug?: (details: {
        scrollLeft: number;
        deltaLeft: number;
        overscanColumns: number;
        horizontalOverscan: number;
        velocity: number;
        direction: number;
        horizontalState: AxisVirtualizerState<HorizontalVirtualizerPayload>;
        columnMeta: DataGridViewportHorizontalMeta;
        virtualizationEnabled: boolean;
    }) => void;
    onColumns?: (payload: ImperativeColumnUpdatePayload) => void;
}
export interface HorizontalUpdatePrepared {
    shouldUpdate: boolean;
    scrollLeftValue: number;
    syncScrollLeftValue: number | null;
    smoothedHorizontalVelocity: number;
    horizontalOverscan: number;
    lastHorizontalSampleTime: number;
    lastScrollDirection: number;
    lastScrollLeftSample: number;
    lastAppliedHorizontalMetaVersion: number;
    pendingScrollWrite: number | null;
    columnSnapshot?: {
        meta: DataGridViewportHorizontalMeta;
        start: number;
        end: number;
        payload: HorizontalVirtualizerPayload;
    };
    debugPayload?: {
        scrollLeft: number;
        deltaLeft: number;
        overscanColumns: number;
        horizontalOverscan: number;
        velocity: number;
        direction: number;
        horizontalState: AxisVirtualizerState<HorizontalVirtualizerPayload>;
        columnMeta: DataGridViewportHorizontalMeta;
        virtualizationEnabled: boolean;
    };
    columnCallbackPayload?: ImperativeColumnUpdatePayload;
}
export interface HorizontalUpdateParams {
    columnMeta: DataGridViewportHorizontalMeta;
    horizontalVirtualizer: AxisVirtualizer<HorizontalVirtualizerMeta<DataGridColumn>, HorizontalVirtualizerPayload>;
    horizontalOverscanController: HorizontalOverscanController;
    callbacks: HorizontalUpdateCallbacks;
    columnSnapshot: ColumnVirtualizationSnapshot<DataGridColumn>;
    layoutScale: number;
    viewportWidth: number;
    nowTs: number;
    frameTimeValue: number;
    averageColumnWidth: number;
    scrollDirection: number;
    horizontalVirtualizationEnabled: boolean;
    horizontalUpdateForced: boolean;
    currentPendingLeft: number;
    previousScrollLeftSample: number;
    deltaLeft: number;
    horizontalScrollEpsilon: number;
    pendingScrollLeftRequest: number | null;
    measuredScrollLeftFromPending: boolean;
    currentScrollLeftMeasurement: number;
    smoothedHorizontalVelocity: number;
    lastHorizontalSampleTime: number;
    horizontalOverscan: number;
    lastAppliedHorizontalMetaVersion: number;
}
export interface HorizontalUpdateResult {
    shouldUpdate: boolean;
    scrollLeftValue: number;
    syncScrollLeftValue: number | null;
    smoothedHorizontalVelocity: number;
    horizontalOverscan: number;
    lastHorizontalSampleTime: number;
    lastScrollDirection: number;
    lastScrollLeftSample: number;
    lastAppliedHorizontalMetaVersion: number;
}
export declare function prepareHorizontalViewport(params: HorizontalUpdateParams): HorizontalUpdatePrepared;
export interface HorizontalViewportApplyArgs {
    callbacks: HorizontalUpdateCallbacks;
    prepared: HorizontalUpdatePrepared;
}
export declare function applyHorizontalViewport({ callbacks, prepared }: HorizontalViewportApplyArgs): void;
//# sourceMappingURL=dataGridViewportHorizontalUpdate.d.ts.map