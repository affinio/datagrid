import {
  useTableFindReplaceBridge,
  type FindReplaceStore,
} from "../composables/useTableFindReplaceBridge"
import type { UiTableColumn, VisibleRow } from "@affino/datagrid-core/types"
import type { ComputedRef, Ref } from "vue"
import type { SelectionPoint } from "../composables/useTableSelection"

export interface DataGridFindReplaceFacadeOptions {
  findReplace: FindReplaceStore
  processedRows: ComputedRef<VisibleRow[]>
  visibleColumns: ComputedRef<UiTableColumn[]>
  scrollToRow: (rowIndex: number) => void
  scrollToColumn: (columnKey: string) => void
  focusCell: (rowIndex: number, columnKey: string) => void
  getCellValue: (rowIndex: number, columnKey: string) => unknown
  setCellValue: (rowIndex: number, columnKey: string | number, value: unknown) => boolean
  focusContainer: () => void
  undo: () => void
  redo: () => void
  anchorCell: Ref<SelectionPoint | null>
  selectedCell: Ref<SelectionPoint | null>
  isEventInsideTable: (target: EventTarget | null) => boolean
  isEditableTarget: (target: EventTarget | null) => boolean
}

export function useDataGridFindReplaceFacade(options: DataGridFindReplaceFacadeOptions) {
  return useTableFindReplaceBridge(options)
}
