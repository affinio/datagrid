import type { Ref } from "vue"
import type { DataGridSortState } from "@affino/datagrid-core"
import type { DataGridColumnDef } from "@affino/datagrid-core"

export interface UseAffinoDataGridActionRunnerOptions {
  selectedRowKeySet: Ref<Set<string>>
  clearSelection: () => void
  selectAllRows: () => number
  resolveSelectedRows: () => readonly unknown[]
  copySelectedRows: () => Promise<boolean>
  cutSelectedRows: () => Promise<number>
  pasteRowsAppend: () => Promise<number>
  clearSelectedRows: () => Promise<number>
  setSortState: (nextState: readonly DataGridSortState[]) => void
  clearSort: () => void
  resolveRows: () => readonly unknown[]
  resolveColumns: () => readonly DataGridColumnDef[]
  setColumnWidth: (columnKey: string, width: number) => void
  isFilteringEnabled: () => boolean
  runFilterAction?: (columnKey: string) => boolean
}

export type AffinoDataGridInternalActionId =
  | "copy"
  | "cut"
  | "paste"
  | "clear"
  | "filter"
  | "sort-asc"
  | "sort-desc"
  | "sort-clear"
  | "auto-size"
  | "select-all"
  | "clear-selection"

export interface AffinoDataGridInternalRunActionOptions {
  columnKey?: string | null
}

export interface AffinoDataGridInternalActionResult {
  ok: boolean
  affected: number
  message: string
}

export interface UseAffinoDataGridActionRunnerResult {
  runAction: (
    actionId: AffinoDataGridInternalActionId,
    actionOptions?: AffinoDataGridInternalRunActionOptions,
  ) => Promise<AffinoDataGridInternalActionResult>
}

export function useAffinoDataGridActionRunner(
  options: UseAffinoDataGridActionRunnerOptions,
): UseAffinoDataGridActionRunnerResult {
  const DEFAULT_MIN_WIDTH = 64
  const DEFAULT_MAX_WIDTH = 640
  const MAX_MEASURE_ROWS = 400
  const CHAR_WIDTH = 8
  const PADDING = 28

  const estimateAutoSizeWidth = (columnKey: string): number | null => {
    const columns = options.resolveColumns()
    const column = columns.find(entry => entry.key === columnKey)
    if (!column) {
      return null
    }
    const rows = options.resolveRows()
    const sampleRows = rows.slice(0, MAX_MEASURE_ROWS)
    const headerLabel = typeof column.label === "string" && column.label.trim().length > 0
      ? column.label.trim()
      : column.key

    let maxChars = headerLabel.length
    for (const row of sampleRows) {
      const value = (row as Record<string, unknown>)[columnKey]
      const text = value === null || value === undefined ? "" : String(value)
      if (text.length > maxChars) {
        maxChars = text.length
      }
    }

    const minWidth = Number.isFinite(column.minWidth)
      ? Math.max(0, Math.trunc(column.minWidth as number))
      : DEFAULT_MIN_WIDTH
    const maxWidth = Number.isFinite(column.maxWidth)
      ? Math.max(minWidth, Math.trunc(column.maxWidth as number))
      : DEFAULT_MAX_WIDTH
    const measured = Math.trunc(maxChars * CHAR_WIDTH + PADDING)
    return Math.max(minWidth, Math.min(maxWidth, measured))
  }

  const runAction = async (
    actionId: AffinoDataGridInternalActionId,
    actionOptions: AffinoDataGridInternalRunActionOptions = {},
  ): Promise<AffinoDataGridInternalActionResult> => {
    switch (actionId) {
      case "copy": {
        const ok = await options.copySelectedRows()
        const affected = options.resolveSelectedRows().length
        return {
          ok,
          affected: ok ? affected : 0,
          message: ok ? `Copied ${affected} selected row(s)` : "Copy failed",
        }
      }
      case "cut": {
        const affected = await options.cutSelectedRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Cut ${affected} row(s)` : "Nothing was cut",
        }
      }
      case "paste": {
        const affected = await options.pasteRowsAppend()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Pasted ${affected} row(s)` : "Nothing to paste",
        }
      }
      case "clear": {
        const affected = await options.clearSelectedRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Cleared ${affected} row(s)` : "Nothing to clear",
        }
      }
      case "sort-asc":
      case "sort-desc": {
        const columnKey = actionOptions.columnKey ?? null
        if (!columnKey) {
          return {
            ok: false,
            affected: 0,
            message: "Missing column key for sort action",
          }
        }
        options.setSortState([{ key: columnKey, direction: actionId === "sort-asc" ? "asc" : "desc" }])
        return {
          ok: true,
          affected: 1,
          message: `Sorted ${columnKey} ${actionId === "sort-asc" ? "ascending" : "descending"}`,
        }
      }
      case "sort-clear": {
        options.clearSort()
        return {
          ok: true,
          affected: 1,
          message: "Sort cleared",
        }
      }
      case "select-all": {
        const affected = options.selectAllRows()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? `Selected ${affected} row(s)` : "Nothing to select",
        }
      }
      case "clear-selection": {
        const affected = options.selectedRowKeySet.value.size
        options.clearSelection()
        return {
          ok: affected > 0,
          affected,
          message: affected > 0 ? "Selection cleared" : "Selection already empty",
        }
      }
      case "filter":
        if (!actionOptions.columnKey) {
          return {
            ok: false,
            affected: 0,
            message: "Missing column key for filter action",
          }
        }
        if (!options.isFilteringEnabled()) {
          return {
            ok: false,
            affected: 0,
            message: "Filtering feature is disabled",
          }
        }
        if (!options.runFilterAction) {
          return {
            ok: false,
            affected: 0,
            message: `Filter action for "${actionOptions.columnKey}" requires a custom filter UI handler`,
          }
        }
        if (!options.runFilterAction(actionOptions.columnKey)) {
          return {
            ok: false,
            affected: 0,
            message: `Filter action rejected for "${actionOptions.columnKey}"`,
          }
        }
        return {
          ok: true,
          affected: 1,
          message: `Opened filter for ${actionOptions.columnKey}`,
        }
      case "auto-size":
        if (!actionOptions.columnKey) {
          return {
            ok: false,
            affected: 0,
            message: "Missing column key for auto-size action",
          }
        }
        {
          const width = estimateAutoSizeWidth(actionOptions.columnKey)
          if (!Number.isFinite(width)) {
            return {
              ok: false,
              affected: 0,
              message: `Cannot auto-size unknown column "${actionOptions.columnKey}"`,
            }
          }
          options.setColumnWidth(actionOptions.columnKey, width as number)
          return {
            ok: true,
            affected: 1,
            message: `Auto-sized ${actionOptions.columnKey} to ${width}px`,
          }
        }
      default:
        return {
          ok: false,
          affected: 0,
          message: `Unknown action "${actionId}"`,
        }
    }
  }

  return {
    runAction,
  }
}
