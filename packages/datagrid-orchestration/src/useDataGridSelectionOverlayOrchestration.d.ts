export interface DataGridOverlayRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridOverlayColumnLike {
    pin?: string | null;
}
export interface DataGridOverlayColumnMetricLike {
    start: number;
    end: number;
}
export interface DataGridSelectionOverlaySegment {
    key: string;
    mode: "scroll";
    style: {
        top: string;
        left: string;
        width: string;
        height: string;
    };
}
export interface DataGridSelectionOverlayVirtualWindow {
    rowStart?: number;
    rowEnd?: number;
    rowTotal: number;
    colStart?: number;
    colEnd?: number;
    colTotal: number;
    overscan?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
}
export interface UseDataGridSelectionOverlayOrchestrationOptions {
    headerHeight: number;
    rowHeight: number;
    resolveRowHeight?: (rowIndex: number) => number;
    resolveRowOffset?: (rowIndex: number) => number;
    orderedColumns: readonly DataGridOverlayColumnLike[];
    orderedColumnMetrics: readonly DataGridOverlayColumnMetricLike[];
    cellSelectionRange: DataGridOverlayRange | null;
    fillPreviewRange: DataGridOverlayRange | null;
    fillBaseRange: DataGridOverlayRange | null;
    rangeMovePreviewRange: DataGridOverlayRange | null;
    rangeMoveBaseRange: DataGridOverlayRange | null;
    isRangeMoving: boolean;
    virtualWindow: DataGridSelectionOverlayVirtualWindow;
    resolveDevicePixelRatio?: () => number;
}
export interface DataGridSelectionOverlaySnapshot {
    cellSelectionOverlaySegments: readonly DataGridSelectionOverlaySegment[];
    fillPreviewOverlaySegments: readonly DataGridSelectionOverlaySegment[];
    rangeMoveOverlaySegments: readonly DataGridSelectionOverlaySegment[];
}
export declare function useDataGridSelectionOverlayOrchestration(options: UseDataGridSelectionOverlayOrchestrationOptions): DataGridSelectionOverlaySnapshot;
//# sourceMappingURL=useDataGridSelectionOverlayOrchestration.d.ts.map