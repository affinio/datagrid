import type { DataGridRowModelListener, DataGridRowModelSnapshot } from "./rowModel.js";
export interface DataGridClientRowLifecycle<T> {
    ensureActive: () => void;
    emit: (getSnapshot: () => DataGridRowModelSnapshot<T>) => void;
    subscribe: (listener: DataGridRowModelListener<T>) => () => void;
    dispose: () => boolean;
    isDisposed: () => boolean;
}
export declare function createClientRowLifecycle<T>(): DataGridClientRowLifecycle<T>;
//# sourceMappingURL=clientRowLifecycle.d.ts.map