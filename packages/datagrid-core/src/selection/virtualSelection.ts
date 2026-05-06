import type { DataGridRowId, DataGridRowModelSnapshot } from "../models/rowModel.js"
import type { GridSelectionPoint } from "./selectionState.js"
import type { GridSelectionSnapshot } from "./snapshot.js"

export interface DataGridSelectionRangeLike {
  startRow: number
  endRow: number
  startCol?: number
  endCol?: number
  startColumn?: number
  endColumn?: number
}

export interface DataGridNormalizedSelectionRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridSelectionMissingRowInterval {
  startRow: number
  endRow: number
}

export interface DataGridSelectionLoadedRowId<TRowKey = DataGridRowId> {
  rowIndex: number
  rowId: TRowKey
}

export interface DataGridSelectionLoadedCoverage<TRowKey = DataGridRowId> {
  isFullyLoaded: boolean
  loadedRowCount: number
  totalRowCount: number
  missingIntervals: readonly DataGridSelectionMissingRowInterval[]
  rowIds: readonly DataGridSelectionLoadedRowId<TRowKey>[]
}

export interface DataGridSelectionProjectionIdentity {
  rowModelKind?: string
  revision?: string | number | null
  datasetVersion?: string | number | null
  projectionKey?: string | null
}

export interface DataGridVirtualSelectionMetadata<TRowKey = DataGridRowId> {
  anchorCell: GridSelectionPoint<TRowKey>
  focusCell: GridSelectionPoint<TRowKey>
  startRowIndex: number
  endRowIndex: number
  startColumnIndex: number
  endColumnIndex: number
  rowIds: readonly DataGridSelectionLoadedRowId<TRowKey>[]
  coverage: DataGridSelectionLoadedCoverage<TRowKey>
  datasetVersion?: string | number | null
  projectionIdentity?: DataGridSelectionProjectionIdentity | null
  projectionStale?: boolean
  staleReason?: string | null
  isVirtualSelection: boolean
}

export type DataGridVirtualSelectionOperation =
  | "navigate"
  | "copy"
  | "cut"
  | "clear"
  | "delete"
  | "fill"
  | "inline-edit"
  | "range-move"

export interface DataGridVirtualSelectionServerCapabilities {
  copy?: boolean
  cut?: boolean
  clear?: boolean
  delete?: boolean
  fill?: boolean
  rangeMove?: boolean
}

export interface DataGridVirtualSelectionOperationDecision {
  allowed: boolean
  mode: "materialized" | "server" | "virtual" | "blocked"
  requiresMaterializedValues: boolean
  canDelegateToServer: boolean
  reason: string | null
}

export interface CollectDataGridSelectionLoadedCoverageOptions<TRowKey = DataGridRowId> {
  isRowLoaded: (rowIndex: number) => boolean
  getRowIdAtIndex?: (rowIndex: number) => TRowKey | null | undefined
}

export interface CreateDataGridVirtualSelectionMetadataOptions<TRowKey = DataGridRowId> {
  range: DataGridSelectionRangeLike
  anchorCell: GridSelectionPoint<TRowKey>
  focusCell: GridSelectionPoint<TRowKey>
  coverage: DataGridSelectionLoadedCoverage<TRowKey>
  projectionIdentity?: DataGridSelectionProjectionIdentity | null
  projectionStale?: boolean
  staleReason?: string | null
}

export function normalizeDataGridSelectionRangeLike(
  range: DataGridSelectionRangeLike,
): DataGridNormalizedSelectionRange | null {
  const startColumn = typeof range.startColumn === "number" ? range.startColumn : range.startCol
  const endColumn = typeof range.endColumn === "number" ? range.endColumn : range.endCol
  if (
    !Number.isFinite(range.startRow)
    || !Number.isFinite(range.endRow)
    || !Number.isFinite(startColumn)
    || !Number.isFinite(endColumn)
  ) {
    return null
  }
  // Normalize direction only. Bounds are not clamped here because selection
  // controllers own dataset-specific row and column limits.
  return {
    startRow: Math.min(Math.trunc(range.startRow), Math.trunc(range.endRow)),
    endRow: Math.max(Math.trunc(range.startRow), Math.trunc(range.endRow)),
    startColumn: Math.min(Math.trunc(startColumn as number), Math.trunc(endColumn as number)),
    endColumn: Math.max(Math.trunc(startColumn as number), Math.trunc(endColumn as number)),
  }
}

