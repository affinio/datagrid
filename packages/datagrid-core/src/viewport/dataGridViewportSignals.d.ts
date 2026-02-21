import type { DataGridColumn, VisibleRow } from "../types";
import type { ColumnMetric } from "../virtualization/columnSnapshot";
import type { WritableSignal } from "../runtime/signals";
export interface RowPoolItem {
    poolIndex: number;
    entry: VisibleRow | null;
    displayIndex: number;
    rowIndex: number;
}
export interface DataGridViewportState {
    startIndex: number;
    endIndex: number;
    visibleCount: number;
    poolSize: number;
    totalRowCount: number;
    overscanLeading: number;
    overscanTrailing: number;
}
export interface DataGridViewportInputSignals {
    scrollTop: WritableSignal<number>;
    scrollLeft: WritableSignal<number>;
    viewportHeight: WritableSignal<number>;
    viewportWidth: WritableSignal<number>;
    virtualizationEnabled: WritableSignal<boolean>;
}
export interface DataGridViewportCoreSignals {
    totalRowCount: WritableSignal<number>;
    effectiveRowHeight: WritableSignal<number>;
    visibleCount: WritableSignal<number>;
    poolSize: WritableSignal<number>;
    totalContentHeight: WritableSignal<number>;
    startIndex: WritableSignal<number>;
    endIndex: WritableSignal<number>;
    overscanLeading: WritableSignal<number>;
    overscanTrailing: WritableSignal<number>;
}
export interface DataGridViewportDerivedRowSignals {
    visibleRange: WritableSignal<{
        start: number;
        end: number;
    }>;
}
export interface DataGridViewportDerivedColumnSignals {
    visibleColumns: WritableSignal<DataGridColumn[]>;
    visibleColumnEntries: WritableSignal<ColumnMetric<DataGridColumn>[]>;
    visibleScrollableColumns: WritableSignal<DataGridColumn[]>;
    visibleScrollableEntries: WritableSignal<ColumnMetric<DataGridColumn>[]>;
    pinnedLeftColumns: WritableSignal<DataGridColumn[]>;
    pinnedLeftEntries: WritableSignal<ColumnMetric<DataGridColumn>[]>;
    pinnedRightColumns: WritableSignal<DataGridColumn[]>;
    pinnedRightEntries: WritableSignal<ColumnMetric<DataGridColumn>[]>;
    leftPadding: WritableSignal<number>;
    rightPadding: WritableSignal<number>;
    columnWidthMap: WritableSignal<Map<string, number>>;
    visibleStartCol: WritableSignal<number>;
    visibleEndCol: WritableSignal<number>;
    scrollableRange: WritableSignal<{
        start: number;
        end: number;
    }>;
    columnVirtualState: WritableSignal<{
        start: number;
        end: number;
        visibleStart: number;
        visibleEnd: number;
        overscanLeading: number;
        overscanTrailing: number;
        poolSize: number;
        visibleCount: number;
        totalCount: number;
        indexColumnWidth: number;
        pinnedRightWidth: number;
    }>;
}
export interface DataGridViewportMetricSignals {
    debugMode: WritableSignal<boolean>;
    fps: WritableSignal<number>;
    frameTime: WritableSignal<number>;
    droppedFrames: WritableSignal<number>;
    layoutReads: WritableSignal<number>;
    layoutWrites: WritableSignal<number>;
    syncScrollRate: WritableSignal<number>;
    heavyUpdateRate: WritableSignal<number>;
    virtualizerUpdates: WritableSignal<number>;
    virtualizerSkips: WritableSignal<number>;
}
export interface DataGridViewportDerivedSignals {
    rows: DataGridViewportDerivedRowSignals;
    columns: DataGridViewportDerivedColumnSignals;
    metrics: DataGridViewportMetricSignals;
}
export interface DataGridViewportSignals {
    input: DataGridViewportInputSignals;
    core: DataGridViewportCoreSignals;
    derived: DataGridViewportDerivedSignals;
    dispose(): void;
}
export type SignalFactory = <T>(initial: T) => WritableSignal<T>;
export declare function createDataGridViewportSignals(createSignal: SignalFactory): DataGridViewportSignals;
//# sourceMappingURL=dataGridViewportSignals.d.ts.map