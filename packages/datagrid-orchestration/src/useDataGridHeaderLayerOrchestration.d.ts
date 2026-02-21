export interface DataGridHeaderLayerViewportGeometryInput {
    headerViewportHeight: number;
    bodyViewportWidth: number;
    bodyViewportHeight: number;
}
export interface DataGridHeaderLayerViewportGeometry {
    overlayTop: number;
    overlayWidth: number;
    overlayHeight: number;
}
export declare function resolveDataGridHeaderScrollSyncLeft(headerScrollLeft: number, bodyScrollLeft: number): number;
export declare function resolveDataGridHeaderLayerViewportGeometry(input: DataGridHeaderLayerViewportGeometryInput): DataGridHeaderLayerViewportGeometry;
//# sourceMappingURL=useDataGridHeaderLayerOrchestration.d.ts.map