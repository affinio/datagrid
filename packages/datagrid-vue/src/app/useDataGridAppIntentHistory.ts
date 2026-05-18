import type { DataGridIntentTransactionDescriptor } from "../advanced"
import { useDataGridIntentHistory } from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"

export interface DataGridAppRowSnapshot<TRow> {
  kind: "full" | "partial"
  rows: Array<{ rowId: string | number; row: TRow }>
  budget?: DataGridAppHistorySnapshotBudgetResult
  restoration?: DataGridAppHistoryRestorationState | null
  operation?: DataGridAppHistoryOperationPayload | null
}

export interface DataGridAppHistorySnapshotBudget {
  maxRows?: number
  maxCells?: number
  maxBytes?: number
}

export interface DataGridAppHistorySnapshotBudgetResult {
  exceeded: true
  limit: "rows" | "cells" | "bytes"
  rowCount: number
  cellCount: number
  byteEstimate: number
  maxRows: number
  maxCells: number
  maxBytes: number
}

export interface DataGridAppHistoryRestorationCell {
  rowIndex: number
  columnIndex: number
  rowId?: string | number | null
  columnKey?: string | null
}

export interface DataGridAppHistoryRestorationState {
  activeCell?: DataGridAppHistoryRestorationCell | null
  selectionSnapshot?: unknown
  scrollAnchor?: DataGridAppHistoryRestorationCell | null
  focusTarget?: DataGridAppHistoryRestorationCell | null
  editTarget?: DataGridAppHistoryRestorationCell | null
}

export type DataGridAppHistoryOperationKind =
  | "edit"
  | "paste"
  | "cut-paste"
  | "fill"
  | "range-move"
  | "row-insert"
  | "row-delete"
  | "placeholder-materialization"
  | "snapshot-fallback"

export interface DataGridAppHistoryOperationScope {
  snapshotKind: DataGridAppRowSnapshot<unknown>["kind"] | "snapshot-fallback"
  rowIds: readonly (string | number)[]
  rowCount: number
  affectedRange?: {
    startRow: number
    endRow: number
    startColumn: number
    endColumn: number
  } | null
}

export interface DataGridAppHistoryOperationPayload {
  version: 1
  kind: DataGridAppHistoryOperationKind
  intent: string
  scope: DataGridAppHistoryOperationScope
  metadata?: Record<string, unknown>
}

export interface UseDataGridAppIntentHistoryOptions<TRow> {
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "getBodyRowAtIndex" | "resolveBodyRowIndexById">
  cloneRowData: (row: TRow) => TRow
  syncViewport: () => void
  maxHistoryDepth?: number
  snapshotBudget?: DataGridAppHistorySnapshotBudget
  captureRestorationState?: () => DataGridAppHistoryRestorationState | null
  applyRestorationState?: (state: DataGridAppHistoryRestorationState) => void | Promise<void>
  onOperationRecorded?: (operation: DataGridAppHistoryOperationPayload) => void
}

export interface UseDataGridAppIntentHistoryResult<TRow> {
  captureRowsSnapshot: () => DataGridAppRowSnapshot<TRow>
  captureRowsSnapshotByIds: (rowIds: readonly (string | number)[]) => DataGridAppRowSnapshot<TRow>
  canUndo: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["canUndo"]
  canRedo: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["canRedo"]
  runHistoryAction: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["runHistoryAction"]
  recordIntentTransaction: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["recordIntentTransaction"]
  dispose: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["dispose"]
}

