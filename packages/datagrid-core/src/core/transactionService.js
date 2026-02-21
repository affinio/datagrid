function normalizeLabel(label) {
    if (typeof label !== "string") {
        return null;
    }
    const normalized = label.trim();
    return normalized.length > 0 ? normalized : null;
}
function normalizeId(candidate, fallback) {
    if (typeof candidate !== "string") {
        return fallback;
    }
    const normalized = candidate.trim();
    return normalized.length > 0 ? normalized : fallback;
}
function normalizeCommand(command) {
    if (!command || typeof command !== "object") {
        throw new Error("[DataGridTransaction] command must be an object.");
    }
    if (typeof command.type !== "string" || command.type.trim().length === 0) {
        throw new Error("[DataGridTransaction] command.type must be a non-empty string.");
    }
    if (!Object.prototype.hasOwnProperty.call(command, "rollbackPayload")) {
        throw new Error("[DataGridTransaction] command.rollbackPayload is required for rollback safety.");
    }
    return {
        type: command.type,
        payload: command.payload,
        rollbackPayload: command.rollbackPayload,
        meta: cloneTransactionMeta(command.meta),
    };
}
function normalizeIntent(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeIndex(value) {
    if (!Number.isFinite(value)) {
        return null;
    }
    return Math.max(0, Math.trunc(value));
}
function normalizeAffectedRange(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const range = value;
    const startRow = normalizeIndex(range.startRow);
    const endRow = normalizeIndex(range.endRow);
    const startColumn = normalizeIndex(range.startColumn);
    const endColumn = normalizeIndex(range.endColumn);
    if (startRow === null || endRow === null || startColumn === null || endColumn === null) {
        return null;
    }
    return {
        startRow: Math.min(startRow, endRow),
        endRow: Math.max(startRow, endRow),
        startColumn: Math.min(startColumn, endColumn),
        endColumn: Math.max(startColumn, endColumn),
    };
}
function normalizeTransactionMeta(meta) {
    if (!meta || typeof meta !== "object") {
        return null;
    }
    const intent = normalizeIntent(meta.intent);
    const affectedRange = normalizeAffectedRange(meta.affectedRange);
    if (!intent && !affectedRange) {
        return null;
    }
    return {
        ...(intent ? { intent } : {}),
        ...(affectedRange ? { affectedRange } : {}),
    };
}
function cloneTransactionMeta(meta) {
    const normalized = normalizeTransactionMeta(meta);
    if (!normalized) {
        return null;
    }
    return {
        ...(normalized.intent ? { intent: normalized.intent } : {}),
        ...(normalized.affectedRange
            ? {
                affectedRange: {
                    startRow: normalized.affectedRange.startRow,
                    endRow: normalized.affectedRange.endRow,
                    startColumn: normalized.affectedRange.startColumn,
                    endColumn: normalized.affectedRange.endColumn,
                },
            }
            : {}),
    };
}
function createError(message, cause) {
    const error = new Error(message);
    error.cause = cause;
    return error;
}
function normalizeHistoryDepth(value) {
    if (!Number.isFinite(value)) {
        return Number.POSITIVE_INFINITY;
    }
    const normalized = Math.max(0, Math.trunc(value));
    return normalized;
}
export function createDataGridTransactionService(options) {
    if (typeof options.execute !== "function") {
        throw new Error("[DataGridTransaction] execute(command, context) handler is required.");
    }
    const listeners = new Set();
    const undoStack = [];
    const redoStack = [];
    const execute = options.execute;
    const maxHistoryDepth = normalizeHistoryDepth(options.maxHistoryDepth);
    let disposed = false;
    let revision = 0;
    let autoTransactionId = 1;
    let autoBatchId = 1;
    let autoCommittedId = 1;
    let lastCommittedId = null;
    let pendingBatch = null;
    function ensureActive() {
        if (disposed) {
            throw new Error("DataGridTransactionService has been disposed");
        }
    }
    function materializeSnapshot() {
        return {
            revision,
            pendingBatch: pendingBatch
                ? {
                    id: pendingBatch.id,
                    label: pendingBatch.label,
                    size: pendingBatch.transactions.length,
                }
                : null,
            undoDepth: undoStack.length,
            redoDepth: redoStack.length,
            lastCommittedId,
        };
    }
    function emit() {
        if (disposed || listeners.size === 0) {
            return;
        }
        const snapshot = materializeSnapshot();
        for (const listener of listeners) {
            listener(snapshot);
        }
    }
    function bumpRevision() {
        revision += 1;
        emit();
    }
    function normalizeTransaction(input) {
        if (!Array.isArray(input.commands) || input.commands.length === 0) {
            throw new Error("[DataGridTransaction] transaction.commands must contain at least one command.");
        }
        const transactionId = normalizeId(input.id, `tx-${autoTransactionId}`);
        if (transactionId === `tx-${autoTransactionId}`) {
            autoTransactionId += 1;
        }
        return {
            id: transactionId,
            label: normalizeLabel(input.label),
            meta: cloneTransactionMeta(input.meta),
            commands: input.commands.map(command => normalizeCommand(command)),
        };
    }
    async function runCommand(command, context) {
        await execute(command, context);
    }
    async function rollbackAppliedCommands(transaction, appliedCommandIndexes, batchId) {
        for (let offset = appliedCommandIndexes.length - 1; offset >= 0; offset -= 1) {
            const commandIndex = appliedCommandIndexes[offset];
            const command = transaction.commands[commandIndex];
            await runCommand({
                type: command.type,
                payload: command.rollbackPayload,
                rollbackPayload: command.payload,
            }, {
                direction: "rollback",
                transactionId: transaction.id,
                transactionLabel: transaction.label,
                commandIndex,
                batchId,
            });
        }
    }
    async function applyOneTransaction(transaction, direction, batchId) {
        const appliedCommandIndexes = [];
        for (let commandIndex = 0; commandIndex < transaction.commands.length; commandIndex += 1) {
            const command = transaction.commands[commandIndex];
            try {
                await runCommand(command, {
                    direction,
                    transactionId: transaction.id,
                    transactionLabel: transaction.label,
                    commandIndex,
                    batchId,
                });
                appliedCommandIndexes.push(commandIndex);
            }
            catch (error) {
                try {
                    await rollbackAppliedCommands(transaction, appliedCommandIndexes, batchId);
                }
                catch (rollbackError) {
                    throw createError(`[DataGridTransaction] ${direction} failed and rollback failed for transaction "${transaction.id}".`, { applyError: error, rollbackError });
                }
                throw createError(`[DataGridTransaction] ${direction} failed for transaction "${transaction.id}".`, error);
            }
        }
    }
    async function rollbackOneTransaction(transaction, direction, batchId) {
        for (let commandIndex = transaction.commands.length - 1; commandIndex >= 0; commandIndex -= 1) {
            const command = transaction.commands[commandIndex];
            await runCommand({
                type: command.type,
                payload: command.rollbackPayload,
                rollbackPayload: command.payload,
            }, {
                direction,
                transactionId: transaction.id,
                transactionLabel: transaction.label,
                commandIndex,
                batchId,
            });
        }
    }
    async function applyCommittedBatch(committedBatch, direction) {
        const appliedTransactions = [];
        try {
            for (const transaction of committedBatch.transactions) {
                await applyOneTransaction(transaction, direction, committedBatch.batchId);
                appliedTransactions.push(transaction);
            }
        }
        catch (error) {
            for (let index = appliedTransactions.length - 1; index >= 0; index -= 1) {
                const transaction = appliedTransactions[index];
                await rollbackOneTransaction(transaction, "rollback", committedBatch.batchId);
            }
            throw error;
        }
    }
    async function rollbackCommittedBatch(committedBatch, direction) {
        for (let index = committedBatch.transactions.length - 1; index >= 0; index -= 1) {
            const transaction = committedBatch.transactions[index];
            await rollbackOneTransaction(transaction, direction, committedBatch.batchId);
        }
    }
    function createCommittedBatch(transactions, batchId, label) {
        const committedId = `commit-${autoCommittedId}`;
        autoCommittedId += 1;
        return {
            committedId,
            batchId,
            label,
            transactions: transactions.map(transaction => ({
                ...transaction,
                meta: cloneTransactionMeta(transaction.meta),
                commands: transaction.commands.map(command => ({ ...command })),
            })),
        };
    }
    function transactionIds(batch) {
        return batch.transactions.map(transaction => transaction.id);
    }
    function transactionEntries(batch) {
        return batch.transactions.map(transaction => ({
            id: transaction.id,
            label: transaction.label,
            meta: cloneTransactionMeta(transaction.meta),
        }));
    }
    function pushUndoBatch(batch) {
        if (maxHistoryDepth <= 0) {
            return;
        }
        undoStack.push(batch);
        if (undoStack.length <= maxHistoryDepth) {
            return;
        }
        const overflow = undoStack.length - maxHistoryDepth;
        if (overflow > 0) {
            undoStack.splice(0, overflow);
        }
    }
    return {
        getSnapshot() {
            return materializeSnapshot();
        },
        beginBatch(label) {
            ensureActive();
            if (pendingBatch) {
                throw new Error(`[DataGridTransaction] batch "${pendingBatch.id}" is already active. Commit or rollback it first.`);
            }
            const batchId = `batch-${autoBatchId}`;
            autoBatchId += 1;
            pendingBatch = {
                id: batchId,
                label: normalizeLabel(label),
                transactions: [],
            };
            bumpRevision();
            return batchId;
        },
        async commitBatch(batchId) {
            ensureActive();
            if (!pendingBatch) {
                return [];
            }
            if (typeof batchId === "string" && batchId !== pendingBatch.id) {
                throw new Error(`[DataGridTransaction] cannot commit batch "${batchId}". Active batch is "${pendingBatch.id}".`);
            }
            const batch = pendingBatch;
            pendingBatch = null;
            if (batch.transactions.length === 0) {
                bumpRevision();
                return [];
            }
            const committedBatch = createCommittedBatch(batch.transactions, batch.id, batch.label);
            try {
                await applyCommittedBatch(committedBatch, "apply");
            }
            catch (error) {
                bumpRevision();
                options.onRolledBack?.({
                    committedId: committedBatch.committedId,
                    batchId: committedBatch.batchId,
                    transactionIds: transactionIds(committedBatch),
                    transactions: transactionEntries(committedBatch),
                    error,
                });
                throw error;
            }
            pushUndoBatch(committedBatch);
            redoStack.length = 0;
            lastCommittedId = committedBatch.committedId;
            bumpRevision();
            options.onApplied?.({
                committedId: committedBatch.committedId,
                batchId: committedBatch.batchId,
                transactionIds: transactionIds(committedBatch),
                transactions: transactionEntries(committedBatch),
            });
            return transactionIds(committedBatch);
        },
        rollbackBatch(batchId) {
            ensureActive();
            if (!pendingBatch) {
                return [];
            }
            if (typeof batchId === "string" && batchId !== pendingBatch.id) {
                throw new Error(`[DataGridTransaction] cannot rollback batch "${batchId}". Active batch is "${pendingBatch.id}".`);
            }
            const transactionIdsInBatch = pendingBatch.transactions.map(transaction => transaction.id);
            pendingBatch = null;
            bumpRevision();
            return transactionIdsInBatch;
        },
        async applyTransaction(transactionInput) {
            ensureActive();
            const transaction = normalizeTransaction(transactionInput);
            if (pendingBatch) {
                pendingBatch.transactions.push(transaction);
                bumpRevision();
                return transaction.id;
            }
            const committedBatch = createCommittedBatch([transaction], null, transaction.label);
            try {
                await applyCommittedBatch(committedBatch, "apply");
            }
            catch (error) {
                options.onRolledBack?.({
                    committedId: committedBatch.committedId,
                    batchId: committedBatch.batchId,
                    transactionIds: transactionIds(committedBatch),
                    transactions: transactionEntries(committedBatch),
                    error,
                });
                throw error;
            }
            pushUndoBatch(committedBatch);
            redoStack.length = 0;
            lastCommittedId = committedBatch.committedId;
            bumpRevision();
            options.onApplied?.({
                committedId: committedBatch.committedId,
                batchId: committedBatch.batchId,
                transactionIds: transactionIds(committedBatch),
                transactions: transactionEntries(committedBatch),
            });
            return transaction.id;
        },
        canUndo() {
            return undoStack.length > 0;
        },
        canRedo() {
            return redoStack.length > 0;
        },
        async undo() {
            ensureActive();
            const committedBatch = undoStack[undoStack.length - 1];
            if (!committedBatch) {
                return null;
            }
            await rollbackCommittedBatch(committedBatch, "undo");
            undoStack.pop();
            redoStack.push(committedBatch);
            lastCommittedId = committedBatch.committedId;
            bumpRevision();
            options.onUndone?.({
                committedId: committedBatch.committedId,
                batchId: committedBatch.batchId,
                transactionIds: transactionIds(committedBatch),
                transactions: transactionEntries(committedBatch),
            });
            return committedBatch.committedId;
        },
        async redo() {
            ensureActive();
            const committedBatch = redoStack[redoStack.length - 1];
            if (!committedBatch) {
                return null;
            }
            await applyCommittedBatch(committedBatch, "redo");
            redoStack.pop();
            pushUndoBatch(committedBatch);
            lastCommittedId = committedBatch.committedId;
            bumpRevision();
            options.onRedone?.({
                committedId: committedBatch.committedId,
                batchId: committedBatch.batchId,
                transactionIds: transactionIds(committedBatch),
                transactions: transactionEntries(committedBatch),
            });
            return committedBatch.committedId;
        },
        subscribe(listener) {
            if (disposed) {
                return () => { };
            }
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            listeners.clear();
            undoStack.length = 0;
            redoStack.length = 0;
            pendingBatch = null;
            revision = 0;
            lastCommittedId = null;
        },
    };
}
