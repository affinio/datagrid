import {
  invokeDataGridCellInteraction,
  resolveDataGridCellClickAction,
  resolveDataGridCellKeyboardAction,
  toggleDataGridCellValue,
  type DataGridApi,
  type DataGridColumnModel,
} from "@affino/datagrid-core"
import { createHistoryPatch, createHistorySnapshot, type DomHistoryIntent } from "./historyController.js"

export function createDomCellToggleController<TRow>(options: {
  api: DataGridApi<TRow>
  columnModel: DataGridColumnModel
  recordIntent: (intent: DomHistoryIntent<TRow>) => Promise<string | null>
  updateView: () => void
}) {
  function toggleCell(rowIndex: number, columnIndex: number): boolean {
    const row = options.api.rows.get(rowIndex)
    const column = options.columnModel.getSnapshot().visibleColumns[columnIndex]
    if (!row || row.kind !== "leaf" || !column || !options.api.rows.hasPatchSupport()) return false
    const editable = column.column.capabilities?.editable === true
    const action = resolveDataGridCellClickAction({
      column: column.column,
      row: row.row,
      rowId: row.rowId,
      editable,
    })
    if (action !== "toggle") return false

    const resolved = options.api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "source" })
    if (resolved.status !== "available") return false
    const writeTarget = resolved.writeTarget
    if (!writeTarget || writeTarget.kind !== "row-patch") return false
    const writeKey = writeTarget.key
    const nextValue = toggleDataGridCellValue({ column: column.column, row: row.row, value: resolved.sourceValue })
    const beforeSelection = options.api.selection.getSnapshot()
    const patch = { rowId: row.rowId, data: { [writeKey]: nextValue } as Partial<TRow> }
    void Promise.resolve(options.api.rows.applyEdits([patch], { source: "grid" }))
      .then(() => options.recordIntent({
        intent: "edit",
        label: `Toggle ${column.key}`,
        affectedRange: { startRow: rowIndex, endRow: rowIndex, startColumn: columnIndex, endColumn: columnIndex },
        before: createHistorySnapshot([
          createHistoryPatch(row.rowId, { [writeKey]: resolved.sourceValue } as Partial<TRow>),
        ], beforeSelection),
        after: createHistorySnapshot([
          createHistoryPatch(row.rowId, { [writeKey]: nextValue } as Partial<TRow>),
        ], options.api.selection.getSnapshot()),
      }))
      .catch(() => options.updateView())
    return true
  }

  function handleCellClick(rowIndex: number, columnIndex: number): boolean {
    const row = options.api.rows.get(rowIndex)
    const column = options.columnModel.getSnapshot().visibleColumns[columnIndex]
    if (!row || !column) return false
    const editable = column.column.capabilities?.editable !== false
    const action = resolveDataGridCellClickAction({
      column: column.column,
      row: row.kind === "leaf" ? row.data : undefined,
      rowId: row.rowId,
      editable,
    })
    if (action === "invoke") {
      invokeDataGridCellInteraction({
        column: column.column,
        row: row.kind === "leaf" ? row.data : undefined,
        rowId: row.rowId,
        editable,
        trigger: "click",
      })
      return true
    }
    return action === "toggle" ? toggleCell(rowIndex, columnIndex) : false
  }

  function isKeyboardToggle(rowIndex: number, columnIndex: number): boolean {
    const row = options.api.rows.get(rowIndex)
    const column = options.columnModel.getSnapshot().visibleColumns[columnIndex]
    if (!row || row.kind !== "leaf" || !column) return false
    if (!options.api.rows.hasPatchSupport()) return false
    const resolved = options.api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "source" })
    if (resolved.status !== "available" || resolved.writeTarget?.kind !== "row-patch") return false
    return resolveDataGridCellKeyboardAction({
      column: column.column,
      row: row.row,
      rowId: row.rowId,
      editable: column.column.capabilities?.editable === true,
      key: " ",
      printable: false,
    }) === "toggle"
  }

  return { toggleCell, handleCellClick, isKeyboardToggle }
}