export function useDataGridAppIntentHistory<TRow>(
  options: UseDataGridAppIntentHistoryOptions<TRow>,
): UseDataGridAppIntentHistoryResult<TRow> {
  const maxSnapshotRows = normalizeBudgetLimit(options.snapshotBudget?.maxRows, 10_000)
  const maxSnapshotCells = normalizeBudgetLimit(options.snapshotBudget?.maxCells, 250_000)
  const maxSnapshotBytes = normalizeBudgetLimit(options.snapshotBudget?.maxBytes, 16 * 1024 * 1024)

  const cloneSnapshot = (snapshot: DataGridAppRowSnapshot<TRow>): DataGridAppRowSnapshot<TRow> => ({
    kind: snapshot.kind,
    rows: snapshot.rows.map(entry => ({
      rowId: entry.rowId,
      row: options.cloneRowData(entry.row),
    })),
    ...(snapshot.budget ? { budget: { ...snapshot.budget } } : {}),
    ...(snapshot.restoration ? { restoration: cloneRestorationState(snapshot.restoration) } : {}),
    ...(snapshot.operation ? { operation: cloneHistoryOperation(snapshot.operation) } : {}),
  })

  const captureRestorationState = (): DataGridAppHistoryRestorationState | null => {
    return cloneRestorationState(options.captureRestorationState?.() ?? null)
  }

  const createBudgetExceededSnapshot = (
    kind: DataGridAppRowSnapshot<TRow>["kind"],
    limit: DataGridAppHistorySnapshotBudgetResult["limit"],
    rowCount: number,
    cellCount: number,
    byteEstimate: number,
  ): DataGridAppRowSnapshot<TRow> => ({
    kind,
    rows: [],
    restoration: captureRestorationState(),
    budget: {
      exceeded: true,
      limit,
      rowCount,
      cellCount,
      byteEstimate,
      maxRows: maxSnapshotRows,
      maxCells: maxSnapshotCells,
      maxBytes: maxSnapshotBytes,
    },
  })

  const appendSnapshotRow = (
    rows: Array<{ rowId: string | number; row: TRow }>,
    rowId: string | number,
    row: TRow,
    metrics: { cellCount: number; byteEstimate: number },
  ): DataGridAppRowSnapshot<TRow> | null => {
    const clonedRow = options.cloneRowData(row)
    const nextCellCount = metrics.cellCount + estimateSnapshotCellCount(clonedRow)
    const nextByteEstimate = metrics.byteEstimate + estimateSnapshotByteSize(rowId, clonedRow)
    const nextRowCount = rows.length + 1
    if (nextRowCount > maxSnapshotRows) {
      return createBudgetExceededSnapshot("partial", "rows", nextRowCount, nextCellCount, nextByteEstimate)
    }
    if (nextCellCount > maxSnapshotCells) {
      return createBudgetExceededSnapshot("partial", "cells", nextRowCount, nextCellCount, nextByteEstimate)
    }
    if (nextByteEstimate > maxSnapshotBytes) {
      return createBudgetExceededSnapshot("partial", "bytes", nextRowCount, nextCellCount, nextByteEstimate)
    }
    rows.push({ rowId, row: clonedRow })
    metrics.cellCount = nextCellCount
    metrics.byteEstimate = nextByteEstimate
    return null
  }

  const resolveRuntimeRowById = (rowId: string | number) => {
    const rowIndex = options.runtime.resolveBodyRowIndexById(rowId)
    if (rowIndex >= 0) {
      return options.runtime.getBodyRowAtIndex(rowIndex) ?? options.runtime.api.rows.get(rowIndex)
    }
    const count = options.runtime.api.rows.getCount()
    for (let candidateIndex = 0; candidateIndex < count; candidateIndex += 1) {
      const candidate = options.runtime.api.rows.get(candidateIndex)
      if (candidate?.rowId === rowId) {
        return candidate
      }
    }
    return null
  }

  const captureRowsSnapshot = (): DataGridAppRowSnapshot<TRow> => {
    const count = options.runtime.api.rows.getCount()
    if (count > maxSnapshotRows) {
      return createBudgetExceededSnapshot("full", "rows", count, 0, 0)
    }
    const snapshotRows: Array<{ rowId: string | number; row: TRow }> = []
    const metrics = { cellCount: 0, byteEstimate: 0 }
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      const node = options.runtime.api.rows.get(rowIndex)
      if (!node || node.rowId == null || node.kind === "group") {
        continue
      }
      const budgetExceeded = appendSnapshotRow(snapshotRows, node.rowId, node.data as TRow, metrics)
      if (budgetExceeded) {
        return { ...budgetExceeded, kind: "full" }
      }
    }
    return { kind: "full", rows: snapshotRows, restoration: captureRestorationState() }
  }

  const captureRowsSnapshotByIds = (
    rowIds: readonly (string | number)[],
  ): DataGridAppRowSnapshot<TRow> => {
    const snapshotRows: Array<{ rowId: string | number; row: TRow }> = []
    const seen = new Set<string | number>()
    const metrics = { cellCount: 0, byteEstimate: 0 }
    for (const rowId of rowIds) {
      if (seen.has(rowId)) {
        continue
      }
      seen.add(rowId)
      if (seen.size > maxSnapshotRows) {
        return createBudgetExceededSnapshot("partial", "rows", seen.size, metrics.cellCount, metrics.byteEstimate)
      }
      const node = resolveRuntimeRowById(rowId)
      if (!node || node.rowId == null || node.kind === "group") {
        continue
      }
      const budgetExceeded = appendSnapshotRow(snapshotRows, node.rowId, node.data as TRow, metrics)
      if (budgetExceeded) {
        return budgetExceeded
      }
    }
    return { kind: "partial", rows: snapshotRows, restoration: captureRestorationState() }
  }

  const applySnapshotRestoration = async (
    snapshot: DataGridAppRowSnapshot<TRow>,
  ): Promise<void> => {
    if (!snapshot.restoration || typeof options.applyRestorationState !== "function") {
      return
    }
    await options.applyRestorationState(cloneRestorationState(snapshot.restoration) as DataGridAppHistoryRestorationState)
  }

  const applyRowsSnapshot = async (
    snapshot: DataGridAppRowSnapshot<TRow>,
  ): Promise<void> => {
    if (snapshot.budget?.exceeded) {
      options.syncViewport()
      return
    }
    if (snapshot.kind === "partial") {
      if (snapshot.rows.length > 0) {
        await options.runtime.api.rows.applyEdits(snapshot.rows.map(entry => ({
          rowId: entry.rowId,
          data: options.cloneRowData(entry.row) as Partial<TRow>,
        })))
        return
      }
      options.syncViewport()
      return
    }
    const rowsApi = options.runtime.api.rows as {
      hasDataMutationSupport?: () => boolean
      applyEdits?: (updates: Array<{ rowId: string | number; data: Partial<TRow> }>) => void | Promise<void>
      setData?: (rows: Array<{ rowId: string | number; originalIndex: number; row: TRow }>) => void
    }
    if (typeof rowsApi.hasDataMutationSupport === "function" && !rowsApi.hasDataMutationSupport()) {
      const rowPatches = snapshot.rows.map(entry => ({
        rowId: entry.rowId,
        data: options.cloneRowData(entry.row) as Partial<TRow>,
      }))
      if (rowPatches.length > 0) {
        await rowsApi.applyEdits?.(rowPatches)
        options.syncViewport()
        return
      }
      options.syncViewport()
      return
    }
    rowsApi.setData?.(snapshot.rows.map((entry, index) => ({
      rowId: entry.rowId,
      originalIndex: index,
      row: options.cloneRowData(entry.row),
    })))
    options.syncViewport()
  }

  const intentHistory = useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>({
    captureSnapshot: captureRowsSnapshot,
    applySnapshot: async snapshot => {
      await applyRowsSnapshot(snapshot)
      await applySnapshotRestoration(snapshot)
    },
    maxHistoryDepth: options.maxHistoryDepth,
  })

  const recordIntentTransaction = (
    descriptor: DataGridIntentTransactionDescriptor,
    beforeSnapshot: DataGridAppRowSnapshot<TRow>,
    afterSnapshotOverride?: DataGridAppRowSnapshot<TRow>,
  ): Promise<string | null> => {
    if (beforeSnapshot.budget?.exceeded) {
      return Promise.resolve(null)
    }
    const afterSnapshot = afterSnapshotOverride
      ?? (beforeSnapshot.kind === "partial"
        ? captureRowsSnapshotByIds(beforeSnapshot.rows.map(entry => entry.rowId))
        : captureRowsSnapshot())
    if (afterSnapshot.budget?.exceeded) {
      return Promise.resolve(null)
    }
    const operation = resolveHistoryOperation(descriptor, beforeSnapshot, afterSnapshot)
    options.onOperationRecorded?.(cloneHistoryOperation(operation))
    return intentHistory.recordIntentTransaction(
      { ...descriptor, operation },
      withHistoryOperation(cloneSnapshot(beforeSnapshot), operation),
      withHistoryOperation(cloneSnapshot(afterSnapshot), operation),
    )
  }

  return {
    captureRowsSnapshot,
    captureRowsSnapshotByIds,
    canUndo: intentHistory.canUndo,
    canRedo: intentHistory.canRedo,
    runHistoryAction: intentHistory.runHistoryAction,
    recordIntentTransaction,
    dispose: intentHistory.dispose,
  }
}

function normalizeBudgetLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.trunc(value as number))
}

function estimateSnapshotCellCount(row: unknown): number {
  if (Array.isArray(row)) {
    return row.length
  }
  if (row && typeof row === "object") {
    return Object.keys(row).length
  }
  return 1
}

function estimateSnapshotByteSize(rowId: string | number, row: unknown): number {
  try {
    return JSON.stringify({ rowId, row }).length
  } catch {
    return 1024
  }
}

export function createDataGridAppHistoryOperationPayload<TRow>(
  descriptor: Pick<DataGridIntentTransactionDescriptor, "intent" | "affectedRange" | "operation">,
  beforeSnapshot: DataGridAppRowSnapshot<TRow>,
  afterSnapshot: DataGridAppRowSnapshot<TRow>,
): DataGridAppHistoryOperationPayload {
  const explicitOperation = normalizeHistoryOperation(descriptor.operation)
  if (explicitOperation) {
    return explicitOperation
  }
  const normalizedIntent = descriptor.intent.trim() || "intent"
  return {
    version: 1,
    kind: resolveHistoryOperationKind(normalizedIntent),
    intent: normalizedIntent,
    scope: {
      snapshotKind: beforeSnapshot.kind === afterSnapshot.kind ? beforeSnapshot.kind : "snapshot-fallback",
      rowIds: collectHistoryOperationRowIds(beforeSnapshot, afterSnapshot),
      rowCount: Math.max(beforeSnapshot.rows.length, afterSnapshot.rows.length),
      affectedRange: cloneAffectedRange(descriptor.affectedRange ?? null),
    },
  }
}