// Current coverage helpers intentionally scan row-by-row. They are intended for
// selection-sized and viewport-adjacent checks. TODO: accept loaded row intervals
// directly before using these helpers for very large virtual ranges.
export function getDataGridSelectionMissingRowIntervals(
  range: DataGridSelectionRangeLike,
  isRowLoaded: (rowIndex: number) => boolean,
): readonly DataGridSelectionMissingRowInterval[] {
  const normalized = normalizeDataGridSelectionRangeLike(range)
  if (!normalized) {
    return []
  }
  const intervals: DataGridSelectionMissingRowInterval[] = []
  let openStart: number | null = null
  let openEnd: number | null = null
  for (let rowIndex = normalized.startRow; rowIndex <= normalized.endRow; rowIndex += 1) {
    if (isRowLoaded(rowIndex)) {
      if (openStart != null && openEnd != null) {
        intervals.push({ startRow: openStart, endRow: openEnd })
      }
      openStart = null
      openEnd = null
      continue
    }
    if (openStart == null) {
      openStart = rowIndex
    }
    openEnd = rowIndex
  }
  if (openStart != null && openEnd != null) {
    intervals.push({ startRow: openStart, endRow: openEnd })
  }
  return intervals
}

export function isDataGridSelectionRangeFullyLoaded(
  range: DataGridSelectionRangeLike,
  isRowLoaded: (rowIndex: number) => boolean,
): boolean {
  return getDataGridSelectionMissingRowIntervals(range, isRowLoaded).length === 0
}

export function getDataGridSelectionVisibleRowOverlap(
  selectionRange: DataGridSelectionRangeLike,
  visibleRange: { startRow?: number; endRow?: number; start?: number; end?: number },
): DataGridNormalizedSelectionRange | null {
  const normalized = normalizeDataGridSelectionRangeLike(selectionRange)
  const visibleStart = typeof visibleRange.startRow === "number" ? visibleRange.startRow : visibleRange.start
  const visibleEnd = typeof visibleRange.endRow === "number" ? visibleRange.endRow : visibleRange.end
  if (!normalized || !Number.isFinite(visibleStart) || !Number.isFinite(visibleEnd)) {
    return null
  }
  const startRow = Math.max(normalized.startRow, Math.trunc(visibleStart as number))
  const endRow = Math.min(normalized.endRow, Math.trunc(visibleEnd as number))
  if (startRow > endRow) {
    return null
  }
  return {
    ...normalized,
    startRow,
    endRow,
  }
}

export function collectDataGridSelectionLoadedCoverage<TRowKey = DataGridRowId>(
  range: DataGridSelectionRangeLike,
  options: CollectDataGridSelectionLoadedCoverageOptions<TRowKey>,
): DataGridSelectionLoadedCoverage<TRowKey> {
  const normalized = normalizeDataGridSelectionRangeLike(range)
  if (!normalized) {
    return {
      isFullyLoaded: false,
      loadedRowCount: 0,
      totalRowCount: 0,
      missingIntervals: [],
      rowIds: [],
    }
  }
  const rowIds: DataGridSelectionLoadedRowId<TRowKey>[] = []
  let loadedRowCount = 0
  for (let rowIndex = normalized.startRow; rowIndex <= normalized.endRow; rowIndex += 1) {
    if (!options.isRowLoaded(rowIndex)) {
      continue
    }
    loadedRowCount += 1
    const rowId = options.getRowIdAtIndex?.(rowIndex)
    if (rowId != null) {
      rowIds.push({ rowIndex, rowId })
    }
  }
  const missingIntervals = getDataGridSelectionMissingRowIntervals(normalized, options.isRowLoaded)
  return {
    isFullyLoaded: missingIntervals.length === 0,
    loadedRowCount,
    totalRowCount: normalized.endRow - normalized.startRow + 1,
    missingIntervals,
    rowIds,
  }
}

export function doesDataGridOperationRequireMaterializedValues(
  operation: DataGridVirtualSelectionOperation,
): boolean {
  // For server-delegated operations this means "requires materialized values
  // when handled locally"; evaluateDataGridVirtualSelectionOperation may still
  // return mode "server" for unloaded ranges with matching capabilities.
  return (
    operation === "copy"
    || operation === "cut"
    || operation === "clear"
    || operation === "delete"
    || operation === "fill"
    || operation === "range-move"
  )
}

export function canDataGridOperationDelegateToServer(
  operation: DataGridVirtualSelectionOperation,
  capabilities: DataGridVirtualSelectionServerCapabilities = {},
): boolean {
  if (operation === "copy") {
    return capabilities.copy === true
  }
  if (operation === "cut") {
    return capabilities.cut === true || (capabilities.copy === true && capabilities.clear === true)
  }
  if (operation === "clear") {
    return capabilities.clear === true
  }
  if (operation === "delete") {
    return capabilities.delete === true
  }
  if (operation === "fill") {
    return capabilities.fill === true
  }
  if (operation === "range-move") {
    return capabilities.rangeMove === true
  }
  return false
}

