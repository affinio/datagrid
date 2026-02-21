export type DataGridTransactionDirection = "apply" | "rollback" | "undo" | "redo";
export interface DataGridTransactionAffectedRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridTransactionMeta {
    intent?: string;
    affectedRange?: DataGridTransactionAffectedRange | null;
}
export interface DataGridTransactionCommand {
    type: string;
    payload: unknown;
    rollbackPayload: unknown;
    meta?: DataGridTransactionMeta | null;
}
export interface DataGridTransactionInput {
    id?: string;
    label?: string;
    meta?: DataGridTransactionMeta | null;
    commands: readonly DataGridTransactionCommand[];
}
export interface DataGridTransactionSnapshot {
    revision: number;
    pendingBatch: DataGridTransactionPendingBatchSnapshot | null;
    undoDepth: number;
    redoDepth: number;
    lastCommittedId: string | null;
}
export interface DataGridTransactionPendingBatchSnapshot {
    id: string;
    label: string | null;
    size: number;
}
export interface DataGridTransactionExecutionContext {
    direction: DataGridTransactionDirection;
    transactionId: string;
    transactionLabel: string | null;
    commandIndex: number;
    batchId: string | null;
}
export type DataGridTransactionExecutor = (command: DataGridTransactionCommand, context: DataGridTransactionExecutionContext) => void | Promise<void>;
export interface DataGridTransactionAppliedEvent {
    committedId: string;
    batchId: string | null;
    transactionIds: readonly string[];
    transactions: readonly DataGridTransactionEventEntry[];
}
export interface DataGridTransactionRolledBackEvent {
    committedId: string;
    batchId: string | null;
    transactionIds: readonly string[];
    transactions: readonly DataGridTransactionEventEntry[];
    error: unknown;
}
export interface DataGridTransactionHistoryEvent {
    committedId: string;
    batchId: string | null;
    transactionIds: readonly string[];
    transactions: readonly DataGridTransactionEventEntry[];
}
export interface DataGridTransactionServiceHooks {
    onApplied?(event: DataGridTransactionAppliedEvent): void;
    onRolledBack?(event: DataGridTransactionRolledBackEvent): void;
    onUndone?(event: DataGridTransactionHistoryEvent): void;
    onRedone?(event: DataGridTransactionHistoryEvent): void;
}
export interface CreateDataGridTransactionServiceOptions extends DataGridTransactionServiceHooks {
    execute: DataGridTransactionExecutor;
    maxHistoryDepth?: number;
}
export type DataGridTransactionListener = (snapshot: DataGridTransactionSnapshot) => void;
export interface DataGridTransactionService {
    getSnapshot(): DataGridTransactionSnapshot;
    beginBatch(label?: string): string;
    commitBatch(batchId?: string): Promise<readonly string[]>;
    rollbackBatch(batchId?: string): readonly string[];
    applyTransaction(transaction: DataGridTransactionInput): Promise<string>;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): Promise<string | null>;
    redo(): Promise<string | null>;
    subscribe(listener: DataGridTransactionListener): () => void;
    dispose(): void;
}
export interface DataGridTransactionEventEntry {
    id: string;
    label: string | null;
    meta: DataGridTransactionMeta | null;
}
export declare function createDataGridTransactionService(options: CreateDataGridTransactionServiceOptions): DataGridTransactionService;
//# sourceMappingURL=transactionService.d.ts.map