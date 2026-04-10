import { computed, shallowRef, type ComputedRef, type Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridRuntimeVirtualWindowSnapshot,
} from "@affino/datagrid-vue"
import {
  isDataGridPlaceholderMaterializeTriggerEnabled,
  type DataGridPlaceholderRowMaterializeTrigger,
  type DataGridPlaceholderRowsOptions,
} from "../config/dataGridPlaceholderRows"

const PLACEHOLDER_ROW_ID_PREFIX = "__datagrid_placeholder__:"

export interface DataGridPlaceholderSurfaceRow<TRow extends Record<string, unknown>>
  extends DataGridRowNode<TRow> {
  __placeholder: true
  __visualRowIndex: number
}

interface DataGridPlaceholderSurfaceRuntime<TRow extends Record<string, unknown>> {
  api: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["api"]
  syncBodyRowsInRange: (range: { start: number; end: number }) => readonly DataGridRowNode<TRow>[]
  setViewportRange: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["setViewportRange"]
  rowPartition: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["rowPartition"]
  virtualWindow: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["virtualWindow"]
  columnSnapshot: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["columnSnapshot"]
  setVirtualWindowRange?: (range: { start: number; end: number }) => void
  setRows?: import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>["setRows"]
  getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<TRow> | null
  resolveBodyRowIndexById: (rowId: string | number) => number
}

export interface UseDataGridTableStagePlaceholderRowsOptions<TRow extends Record<string, unknown>> {
  runtime: DataGridPlaceholderSurfaceRuntime<TRow>
  sourceRows: Ref<readonly TRow[]>
  totalBodyRows: ComputedRef<number>
  placeholderRows: Ref<DataGridPlaceholderRowsOptions<TRow>>
  cloneRowData: (row: TRow) => TRow
}

export interface UseDataGridTableStagePlaceholderRowsResult<TRow extends Record<string, unknown>> {
  totalVisualRows: ComputedRef<number>
  visualRuntime: DataGridPlaceholderSurfaceRuntime<TRow>
  isPlaceholderRow: (row: DataGridRowNode<TRow> | null | undefined) => row is DataGridPlaceholderSurfaceRow<TRow>
  isPlaceholderCellEditable: (column: DataGridColumnSnapshot | null | undefined) => boolean
  ensureMaterializedRowAt: (
    rowIndex: number,
    trigger: DataGridPlaceholderRowMaterializeTrigger,
  ) => DataGridRowNode<TRow> | null
}

function buildPlaceholderRowId(rowIndex: number): string {
  return `${PLACEHOLDER_ROW_ID_PREFIX}${rowIndex}`
}

function parsePlaceholderRowIndex(rowId: string | number): number {
  if (typeof rowId !== "string" || !rowId.startsWith(PLACEHOLDER_ROW_ID_PREFIX)) {
    return -1
  }
  const parsed = Number.parseInt(rowId.slice(PLACEHOLDER_ROW_ID_PREFIX.length), 10)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : -1
}

function createPlaceholderRow<TRow extends Record<string, unknown>>(
  rowIndex: number,
): DataGridPlaceholderSurfaceRow<TRow> {
  const rowId = buildPlaceholderRowId(rowIndex)
  return {
    __placeholder: true,
    __visualRowIndex: rowIndex,
    kind: "leaf",
    rowId,
    rowKey: rowId,
    sourceIndex: rowIndex,
    originalIndex: rowIndex,
    displayIndex: rowIndex,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
    data: {} as TRow,
    row: {} as TRow,
  }
}

export function isDataGridPlaceholderSurfaceRow<TRow extends Record<string, unknown>>(
  row: DataGridRowNode<TRow> | null | undefined,
): row is DataGridPlaceholderSurfaceRow<TRow> {
  return (row as Partial<DataGridPlaceholderSurfaceRow<TRow>> | null)?.__placeholder === true
}

