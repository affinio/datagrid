import type { DataGridColumnSnapshot } from "@affino/datagrid-core"

export type DataGridColumnFilterKind = "text" | "enum" | "number"

export interface UseDataGridColumnUiPolicyOptions<TRow, TGroupBy extends string = string> {
  resolveCurrentGroupBy: () => TGroupBy | "none" | null | undefined
  isEnumColumn: (columnKey: string) => boolean
  resolveEnumEditorOptions: (columnKey: string) => readonly string[] | null | undefined
  resolveRows: () => readonly TRow[]
  resolveCellValue: (row: TRow, columnKey: string) => unknown
  numericColumnKeys: ReadonlySet<string>
  selectColumnKey?: string
  selectColumnMinWidth?: number
  selectColumnDefaultWidth?: number
  defaultColumnMinWidth?: number
  defaultColumnWidth?: number
}

export interface UseDataGridColumnUiPolicyResult {
  isGroupedByColumn: (columnKey: string) => boolean
  isSortableColumn: (columnKey: string) => boolean
  isColumnResizable: (columnKey: string) => boolean
  resolveColumnFilterKind: (columnKey: string) => DataGridColumnFilterKind
  resolveEnumFilterOptions: (columnKey: string) => string[]
  resolveColumnWidth: (column: DataGridColumnSnapshot) => number
}

export function useDataGridColumnUiPolicy<TRow, TGroupBy extends string = string>(
  options: UseDataGridColumnUiPolicyOptions<TRow, TGroupBy>,
): UseDataGridColumnUiPolicyResult {
  const selectColumnKey = options.selectColumnKey ?? "select"
  const selectColumnMinWidth = options.selectColumnMinWidth ?? 48
  const selectColumnDefaultWidth = options.selectColumnDefaultWidth ?? 58
  const defaultColumnMinWidth = options.defaultColumnMinWidth ?? 110
  const defaultColumnWidth = options.defaultColumnWidth ?? 160

  function isGroupedByColumn(columnKey: string): boolean {
    const groupBy = options.resolveCurrentGroupBy()
    return groupBy !== "none" && Boolean(groupBy) && columnKey === groupBy
  }

  function isSortableColumn(columnKey: string): boolean {
    return columnKey !== selectColumnKey
  }

  function isColumnResizable(columnKey: string): boolean {
    return columnKey !== selectColumnKey
  }

  function resolveColumnFilterKind(columnKey: string): DataGridColumnFilterKind {
    if (options.isEnumColumn(columnKey)) {
      return "enum"
    }
    if (options.numericColumnKeys.has(columnKey)) {
      return "number"
    }
    return "text"
  }

  function resolveEnumFilterOptions(columnKey: string): string[] {
    const editorOptions = options.resolveEnumEditorOptions(columnKey)
    if (editorOptions && editorOptions.length) {
      return [...editorOptions]
    }
    const values = new Set<string>()
    for (const row of options.resolveRows()) {
      const value = options.resolveCellValue(row, columnKey)
      if (value === null || typeof value === "undefined") {
        continue
      }
      values.add(String(value))
    }
    return [...values].sort((left, right) => left.localeCompare(right))
  }

  function resolveColumnWidth(column: DataGridColumnSnapshot): number {
    if (column.key === selectColumnKey) {
      return Math.max(selectColumnMinWidth, column.width ?? selectColumnDefaultWidth)
    }
    return Math.max(defaultColumnMinWidth, column.width ?? defaultColumnWidth)
  }

  return {
    isGroupedByColumn,
    isSortableColumn,
    isColumnResizable,
    resolveColumnFilterKind,
    resolveEnumFilterOptions,
    resolveColumnWidth,
  }
}
