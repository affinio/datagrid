import type { Ref } from "vue"
import {
  buildDataGridCellRenderModel,
  type DataGridRowNode,
} from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode } from "./index"

export interface UseDataGridAppRowPresentationOptions<TRow extends Record<string, unknown>> {
  mode: Ref<DataGridAppMode>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "columnSnapshot">
  viewportRowStart: Ref<number>
  firstColumnKey: Ref<string>
}

export interface UseDataGridAppRowPresentationResult<TRow extends Record<string, unknown>> {
  rowIndexLabel: (row: DataGridRowNode<TRow>, rowOffset: number) => string
  readCell: (row: DataGridRowNode<TRow>, key: string) => string
  readDisplayCell: (row: DataGridRowNode<TRow>, key: string) => string
  rowClass: (row: DataGridRowNode<TRow>) => string
  toggleGroupRow: (row: DataGridRowNode<TRow>) => void
}

export function useDataGridAppRowPresentation<TRow extends Record<string, unknown>>(
  options: UseDataGridAppRowPresentationOptions<TRow>,
): UseDataGridAppRowPresentationResult<TRow> {
  const rowIndexLabel = (row: DataGridRowNode<TRow>, rowOffset: number): string => {
    if (row.kind === "group") {
      return ""
    }
    const sourceId = (row.data as { id?: unknown }).id
    if (typeof sourceId === "number" && Number.isFinite(sourceId)) {
      return String(sourceId)
    }
    return String(options.viewportRowStart.value + rowOffset + 1)
  }

  const resolveColumnDef = (key: string) => {
    return options.runtime.columnSnapshot.value.byKey[key]?.column
  }

  const readCell = (row: DataGridRowNode<TRow>, key: string): string => {
    if (row.kind === "group") {
      const level = Math.max(0, row.groupMeta?.level ?? 0)
      const indent = "· ".repeat(level)
      const caret = row.state.expanded ? "▾" : "▸"
      const isGroupLabelColumn = options.mode.value === "tree"
        ? key === "name"
        : key === options.firstColumnKey.value
      if (isGroupLabelColumn) {
        return `${indent}${caret} ${String(row.groupMeta?.groupField ?? "group")}: ${String(row.groupMeta?.groupValue ?? row.rowId)} (${row.groupMeta?.childrenCount ?? 0})`
      }
      if (options.mode.value === "tree") {
        return ""
      }
      const groupValue = (row.data as Record<string, unknown>)[key]
        ?? row.groupMeta?.aggregates?.[key]
      return groupValue == null ? "" : String(groupValue)
    }
    const value = (row.data as Record<string, unknown>)[key]
    return value == null ? "" : String(value)
  }

  const readDisplayCell = (row: DataGridRowNode<TRow>, key: string): string => {
    if (row.kind === "group") {
      const level = Math.max(0, row.groupMeta?.level ?? 0)
      const indent = "· ".repeat(level)
      const caret = row.state.expanded ? "▾" : "▸"
      const isGroupLabelColumn = options.mode.value === "tree"
        ? key === "name"
        : key === options.firstColumnKey.value
      if (isGroupLabelColumn) {
        return `${indent}${caret} ${String(row.groupMeta?.groupField ?? "group")}: ${String(row.groupMeta?.groupValue ?? row.rowId)} (${row.groupMeta?.childrenCount ?? 0})`
      }
      if (options.mode.value === "tree") {
        return ""
      }
      const groupValue = (row.data as Record<string, unknown>)[key]
        ?? row.groupMeta?.aggregates?.[key]
        const column = resolveColumnDef(key)
        if (!column) {
          return groupValue == null ? "" : String(groupValue)
        }
        return buildDataGridCellRenderModel({
          column,
          value: groupValue,
        }).displayValue
    }
    const value = (row.data as Record<string, unknown>)[key]
      const column = resolveColumnDef(key)
      if (!column) {
        return value == null ? "" : String(value)
      }
      return buildDataGridCellRenderModel({
        column,
        row: row.data,
        value,
      }).displayValue
  }

  const rowClass = (row: DataGridRowNode<TRow>): string => {
    if (options.mode.value === "pivot") {
      return row.kind === "group" ? "row--group row--pivot" : "row--pivot"
    }
    if (row.kind !== "group") {
      return ""
    }
    if (options.mode.value === "tree") {
      return "row--group row--tree"
    }
    return "row--group"
  }

  const toggleGroupRow = (row: DataGridRowNode<TRow>): void => {
    if (row.kind !== "group") {
      return
    }
    const groupKey = row.groupMeta?.groupKey
    if (!groupKey) {
      return
    }
    if (row.state.expanded) {
      options.runtime.api.rows.collapseGroup(groupKey)
      return
    }
    options.runtime.api.rows.expandGroup(groupKey)
  }

  return {
    rowIndexLabel,
    readCell,
    readDisplayCell,
    rowClass,
    toggleGroupRow,
  }
}