function normalizePlaceholderViewportRange(
  range: { start: number; end: number },
  rowCount: number,
): { start: number; end: number } {
  if (rowCount <= 0) {
    return { start: 0, end: 0 }
  }
  const start = Math.max(0, Math.min(rowCount - 1, Math.trunc(range.start)))
  const end = Math.max(start, Math.min(rowCount - 1, Math.trunc(range.end)))
  return { start, end }
}

function normalizePlaceholderVirtualWindowSnapshot(
  snapshot: DataGridRuntimeVirtualWindowSnapshot | null,
  rangeOverride: { start: number; end: number } | null,
  rowCount: number,
): DataGridRuntimeVirtualWindowSnapshot {
  const normalizedRange = normalizePlaceholderViewportRange(
    rangeOverride
      ?? (snapshot
        ? { start: snapshot.rowStart, end: snapshot.rowEnd }
        : { start: 0, end: Math.max(0, rowCount - 1) }),
    rowCount,
  )
  const colTotal = Math.max(0, snapshot?.colTotal ?? 0)
  const maxColIndex = Math.max(0, colTotal - 1)
  const colStart = snapshot
    ? Math.max(0, Math.min(maxColIndex, Math.trunc(snapshot.colStart)))
    : 0
  const colEnd = snapshot
    ? Math.max(colStart, Math.min(maxColIndex, Math.trunc(snapshot.colEnd)))
    : maxColIndex
  return {
    rowStart: normalizedRange.start,
    rowEnd: normalizedRange.end,
    rowTotal: Math.max(0, rowCount),
    colStart,
    colEnd,
    colTotal,
    overscan: snapshot?.overscan ?? { top: 0, bottom: 0, left: 0, right: 0 },
  }
}

