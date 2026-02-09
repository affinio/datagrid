import type { DataGridRowNode } from "@affino/datagrid-core"

export interface UseDataGridA11yCellIdsOptions<TRow> {
  resolveColumnIndex: (columnKey: string) => number
  resolveRowIndex: (row: DataGridRowNode<TRow>) => number
  idPrefix?: string
  rowAriaIndexBase?: number
  columnAriaIndexBase?: number
}

export interface UseDataGridA11yCellIdsResult<TRow> {
  getGridCellId: (rowId: string, columnKey: string) => string
  getHeaderCellId: (columnKey: string) => string
  getColumnAriaIndex: (columnKey: string) => number
  getRowAriaIndex: (row: DataGridRowNode<TRow>) => number
}

function sanitizeDomIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-")
}

export function useDataGridA11yCellIds<TRow>(
  options: UseDataGridA11yCellIdsOptions<TRow>,
): UseDataGridA11yCellIdsResult<TRow> {
  const idPrefix = options.idPrefix ?? "datagrid"
  const rowAriaIndexBase = options.rowAriaIndexBase ?? 2
  const columnAriaIndexBase = options.columnAriaIndexBase ?? 1

  function getGridCellId(rowId: string, columnKey: string): string {
    return `${idPrefix}-cell-${sanitizeDomIdPart(rowId)}-${sanitizeDomIdPart(columnKey)}`
  }

  function getHeaderCellId(columnKey: string): string {
    return `${idPrefix}-header-${sanitizeDomIdPart(columnKey)}`
  }

  function getColumnAriaIndex(columnKey: string): number {
    return Math.max(
      columnAriaIndexBase,
      options.resolveColumnIndex(columnKey) + columnAriaIndexBase,
    )
  }

  function getRowAriaIndex(row: DataGridRowNode<TRow>): number {
    return Math.max(rowAriaIndexBase, options.resolveRowIndex(row) + rowAriaIndexBase)
  }

  return {
    getGridCellId,
    getHeaderCellId,
    getColumnAriaIndex,
    getRowAriaIndex,
  }
}
