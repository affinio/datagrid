import { createDataGridTransactionService, } from "@affino/datagrid-core/advanced";
export function useDataGridIntentHistory(options) {
    let transactionIntentCounter = 0;
    const service = createDataGridTransactionService({
        maxHistoryDepth: options.maxHistoryDepth,
        execute(command, context) {
            if (context.direction === "apply") {
                return;
            }
            options.applySnapshot(command.payload);
        },
    });
    let transactionSnapshot = service.getSnapshot();
    const listeners = new Set();
    const unsubscribe = service.subscribe(nextSnapshot => {
        transactionSnapshot = nextSnapshot;
        listeners.forEach(listener => listener(nextSnapshot));
    });
    let disposed = false;
    function subscribeSnapshot(listener) {
        if (disposed) {
            return () => undefined;
        }
        listeners.add(listener);
        listener(transactionSnapshot);
        return () => {
            listeners.delete(listener);
        };
    }
    function dispose() {
        if (disposed) {
            return;
        }
        disposed = true;
        listeners.clear();
        unsubscribe();
        service.dispose();
    }
    const transactionService = {
        name: "transaction",
        getTransactionSnapshot: service.getSnapshot,
        beginTransactionBatch: service.beginBatch,
        commitTransactionBatch: service.commitBatch,
        rollbackTransactionBatch: service.rollbackBatch,
        applyTransaction: service.applyTransaction,
        canUndoTransaction: service.canUndo,
        canRedoTransaction: service.canRedo,
        undoTransaction: service.undo,
        redoTransaction: service.redo,
        dispose,
    };
    function canUndo() {
        return transactionSnapshot.undoDepth > 0;
    }
    function canRedo() {
        return transactionSnapshot.redoDepth > 0;
    }
    async function recordIntentTransaction(descriptor, beforeSnapshot) {
        if (disposed) {
            return null;
        }
        const afterSnapshot = options.captureSnapshot();
        transactionIntentCounter += 1;
        const normalizedIntent = descriptor.intent.trim() || "intent";
        const transactionId = `intent-${normalizedIntent}-${transactionIntentCounter}`;
        const meta = {
            intent: normalizedIntent,
            affectedRange: descriptor.affectedRange ?? null,
        };
        try {
            return await service.applyTransaction({
                id: transactionId,
                label: descriptor.label,
                meta,
                commands: [
                    {
                        type: `grid-state.${normalizedIntent}`,
                        payload: afterSnapshot,
                        rollbackPayload: beforeSnapshot,
                        meta,
                    },
                ],
            });
        }
        catch (error) {
            options.logger?.error?.("[DataGrid] failed to record transaction intent", error);
            return null;
        }
    }
    async function runHistoryAction(direction) {
        if (disposed) {
            return null;
        }
        if (direction === "undo") {
            return service.undo();
        }
        return service.redo();
    }
    return {
        transactionService,
        getTransactionSnapshot: () => transactionSnapshot,
        canUndo,
        canRedo,
        subscribeSnapshot,
        recordIntentTransaction,
        runHistoryAction,
        dispose,
    };
}
