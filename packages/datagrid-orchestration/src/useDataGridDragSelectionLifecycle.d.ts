export interface UseDataGridDragSelectionLifecycleOptions<TCoord = {
    rowIndex: number;
    columnIndex: number;
}> {
    setDragSelecting: (value: boolean) => void;
    clearDragPointer: () => void;
    clearLastDragCoord: () => void;
    stopAutoScrollFrameIfIdle: () => void;
    resolveLastDragCoord?: () => TCoord | null;
}
export interface UseDataGridDragSelectionLifecycleResult {
    stopDragSelection: () => void;
}
export declare function useDataGridDragSelectionLifecycle<TCoord = {
    rowIndex: number;
    columnIndex: number;
}>(options: UseDataGridDragSelectionLifecycleOptions<TCoord>): UseDataGridDragSelectionLifecycleResult;
//# sourceMappingURL=useDataGridDragSelectionLifecycle.d.ts.map