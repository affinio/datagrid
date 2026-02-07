import type { UiTableColumn, VisibleRow } from "../types";
import type { ColumnMetric } from "../virtualization/columnSnapshot";
import type { WritableSignal } from "../runtime/signals";
export interface RowPoolItem {
    poolIndex: number;
    entry: VisibleRow | null;
    displayIndex: number;
    rowIndex: number;
}
export interface TableViewportState {
    startIndex: number;
    endIndex: number;
    visibleCount: number;
    poolSize: number;
    totalRowCount: number;
    overscanLeading: number;
    overscanTrailing: number;
}
export interface TableViewportInputSignals {
    scrollTop: WritableSignal<number>;
    scrollLeft: WritableSignal<number>;
    viewportHeight: WritableSignal<number>;
    viewportWidth: WritableSignal<number>;
    virtualizationEnabled: WritableSignal<boolean>;
}
export interface TableViewportCoreSignals {
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
export interface TableViewportDerivedRowSignals {
    visibleRange: WritableSignal<{
        start: number;
        end: number;
    }>;
}
export interface TableViewportDerivedColumnSignals {
    visibleColumns: WritableSignal<UiTableColumn[]>;
    visibleColumnEntries: WritableSignal<ColumnMetric<UiTableColumn>[]>;
    visibleScrollableColumns: WritableSignal<UiTableColumn[]>;
    visibleScrollableEntries: WritableSignal<ColumnMetric<UiTableColumn>[]>;
    pinnedLeftColumns: WritableSignal<UiTableColumn[]>;
    pinnedLeftEntries: WritableSignal<ColumnMetric<UiTableColumn>[]>;
    pinnedRightColumns: WritableSignal<UiTableColumn[]>;
    pinnedRightEntries: WritableSignal<ColumnMetric<UiTableColumn>[]>;
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
export interface TableViewportMetricSignals {
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
export interface TableViewportDerivedSignals {
    rows: TableViewportDerivedRowSignals;
    columns: TableViewportDerivedColumnSignals;
    metrics: TableViewportMetricSignals;
}
export interface TableViewportSignals {
    input: TableViewportInputSignals;
    core: TableViewportCoreSignals;
    derived: TableViewportDerivedSignals;
    dispose(): void;
}
export type SignalFactory = <T>(initial: T) => WritableSignal<T>;
export declare function createTableViewportSignals(createSignal: SignalFactory): TableViewportSignals;
//# sourceMappingURL=tableViewportSignals.d.ts.map