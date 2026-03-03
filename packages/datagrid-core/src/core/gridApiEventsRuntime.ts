import type {
  DataGridColumnModel,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridViewportRange,
} from "../models"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type { DataGridTransactionSnapshot } from "./transactionService"
import type {
  DataGridApiErrorEvent,
  DataGridApiEventMap,
  DataGridApiEventsNamespace,
  DataGridUnifiedState,
} from "./gridApiContracts"

type DataGridApiEventListenerMap<TRow = unknown> = {
  [K in keyof DataGridApiEventMap<TRow>]: Set<(payload: DataGridApiEventMap<TRow>[K]) => void>
}

function serializeStable(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

function resolveProjectionVersion<TRow>(snapshot: DataGridRowModelSnapshot<TRow>): number {
  if (!snapshot.projection) {
    return 0
  }
  if (Number.isFinite(snapshot.projection.recomputeVersion)) {
    return snapshot.projection.recomputeVersion as number
  }
  if (Number.isFinite(snapshot.projection.version)) {
    return snapshot.projection.version
  }
  return 0
}

function normalizePivotColumns(columns: readonly DataGridPivotColumn[] | undefined): readonly DataGridPivotColumn[] {
  return Array.isArray(columns) ? columns : []
}

function normalizeViewportRange(range: DataGridViewportRange): DataGridViewportRange {
  return {
    start: Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0,
    end: Number.isFinite(range.end) ? Math.max(0, Math.trunc(range.end)) : 0,
  }
}

export interface DataGridApiEventsRuntime<TRow = unknown> {
  namespace: DataGridApiEventsNamespace<TRow>
  runBatched<TResult>(fn: () => TResult): TResult
  emitSelectionChanged(snapshot: DataGridSelectionSnapshot | null): void
  emitTransactionChanged(snapshot: DataGridTransactionSnapshot | null): void
  emitStateImportBegin(state: DataGridUnifiedState<TRow>): void
  emitStateImportEnd(state: DataGridUnifiedState<TRow>): void
  emitStateImported(state: DataGridUnifiedState<TRow>): void
  emitError(event: DataGridApiErrorEvent): void
  dispose(): void
}

export interface CreateDataGridApiEventsRuntimeInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
}

