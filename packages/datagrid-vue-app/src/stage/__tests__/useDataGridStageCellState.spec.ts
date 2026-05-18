import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridStageCellState } from "../useDataGridStageCellState"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "../dataGridTableStageBody.types"

function createColumn(
  partial: Partial<Omit<DataGridTableStageBodyColumn, "column">> & {
    column?: Partial<DataGridTableStageBodyColumn["column"]>
  },
): DataGridTableStageBodyColumn {
  return {
    key: partial.key ?? "value",
    width: partial.width ?? 120,
    pin: partial.pin ?? "center",
    column: {
      key: partial.key ?? "value",
      label: partial.key ?? "Value",
      ...partial.column,
    },
  } as DataGridTableStageBodyColumn
}

function createRow(partial: Partial<DataGridTableStageBodyRow> = {}): DataGridTableStageBodyRow {
  return {
    kind: "leaf",
    data: {},
    row: {},
    rowId: "r1",
    rowKey: "r1",
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: 0,
    state: { selected: false, group: false, pinned: "none", expanded: false },
    ...partial,
  }
}

describe("useDataGridStageCellState", () => {
  it("resolves checkbox and aria state without changing selection-class behavior", () => {
    const visibleColumns = ref<readonly DataGridTableStageBodyColumn[]>([
      createColumn({
        key: "selection",
        column: {
          cellType: "checkbox",
          meta: { rowSelection: true },
        },
      }),
      createColumn({
        key: "status",
        column: {
          cellInteraction: {
            click: true,
            role: "button",
            label: "Open details",
            pressed: true,
            disabled: true,
            onInvoke: () => undefined,
          },
        },
      }),
      createColumn({
        key: "plain",
      }),
    ])
    const cells = ref({
      readCell: (_row: DataGridTableStageBodyRow, columnKey: string) => (
        columnKey === "selection" ? "1" : "ready"
      ),
    })

    const service = useDataGridStageCellState({
      visibleColumns,
      cells,
      isCellEditableSafe: (_row, _rowOffset, column) => column.key !== "plain",
      isEditingCellSafe: (_row, columnKey) => columnKey === "status",
      resolveCellEditorMode: (_row, column) => column.key === "plain" ? "text" : "select",
      isCellSelectedSafe: (rowOffset, columnIndex) => rowOffset === 1 && columnIndex === 2,
      isVisualSelectionAnchorCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
      shouldHighlightSelectedCellVisual: (rowOffset, columnIndex) => rowOffset === 1 && columnIndex === 2,
      isRangeMoveHandleHoverCell: (rowOffset, columnIndex) => rowOffset === 1 && columnIndex === 1,
      isCellInFillPreviewSafe: (rowOffset, columnIndex) => rowOffset === 1 && columnIndex === 2,
      isCellInPendingClipboardRangeSafe: (rowOffset, columnIndex) => rowOffset === 1 && columnIndex === 2,
      isCellOnPendingClipboardEdgeSafe: (rowOffset, columnIndex, edge) => (
        rowOffset === 1 && columnIndex === 2 && edge === "top"
      ),
    })

    const row = createRow()
    const checkboxColumn = visibleColumns.value[0]!
    const interactiveColumn = visibleColumns.value[1]!
    const plainColumn = visibleColumns.value[2]!

    expect(service.shouldRenderCheckboxCell(row, checkboxColumn)).toBe(true)
    expect(service.builtInCellClasses(row, 0, checkboxColumn, 0)).toMatchObject({
      "grid-cell--checkbox": true,
      "grid-cell--row-selection": true,
      "grid-cell--select": true,
      "grid-cell--interactive": false,
    })
    expect(service.checkboxIndicatorClass(row, checkboxColumn)).toEqual({
      "grid-checkbox-indicator--checked": true,
    })
    expect(service.checkboxIndicatorMarkClass(row, checkboxColumn)).toEqual({
      "grid-checkbox-indicator__mark--checked": true,
    })
    expect(service.cellAriaRole(row, 0, checkboxColumn, 0)).toBe("checkbox")
    expect(service.cellAriaChecked(row, 0, checkboxColumn, 0)).toBe("true")
    expect(service.cellAriaSelected(0, 0)).toBe("true")

    expect(service.builtInCellClasses(row, 0, interactiveColumn, 1)).toMatchObject({
      "grid-cell--interactive": true,
    })
    expect(service.cellAriaRole(row, 0, interactiveColumn, 1)).toBe("button")
    expect(service.cellAriaLabel(row, 0, interactiveColumn, 1)).toBe("Open details")
    expect(service.cellAriaPressed(row, 0, interactiveColumn, 1)).toBe("true")
    expect(service.cellAriaDisabled(row, 0, interactiveColumn, 1)).toBe("true")

    expect(service.cellStateClasses(row, 1, 2)).toMatchObject({
      "grid-cell--selected": true,
      "grid-cell--selection-anchor": false,
      "grid-cell--range-move-handle-hover": false,
      "grid-cell--fill-preview": true,
      "grid-cell--clipboard-pending": true,
      "grid-cell--clipboard-pending-top": true,
      "grid-cell--clipboard-pending-right": false,
      "grid-cell--clipboard-pending-bottom": false,
      "grid-cell--clipboard-pending-left": false,
      "grid-cell--editing": false,
    })
    expect(service.cellAriaSelected(1, 2)).toBe("true")
    expect(service.cellAriaSelected(0, 2)).toBe("false")
    expect(service.builtInCellClasses(row, 0, plainColumn, 2)).toMatchObject({
      "grid-cell--select": false,
      "grid-cell--date": false,
      "grid-cell--interactive": false,
    })

    const placeholderRow = createRow({ __placeholder: true } as Partial<DataGridTableStageBodyRow>)
    expect(service.cellAriaDisabled(placeholderRow, 0, plainColumn, 2)).toBe("true")
  })
})
