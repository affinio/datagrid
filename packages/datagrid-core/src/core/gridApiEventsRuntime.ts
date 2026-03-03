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
  emitSelectionChanged(snapshot: DataGridSelectionSnapshot | null): void
  emitTransactionChanged(snapshot: DataGridTransactionSnapshot | null): void
  emitStateImported(state: DataGridUnifiedState<TRow>): void
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
    "state:imported": new Set(),
  }

  const emit = <K extends keyof DataGridApiEventMap<TRow>>(
    event: K,
    payload: DataGridApiEventMap<TRow>[K],
  ): void => {
    const eventListeners = listeners[event]
    if (eventListeners.size === 0) {
      return
    }
    for (const listener of eventListeners) {
      listener(payload)
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
    emitSelectionChanged(snapshot) {
      emit("selection:changed", { snapshot })
    },
    emitTransactionChanged(snapshot) {
      emit("transaction:changed", { snapshot })
    },
    emitStateImported(state) {
      emit("state:imported", { state })
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
