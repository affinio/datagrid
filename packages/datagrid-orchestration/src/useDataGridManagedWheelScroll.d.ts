export type DataGridWheelMode = "managed" | "native";
export type DataGridWheelAxisLockMode = "off" | "dominant" | "vertical-preferred" | "horizontal-preferred";
export type DataGridWheelPropagationMode = "retain" | "release-at-boundary-when-unconsumed" | "release-when-unconsumed";
export interface DataGridWheelAxisPolicy {
    applyX: boolean;
    applyY: boolean;
}
export interface DataGridManagedWheelBodyViewport {
    readonly scrollTop: number;
    readonly scrollHeight: number;
    readonly clientHeight: number;
}
export interface DataGridManagedWheelMainViewport {
    readonly scrollLeft: number;
    readonly scrollWidth: number;
    readonly clientWidth: number;
}
export interface DataGridWheelConsumptionResult {
    handled: boolean;
    handledX: boolean;
    handledY: boolean;
    consumed: boolean;
    consumedX: boolean;
    consumedY: boolean;
    atBoundaryX: boolean;
    atBoundaryY: boolean;
}
export interface UseDataGridManagedWheelScrollOptions {
    resolveWheelMode?: () => DataGridWheelMode;
    resolveWheelAxisLockMode?: () => DataGridWheelAxisLockMode;
    resolvePreventDefaultWhenHandled?: () => boolean;
    resolveStopImmediatePropagation?: () => boolean;
    resolveWheelPropagationMode?: () => DataGridWheelPropagationMode;
    resolveShouldPropagateWheelEvent?: (result: DataGridWheelConsumptionResult) => boolean;
    /** @deprecated Use resolvePreventDefaultWhenHandled */
    resolvePreventDefaultWhenConsumed?: () => boolean;
    resolveMinDeltaToApply?: () => number;
    resolveWheelPageSizeY?: () => number;
    resolveWheelPageSizeX?: () => number;
    resolveBodyViewport: () => DataGridManagedWheelBodyViewport | null;
    resolveMainViewport?: () => DataGridManagedWheelMainViewport | null;
    setHandledScrollTop: (value: number) => void;
    setHandledScrollLeft?: (value: number) => void;
    syncLinkedScroll?: (scrollTop: number) => void;
    scheduleLinkedScrollSyncLoop?: () => void;
    isLinkedScrollSyncLoopScheduled?: () => boolean;
    onWheelConsumed?: () => void;
}
export interface UseDataGridManagedWheelScrollResult {
    applyWheelToViewports: (event: WheelEvent) => DataGridWheelConsumptionResult;
    onLinkedViewportWheel: (event: WheelEvent) => void;
    onBodyViewportWheel: (event: WheelEvent) => void;
    reset: () => void;
}
export declare function normalizeDataGridWheelDelta(delta: number, deltaMode: number, pageSize: number): number;
export declare function resolveDataGridWheelAxisPolicy(deltaX: number, deltaY: number, mode: DataGridWheelAxisLockMode): DataGridWheelAxisPolicy;
export declare function resolveDataGridWheelPropagationDecision(result: DataGridWheelConsumptionResult, mode: DataGridWheelPropagationMode): boolean;
export declare function useDataGridManagedWheelScroll(options: UseDataGridManagedWheelScrollOptions): UseDataGridManagedWheelScrollResult;
//# sourceMappingURL=useDataGridManagedWheelScroll.d.ts.map