export function createDataGridApiEventsRuntime<TRow = unknown>(
  input: CreateDataGridApiEventsRuntimeInput<TRow>,
): DataGridApiEventsRuntime<TRow> {
  const listeners: DataGridApiEventListenerMap<TRow> = {
    "rows:changed": new Set(),
    "columns:changed": new Set(),
    "projection:recomputed": new Set(),
    "selection:changed": new Set(),
    "pivot:changed": new Set(),
    "transaction:changed": new Set(),
    "viewport:changed": new Set(),
    "state:import:begin": new Set(),
    "state:import:end": new Set(),
    "state:imported": new Set(),
    "error": new Set(),
  }

  const dispatchQueuedEvent = <K extends keyof DataGridApiEventMap<TRow>>(
    event: K,
    payload: DataGridApiEventMap<TRow>[K],
  ): void => {
    const eventListeners = listeners[event] as Set<(payload: DataGridApiEventMap<TRow>[K]) => void>
    if (eventListeners.size === 0) {
      return
    }
    const listenerSnapshot = [...eventListeners]
    for (const listener of listenerSnapshot) {
      listener(payload)
    }
  }

  const emitQueue: Array<{
    event: keyof DataGridApiEventMap<TRow>
    payload: unknown
  }> = []
  const batchedPayloads = new Map<keyof DataGridApiEventMap<TRow>, unknown>()
  const batchedErrors: DataGridApiErrorEvent[] = []
  let batchDepth = 0
  let emitting = false

  const flushBatched = (): void => {
    if (batchedPayloads.size === 0 && batchedErrors.length === 0) {
      return
    }

    const orderedEvents: readonly (keyof DataGridApiEventMap<TRow>)[] = [
      "state:import:begin",
      "rows:changed",
      "columns:changed",
      "projection:recomputed",
      "pivot:changed",
      "selection:changed",
      "transaction:changed",
      "viewport:changed",
      "state:imported",
      "state:import:end",
    ]

    for (const event of orderedEvents) {
      const payload = batchedPayloads.get(event)
      if (typeof payload === "undefined") {
        continue
      }
      batchedPayloads.delete(event)
      emit(event, payload as DataGridApiEventMap<TRow>[typeof event])
    }

    while (batchedErrors.length > 0) {
      const nextError = batchedErrors.shift()
      if (!nextError) {
        continue
      }
      emit("error", nextError)
    }
  }

  const emit = <K extends keyof DataGridApiEventMap<TRow>>(
    event: K,
    payload: DataGridApiEventMap<TRow>[K],
  ): void => {
    if (batchDepth > 0) {
      if (event === "error") {
        batchedErrors.push(payload as DataGridApiErrorEvent)
      } else {
        batchedPayloads.set(event, payload)
      }
      return
    }
    // Queue nested emissions to keep deterministic FIFO ordering under reentrant listeners.
    emitQueue.push({ event, payload })
    if (emitting) {
      return
    }
    emitting = true
    try {
      while (emitQueue.length > 0) {
        const next = emitQueue.shift()
        if (!next) {
          continue
        }
        dispatchQueuedEvent(
          next.event,
          next.payload as DataGridApiEventMap<TRow>[typeof next.event],
        )
      }
    } finally {
      emitting = false
    }
  }

  const initialSnapshot = input.rowModel.getSnapshot()
  let lastProjectionVersion = resolveProjectionVersion(initialSnapshot)
  let lastPivotSignature = serializeStable({
    pivotModel: initialSnapshot.pivotModel ?? null,
    pivotColumns: normalizePivotColumns(initialSnapshot.pivotColumns),
  } satisfies { pivotModel: DataGridPivotSpec | null; pivotColumns: readonly DataGridPivotColumn[] })
  let lastViewportSignature = serializeStable(normalizeViewportRange(initialSnapshot.viewportRange))

  const unsubscribeRowModel = input.rowModel.subscribe((snapshot) => {
    emit("rows:changed", { snapshot })

    const nextProjectionVersion = resolveProjectionVersion(snapshot)
    if (nextProjectionVersion !== lastProjectionVersion) {
      emit("projection:recomputed", {
        snapshot,
        previousVersion: lastProjectionVersion,
        nextVersion: nextProjectionVersion,
        staleStages: snapshot.projection?.staleStages ?? [],
      })
      lastProjectionVersion = nextProjectionVersion
    }

    const nextPivotSignature = serializeStable({
      pivotModel: snapshot.pivotModel ?? null,
      pivotColumns: normalizePivotColumns(snapshot.pivotColumns),
    })
    if (nextPivotSignature !== lastPivotSignature) {
      emit("pivot:changed", {
        pivotModel: snapshot.pivotModel ?? null,
        pivotColumns: normalizePivotColumns(snapshot.pivotColumns),
      })
      lastPivotSignature = nextPivotSignature
    }

    const nextViewportRange = normalizeViewportRange(snapshot.viewportRange)
    const nextViewportSignature = serializeStable(nextViewportRange)
    if (nextViewportSignature !== lastViewportSignature) {
      emit("viewport:changed", {
        range: nextViewportRange,
        snapshot,
      })
      lastViewportSignature = nextViewportSignature
    }
  })

  const unsubscribeColumnModel = input.columnModel.subscribe((snapshot) => {
    emit("columns:changed", { snapshot })
  })

  return {
    namespace: {
      on(event, listener) {
        const eventListeners = listeners[event]
        eventListeners.add(listener)
        return () => {
          eventListeners.delete(listener)
        }
      },
    },
    runBatched<TResult>(fn: () => TResult): TResult {
      batchDepth += 1
      try {
        return fn()
      } finally {
        batchDepth = Math.max(0, batchDepth - 1)
        if (batchDepth === 0) {
          flushBatched()
        }
      }
    },
    emitSelectionChanged(snapshot) {
      emit("selection:changed", { snapshot })
    },
    emitTransactionChanged(snapshot) {
      emit("transaction:changed", { snapshot })
    },
    emitStateImportBegin(state) {
      emit("state:import:begin", { state })
    },
    emitStateImportEnd(state) {
      emit("state:import:end", { state })
    },
    emitStateImported(state) {
      emit("state:imported", { state })
    },
    emitError(event) {
      emit("error", event)
    },
    dispose() {
      unsubscribeRowModel()
      unsubscribeColumnModel()
      for (const eventListeners of Object.values(listeners)) {
        eventListeners.clear()
      }
    },
  }
}
