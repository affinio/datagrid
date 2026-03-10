import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridRowNode } from "@affino/datagrid-core"
import { useDataGridAppRowSizing } from "../useDataGridAppRowSizing"

type DemoRow = Record<string, unknown>

function createRuntime() {
  return {
    api: {
      view: {
        getRowHeightOverride: vi.fn<(rowIndex: number) => number | null>(() => null),
        setRowHeightOverride: vi.fn(),
        measureRowHeight: vi.fn(),
      },
    },
  } as const
}

function createRow(rowId = "row-1"): DataGridRowNode<DemoRow> {
  return {
    rowId,
    kind: "data",
    data: {},
    state: {},
  } as unknown as DataGridRowNode<DemoRow>
}

describe("useDataGridAppRowSizing contract", () => {
  it("keeps fixed row height in tree mode", () => {
    const runtime = createRuntime()
    runtime.api.view.getRowHeightOverride.mockReturnValueOnce(42)
    const sizing = useDataGridAppRowSizing<DemoRow>({
      mode: ref("tree"),
      rowHeightMode: ref("fixed"),
      normalizedBaseRowHeight: ref(31),
      viewportRowStart: ref(0),
      runtime: runtime as never,
    })

    expect(sizing.rowStyle(createRow(), 0)).toEqual({
      height: "42px",
      minHeight: "42px",
    })
  })

  it("does not force fixed height in auto mode", () => {
    const runtime = createRuntime()
    const sizing = useDataGridAppRowSizing<DemoRow>({
      mode: ref("tree"),
      rowHeightMode: ref("auto"),
      normalizedBaseRowHeight: ref(31),
      viewportRowStart: ref(0),
      runtime: runtime as never,
    })

    expect(sizing.rowStyle(createRow(), 0)).toEqual({})
  })
})