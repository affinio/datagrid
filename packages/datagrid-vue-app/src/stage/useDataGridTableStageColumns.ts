import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"
import type { DataGridCellEditablePredicate } from "../dataGridEditability"
import type { DataGridTableRow } from "./dataGridTableStage.types"

const DEFAULT_COLUMN_WIDTH = 140
const ROW_SELECTION_COLUMN_WIDTH = 108
const ROW_SELECTION_COLUMN_KEY = "__datagrid_row_selection__"

export interface UseDataGridTableStageColumnsOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>, "api">
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  showRowSelection?: Ref<boolean>
  isCellEditable?: DataGridCellEditablePredicate<TRow>
}

export interface UseDataGridTableStageColumnsResult<TRow extends Record<string, unknown>> {
  orderedVisibleColumns: ComputedRef<readonly DataGridColumnSnapshot[]>
  centerColumns: ComputedRef<readonly DataGridColumnSnapshot[]>
  resolveColumnWidth: (column: DataGridColumnSnapshot) => number
  stageColumnStyle: (columnKey: string) => Record<string, string>
  isRowSelectionColumnKey: (columnKey: string) => boolean
  isRowSelectionColumn: (column: DataGridColumnSnapshot) => boolean
  isCellEditable: (row: DataGridTableRow<TRow>, rowIndex: number, column: DataGridColumnSnapshot) => boolean
  isCellEditableByKey: (row: DataGridTableRow<TRow>, rowIndex: number, columnKey: string, columnIndex: number) => boolean
  rowSelectionColumn: ComputedRef<DataGridColumnSnapshot | null>
}

export function useDataGridTableStageColumns<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageColumnsOptions<TRow>,
): UseDataGridTableStageColumnsResult<TRow> {
  const hasRowSelectionSupport = computed(() => {
    return (options.showRowSelection?.value ?? true) && options.runtime.api.rowSelection.hasSupport()
  })
  const rowSelectionColumn = computed<DataGridColumnSnapshot | null>(() => {
    if (!hasRowSelectionSupport.value) {
      return null
    }
    return {
      key: ROW_SELECTION_COLUMN_KEY,
      state: {
        visible: true,
        pin: "left",
        width: ROW_SELECTION_COLUMN_WIDTH,
      },
      visible: true,
      pin: "left",
      width: ROW_SELECTION_COLUMN_WIDTH,
      column: {
        key: ROW_SELECTION_COLUMN_KEY,
        label: "",
        cellType: "checkbox",
        minWidth: ROW_SELECTION_COLUMN_WIDTH,
        maxWidth: ROW_SELECTION_COLUMN_WIDTH,
        capabilities: {
          editable: true,
          sortable: false,
          filterable: false,
          groupable: false,
          pivotable: false,
          aggregatable: false,
        },
        presentation: {
          align: "center",
          headerAlign: "center",
        },
        meta: {
          isSystem: true,
          rowSelection: true,
        },
      },
    }
  })

  const isRowSelectionColumnKey = (columnKey: string): boolean => columnKey === ROW_SELECTION_COLUMN_KEY
  const isRowSelectionColumn = (column: DataGridColumnSnapshot): boolean => isRowSelectionColumnKey(column.key)

  const orderedVisibleColumns = computed(() => {
    const selectionColumn = rowSelectionColumn.value
    const left = options.visibleColumns.value.filter((column) => column.pin === "left")
    const center = options.visibleColumns.value.filter((column) => column.pin !== "left" && column.pin !== "right")
    const right = options.visibleColumns.value.filter((column) => column.pin === "right")
    return selectionColumn ? [selectionColumn, ...left, ...center, ...right] : [...left, ...center, ...right]
  })

  const centerColumns = computed(() => (
    orderedVisibleColumns.value.filter((column) => column.pin !== "left" && column.pin !== "right")
  ))

  const resolveColumnWidth = (column: DataGridColumnSnapshot): number => {
    return column.width ?? DEFAULT_COLUMN_WIDTH
  }

  const stageColumnStyle = (columnKey: string): Record<string, string> => {
    const column = orderedVisibleColumns.value.find((candidate) => candidate.key === columnKey)
    const width = column ? resolveColumnWidth(column) : DEFAULT_COLUMN_WIDTH
    const px = `${width}px`
    return {
      width: px,
      minWidth: px,
      maxWidth: px,
    }
  }

  const isColumnEditable = (column: DataGridColumnSnapshot): boolean => {
    return column.column.capabilities?.editable !== false
  }

  const isCellEditable = (
    row: DataGridTableRow<TRow>,
    rowIndex: number,
    column: DataGridColumnSnapshot,
  ): boolean => {
    if (isRowSelectionColumn(column)) {
      return row.kind !== "group" && row.rowId != null
    }
    if (row.kind === "group" || row.rowId == null || !isColumnEditable(column)) {
      return false
    }
    if (!options.isCellEditable) {
      return true
    }
    return options.isCellEditable({
      row: row.data as TRow,
      rowId: row.rowId,
      rowIndex,
      column: column.column,
      columnKey: column.key,
    })
  }

  const resolveEditableColumn = (
    columnKey: string,
    columnIndex: number,
  ): { column: DataGridColumnSnapshot; columnIndex: number } | null => {
    const columnAtIndex = orderedVisibleColumns.value[columnIndex]
    if (columnAtIndex?.key === columnKey) {
      return { column: columnAtIndex, columnIndex }
    }
    const resolvedColumnIndex = orderedVisibleColumns.value.findIndex((column) => column.key === columnKey)
    if (resolvedColumnIndex < 0) {
      return null
    }
    return {
      column: orderedVisibleColumns.value[resolvedColumnIndex] as DataGridColumnSnapshot,
      columnIndex: resolvedColumnIndex,
    }
  }

  const isCellEditableByKey = (
    row: DataGridTableRow<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ): boolean => {
    const resolved = resolveEditableColumn(columnKey, columnIndex)
    if (!resolved) {
      return false
    }
    return isCellEditable(row, rowIndex, resolved.column)
  }

  return {
    orderedVisibleColumns,
    centerColumns,
    resolveColumnWidth,
    stageColumnStyle,
    isRowSelectionColumnKey,
    isRowSelectionColumn,
    isCellEditable,
    isCellEditableByKey,
    rowSelectionColumn,
  }
}