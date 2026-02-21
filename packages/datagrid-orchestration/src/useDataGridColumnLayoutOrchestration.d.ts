export interface DataGridColumnLayoutColumn {
    key: string;
    pin?: string | null;
}
export interface DataGridColumnLayoutMetric {
    key: string;
    columnIndex: number;
    start: number;
    width: number;
    end: number;
}
export interface DataGridVisibleColumnsWindow {
    start: number;
    end: number;
    total: number;
    keys: string;
}
export interface DataGridVirtualWindowColumnSnapshot {
    rowStart?: number;
    rowEnd?: number;
    rowTotal?: number;
    colStart: number;
    colEnd: number;
    colTotal: number;
    overscan?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
}
export type DataGridColumnLayerKey = "left" | "scroll" | "right";
export interface DataGridColumnLayer<TColumn extends DataGridColumnLayoutColumn> {
    key: DataGridColumnLayerKey;
    columns: readonly TColumn[];
    templateColumns: string;
    width: number;
}
export interface UseDataGridColumnLayoutOrchestrationOptions<TColumn extends DataGridColumnLayoutColumn> {
    columns: readonly TColumn[];
    resolveColumnWidth: (column: TColumn) => number;
    virtualWindow: DataGridVirtualWindowColumnSnapshot;
}
export interface DataGridColumnLayoutSnapshot<TColumn extends DataGridColumnLayoutColumn> {
    orderedColumns: readonly TColumn[];
    orderedColumnMetrics: readonly DataGridColumnLayoutMetric[];
    templateColumns: string;
    stickyLeftOffsets: Map<string, number>;
    stickyRightOffsets: Map<string, number>;
    visibleColumnsWindow: DataGridVisibleColumnsWindow;
}
export declare function orderDataGridColumns<TColumn extends DataGridColumnLayoutColumn>(columns: readonly TColumn[]): readonly TColumn[];
export declare function buildDataGridColumnMetrics<TColumn extends DataGridColumnLayoutColumn>(columns: readonly TColumn[], resolveColumnWidth: (column: TColumn) => number): readonly DataGridColumnLayoutMetric[];
export declare function resolveDataGridColumnCellStyle(snapshot: DataGridColumnLayoutSnapshot<DataGridColumnLayoutColumn>, columnKey: string): Record<string, string>;
export declare function isDataGridStickyColumn(snapshot: DataGridColumnLayoutSnapshot<DataGridColumnLayoutColumn>, columnKey: string): boolean;
export declare function buildDataGridColumnLayers<TColumn extends DataGridColumnLayoutColumn>(snapshot: DataGridColumnLayoutSnapshot<TColumn>): readonly DataGridColumnLayer<TColumn>[];
export declare function resolveDataGridLayerTrackTemplate<TColumn extends DataGridColumnLayoutColumn>(layers: readonly DataGridColumnLayer<TColumn>[]): string;
export declare function useDataGridColumnLayoutOrchestration<TColumn extends DataGridColumnLayoutColumn>(options: UseDataGridColumnLayoutOrchestrationOptions<TColumn>): DataGridColumnLayoutSnapshot<TColumn>;
//# sourceMappingURL=useDataGridColumnLayoutOrchestration.d.ts.map