function getDataGridVirtualSelectionBlockedReason(
  operation: DataGridVirtualSelectionOperation,
): string {
  if (operation === "copy") {
    return "Selected range includes unloaded rows and cannot be copied without server support."
  }
  if (operation === "cut") {
    return "Selected range includes unloaded rows and cannot be cut without server support."
  }
  if (operation === "clear" || operation === "delete") {
    return "Selected range includes unloaded rows and cannot be modified without server support."
  }
  if (operation === "fill") {
    return "Selected fill range includes unloaded rows and server-backed fill is not available."
  }
  if (operation === "range-move") {
    return "Selected range includes unloaded rows and range move cannot be performed without server support."
  }
  return "Selected range includes unloaded rows."
}

export function evaluateDataGridVirtualSelectionOperation(
  operation: DataGridVirtualSelectionOperation,
  coverage: Pick<DataGridSelectionLoadedCoverage, "isFullyLoaded">,
  capabilities: DataGridVirtualSelectionServerCapabilities = {},
): DataGridVirtualSelectionOperationDecision {
  const requiresMaterializedValues = doesDataGridOperationRequireMaterializedValues(operation)
  const canDelegateToServer = canDataGridOperationDelegateToServer(operation, capabilities)
  if (!requiresMaterializedValues) {
    return {
      allowed: true,
      mode: "virtual",
      requiresMaterializedValues,
      canDelegateToServer,
      reason: null,
    }
  }
  if (coverage.isFullyLoaded) {
    return {
      allowed: true,
      mode: "materialized",
      requiresMaterializedValues,
      canDelegateToServer,
      reason: null,
    }
  }
  if (canDelegateToServer) {
    return {
      allowed: true,
      mode: "server",
      requiresMaterializedValues,
      canDelegateToServer,
      reason: null,
    }
  }
  return {
    allowed: false,
    mode: "blocked",
    requiresMaterializedValues,
    canDelegateToServer,
    reason: getDataGridVirtualSelectionBlockedReason(operation),
  }
}

export function createDataGridVirtualSelectionMetadata<TRowKey = DataGridRowId>(
  options: CreateDataGridVirtualSelectionMetadataOptions<TRowKey>,
): DataGridVirtualSelectionMetadata<TRowKey> {
  const normalized = normalizeDataGridSelectionRangeLike(options.range) ?? {
    startRow: 0,
    endRow: 0,
    startColumn: 0,
    endColumn: 0,
  }
  return {
    anchorCell: { ...options.anchorCell },
    focusCell: { ...options.focusCell },
    startRowIndex: normalized.startRow,
    endRowIndex: normalized.endRow,
    startColumnIndex: normalized.startColumn,
    endColumnIndex: normalized.endColumn,
    rowIds: [...options.coverage.rowIds],
    coverage: {
      isFullyLoaded: options.coverage.isFullyLoaded,
      loadedRowCount: options.coverage.loadedRowCount,
      totalRowCount: options.coverage.totalRowCount,
      missingIntervals: [...options.coverage.missingIntervals],
      rowIds: [...options.coverage.rowIds],
    },
    datasetVersion: options.projectionIdentity?.datasetVersion ?? null,
    projectionIdentity: options.projectionIdentity ?? null,
    projectionStale: options.projectionStale === true,
    staleReason: options.staleReason ?? null,
    isVirtualSelection: !options.coverage.isFullyLoaded,
  }
}

export function buildDataGridSelectionProjectionIdentity(
  snapshot: DataGridRowModelSnapshot | null | undefined,
): DataGridSelectionProjectionIdentity | null {
  if (!snapshot) {
    return null
  }
  return {
    rowModelKind: snapshot.kind,
    revision: snapshot.revision ?? null,
    datasetVersion: snapshot.datasetVersion ?? null,
    projectionKey: JSON.stringify({
      rowModelKind: snapshot.kind,
      sortModel: snapshot.sortModel ?? [],
      filterModel: snapshot.filterModel ?? null,
      groupBy: snapshot.groupBy ?? null,
      groupExpansion: snapshot.groupExpansion ?? null,
      pivotModel: snapshot.pivotModel ?? null,
      pagination: snapshot.pagination ?? null,
    }),
  }
}

export function markDataGridVirtualSelectionProjectionStale<TRowKey = unknown>(
  snapshot: GridSelectionSnapshot<TRowKey>,
  reason: string,
): GridSelectionSnapshot<TRowKey> {
  return {
    ...snapshot,
    ranges: snapshot.ranges.map(range => (
      range.virtual
        ? {
            ...range,
            virtual: {
              ...range.virtual,
              projectionStale: true,
              staleReason: reason,
            },
          }
        : range
    )),
  }
}
