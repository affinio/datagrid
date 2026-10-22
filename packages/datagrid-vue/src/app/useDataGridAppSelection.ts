import { computed, ref, watch, type Ref } from "vue"
import {
  buildDataGridSelectionProjectionIdentity,
  markDataGridVirtualSelectionProjectionStale,
} from "@affino/datagrid-core"
import type {
  DataGridColumnSnapshot,
  DataGridRowId,
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import type { GridSelectionPointLike } from "@affino/datagrid-core/advanced"
import type { UseDataGridRuntimeOptions, UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode } from "./useDataGridAppControls"

type MaybeRef<T> = T | Ref<T>

function resolveMaybeRef<T>(value: MaybeRef<T>): T {
  if (typeof value === "object" && value !== null && "value" in value) {
    return value.value as T
  }
  return value
}

export interface UseDataGridAppSelectionOptions<TRow> {
  mode: MaybeRef<DataGridAppMode>
  resolveRuntime?: () => (Pick<UseDataGridRuntimeResult<TRow>, "api"> & Partial<Pick<UseDataGridRuntimeResult<TRow>, "rowModel">>) | null
  visibleColumns?: Ref<readonly DataGridColumnSnapshot[]>
  totalRows?: Ref<number>
  showRowSelection?: MaybeRef<boolean>
  readSelectionCell?: (row: DataGridRowNode<TRow>, columnKey: string) => unknown
  resolveSelectionRowAtIndex?: (rowIndex: number) => DataGridRowNode<TRow> | null
}

export interface UseDataGridAppSelectionResult<TRow> {
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  selectionAnchor: Ref<GridSelectionPointLike<DataGridRowId> | null>
  selectionService: NonNullable<NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>["selection"]>
  runtimeServices: Pick<NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>, "selection">
  selectionAggregatesLabel: Ref<string>
  syncSelectionSnapshotFromRuntime: () => void
}

const aggregateNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
const SELECTION_AGGREGATE_CELL_BUDGET = 50_000

function normalizeRowId(value: unknown): DataGridRowId | null {
  return typeof value === "string" || typeof value === "number" ? value : null
}

function formatAggregateNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—"
  }
  return aggregateNumberFormatter.format(value)
}

function readSelectionCellValue<TRow>(
  api: UseDataGridRuntimeResult<TRow>["api"],
  rowNode: DataGridRowNode<TRow>,
  column: DataGridColumnSnapshot | undefined,
  readSelectionCell?: (row: DataGridRowNode<TRow>, columnKey: string) => unknown,
): unknown {
  if (!column) {
    return undefined
  }
  if (readSelectionCell) {
    const customValue = readSelectionCell(rowNode, column.key)
    if (typeof customValue !== "undefined") return customValue
  }
  const resolveValue = api.cells?.resolveValue
  if (typeof resolveValue !== "function") {
    const valueGetter = (column.column as { valueGetter?: (row: unknown) => unknown }).valueGetter
    if (typeof valueGetter === "function") return valueGetter(rowNode.data)
    const data = rowNode.data as Record<string, unknown> | undefined
    const field = (column.column as { field?: string }).field ?? column.key
    return data?.[field]
  }
  const resolved = resolveValue({ rowId: rowNode.rowId, columnKey: column.key, purpose: "computed" })
  return resolved.status === "available" ? resolved.computedValue : undefined
}

function resolveRowModelVersionKey<TRow>(snapshot: DataGridRowModelSnapshot<TRow>): string {
  return [
    snapshot.kind,
    snapshot.revision ?? "",
    snapshot.datasetVersion ?? "",
    snapshot.rowCount,
    snapshot.loading ? 1 : 0,
    snapshot.projection?.recomputeVersion ?? snapshot.projection?.version ?? "",
  ].join("|")
}

function selectionHasFreshVirtualMetadata(snapshot: DataGridSelectionSnapshot | null): boolean {
  return snapshot?.ranges.some(range => range.virtual && range.virtual.projectionStale !== true) === true
}

function hasLeadingRowSelectionColumn<TRow>(
  showRowSelection: boolean,
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api"> | null,
): boolean {
  return showRowSelection && runtime?.api.rowSelection?.hasSupport?.() === true
}

