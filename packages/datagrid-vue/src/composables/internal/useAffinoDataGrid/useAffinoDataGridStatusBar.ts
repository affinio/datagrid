import { ref, watch, type Ref } from "vue"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"
import type { AffinoDataGridStatusBarMetrics } from "../../useAffinoDataGrid.types"
import type { UseAffinoDataGridFeatureSuiteResult } from "./useAffinoDataGridFeatureSuite"

interface AffinoDataGridCellRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

interface AffinoDataGridCellSelection {
  rowKey: string
  columnKey: string
}

export interface UseAffinoDataGridStatusBarOptions<TRow> {
  enabled: boolean
  rows: Ref<readonly TRow[]>
  runtime: UseDataGridRuntimeResult<TRow>
  featureSuite: UseAffinoDataGridFeatureSuiteResult<TRow>
  cellSelectionRange: Ref<AffinoDataGridCellRange | null>
  activeCellSelection: Ref<AffinoDataGridCellSelection | null>
  anchorCellSelection: Ref<AffinoDataGridCellSelection | null>
  resolveRowKey: (row: TRow, index: number) => string
}

export interface UseAffinoDataGridStatusBarResult<TRow> {
  enabled: Ref<boolean>
  metrics: Ref<AffinoDataGridStatusBarMetrics<TRow>>
  refresh: () => AffinoDataGridStatusBarMetrics<TRow>
}

export function useAffinoDataGridStatusBar<TRow>(
  options: UseAffinoDataGridStatusBarOptions<TRow>,
): UseAffinoDataGridStatusBarResult<TRow> {
  const statusBarEnabled = ref(options.enabled)

  const buildStatusBarMetrics = (): AffinoDataGridStatusBarMetrics<TRow> => {
    const range = options.cellSelectionRange.value
    const selectedCells = range
      ? (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1)
      : 0
    const selectedSummarySnapshot = options.featureSuite.summaryEnabled.value
      ? (options.featureSuite.selectedSummary.value ?? options.featureSuite.recomputeSelectedSummary())
      : null
    return {
      rowsTotal: options.rows.value.length,
      rowsFiltered: options.runtime.api.getRowCount(),
      columnsVisible: options.runtime.columnSnapshot.value.visibleColumns.length,
      selectedCells,
      selectedRows: options.featureSuite.selectedCount.value,
      activeCell: options.activeCellSelection.value
        ? {
            rowKey: options.activeCellSelection.value.rowKey,
            columnKey: options.activeCellSelection.value.columnKey,
          }
        : null,
      anchorCell: options.anchorCellSelection.value
        ? {
            rowKey: options.anchorCellSelection.value.rowKey,
            columnKey: options.anchorCellSelection.value.columnKey,
          }
        : null,
      summary: selectedSummarySnapshot,
      format: (_columnKey, fallback = "") => fallback,
      getAggregate: (columnKey, aggregation) => {
        const column = selectedSummarySnapshot?.columns?.[columnKey]
        if (!column) {
          return null
        }
        return column.metrics[aggregation] ?? null
      },
      resolveRowByKey: (rowKey: string): TRow | null => {
        for (let index = 0; index < options.rows.value.length; index += 1) {
          const row = options.rows.value[index]
          if (!row) {
            continue
          }
          if (options.resolveRowKey(row, index) === rowKey) {
            return row
          }
        }
        return null
      },
    }
  }

  const statusBarMetrics = ref<AffinoDataGridStatusBarMetrics<TRow>>(buildStatusBarMetrics())

  const refreshStatusBarMetrics = (): AffinoDataGridStatusBarMetrics<TRow> => {
    const nextMetrics = buildStatusBarMetrics()
    statusBarMetrics.value = nextMetrics
    return nextMetrics
  }

  watch(
    [
      () => options.rows.value,
      () => options.featureSuite.selectedCount.value,
      options.cellSelectionRange,
      () => options.featureSuite.selectedSummary.value,
      () => options.runtime.columnSnapshot.value.visibleColumns.length,
    ],
    () => {
      refreshStatusBarMetrics()
    },
    { flush: "sync" },
  )

  return {
    enabled: statusBarEnabled,
    metrics: statusBarMetrics,
    refresh: refreshStatusBarMetrics,
  }
}
