import type {
  DataGridColumnModel,
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridViewportRange,
} from "../models/index.js"
import type {
  DataGridPivotColumn,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type { DataGridRowSelectionSnapshot } from "../selection/rowSelection"
import type { DataGridColumnSelectionSnapshot } from "../selection/columnSelection.js"
import type { DataGridTransactionSnapshot } from "./transactionService"
import type {
  DataGridApiErrorEvent,
  DataGridChangeContext,
  DataGridApiEventMap,
  DataGridApiEventsNamespace,
  DataGridUnifiedState,
} from "./gridApiContracts"

type DataGridApiEventListenerMap<TRow = unknown> = {
  [K in keyof DataGridApiEventMap<TRow>]: Set<(payload: DataGridApiEventMap<TRow>[K]) => void>
}

let generatedOperationSequence = 0

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
  emitSelectionChanged(snapshot: DataGridSelectionSnapshot | null, context?: DataGridChangeContext): void
  emitRowSelectionChanged(snapshot: DataGridRowSelectionSnapshot | null, context?: DataGridChangeContext): void
  emitColumnSelectionChanged(snapshot: DataGridColumnSelectionSnapshot | null, context?: DataGridChangeContext): void
  emitRowsEdited(event: DataGridApiEventMap<TRow>["rows:edited"]): void
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
  const operationPrefix = `dg-${Date.now().toString(36)}`
  const resolveChangeContext = (context?: DataGridChangeContext) => ({
    ...(typeof context?.origin === "string" ? { origin: context.origin } : {}),
    operationId: context?.operationId ?? `${operationPrefix}-${++generatedOperationSequence}`,
  })
  const listeners: DataGridApiEventListenerMap<TRow> = {
    "rows:changed": new Set(),
    "rows:edited": new Set(),
    "columns:changed": new Set(),
    "projection:recomputed": new Set(),
    "selection:changed": new Set(),
    "row-selection:changed": new Set(),
    "column-selection:changed": new Set(),
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
    // Detach this flush before invoking user listeners. If one throws, the
    // remainder belongs to the failed batch and must not leak into a later one.
    const payloads = new Map(batchedPayloads)
    const errors = batchedErrors.splice(0)
    batchedPayloads.clear()

    const orderedEvents: readonly (keyof DataGridApiEventMap<TRow>)[] = [
      "state:import:begin",
      "rows:changed",
      "rows:edited",
      "columns:changed",
      "projection:recomputed",
      "pivot:changed",
      "selection:changed",
      "row-selection:changed",
      "column-selection:changed",
      "transaction:changed",
      "viewport:changed",
      "state:imported",
      "state:import:end",
    ]

    for (const event of orderedEvents) {
      const payload = payloads.get(event)
      if (typeof payload === "undefined") {
        continue
      }
      if (event === "rows:edited" && (payload as DataGridApiEventMap<TRow>["rows:edited"]).edits.length === 0) {
        continue
      }
      emit(event, payload as DataGridApiEventMap<TRow>[typeof event])
    }

    while (errors.length > 0) {
      const nextError = errors.shift()
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
      } else if (event === "rows:edited") {
        const previous = batchedPayloads.get(event) as DataGridApiEventMap<TRow>["rows:edited"] | undefined
        const next = payload as DataGridApiEventMap<TRow>["rows:edited"]
        if (!previous) {
          batchedPayloads.set(event, next)
        } else {
          const byId = new Map(previous.edits.map(edit => [edit.rowId, edit]))
          for (const edit of next.edits) {
            const prior = byId.get(edit.rowId)
            if (!prior) {
              byId.set(edit.rowId, edit)
              continue
            }
            const keys = new Set([...Object.keys(prior.patch), ...Object.keys(edit.patch)])
            const patch: Record<string, unknown> = {}
            for (const key of keys) {
              if (!Object.is((prior.oldData as Record<string, unknown>)[key], (edit.newData as Record<string, unknown>)[key])) {
                patch[key] = (edit.newData as Record<string, unknown>)[key]
              }
            }
            if (Object.keys(patch).length === 0) byId.delete(edit.rowId)
            else byId.set(edit.rowId, { ...edit, oldData: prior.oldData, patch: patch as Partial<TRow> })
          }
          batchedPayloads.set(event, { source: next.source, edits: [...byId.values()] })
        }
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
    } catch (error) {
      // Nested emissions queued behind the failing listener have no valid
      // ordering guarantee after the dispatch aborts.
      emitQueue.length = 0
      throw error
    } finally {
      emitting = false
    }
  }

  const emitSequence = (events: Array<{ event: keyof DataGridApiEventMap<TRow>; payload: unknown }>): void => {
    if (batchDepth > 0) {
      for (const entry of events) {
        emit(entry.event, entry.payload as DataGridApiEventMap<TRow>[typeof entry.event])
      }
      return
    }
    emitQueue.push(...events)
    if (emitting) return
    emitting = true
    try {
      while (emitQueue.length > 0) {
        const next = emitQueue.shift()
        if (!next) continue
        dispatchQueuedEvent(next.event, next.payload as DataGridApiEventMap<TRow>[typeof next.event])
      }
    } catch (error) {
      emitQueue.length = 0
      throw error
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
    const nextProjectionVersion = resolveProjectionVersion(snapshot)
    const projectionChanged = nextProjectionVersion !== lastProjectionVersion
    const previousProjectionVersion = lastProjectionVersion
    if (projectionChanged) lastProjectionVersion = nextProjectionVersion

    const nextPivotSignature = serializeStable({
      pivotModel: snapshot.pivotModel ?? null,
      pivotColumns: normalizePivotColumns(snapshot.pivotColumns),
    })
    const pivotChanged = nextPivotSignature !== lastPivotSignature
    if (pivotChanged) lastPivotSignature = nextPivotSignature

    const nextViewportRange = normalizeViewportRange(snapshot.viewportRange)
    const nextViewportSignature = serializeStable(nextViewportRange)
    const viewportChanged = nextViewportSignature !== lastViewportSignature
    if (viewportChanged) lastViewportSignature = nextViewportSignature

    const notifications: Array<{ event: keyof DataGridApiEventMap<TRow>; payload: unknown }> = [
      { event: "rows:changed", payload: { snapshot } },
    ]

    if (projectionChanged) {
      notifications.push({
        event: "projection:recomputed",
        payload: {
          snapshot,
          previousVersion: previousProjectionVersion,
          nextVersion: nextProjectionVersion,
          staleStages: snapshot.projection?.staleStages ?? [],
        },
      })
    }

    if (pivotChanged) {
      notifications.push({
        event: "pivot:changed",
        payload: {
          pivotModel: snapshot.pivotModel ?? null,
          pivotColumns: normalizePivotColumns(snapshot.pivotColumns),
        },
      })
    }

    if (viewportChanged) {
      notifications.push({
        event: "viewport:changed",
        payload: {
          range: nextViewportRange,
          snapshot,
        },
      })
    }
    emitSequence(notifications)
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
    emitSelectionChanged(snapshot, context) {
      emit("selection:changed", { snapshot, ...resolveChangeContext(context) })
    },
    emitRowSelectionChanged(snapshot, context) {
      emit("row-selection:changed", { snapshot, ...resolveChangeContext(context) })
    },
    emitColumnSelectionChanged(snapshot, context) {
      emit("column-selection:changed", { snapshot, ...resolveChangeContext(context) })
    },
    emitRowsEdited(event) {
      emit("rows:edited", event)
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
