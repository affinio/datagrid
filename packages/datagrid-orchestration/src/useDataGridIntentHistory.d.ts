import type { DataGridCoreTransactionService } from "@affino/datagrid-core";
import { type DataGridTransactionAffectedRange, type DataGridTransactionSnapshot } from "@affino/datagrid-core/advanced";
export interface DataGridIntentTransactionDescriptor {
    intent: string;
    label: string;
    affectedRange?: DataGridTransactionAffectedRange | null;
}
export interface UseDataGridIntentHistoryOptions<TSnapshot> {
    captureSnapshot: () => TSnapshot;
    applySnapshot: (snapshot: TSnapshot) => void;
    maxHistoryDepth?: number;
    logger?: Pick<Console, "error">;
}
export interface UseDataGridIntentHistoryResult<TSnapshot> {
    transactionService: DataGridCoreTransactionService;
    getTransactionSnapshot: () => DataGridTransactionSnapshot;
    canUndo: () => boolean;
    canRedo: () => boolean;
    subscribeSnapshot: (listener: (snapshot: DataGridTransactionSnapshot) => void) => () => void;
    recordIntentTransaction: (descriptor: DataGridIntentTransactionDescriptor, beforeSnapshot: TSnapshot) => Promise<string | null>;
    runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>;
    dispose: () => void;
}
export declare function useDataGridIntentHistory<TSnapshot>(options: UseDataGridIntentHistoryOptions<TSnapshot>): UseDataGridIntentHistoryResult<TSnapshot>;
//# sourceMappingURL=useDataGridIntentHistory.d.ts.map