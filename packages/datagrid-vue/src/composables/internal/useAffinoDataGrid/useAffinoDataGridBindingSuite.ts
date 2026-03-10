import type { Ref } from "vue"
import type { DataGridColumnInput, DataGridSortDirection } from "@affino/datagrid-core"
import {
  useAffinoDataGridBaseBindings,
  type UseAffinoDataGridBaseBindingsResult,
} from "./useAffinoDataGridBaseBindings"
import {
  useAffinoDataGridContextMenuFeature,
  type UseAffinoDataGridContextMenuFeatureResult,
} from "./useAffinoDataGridContextMenuFeature"
import type {
  AffinoDataGridActionId,
  AffinoDataGridActionResult,
  AffinoDataGridEditMode,
  AffinoDataGridEditSession,
  AffinoDataGridRunActionOptions,
} from "../../useAffinoDataGrid.types"

export interface UseAffinoDataGridBindingSuiteOptions<TRow> {
  columns: Ref<readonly DataGridColumnInput[]>
  resolveColumnOrder: () => readonly string[]
  setColumnOrder: (keys: readonly string[]) => void
  resolveRowOrder: () => readonly string[]
  moveRowByKey: (
    sourceRowKey: string,
    targetRowKey: string,
    position?: "before" | "after",
  ) => Promise<boolean> | boolean
  canReorderRows: () => boolean
  resolveRowKey: (row: TRow, index: number) => string
  resolveColumnSortDirection: (columnKey: string) => DataGridSortDirection | null
  toggleColumnSort: (columnKey: string, directionCycle?: readonly DataGridSortDirection[]) => void
  isSelectedByKey: (rowKey: string) => boolean
  toggleSelectedByKey: (rowKey: string) => void
  selectOnlyRow: (rowKey: string) => void
  editingEnabled: Ref<boolean>
  beginEdit: (session: Omit<AffinoDataGridEditSession, "mode"> & { mode?: AffinoDataGridEditMode }) => boolean
  resolveCellDraft: (params: { row: TRow; columnKey: string; value?: unknown }) => string
  isCellEditing: (rowKey: string, columnKey: string) => boolean
  activeSession: Ref<AffinoDataGridEditSession | null>
  updateDraft: (draft: string) => boolean
  cancelEdit: () => boolean
  commitEdit: () => Promise<boolean>
  runAction: (actionId: AffinoDataGridActionId, actionOptions?: AffinoDataGridRunActionOptions) => Promise<AffinoDataGridActionResult>
}

export type UseAffinoDataGridBindingSuiteResult<TRow> =
  & UseAffinoDataGridBaseBindingsResult<TRow>
  & UseAffinoDataGridContextMenuFeatureResult<
    TRow,
    AffinoDataGridActionId,
    AffinoDataGridActionResult
  >
  & {
    findCellElement: (rowKey: string, columnKey: string) => HTMLElement | null
    findHeaderElement: (columnKey: string) => HTMLElement | null
  }

export function useAffinoDataGridBindingSuite<TRow>(
  options: UseAffinoDataGridBindingSuiteOptions<TRow>,
): UseAffinoDataGridBindingSuiteResult<TRow> {
  const {
    createHeaderSortBindings,
    createHeaderReorderBindings,
    createRowSelectionBindings,
    createRowReorderBindings,
    createEditableCellBindings,
    createInlineEditorBindings,
  } = useAffinoDataGridBaseBindings({
    resolveColumnOrder: options.resolveColumnOrder,
    setColumnOrder: options.setColumnOrder,
    resolveRowOrder: options.resolveRowOrder,
    moveRowByKey: options.moveRowByKey,
    canReorderRows: options.canReorderRows,
    resolveColumnSortDirection: options.resolveColumnSortDirection,
    toggleColumnSort: options.toggleColumnSort,
    resolveRowKey: options.resolveRowKey,
    isSelectedByKey: options.isSelectedByKey,
    toggleSelectedByKey: options.toggleSelectedByKey,
    selectOnlyRow: options.selectOnlyRow,
    editingEnabled: options.editingEnabled,
    beginEdit: options.beginEdit,
    resolveCellDraft: options.resolveCellDraft,
    isCellEditing: options.isCellEditing,
    activeSession: options.activeSession,
    updateDraft: options.updateDraft,
    cancelEdit: options.cancelEdit,
    commitEdit: options.commitEdit,
  })

  const contextMenuFeature = useAffinoDataGridContextMenuFeature<
    TRow,
    AffinoDataGridActionId,
    AffinoDataGridActionResult
  >({
    columns: options.columns,
    resolveRowKey: options.resolveRowKey,
    createHeaderSortBindings,
    createHeaderReorderBindings,
    createEditableCellBindings,
    runAction: options.runAction,
  })

  const cellElementRegistry = new Map<string, HTMLElement>()
  const headerElementRegistry = new Map<string, HTMLElement>()

  const toCellRegistryKey = (rowKey: string, columnKey: string): string => `${rowKey}::${columnKey}`

  const registerCellElement = (rowKey: string, columnKey: string, element: Element | null): void => {
    const registryKey = toCellRegistryKey(rowKey, columnKey)
    if (element instanceof HTMLElement) {
      cellElementRegistry.set(registryKey, element)
      return
    }
    cellElementRegistry.delete(registryKey)
  }

  const registerHeaderElement = (columnKey: string, element: Element | null): void => {
    if (element instanceof HTMLElement) {
      headerElementRegistry.set(columnKey, element)
      return
    }
    headerElementRegistry.delete(columnKey)
  }

  const createHeaderCellBindings = (columnKey: string) => ({
    ...contextMenuFeature.createHeaderCellBindings(columnKey),
    ref: (element: Element | null) => {
      registerHeaderElement(columnKey, element)
    },
  })

  const createDataCellBindings = (params: Parameters<typeof contextMenuFeature.createDataCellBindings>[0]) => {
    const rowKey = options.resolveRowKey(params.row, params.rowIndex)
    return {
      ...contextMenuFeature.createDataCellBindings(params),
      ref: (element: Element | null) => {
        registerCellElement(rowKey, params.columnKey, element)
      },
    }
  }

  const findCellElement = (rowKey: string, columnKey: string): HTMLElement | null => {
    const registered = cellElementRegistry.get(toCellRegistryKey(rowKey, columnKey))
    if (registered) {
      return registered
    }
    if (typeof document === "undefined") {
      return null
    }
    const cells = document.querySelectorAll<HTMLElement>("[data-row-key][data-column-key]")
    for (const cell of cells) {
      if (cell.dataset.rowKey === rowKey && cell.dataset.columnKey === columnKey) {
        return cell
      }
    }
    return null
  }

  const findHeaderElement = (columnKey: string): HTMLElement | null => {
    const registered = headerElementRegistry.get(columnKey)
    if (registered) {
      return registered
    }
    if (typeof document === "undefined") {
      return null
    }
    const headers = document.querySelectorAll<HTMLElement>("[role='columnheader'][data-column-key]")
    for (const header of headers) {
      if (header.dataset.columnKey === columnKey) {
        return header
      }
    }
    return null
  }

  return {
    createHeaderSortBindings,
    createHeaderReorderBindings,
    createRowSelectionBindings,
    createRowReorderBindings,
    createEditableCellBindings,
    createInlineEditorBindings,
    ...contextMenuFeature,
    createHeaderCellBindings,
    createDataCellBindings,
    findCellElement,
    findHeaderElement,
  }
}
