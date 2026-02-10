import type { Ref } from "vue"
import type { DataGridSortState } from "@affino/datagrid-core"

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
      case "auto-size":
      default:
        return {
          ok: false,
          affected: 0,
          message: `Action "${actionId}" is not mapped in useAffinoDataGrid`,
        }
    }
  }

  return {
    runAction,
  }
}
