export interface DataGridOverlayTransformInput {
    viewportWidth: number;
    viewportHeight: number;
    scrollLeft: number;
    scrollTop: number;
    pinnedOffsetLeft?: number;
    pinnedOffsetRight?: number;
}
export interface DataGridOverlayTransform {
    transform: string;
    clipPath: string;
    willChange: "transform";
}
export declare function buildDataGridOverlayTransform(input: DataGridOverlayTransformInput): DataGridOverlayTransform;
export declare function buildDataGridOverlayTransformFromSnapshot(snapshot: DataGridOverlayTransformInput): DataGridOverlayTransform;
//# sourceMappingURL=selectionOverlayTransform.d.ts.map