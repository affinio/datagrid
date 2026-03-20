import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"
import { useDataGridTableStageCellIo } from "../useDataGridTableStageCellIo"

describe("useDataGridTableStageCellIo", () => {
  it("invokes column cellInteraction on click without applying built-in edits", () => {
    const onInvoke = vi.fn()
    const applyEdits = vi.fn()
    const recordHistoryIntentTransaction = vi.fn()
    const syncViewport = vi.fn()
    const row = {
      rowId: "r1",
      kind: "data",
      data: {
        status: "ready",
      },
    } as const
    const column = {
      key: "status",
      width: 140,
      pin: "center",
      column: {
        key: "status",
        label: "Status",
        cellInteraction: {
          click: true,
          role: "button",
          onInvoke,
        },
      },
    } as unknown as DataGridColumnSnapshot

    const service = useDataGridTableStageCellIo({
      runtime: {
        api: {
          rows: {
            applyEdits,
          },
        },
      } as never,
      viewportRowStart: ref(0),
      isRowSelectionColumnKey: () => false,
      isRowSelectionColumn: () => false,
      isCellEditableByKey: () => false,
      readRowSelectionCell: () => "",
      readRowSelectionDisplayCell: () => "",
      readCell: nextRow => String(nextRow.data.status ?? ""),
      readDisplayCell: nextRow => String(nextRow.data.status ?? ""),
      toggleRowCheckboxSelected: vi.fn(),
      captureHistorySnapshot: () => [],
      recordHistoryIntentTransaction,
      syncViewport,
    })

    service.handleCellClick(row as never, 0, column, 0)

    expect(onInvoke).toHaveBeenCalledWith(expect.objectContaining({
      value: "ready",
      trigger: "click",
    }))
    expect(applyEdits).not.toHaveBeenCalled()
    expect(recordHistoryIntentTransaction).not.toHaveBeenCalled()
    expect(syncViewport).not.toHaveBeenCalled()
  })
})