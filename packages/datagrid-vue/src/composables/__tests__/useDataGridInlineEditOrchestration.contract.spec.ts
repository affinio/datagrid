import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridInlineEditOrchestration } from "../useDataGridInlineEditOrchestration"

interface Row {
  rowId: string
  service: string
  owner: string
}

type EditableColumnKey = "owner"

describe("useDataGridInlineEditOrchestration contract", () => {
  it("opens editor and commits edited value into rows", () => {
    const sourceRows = ref<readonly Row[]>([
      { rowId: "r1", service: "api", owner: "alice" },
      { rowId: "r2", service: "edge", owner: "bob" },
    ])
    const setSourceRows = vi.fn((rows: readonly Row[]) => {
      sourceRows.value = rows
    })

    const api = useDataGridInlineEditOrchestration<Row, EditableColumnKey>({
      sourceRows,
      setSourceRows,
      cloneRow: row => ({ ...row }),
      resolveRowId: row => row.rowId,
      resolveCellValue: (row, key) => row[key as keyof Row],
      isEditableColumn: (key): key is EditableColumnKey => key === "owner",
      applyEditedValue: (row, key, draft) => {
        row[key] = draft
      },
      resolveRowLabel: row => row.service,
    })

    expect(api.beginInlineEdit(sourceRows.value[0], "owner", "text")).toBe(true)
    expect(api.isEditingCell("r1", "owner")).toBe(true)

    api.updateEditorDraft("zoe")
    expect(api.commitInlineEdit()).toBe(true)
    expect(setSourceRows).toHaveBeenCalledTimes(1)
    expect(sourceRows.value[0]?.owner).toBe("zoe")
  })

  it("supports select-change commit flow and select-editor detection", () => {
    const sourceRows = ref<readonly Row[]>([
      { rowId: "r1", service: "api", owner: "alice" },
    ])
    const api = useDataGridInlineEditOrchestration<Row, EditableColumnKey>({
      sourceRows,
      setSourceRows(rows) {
        sourceRows.value = rows
      },
      cloneRow: row => ({ ...row }),
      resolveRowId: row => row.rowId,
      resolveCellValue: (row, key) => row[key as keyof Row],
      isEditableColumn: (key): key is EditableColumnKey => key === "owner",
      isSelectColumn: key => key === "owner",
      applyEditedValue: (row, key, draft) => {
        row[key] = draft
      },
    })

    api.beginInlineEdit(sourceRows.value[0], "owner", "select")
    expect(api.isSelectEditorCell("r1", "owner")).toBe(true)
    expect(api.onEditorSelectChange("ops")).toBe(true)
    expect(sourceRows.value[0]?.owner).toBe("ops")
  })

  it("records edit transaction when snapshot hook is provided", async () => {
    const sourceRows = ref<readonly Row[]>([
      { rowId: "r1", service: "api", owner: "alice" },
    ])
    const recordIntentTransaction = vi.fn(async () => undefined)
    const api = useDataGridInlineEditOrchestration<Row, EditableColumnKey, { row: string }, { v: number }>({
      sourceRows,
      setSourceRows(rows) {
        sourceRows.value = rows
      },
      cloneRow: row => ({ ...row }),
      resolveRowId: row => row.rowId,
      resolveCellValue: (row, key) => row[key as keyof Row],
      isEditableColumn: (key): key is EditableColumnKey => key === "owner",
      applyEditedValue: (row, key, draft) => {
        row[key] = draft
      },
      captureBeforeSnapshot: () => ({ v: 1 }),
      resolveAffectedRange: target => ({ row: target.rowId }),
      recordIntentTransaction,
    })

    api.beginInlineEdit(sourceRows.value[0], "owner")
    api.updateEditorDraft("charlie")
    expect(api.commitInlineEdit()).toBe(true)
    await Promise.resolve()
    expect(recordIntentTransaction).toHaveBeenCalledTimes(1)
  })
})
