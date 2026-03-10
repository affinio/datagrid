import { computed, ref, type Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowId,
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
  resolveRuntime?: () => Pick<UseDataGridRuntimeResult<TRow>, "api"> | null
  visibleColumns?: Ref<readonly DataGridColumnSnapshot[]>
  totalRows?: Ref<number>
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

function normalizeRowId(value: unknown): DataGridRowId | null {
  return typeof value === "string" || typeof value === "number" ? value : null
}

function formatAggregateNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—"
  }
  return aggregateNumberFormatter.format(value)
}

export function useDataGridAppSelection<TRow>(
  options: UseDataGridAppSelectionOptions<TRow>,
): UseDataGridAppSelectionResult<TRow> {
  const selectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
  const selectionAnchor = ref<GridSelectionPointLike<DataGridRowId> | null>(null)

  const syncSelectionState = (snapshot: DataGridSelectionSnapshot | null): void => {
    selectionSnapshot.value = snapshot
    if (!snapshot || snapshot.ranges.length === 0) {
      selectionAnchor.value = null
      return
    }
    const activeIndex = snapshot.activeRangeIndex ?? 0
    const activeRange = snapshot.ranges[activeIndex] ?? snapshot.ranges[0] ?? null
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
    getSelectionSnapshot: () => selectionSnapshot.value,
    setSelectionSnapshot: snapshot => {
      syncSelectionState(snapshot)
    },
    clearSelection: () => {
      syncSelectionState(null)
    },
  }

  const runtimeServices = {
    selection: selectionService,
  }

  const syncSelectionSnapshotFromRuntime = (): void => {
    const runtime = options.resolveRuntime?.() ?? null
    syncSelectionState(
      runtime?.api.selection.hasSupport()
        ? runtime.api.selection.getSnapshot()
        : null,
    )
  }

  const selectionAggregates = computed<{
    count: number
    sum: number | null
    min: number | null
    max: number | null
    average: number | null
  } | null>(() => {
    if (resolveMaybeRef(options.mode) !== "base") {
      return null
    }
    const runtime = options.resolveRuntime?.() ?? null
    if (!runtime || !options.visibleColumns || !options.totalRows) {
      return null
    }
    const snapshot = selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return null
    }
    const rowCount = options.totalRows.value
    const columnCount = options.visibleColumns.value.length
    if (rowCount <= 0 || columnCount <= 0) {
      return null
    }

    let selectedCellCount = 0
    let numericCount = 0
    let numericSum = 0
    let numericMin = Number.POSITIVE_INFINITY
    let numericMax = Number.NEGATIVE_INFINITY
    const seenCells = new Set<string>()

    for (const range of snapshot.ranges) {
      const startRow = Math.max(0, Math.min(rowCount - 1, Math.min(range.startRow, range.endRow)))
      const endRow = Math.max(0, Math.min(rowCount - 1, Math.max(range.startRow, range.endRow)))
      const startColumn = Math.max(0, Math.min(columnCount - 1, Math.min(range.startCol, range.endCol)))
      const endColumn = Math.max(0, Math.min(columnCount - 1, Math.max(range.startCol, range.endCol)))

      for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
        const rowNode = runtime.api.rows.get(rowIndex)
        if (!rowNode || rowNode.kind === "group") {
          continue
        }
        for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
          const cellKey = `${rowIndex}:${columnIndex}`
          if (seenCells.has(cellKey)) {
            continue
          }
          seenCells.add(cellKey)
          selectedCellCount += 1

          const columnKey = options.visibleColumns.value[columnIndex]?.key
          if (!columnKey) {
            continue
          }
          const rawValue = (rowNode.data as Record<string, unknown>)[columnKey]
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
      sum: numericCount > 0 ? numericSum : null,
      min: numericCount > 0 ? numericMin : null,
      max: numericCount > 0 ? numericMax : null,
      average: numericCount > 0 ? numericSum / numericCount : null,
    }
  })

  const selectionAggregatesLabel = computed<string>(() => {
    const summary = selectionAggregates.value
    if (!summary) {
      return ""
    }
    return `Selection: count ${summary.count} · sum ${formatAggregateNumber(summary.sum)} · min ${formatAggregateNumber(summary.min)} · max ${formatAggregateNumber(summary.max)} · avg ${formatAggregateNumber(summary.average)}`
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
