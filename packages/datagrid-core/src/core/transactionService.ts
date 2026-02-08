export type DataGridTransactionDirection = "apply" | "rollback" | "undo" | "redo"

export interface DataGridTransactionCommand {
  type: string
  payload: unknown
  rollbackPayload: unknown
}

export interface DataGridTransactionInput {
  id?: string
  label?: string
  commands: readonly DataGridTransactionCommand[]
}

export interface DataGridTransactionSnapshot {
  revision: number
  pendingBatch: DataGridTransactionPendingBatchSnapshot | null
  undoDepth: number
  redoDepth: number
  lastCommittedId: string | null
}

export interface DataGridTransactionPendingBatchSnapshot {
  id: string
  label: string | null
  size: number
}

export interface DataGridTransactionExecutionContext {
  direction: DataGridTransactionDirection
  transactionId: string
  transactionLabel: string | null
  commandIndex: number
  batchId: string | null
}

export type DataGridTransactionExecutor = (
  command: DataGridTransactionCommand,
  context: DataGridTransactionExecutionContext,
) => void | Promise<void>

export interface DataGridTransactionAppliedEvent {
  committedId: string
  batchId: string | null
  transactionIds: readonly string[]
}

export interface DataGridTransactionRolledBackEvent {
  committedId: string
  batchId: string | null
  transactionIds: readonly string[]
  error: unknown
}

export interface DataGridTransactionHistoryEvent {
  committedId: string
  batchId: string | null
  transactionIds: readonly string[]
}

export interface DataGridTransactionServiceHooks {
  onApplied?(event: DataGridTransactionAppliedEvent): void
  onRolledBack?(event: DataGridTransactionRolledBackEvent): void
  onUndone?(event: DataGridTransactionHistoryEvent): void
  onRedone?(event: DataGridTransactionHistoryEvent): void
}

export interface CreateDataGridTransactionServiceOptions extends DataGridTransactionServiceHooks {
  execute: DataGridTransactionExecutor
}

export type DataGridTransactionListener = (snapshot: DataGridTransactionSnapshot) => void

export interface DataGridTransactionService {
  getSnapshot(): DataGridTransactionSnapshot
  beginBatch(label?: string): string
  commitBatch(batchId?: string): Promise<readonly string[]>
  rollbackBatch(batchId?: string): readonly string[]
  applyTransaction(transaction: DataGridTransactionInput): Promise<string>
  canUndo(): boolean
  canRedo(): boolean
  undo(): Promise<string | null>
  redo(): Promise<string | null>
  subscribe(listener: DataGridTransactionListener): () => void
  dispose(): void
}

interface DataGridNormalizedTransaction {
  id: string
  label: string | null
  commands: readonly DataGridTransactionCommand[]
}

interface DataGridCommittedBatch {
  committedId: string
  batchId: string | null
  label: string | null
  transactions: readonly DataGridNormalizedTransaction[]
}

interface DataGridPendingBatch {
  id: string
  label: string | null
  transactions: DataGridNormalizedTransaction[]
}