function resolveHistoryOperation<TRow>(
  descriptor: DataGridIntentTransactionDescriptor,
  beforeSnapshot: DataGridAppRowSnapshot<TRow>,
  afterSnapshot: DataGridAppRowSnapshot<TRow>,
): DataGridAppHistoryOperationPayload {
  return createDataGridAppHistoryOperationPayload(descriptor, beforeSnapshot, afterSnapshot)
}

function withHistoryOperation<TRow>(
  snapshot: DataGridAppRowSnapshot<TRow>,
  operation: DataGridAppHistoryOperationPayload,
): DataGridAppRowSnapshot<TRow> {
  return {
    ...snapshot,
    operation: cloneHistoryOperation(operation),
  }
}

function normalizeHistoryOperation(value: unknown): DataGridAppHistoryOperationPayload | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const candidate = value as Partial<DataGridAppHistoryOperationPayload>
  if (candidate.version !== 1 || typeof candidate.intent !== "string") {
    return null
  }
  if (!candidate.scope || typeof candidate.scope !== "object") {
    return null
  }
  return {
    version: 1,
    kind: resolveHistoryOperationKind(candidate.kind),
    intent: candidate.intent.trim() || "intent",
    scope: {
      snapshotKind: candidate.scope.snapshotKind === "full"
        ? "full"
        : candidate.scope.snapshotKind === "snapshot-fallback"
          ? "snapshot-fallback"
          : "partial",
      rowIds: Array.isArray(candidate.scope.rowIds)
        ? candidate.scope.rowIds.filter((rowId): rowId is string | number => (
          typeof rowId === "string" || typeof rowId === "number"
        ))
        : [],
      rowCount: Number.isFinite(candidate.scope.rowCount)
        ? Math.max(0, Math.trunc(candidate.scope.rowCount as number))
        : 0,
      affectedRange: cloneAffectedRange(candidate.scope.affectedRange ?? null),
    },
    ...(candidate.metadata && typeof candidate.metadata === "object"
      ? { metadata: clonePlainValue(candidate.metadata as Record<string, unknown>) }
      : {}),
  }
}

function cloneHistoryOperation(
  operation: DataGridAppHistoryOperationPayload,
): DataGridAppHistoryOperationPayload {
  return clonePlainValue(operation)
}

function resolveHistoryOperationKind(value: unknown): DataGridAppHistoryOperationKind {
  switch (value) {
    case "edit":
    case "paste":
    case "cut-paste":
    case "fill":
    case "range-move":
    case "row-insert":
    case "row-delete":
    case "placeholder-materialization":
    case "snapshot-fallback":
      return value
    case "move":
      return "range-move"
    default:
      return "snapshot-fallback"
  }
}

function collectHistoryOperationRowIds<TRow>(
  beforeSnapshot: DataGridAppRowSnapshot<TRow>,
  afterSnapshot: DataGridAppRowSnapshot<TRow>,
): readonly (string | number)[] {
  const rowIds = new Set<string | number>()
  for (const entry of beforeSnapshot.rows) {
    rowIds.add(entry.rowId)
  }
  for (const entry of afterSnapshot.rows) {
    rowIds.add(entry.rowId)
  }
  return Array.from(rowIds)
}

function cloneAffectedRange(
  range: DataGridIntentTransactionDescriptor["affectedRange"] | null,
): DataGridAppHistoryOperationScope["affectedRange"] {
  if (!range) {
    return null
  }
  return {
    startRow: range.startRow,
    endRow: range.endRow,
    startColumn: range.startColumn,
    endColumn: range.endColumn,
  }
}

function cloneRestorationState(
  state: DataGridAppHistoryRestorationState | null | undefined,
): DataGridAppHistoryRestorationState | null {
  if (!state || typeof state !== "object") {
    return null
  }
  return {
    ...(state.activeCell ? { activeCell: { ...state.activeCell } } : {}),
    ...(typeof state.selectionSnapshot !== "undefined"
      ? { selectionSnapshot: clonePlainValue(state.selectionSnapshot) }
      : {}),
    ...(state.scrollAnchor ? { scrollAnchor: { ...state.scrollAnchor } } : {}),
    ...(state.focusTarget ? { focusTarget: { ...state.focusTarget } } : {}),
    ...(state.editTarget ? { editTarget: { ...state.editTarget } } : {}),
  }
}

function clonePlainValue<T>(value: T): T {
  if (value == null) {
    return value
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}
