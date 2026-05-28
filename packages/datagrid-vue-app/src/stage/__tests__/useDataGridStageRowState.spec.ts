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

function createService(options: { useCanvasChrome: boolean }) {
  const row = createRow()
  const column = createColumn()

  return {
    row,
    column,
    service: useDataGridStageRowState({
      rows: ref({
        rowHover: true,
        stripedRows: true,
        toggleGroupRow: () => undefined,
      }),
      selection: ref({}),
      selectionRange: ref(null),
      selectionRanges: ref([]),
      displayRows: ref([row]),
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
})
