export interface ViewportFrameBudget {
    frameDurationMs: number;
    minVelocitySampleMs: number;
    teleportMultiplier: number;
}
export interface AxisVirtualizationConstants {
    scrollEpsilon: number;
    minOverscan: number;
    edgePadding: number;
    velocityOverscanRatio: number;
    viewportOverscanRatio: number;
    overscanDecay: number;
    maxViewportMultiplier: number;
}
export interface TableVirtualizationConstants {
    frame: ViewportFrameBudget;
    vertical: AxisVirtualizationConstants;
    horizontal: AxisVirtualizationConstants;
}
export declare const DEFAULT_TABLE_VIRTUALIZATION_CONSTANTS: TableVirtualizationConstants;
export declare const FRAME_BUDGET_CONSTANTS: ViewportFrameBudget;
export declare const VERTICAL_VIRTUALIZATION_CONSTANTS: AxisVirtualizationConstants;
export declare const HORIZONTAL_VIRTUALIZATION_CONSTANTS: AxisVirtualizationConstants;
//# sourceMappingURL=dataGridViewportConstants.d.ts.map