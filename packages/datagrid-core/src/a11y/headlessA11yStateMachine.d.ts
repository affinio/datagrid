import type { DataGridRowId } from "../models/rowModel";
export type DataGridA11yKeyCommandKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End" | "PageUp" | "PageDown" | "Tab" | "Enter" | "Escape";
export interface DataGridA11yKeyboardCommand {
    key: DataGridA11yKeyCommandKey;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    pageSize?: number;
}
export interface DataGridA11yFocusCell {
    rowIndex: number;
    colIndex: number;
    rowId?: DataGridRowId;
    columnKey?: string;
}
export interface DataGridA11ySnapshot {
    rowCount: number;
    colCount: number;
    gridFocused: boolean;
    focusCell: DataGridA11yFocusCell | null;
    activeDescendantId: string | null;
}
export interface DataGridA11yGridAriaState {
    role: "grid";
    tabIndex: number;
    ariaRowCount: number;
    ariaColCount: number;
    ariaActiveDescendant: string | null;
    ariaMultiselectable: boolean;
}
export interface DataGridA11yCellAriaState {
    id: string;
    role: "gridcell";
    tabIndex: number;
    ariaRowIndex: number;
    ariaColIndex: number;
    ariaSelected: boolean;
}
export type DataGridA11yStateListener = (snapshot: DataGridA11ySnapshot) => void;
export interface CreateDataGridA11yStateMachineOptions {
    rowCount: number;
    colCount: number;
    idPrefix?: string;
    initialGridFocused?: boolean;
    initialFocusCell?: DataGridA11yFocusCell | null;
    resolveCellId?: (cell: DataGridA11yFocusCell) => string;
}
export interface DataGridA11yStateMachine {
    snapshot(): DataGridA11ySnapshot;
    setDimensions(rowCount: number, colCount: number): DataGridA11ySnapshot;
    setFocusCell(cell: DataGridA11yFocusCell | null): DataGridA11ySnapshot;
    focusGrid(focused: boolean): DataGridA11ySnapshot;
    dispatchKeyboard(command: DataGridA11yKeyboardCommand): DataGridA11ySnapshot;
    getGridAria(): DataGridA11yGridAriaState;
    getCellAria(cell: DataGridA11yFocusCell): DataGridA11yCellAriaState;
    subscribe(listener: DataGridA11yStateListener): () => void;
}
export declare function createDataGridA11yStateMachine(options: CreateDataGridA11yStateMachineOptions): DataGridA11yStateMachine;
//# sourceMappingURL=headlessA11yStateMachine.d.ts.map