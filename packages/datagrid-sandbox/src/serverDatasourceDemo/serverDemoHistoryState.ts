export interface ServerDemoHistoryState {
  operationId?: string | null
  canUndo: boolean
  canRedo: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  affectedRows?: number | null
  affectedCells?: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function hasServerDemoHistoryState(value: unknown): value is ServerDemoHistoryState {
  return isRecord(value) && typeof value.canUndo === "boolean" && typeof value.canRedo === "boolean"
}

export function normalizeServerDemoHistoryState(value: unknown): ServerDemoHistoryState | null {
  if (!hasServerDemoHistoryState(value)) {
    return null
  }
  return {
    operationId: typeof value.operationId === "string" || value.operationId === null ? value.operationId : undefined,
    canUndo: value.canUndo,
    canRedo: value.canRedo,
    latestUndoOperationId:
      typeof value.latestUndoOperationId === "string" || value.latestUndoOperationId === null
        ? value.latestUndoOperationId
        : undefined,
    latestRedoOperationId:
      typeof value.latestRedoOperationId === "string" || value.latestRedoOperationId === null
        ? value.latestRedoOperationId
        : undefined,
    affectedRows: typeof value.affectedRows === "number" ? value.affectedRows : undefined,
    affectedCells: typeof value.affectedCells === "number" ? value.affectedCells : undefined,
  }
}

export function shouldRefreshHistoryStatusAfterCommit(value: unknown): boolean {
  return normalizeServerDemoHistoryState(value) === null
}
