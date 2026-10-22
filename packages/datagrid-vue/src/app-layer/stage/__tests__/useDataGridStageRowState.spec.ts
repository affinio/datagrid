import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridStageRowState } from "../useDataGridStageRowState"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "../dataGridTableStageBody.types"

function createColumn(
  partial: Partial<Omit<DataGridTableStageBodyColumn, "column">> & {
    column?: Partial<DataGridTableStageBodyColumn["column"]>
  } = {},
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

function createService(options: { useCanvasChrome: boolean; checkboxSelected?: boolean }) {
  const row = createRow()
  const column = createColumn()
  const displayRows = ref<readonly DataGridTableStageBodyRow[]>([row])

  return {
    row,
    column,
    displayRows,
    service: useDataGridStageRowState({
      rows: ref({
        rowHover: true,
        stripedRows: true,
        isRowCheckboxSelected: () => options.checkboxSelected === true,
        toggleGroupRow: () => undefined,
      }),
      selection: ref({}),
      selectionRange: ref(null),
      selectionRanges: ref([]),
      displayRows,
      visibleColumns: ref([column]),
      viewportRowStart: ref(0),
      isHoveredRow: () => true,
      isStripedRow: () => false,
      resolveAbsoluteRowIndex: () => 0,
      isCellSelectedSafe: () => false,
      isEditingCellSafe: () => false,
      isCellEditableSafe: () => false,
      resolveCellEditorMode: () => "none",
      startInlineEditIfAllowed: () => undefined,
      handleCellClick: () => undefined,
      hasExplicitGroupCellRenderer: ref(false),
      useCanvasChrome: ref(options.useCanvasChrome),
      cells: ref({}),
    }),
  }
}

describe("useDataGridStageRowState", () => {
  it("skips legacy inline row fill when canvas chrome owns row backgrounds", () => {
    const { row, column, service } = createService({ useCanvasChrome: true })

    expect(service.bodyCellSelectionStyle(row, column, 0, 0)).toEqual({})
  })

  it("preserves legacy inline row fill when canvas chrome is disabled", () => {
    const { row, column, service } = createService({ useCanvasChrome: false })

    expect(service.bodyCellSelectionStyle(row, column, 0, 0)).toMatchObject({
      backgroundImage: "linear-gradient(var(--datagrid-row-band-hover-bg), var(--datagrid-row-band-hover-bg))",
      backgroundPosition: "top left",
      backgroundRepeat: "no-repeat",
    })
  })

  it("leaves selected row backgrounds to the selected-row theme rule", () => {
    const { row, column, service } = createService({ useCanvasChrome: false, checkboxSelected: true })

    expect(service.bodyCellSelectionStyle(row, column, 0, 0)).toEqual({})
  })

  it("marks the outer edges of contiguous selected rows for one shared frame", () => {
    const { row, displayRows, service } = createService({ useCanvasChrome: false, checkboxSelected: true })
    const first = createRow({ rowId: "r0" })
    const last = createRow({ rowId: "r2" })
    displayRows.value = [first, row, last]

    expect(service.rowStateClasses(first, 0)).toMatchObject({
      "grid-row--checkbox-selected-top": true,
      "grid-row--checkbox-selected-middle": false,
      "grid-row--checkbox-selected-bottom": false,
      "grid-row--checkbox-selected-single": false,
    })
    expect(service.rowStateClasses(row, 1)).toMatchObject({
      "grid-row--checkbox-selected-top": false,
      "grid-row--checkbox-selected-middle": true,
      "grid-row--checkbox-selected-bottom": false,
      "grid-row--checkbox-selected-single": false,
    })
    expect(service.rowStateClasses(last, 2)).toMatchObject({
      "grid-row--checkbox-selected-top": false,
      "grid-row--checkbox-selected-middle": false,
      "grid-row--checkbox-selected-bottom": true,
      "grid-row--checkbox-selected-single": false,
    })
  })

  it("marks only root group rows for sticky context headers", () => {
    const { service } = createService({ useCanvasChrome: true })
    const root = createRow({ kind: "group", groupMeta: { level: 0 } } as never)
    const nested = createRow({ kind: "group", groupMeta: { level: 1 } } as never)

    expect(service.rowStateClasses(root, 0)["grid-row--group-root"]).toBe(true)
    expect(service.rowStateClasses(nested, 0)["grid-row--group-root"]).toBe(false)
  })
})