function resolveSelectionColumnAtIndex(
  visibleColumns: readonly DataGridColumnSnapshot[],
  columnIndex: number,
  hasRowSelectionColumn: boolean,
): DataGridColumnSnapshot | undefined {
  const normalizedIndex = hasRowSelectionColumn ? columnIndex - 1 : columnIndex
  if (normalizedIndex < 0) {
    return undefined
  }
  return visibleColumns[normalizedIndex]
}

export function useDataGridAppSelection<TRow>(
  options: UseDataGridAppSelectionOptions<TRow>,
): UseDataGridAppSelectionResult<TRow> {
  const selectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
  const selectionAnchor = ref<GridSelectionPointLike<DataGridRowId> | null>(null)
  const rowVersion = ref(0)
  let observedRowModel: DataGridRowModel<TRow> | null = null
  let pendingReconcileSnapshot: DataGridSelectionSnapshot | null = null

  const syncSelectionState = (snapshot: DataGridSelectionSnapshot | null): void => {
    const runtime = options.resolveRuntime?.() ?? null
    const rowSnapshot = runtime?.api.rows?.getSnapshot?.()
    const columnSnapshot = runtime?.api.columns?.getSnapshot?.()
    const currentSnapshot = snapshot && rowSnapshot && columnSnapshot
      ? {
          ...snapshot,
          projectionRevision: buildDataGridSelectionProjectionIdentity(rowSnapshot)?.revision ?? null,
          columnRevision: columnSnapshot.orderRevision,
        }
      : snapshot
    selectionSnapshot.value = currentSnapshot
    if (!currentSnapshot || currentSnapshot.ranges.length === 0) {
      selectionAnchor.value = null
      return
    }
    const activeIndex = currentSnapshot.activeRangeIndex ?? 0
    const activeRange = currentSnapshot.ranges[activeIndex] ?? currentSnapshot.ranges[0] ?? null
    const anchor = activeRange?.anchor ?? null
    selectionAnchor.value = anchor
      ? {
          rowIndex: anchor.rowIndex,
          colIndex: anchor.colIndex,
          rowId: normalizeRowId(anchor.rowId),
        }
      : null
  }

  const selectionService: NonNullable<NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>["selection"]> = {
    name: "selection",
    getSelectionSnapshot: () => selectionSnapshot.value ?? pendingReconcileSnapshot,
    setSelectionSnapshot: snapshot => {
      pendingReconcileSnapshot = null
      syncSelectionState(snapshot)
    },
    clearSelection: () => {
      pendingReconcileSnapshot = null
      syncSelectionState(null)
    },
  }

  const runtimeServices = {
    selection: selectionService,
  }

  const syncSelectionSnapshotFromRuntime = (): void => {
    const runtime = options.resolveRuntime?.() ?? null
    if (!runtime?.api.selection.hasSupport()) {
      syncSelectionState(null)
      return
    }
    let snapshot = runtime.api.selection.getSnapshot()
    const rowModel = runtime.rowModel ?? observedRowModel
    if (!snapshot && runtime.api.selection.getSnapshotStatus?.() === "stale") {
      const candidate = selectionSnapshot.value ?? pendingReconcileSnapshot
      snapshot = reconcileSingleCellSelection(candidate, rowModel)
      if (snapshot) {
        pendingReconcileSnapshot = null
        runtime.api.selection.setSnapshot(snapshot)
      } else if (hasStableSingleCellAnchor(candidate)) {
        pendingReconcileSnapshot = candidate
        return
      }
    } else if (snapshot) {
      pendingReconcileSnapshot = null
    }
    syncSelectionState(snapshot)
  }

  const hasStableSingleCellAnchor = (snapshot: DataGridSelectionSnapshot | null): snapshot is DataGridSelectionSnapshot => {
    if (!snapshot || snapshot.ranges.length !== 1) return false
    const range = snapshot.ranges[0]
    return !!range
      && range.startRow === range.endRow
      && range.startCol === range.endCol
      && normalizeRowId(range.anchor.rowId) != null
  }

  const hasMaterializationPlaceholderAnchor = (snapshot: DataGridSelectionSnapshot | null): boolean => {
    const rowId = normalizeRowId(snapshot?.ranges[0]?.anchor.rowId)
    return typeof rowId === "string"
      && (/^__datagrid_placeholder__:\d+$/.test(rowId) || /^__affino_datagrid_data_source_loading__:\d+$/.test(rowId))
  }

  const markCurrentSelectionProjectionStale = (reason: string): void => {
    const snapshot = selectionSnapshot.value
    if (!snapshot || !selectionHasFreshVirtualMetadata(snapshot)) {
      return
    }
    const staleSnapshot = markDataGridVirtualSelectionProjectionStale(snapshot, reason)
    syncSelectionState(staleSnapshot)
    const runtime = options.resolveRuntime?.() ?? null
    if (runtime?.api.selection.hasSupport()) {
      runtime.api.selection.setSnapshot(staleSnapshot)
    }
  }

  const reconcileSingleCellSelection = (
    snapshot: DataGridSelectionSnapshot | null,
    rowModel: DataGridRowModel<TRow> | null,
  ): DataGridSelectionSnapshot | null => {
    if (!snapshot || snapshot.ranges.length !== 1) return null
    const range = snapshot.ranges[0]
    if (!range || range.startRow !== range.endRow || range.startCol !== range.endCol) {
      return null
    }
    const anchorRowId = normalizeRowId(range.anchor.rowId)
    const readRowAt = (index: number): DataGridRowNode<TRow> | null => (
      rowModel?.getRow(index) ?? options.resolveSelectionRowAtIndex?.(index) ?? null
    )
    let rowIndex = range.anchor.rowIndex
    let currentRow: DataGridRowNode<TRow> | null = null
    if (anchorRowId != null) {
      const resolution = options.resolveRuntime?.()?.api.rows?.resolveById?.(anchorRowId)
      const identityRow = resolution?.status === "loaded"
        ? resolution.row
        : rowModel?.getRowById?.(anchorRowId)
      const identityIndex = identityRow?.displayIndex
      if (
        Number.isFinite(identityIndex)
        && normalizeRowId(readRowAt(identityIndex as number)?.rowId) === anchorRowId
      ) {
        rowIndex = identityIndex as number
        currentRow = readRowAt(rowIndex)
      }
    } else {
      currentRow = readRowAt(rowIndex)
    }
    if (
      !currentRow
      && typeof anchorRowId === "string"
      && (/^__datagrid_placeholder__:\d+$/.test(anchorRowId) || /^__affino_datagrid_data_source_loading__:\d+$/.test(anchorRowId))
    ) {
      const materializedRow = readRowAt(rowIndex)
      if (materializedRow && (materializedRow as { __placeholder?: boolean }).__placeholder !== true) {
        currentRow = materializedRow
      }
    }
    const currentRowId = normalizeRowId(currentRow?.rowId)
    if (!currentRow || currentRowId == null) return null
    const rebasePoint = (point: typeof range.anchor) => ({ ...point, rowIndex, rowId: currentRowId })
    const nextRange = {
      ...range,
      startRowId: currentRowId,
      endRowId: currentRowId,
      anchor: rebasePoint(range.anchor),
      focus: rebasePoint(range.focus),
    }
    const activeCell = snapshot.activeCell
      ? { ...snapshot.activeCell, rowIndex, rowId: currentRowId }
      : null
    return {
      ...snapshot,
      ranges: [nextRange],
      activeCell,
      projectionRevision: buildDataGridSelectionProjectionIdentity(
        rowModel?.getSnapshot() ?? options.resolveRuntime?.()?.api.rows?.getSnapshot?.(),
      )?.revision ?? null,
    }
  }

  watch(
    () => options.resolveRuntime?.()?.rowModel ?? null,
    (rowModel, _previous, onCleanup) => {
      if (!rowModel) {
        observedRowModel = null
        return
      }
      observedRowModel = rowModel
      let lastVersionKey = resolveRowModelVersionKey(rowModel.getSnapshot())
      let lastProjectionKey = buildDataGridSelectionProjectionIdentity(rowModel.getSnapshot())?.projectionKey ?? null
      const unsubscribe = rowModel.subscribe(() => {
        const nextSnapshot = rowModel.getSnapshot()
        const nextProjectionKey = buildDataGridSelectionProjectionIdentity(nextSnapshot)?.projectionKey ?? null
        const nextVersionKey = resolveRowModelVersionKey(nextSnapshot)
        const rowModelChanged = nextVersionKey !== lastVersionKey
        if (lastProjectionKey != null && nextProjectionKey != null && nextProjectionKey !== lastProjectionKey) {
          const candidate = selectionSnapshot.value ?? pendingReconcileSnapshot
          const reconciled = reconcileSingleCellSelection(candidate, rowModel)
          if (reconciled) {
            pendingReconcileSnapshot = null
            syncSelectionState(reconciled)
            if (options.resolveRuntime?.()?.api.selection.hasSupport()) {
              options.resolveRuntime?.()?.api.selection.setSnapshot(reconciled)
            }
          } else {
            if (hasStableSingleCellAnchor(candidate)) {
              pendingReconcileSnapshot = candidate
            } else {
              markCurrentSelectionProjectionStale("projection-changed")
            }
          }
        } else if (rowModelChanged && (pendingReconcileSnapshot || hasMaterializationPlaceholderAnchor(selectionSnapshot.value))) {
          // Viewport updates are frequent for sparse/worker models. Only retry
          // a pending anchor or a recognized placeholder being materialized;
          // probing arbitrary selections here can turn one scroll into O(N)
          // individual datasource requests.
          const candidate = pendingReconcileSnapshot ?? selectionSnapshot.value
          const reconciled = reconcileSingleCellSelection(candidate, rowModel)
          if (reconciled) {
            pendingReconcileSnapshot = null
            syncSelectionState(reconciled)
            if (options.resolveRuntime?.()?.api.selection.hasSupport()) {
              options.resolveRuntime?.()?.api.selection.setSnapshot(reconciled)
            }
          } else if (hasStableSingleCellAnchor(candidate)) {
            pendingReconcileSnapshot = candidate
          }
        }
        lastProjectionKey = nextProjectionKey
        if (nextVersionKey === lastVersionKey) {
          return
        }
        lastVersionKey = nextVersionKey
        rowVersion.value += 1
      })
      onCleanup(() => {
        unsubscribe()
      })
    },
    { immediate: true },
  )
  const selectionAggregates = computed<{
    count: number
    loadedCount: number
    sum: number | null
    min: number | null
    max: number | null
    average: number | null
    isPartial: boolean
    isBudgeted: boolean
  } | null>(() => {
    void rowVersion.value
    if (resolveMaybeRef(options.mode) !== "base") {
      return null
    }
    const runtime = options.resolveRuntime?.() ?? null
    if (!runtime || !options.visibleColumns || !options.totalRows) {
      return null
    }
    const hasRowSelectionColumn = hasLeadingRowSelectionColumn(
      resolveMaybeRef(options.showRowSelection ?? true),
      runtime,
    )
    const snapshot = selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return null
    }
    const rowCount = options.totalRows.value
    const columnCount = options.visibleColumns.value.length + (hasRowSelectionColumn ? 1 : 0)
    if (rowCount <= 0 || columnCount <= 0) {
      return null
    }

    let selectedCellCount = 0
    let loadedSelectedCellCount = 0
    let numericCount = 0
    let numericSum = 0
    let numericMin = Number.POSITIVE_INFINITY
    let numericMax = Number.NEGATIVE_INFINITY
    let processedCellCount = 0
    let budgetExceeded = false
    const seenCells = new Set<string>()
    const seenSelectedCells = new Set<string>()

    for (const range of snapshot.ranges) {
      const startRow = Math.max(0, Math.min(rowCount - 1, Math.min(range.startRow, range.endRow)))
      const endRow = Math.max(0, Math.min(rowCount - 1, Math.max(range.startRow, range.endRow)))
      const startColumn = Math.max(0, Math.min(columnCount - 1, Math.min(range.startCol, range.endCol)))
      const endColumn = Math.max(0, Math.min(columnCount - 1, Math.max(range.startCol, range.endCol)))
      const selectedColumnIndexes: number[] = []

      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
        const column = resolveSelectionColumnAtIndex(
          options.visibleColumns.value,
          columnIndex,
          hasRowSelectionColumn,
        )
        if (column?.key) {
          selectedColumnIndexes.push(columnIndex)
        }
      }
      if (selectedColumnIndexes.length === 0) {
        continue
      }

      const rangeCellCount = (endRow - startRow + 1) * selectedColumnIndexes.length
      const countSelectedCellsExactly = selectedCellCount + rangeCellCount <= SELECTION_AGGREGATE_CELL_BUDGET
      if (!countSelectedCellsExactly) {
        selectedCellCount += rangeCellCount
      }
      if (budgetExceeded) {
        continue
      }

      const missingIntervals = range.virtual?.coverage?.isFullyLoaded === false
        ? range.virtual.coverage.missingIntervals
        : []
      let missingIntervalIndex = 0

      for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
        if (budgetExceeded) {
          break
        }
        const missingInterval = missingIntervals[missingIntervalIndex]
        if (missingInterval && rowIndex > missingInterval.endRow) {
          missingIntervalIndex += 1
        }
        const currentMissingInterval = missingIntervals[missingIntervalIndex]
        if (currentMissingInterval && rowIndex >= currentMissingInterval.startRow && rowIndex <= currentMissingInterval.endRow) {
          const missingEnd = Math.min(endRow, currentMissingInterval.endRow)
          if (countSelectedCellsExactly) {
            for (let missingRowIndex = rowIndex; missingRowIndex <= missingEnd; missingRowIndex += 1) {
              for (const columnIndex of selectedColumnIndexes) {
                const cellKey = `${missingRowIndex}:${columnIndex}`
                if (!seenSelectedCells.has(cellKey)) {
                  seenSelectedCells.add(cellKey)
                  selectedCellCount += 1
                }
              }
            }
          }
          rowIndex = missingEnd
          continue
        }
        const rowNode = options.resolveSelectionRowAtIndex?.(rowIndex) ?? runtime.api.rows.get(rowIndex)
        for (const columnIndex of selectedColumnIndexes) {
          const cellKey = `${rowIndex}:${columnIndex}`
          if (countSelectedCellsExactly && !seenSelectedCells.has(cellKey)) {
            seenSelectedCells.add(cellKey)
            selectedCellCount += 1
          }
          if (seenCells.has(cellKey)) {
            continue
          }
          if (processedCellCount >= SELECTION_AGGREGATE_CELL_BUDGET) {
            budgetExceeded = true
            break
          }

          const column = resolveSelectionColumnAtIndex(
            options.visibleColumns.value,
            columnIndex,
            hasRowSelectionColumn,
          )
          if (!column?.key) {
            continue
          }

          seenCells.add(cellKey)
          processedCellCount += 1
          if (!rowNode || rowNode.kind === "group") {
            continue
          }

          loadedSelectedCellCount += 1
          const rawValue = readSelectionCellValue(runtime.api, rowNode, column, options.readSelectionCell)
          const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue)
          if (!Number.isFinite(numericValue)) {
            continue
          }
          numericCount += 1
          numericSum += numericValue
          numericMin = Math.min(numericMin, numericValue)
          numericMax = Math.max(numericMax, numericValue)
        }
      }
    }

    if (selectedCellCount <= 1) {
      return null
    }

    return {
      count: selectedCellCount,
      loadedCount: loadedSelectedCellCount,
      sum: numericCount > 0 ? numericSum : null,
      min: numericCount > 0 ? numericMin : null,
      max: numericCount > 0 ? numericMax : null,
      average: numericCount > 0 ? numericSum / numericCount : null,
      isPartial: loadedSelectedCellCount < selectedCellCount || budgetExceeded,
      isBudgeted: budgetExceeded,
    }
  })

  const selectionAggregatesLabel = computed<string>(() => {
    const summary = selectionAggregates.value
    if (!summary) {
      return ""
    }
    const loadedLabel = summary.isPartial
      ? ` · loaded ${aggregateNumberFormatter.format(summary.loadedCount)}`
      : ""
    const budgetLabel = summary.isBudgeted ? " · budgeted" : ""
    return `Selection: count ${aggregateNumberFormatter.format(summary.count)}${loadedLabel}${budgetLabel} · sum ${formatAggregateNumber(summary.sum)} · min ${formatAggregateNumber(summary.min)} · max ${formatAggregateNumber(summary.max)} · avg ${formatAggregateNumber(summary.average)}`
  })

  return {
    selectionSnapshot,
    selectionAnchor,
    selectionService,
    runtimeServices,
    selectionAggregatesLabel,
    syncSelectionSnapshotFromRuntime,
  }
}