export function useDataGridTableStagePlaceholderRows<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStagePlaceholderRowsOptions<TRow>,
): UseDataGridTableStagePlaceholderRowsResult<TRow> {
  const totalVisualRows = computed(() => {
    return Math.max(0, options.totalBodyRows.value + options.placeholderRows.value.count)
  })
  const visualViewportRange = shallowRef<{ start: number; end: number } | null>(null)

  const getVisualRowAtIndex = (rowIndex: number): DataGridRowNode<TRow> | null => {
    if (!Number.isFinite(rowIndex)) {
      return null
    }
    const normalizedIndex = Math.max(0, Math.trunc(rowIndex))
    if (normalizedIndex < options.totalBodyRows.value) {
      return options.runtime.getBodyRowAtIndex(normalizedIndex)
    }
    if (normalizedIndex >= totalVisualRows.value) {
      return null
    }
    return createPlaceholderRow<TRow>(normalizedIndex)
  }

  const resolveVisualRowIndexById = (rowId: string | number): number => {
    const placeholderIndex = parsePlaceholderRowIndex(rowId)
    if (placeholderIndex >= 0) {
      return placeholderIndex
    }
    return options.runtime.resolveBodyRowIndexById(rowId)
  }

  const isPlaceholderCellEditable = (column: DataGridColumnSnapshot | null | undefined): boolean => {
    return options.placeholderRows.value.createRowAt != null
      && column?.column.capabilities?.editable !== false
  }

  const syncBackingRuntimeViewport = (
    range: { start: number; end: number },
    mode: "viewport" | "virtual-window",
  ): void => {
    if (options.totalBodyRows.value <= 0) {
      return
    }
    const actualRowCount = options.totalBodyRows.value
    const normalizedActualRange = normalizePlaceholderViewportRange({
      start: Math.min(range.start, actualRowCount - 1),
      end: Math.min(range.end, actualRowCount - 1),
    }, actualRowCount)
    if (mode === "viewport") {
      options.runtime.setViewportRange(normalizedActualRange)
      return
    }
    const setVirtualWindowRange = options.runtime.setVirtualWindowRange ?? options.runtime.setViewportRange
    setVirtualWindowRange?.(normalizedActualRange)
  }

  const setVisualViewportRange = (
    range: { start: number; end: number },
    mode: "viewport" | "virtual-window",
  ): { start: number; end: number } => {
    const normalizedRange = normalizePlaceholderViewportRange(range, totalVisualRows.value)
    visualViewportRange.value = normalizedRange
    syncBackingRuntimeViewport(normalizedRange, mode)
    return normalizedRange
  }

  const visualVirtualWindow = computed<DataGridRuntimeVirtualWindowSnapshot>(() => {
    return normalizePlaceholderVirtualWindowSnapshot(
      options.runtime.virtualWindow.value,
      visualViewportRange.value,
      totalVisualRows.value,
    )
  })

  const ensureMaterializedRowAt = (
    rowIndex: number,
    trigger: DataGridPlaceholderRowMaterializeTrigger,
  ): DataGridRowNode<TRow> | null => {
    const normalizedIndex = Math.max(0, Math.trunc(rowIndex))
    if (normalizedIndex < options.totalBodyRows.value) {
      return options.runtime.getBodyRowAtIndex(normalizedIndex)
    }
    const resolvedPlaceholderRows = options.placeholderRows.value
    if (
      !resolvedPlaceholderRows.enabled
      || !resolvedPlaceholderRows.createRowAt
      || !isDataGridPlaceholderMaterializeTriggerEnabled(resolvedPlaceholderRows, trigger)
      || normalizedIndex >= totalVisualRows.value
    ) {
      return null
    }

    const nextSourceRows = [...options.sourceRows.value]
    let materializedCount = options.totalBodyRows.value
    while (materializedCount <= normalizedIndex) {
      const createdRow = resolvedPlaceholderRows.createRowAt({
        visualRowIndex: materializedCount,
        materializedRowCount: materializedCount,
        sourceRows: nextSourceRows,
        reason: trigger,
      })
      if (!createdRow) {
        return null
      }
      const insertedRow = options.cloneRowData(createdRow)
      const inserted = options.runtime.api.rows.insertDataAt(
        materializedCount,
        [insertedRow as unknown as DataGridRowNodeInput<TRow>],
      )
      if (!inserted) {
        if (materializedCount === 0 && typeof options.runtime.setRows === "function") {
          options.runtime.setRows([insertedRow])
        }
        else {
          return null
        }
      }
      nextSourceRows.push(insertedRow)
      materializedCount += 1
    }

    return options.runtime.getBodyRowAtIndex(normalizedIndex)
  }

  const visualRuntime: DataGridPlaceholderSurfaceRuntime<TRow> = {
    ...options.runtime,
    virtualWindow: visualVirtualWindow,
    rowPartition: computed(() => ({
      ...options.runtime.rowPartition.value,
      bodyRowCount: totalVisualRows.value,
    })),
    syncBodyRowsInRange: (range) => {
      const normalizedRange = setVisualViewportRange(range, "virtual-window")
      if (range.end < range.start) {
        return []
      }
      const rows: DataGridRowNode<TRow>[] = []
      for (let rowIndex = normalizedRange.start; rowIndex <= normalizedRange.end; rowIndex += 1) {
        const row = getVisualRowAtIndex(rowIndex)
        if (row) {
          rows.push(row)
        }
      }
      return rows
    },
    setViewportRange: (range) => {
      setVisualViewportRange(range, "viewport")
    },
    setVirtualWindowRange: (range) => {
      setVisualViewportRange(range, "virtual-window")
    },
    getBodyRowAtIndex: getVisualRowAtIndex,
    resolveBodyRowIndexById: resolveVisualRowIndexById,
  }

  return {
    totalVisualRows,
    visualRuntime,
    isPlaceholderRow: isDataGridPlaceholderSurfaceRow,
    isPlaceholderCellEditable,
    ensureMaterializedRowAt,
  }
}