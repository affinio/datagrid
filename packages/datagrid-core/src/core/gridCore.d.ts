import type { DataGridColumnModel, DataGridEditModel, DataGridRowModel, DataGridViewportRange } from "../models";
import type { DataGridSelectionSnapshot } from "../selection/snapshot";
import type { DataGridTransactionInput, DataGridTransactionSnapshot } from "./transactionService";
export type DataGridCoreServiceName = "event" | "rowModel" | "columnModel" | "edit" | "transaction" | "selection" | "viewport";
export type DataGridCoreLifecycleState = "idle" | "initialized" | "started" | "stopped" | "disposed";
export interface DataGridCoreService {
    readonly name: DataGridCoreServiceName;
    init?(context: DataGridCoreServiceContext): void | Promise<void>;
    start?(context: DataGridCoreServiceContext): void | Promise<void>;
    stop?(context: DataGridCoreServiceContext): void | Promise<void>;
    dispose?(context: DataGridCoreServiceContext): void | Promise<void>;
}
export interface DataGridCoreEventService extends DataGridCoreService {
    readonly name: "event";
}
export interface DataGridCoreRowModelService<TRow = unknown> extends DataGridCoreService {
    readonly name: "rowModel";
    model?: DataGridRowModel<TRow>;
}
export interface DataGridCoreColumnModelService extends DataGridCoreService {
    readonly name: "columnModel";
    model?: DataGridColumnModel;
}
export interface DataGridCoreEditService extends DataGridCoreService {
    readonly name: "edit";
    model?: DataGridEditModel;
}
export interface DataGridCoreTransactionService extends DataGridCoreService {
    readonly name: "transaction";
    getTransactionSnapshot?(): DataGridTransactionSnapshot;
    beginTransactionBatch?(label?: string): string;
    commitTransactionBatch?(batchId?: string): Promise<readonly string[]>;
    rollbackTransactionBatch?(batchId?: string): readonly string[];
    applyTransaction?(transaction: DataGridTransactionInput): Promise<string>;
    canUndoTransaction?(): boolean;
    canRedoTransaction?(): boolean;
    undoTransaction?(): Promise<string | null>;
    redoTransaction?(): Promise<string | null>;
}
export interface DataGridCoreSelectionService extends DataGridCoreService {
    readonly name: "selection";
    getSelectionSnapshot?(): DataGridSelectionSnapshot | null;
    setSelectionSnapshot?(snapshot: DataGridSelectionSnapshot): void;
    clearSelection?(): void;
}
export interface DataGridCoreViewportService extends DataGridCoreService {
    readonly name: "viewport";
    getViewportRange?(): DataGridViewportRange;
    setViewportRange?(range: DataGridViewportRange): void;
}
export interface DataGridCoreServiceByName {
    event: DataGridCoreEventService;
    rowModel: DataGridCoreRowModelService;
    columnModel: DataGridCoreColumnModelService;
    edit: DataGridCoreEditService;
    transaction: DataGridCoreTransactionService;
    selection: DataGridCoreSelectionService;
    viewport: DataGridCoreViewportService;
}
export type DataGridCoreServiceRegistry = DataGridCoreServiceByName;
export interface DataGridCoreServiceContext {
    readonly state: DataGridCoreLifecycleState;
    getService<TName extends DataGridCoreServiceName>(name: TName): DataGridCoreServiceByName[TName];
}
export interface CreateDataGridCoreOptions {
    services?: Partial<DataGridCoreServiceRegistry>;
    startupOrder?: readonly DataGridCoreServiceName[];
}
export interface DataGridCore {
    readonly lifecycle: {
        readonly state: DataGridCoreLifecycleState;
        readonly startupOrder: readonly DataGridCoreServiceName[];
    };
    readonly services: DataGridCoreServiceRegistry;
    init(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
    getService<TName extends DataGridCoreServiceName>(name: TName): DataGridCoreServiceByName[TName];
}
export declare function createDataGridCore(options?: CreateDataGridCoreOptions): DataGridCore;
//# sourceMappingURL=gridCore.d.ts.map