function normalizeLabel(label: string | undefined): string | null {
  if (typeof label !== "string") {
    return null
  }
  const normalized = label.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeId(candidate: string | undefined, fallback: string): string {
  if (typeof candidate !== "string") {
    return fallback
  }
  const normalized = candidate.trim()
  return normalized.length > 0 ? normalized : fallback
}

function normalizeCommand(command: DataGridTransactionCommand): DataGridTransactionCommand {
  if (!command || typeof command !== "object") {
    throw new Error("[DataGridTransaction] command must be an object.")
  }
  if (typeof command.type !== "string" || command.type.trim().length === 0) {
    throw new Error("[DataGridTransaction] command.type must be a non-empty string.")
  }
  if (!Object.prototype.hasOwnProperty.call(command, "rollbackPayload")) {
    throw new Error("[DataGridTransaction] command.rollbackPayload is required for rollback safety.")
  }
  return {
    type: command.type,
    payload: command.payload,
    rollbackPayload: command.rollbackPayload,
  }
}

function createError(message: string, cause: unknown): Error {
  const error = new Error(message)
  ;(error as Error & { cause?: unknown }).cause = cause
  return error
}

export function createDataGridTransactionService(
  options: CreateDataGridTransactionServiceOptions,
): DataGridTransactionService {
  if (typeof options.execute !== "function") {
    throw new Error("[DataGridTransaction] execute(command, context) handler is required.")
  }

  const listeners = new Set<DataGridTransactionListener>()
  const undoStack: DataGridCommittedBatch[] = []
  const redoStack: DataGridCommittedBatch[] = []
  const execute = options.execute

  let disposed = false
  let revision = 0
  let autoTransactionId = 1
  let autoBatchId = 1
  let autoCommittedId = 1
  let lastCommittedId: string | null = null
  let pendingBatch: DataGridPendingBatch | null = null

  function ensureActive() {
    if (disposed) {
      throw new Error("DataGridTransactionService has been disposed")
    }
  }

  function materializeSnapshot(): DataGridTransactionSnapshot {
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
    }
  }

  function emit() {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = materializeSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function bumpRevision() {
    revision += 1
    emit()
  }

  function normalizeTransaction(input: DataGridTransactionInput): DataGridNormalizedTransaction {
    if (!Array.isArray(input.commands) || input.commands.length === 0) {
      throw new Error("[DataGridTransaction] transaction.commands must contain at least one command.")
    }

    const transactionId = normalizeId(input.id, `tx-${autoTransactionId}`)
    if (transactionId === `tx-${autoTransactionId}`) {
      autoTransactionId += 1
    }

    return {
      id: transactionId,
      label: normalizeLabel(input.label),
      commands: input.commands.map(command => normalizeCommand(command)),
    }
  }

  async function runCommand(
    command: DataGridTransactionCommand,
    context: DataGridTransactionExecutionContext,
  ): Promise<void> {
    await execute(command, context)
  }

  async function rollbackAppliedCommands(
    transaction: DataGridNormalizedTransaction,
    appliedCommandIndexes: readonly number[],
    batchId: string | null,
  ): Promise<void> {
    for (let offset = appliedCommandIndexes.length - 1; offset >= 0; offset -= 1) {
      const commandIndex = appliedCommandIndexes[offset] as number
      const command = transaction.commands[commandIndex] as DataGridTransactionCommand
      await runCommand(
        {
          type: command.type,
          payload: command.rollbackPayload,
          rollbackPayload: command.payload,
        },
        {
          direction: "rollback",
          transactionId: transaction.id,
          transactionLabel: transaction.label,
          commandIndex,
          batchId,
        },
      )
    }
  }

  async function applyOneTransaction(
    transaction: DataGridNormalizedTransaction,
    direction: "apply" | "redo",
    batchId: string | null,
  ): Promise<void> {
    const appliedCommandIndexes: number[] = []
    for (let commandIndex = 0; commandIndex < transaction.commands.length; commandIndex += 1) {
      const command = transaction.commands[commandIndex] as DataGridTransactionCommand
      try {
        await runCommand(command, {
          direction,
          transactionId: transaction.id,
          transactionLabel: transaction.label,
          commandIndex,
          batchId,
        })
        appliedCommandIndexes.push(commandIndex)
      } catch (error) {
        try {
          await rollbackAppliedCommands(transaction, appliedCommandIndexes, batchId)
        } catch (rollbackError) {
          throw createError(
            `[DataGridTransaction] ${direction} failed and rollback failed for transaction "${transaction.id}".`,
            { applyError: error, rollbackError },
          )
        }
        throw createError(
          `[DataGridTransaction] ${direction} failed for transaction "${transaction.id}".`,
          error,
        )
      }
    }
  }

  async function rollbackOneTransaction(
    transaction: DataGridNormalizedTransaction,
    direction: "rollback" | "undo",
    batchId: string | null,
  ): Promise<void> {
    for (let commandIndex = transaction.commands.length - 1; commandIndex >= 0; commandIndex -= 1) {
      const command = transaction.commands[commandIndex] as DataGridTransactionCommand
      await runCommand(
        {
          type: command.type,
          payload: command.rollbackPayload,
          rollbackPayload: command.payload,
        },
        {
          direction,
          transactionId: transaction.id,
          transactionLabel: transaction.label,
          commandIndex,
          batchId,
        },
      )
    }
  }

  async function applyCommittedBatch(
    committedBatch: DataGridCommittedBatch,
    direction: "apply" | "redo",
  ): Promise<void> {
    const appliedTransactions: DataGridNormalizedTransaction[] = []
    try {
      for (const transaction of committedBatch.transactions) {
        await applyOneTransaction(transaction, direction, committedBatch.batchId)
        appliedTransactions.push(transaction)
      }
    } catch (error) {
      for (let index = appliedTransactions.length - 1; index >= 0; index -= 1) {
        const transaction = appliedTransactions[index] as DataGridNormalizedTransaction
        await rollbackOneTransaction(transaction, "rollback", committedBatch.batchId)
      }
      throw error
    }
  }

  async function rollbackCommittedBatch(
    committedBatch: DataGridCommittedBatch,
    direction: "rollback" | "undo",
  ): Promise<void> {
    for (let index = committedBatch.transactions.length - 1; index >= 0; index -= 1) {
      const transaction = committedBatch.transactions[index] as DataGridNormalizedTransaction
      await rollbackOneTransaction(transaction, direction, committedBatch.batchId)
    }
  }

  function createCommittedBatch(
    transactions: readonly DataGridNormalizedTransaction[],
    batchId: string | null,
    label: string | null,
  ): DataGridCommittedBatch {
    const committedId = `commit-${autoCommittedId}`
    autoCommittedId += 1
    return {
      committedId,
      batchId,
      label,
      transactions: transactions.map(transaction => ({
        ...transaction,
        commands: transaction.commands.map(command => ({ ...command })),
      })),
    }
  }

  function transactionIds(batch: DataGridCommittedBatch): readonly string[] {
    return batch.transactions.map(transaction => transaction.id)
  }

  return {
    getSnapshot() {
      return materializeSnapshot()
    },
    beginBatch(label?: string) {
      ensureActive()
      if (pendingBatch) {
        throw new Error(
          `[DataGridTransaction] batch "${pendingBatch.id}" is already active. Commit or rollback it first.`,
        )
      }
      const batchId = `batch-${autoBatchId}`
      autoBatchId += 1
      pendingBatch = {
        id: batchId,
        label: normalizeLabel(label),
        transactions: [],
      }
      bumpRevision()
      return batchId
    },
    async commitBatch(batchId?: string) {
      ensureActive()
      if (!pendingBatch) {
        return []
      }
      if (typeof batchId === "string" && batchId !== pendingBatch.id) {
        throw new Error(
          `[DataGridTransaction] cannot commit batch "${batchId}". Active batch is "${pendingBatch.id}".`,
        )
      }

      const batch = pendingBatch
      pendingBatch = null

      if (batch.transactions.length === 0) {
        bumpRevision()
        return []
      }

      const committedBatch = createCommittedBatch(batch.transactions, batch.id, batch.label)

      try {
        await applyCommittedBatch(committedBatch, "apply")
      } catch (error) {
        bumpRevision()
        options.onRolledBack?.({
          committedId: committedBatch.committedId,
          batchId: committedBatch.batchId,
          transactionIds: transactionIds(committedBatch),
          error,
        })
        throw error
      }

      undoStack.push(committedBatch)
      redoStack.length = 0
      lastCommittedId = committedBatch.committedId
      bumpRevision()
      options.onApplied?.({
        committedId: committedBatch.committedId,
        batchId: committedBatch.batchId,
        transactionIds: transactionIds(committedBatch),
      })
      return transactionIds(committedBatch)
    },
    rollbackBatch(batchId?: string) {
      ensureActive()
      if (!pendingBatch) {
        return []
      }
      if (typeof batchId === "string" && batchId !== pendingBatch.id) {
        throw new Error(
          `[DataGridTransaction] cannot rollback batch "${batchId}". Active batch is "${pendingBatch.id}".`,
        )
      }
      const transactionIdsInBatch = pendingBatch.transactions.map(transaction => transaction.id)
      pendingBatch = null
      bumpRevision()
      return transactionIdsInBatch
    },
    async applyTransaction(transactionInput: DataGridTransactionInput) {
      ensureActive()
      const transaction = normalizeTransaction(transactionInput)
      if (pendingBatch) {
        pendingBatch.transactions.push(transaction)
        bumpRevision()
        return transaction.id
      }

      const committedBatch = createCommittedBatch([transaction], null, transaction.label)
      try {
        await applyCommittedBatch(committedBatch, "apply")
      } catch (error) {
        options.onRolledBack?.({
          committedId: committedBatch.committedId,
          batchId: committedBatch.batchId,
          transactionIds: transactionIds(committedBatch),
          error,
        })
        throw error
      }

      undoStack.push(committedBatch)
      redoStack.length = 0
      lastCommittedId = committedBatch.committedId
      bumpRevision()
      options.onApplied?.({
        committedId: committedBatch.committedId,
        batchId: committedBatch.batchId,
        transactionIds: transactionIds(committedBatch),
      })
      return transaction.id
    },
    canUndo() {
      return undoStack.length > 0
    },
    canRedo() {
      return redoStack.length > 0
    },
    async undo() {
      ensureActive()
      const committedBatch = undoStack[undoStack.length - 1]
      if (!committedBatch) {
        return null
      }
      await rollbackCommittedBatch(committedBatch, "undo")
      undoStack.pop()
      redoStack.push(committedBatch)
      lastCommittedId = committedBatch.committedId
      bumpRevision()
      options.onUndone?.({
        committedId: committedBatch.committedId,
        batchId: committedBatch.batchId,
        transactionIds: transactionIds(committedBatch),
      })
      return committedBatch.committedId
    },
    async redo() {
      ensureActive()
      const committedBatch = redoStack[redoStack.length - 1]
      if (!committedBatch) {
        return null
      }
      await applyCommittedBatch(committedBatch, "redo")
      redoStack.pop()
      undoStack.push(committedBatch)
      lastCommittedId = committedBatch.committedId
      bumpRevision()
      options.onRedone?.({
        committedId: committedBatch.committedId,
        batchId: committedBatch.batchId,
        transactionIds: transactionIds(committedBatch),
      })
      return committedBatch.committedId
    },
    subscribe(listener: DataGridTransactionListener) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      listeners.clear()
      undoStack.length = 0
      redoStack.length = 0
      pendingBatch = null
      revision = 0
      lastCommittedId = null
    },
  }
}
