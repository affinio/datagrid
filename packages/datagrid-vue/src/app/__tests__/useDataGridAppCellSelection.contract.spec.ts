import { ref } from "vue"
import { describe, expect, it } from "vitest"
import type { DataGridSelectionSnapshot } from "@affino/datagrid-core"
import { useDataGridAppCellSelection } from "../useDataGridAppCellSelection"

describe("useDataGridAppCellSelection contract", () => {
  it("prefers the explicit selection anchor over snapshot anchor when resolving the anchor cell", () => {
    const selectionSnapshot = ref({
      ranges: [
        {
          startRow: 0,
          endRow: 3,
          startCol: 0,
          endCol: 0,
          startRowId: "r1",
          endRowId: "r4",
          anchor: { rowIndex: 3, colIndex: 0, rowId: "r4" },
          focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "r4" },
    } as never)
    const selectionAnchor = ref({ rowIndex: 0, colIndex: 0, rowId: "r1" })

    const api = useDataGridAppCellSelection({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
          },
        },
      } as never,
      totalRows: ref(10),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
      ] as never),
      viewportRowStart: ref(0),
      selectionSnapshot,
      selectionAnchor,
      isEditingCell: () => false,
    })

    expect(api.isSelectionAnchorCell(0, 0)).toBe(true)
    expect(api.isSelectionAnchorCell(3, 0)).toBe(false)
    expect(api.shouldHighlightSelectedCell(0, 0)).toBe(false)
    expect(api.shouldHighlightSelectedCell(1, 0)).toBe(true)
  })

  it("creates a cell selection snapshot in tree mode", () => {
    const selectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
    const selectionAnchor = ref<{ rowIndex: number; colIndex: number; rowId: string | null } | null>(null)
    let runtimeSnapshot: unknown = null

    const api = useDataGridAppCellSelection({
      mode: ref("tree"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
          },
          selection: {
            hasSupport: () => true,
            setSnapshot: (snapshot: unknown) => {
              runtimeSnapshot = snapshot
            },
          },
        },
        getBodyRowAtIndex: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
      } as never,
      totalRows: ref(10),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
        { key: "c" },
      ] as never),
      viewportRowStart: ref(0),
      selectionSnapshot,
      selectionAnchor,
      isEditingCell: () => false,
    })

    api.applyCellSelectionByCoord({
      rowIndex: 2,
      columnIndex: 1,
      rowId: "r3",
    }, false)

    expect(selectionSnapshot.value).toMatchObject({
      activeCell: { rowIndex: 2, colIndex: 1, rowId: "r3" },
      ranges: [
        {
          startRow: 2,
          endRow: 2,
          startCol: 1,
          endCol: 1,
          anchor: { rowIndex: 2, colIndex: 1, rowId: "r3" },
          focus: { rowIndex: 2, colIndex: 1, rowId: "r3" },
        },
      ],
    })
    expect(runtimeSnapshot).toMatchObject({
      activeCell: { rowIndex: 2, colIndex: 1, rowId: "r3" },
    })
    expect(api.isSelectionAnchorCell(2, 1)).toBe(true)
  })

  it("appends additive ctrl/cmd selections and keeps all ranges queryable", () => {
    const selectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
    const selectionAnchor = ref<{ rowIndex: number; colIndex: number; rowId: string | null } | null>(null)

    const api = useDataGridAppCellSelection({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
          },
          selection: {
            hasSupport: () => true,
            setSnapshot: () => undefined,
          },
        },
        getBodyRowAtIndex: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
      } as never,
      totalRows: ref(10),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
        { key: "c" },
      ] as never),
      viewportRowStart: ref(0),
      selectionSnapshot,
      selectionAnchor,
      isEditingCell: () => false,
    })

    api.applyCellSelectionByCoord({ rowIndex: 1, columnIndex: 0, rowId: "r2" }, false)
    api.applyCellSelectionByCoord({ rowIndex: 4, columnIndex: 2, rowId: "r5" }, false, undefined, true)

    expect(selectionSnapshot.value?.ranges).toHaveLength(2)
    expect(selectionSnapshot.value?.activeRangeIndex).toBe(1)
    expect(api.resolveSelectionRanges()).toEqual([
      { startRow: 1, endRow: 1, startColumn: 0, endColumn: 0 },
      { startRow: 4, endRow: 4, startColumn: 2, endColumn: 2 },
    ])
    expect(api.isCellSelected(1, 0)).toBe(true)
    expect(api.isCellSelected(4, 2)).toBe(true)
    expect(api.isSelectionAnchorCell(4, 2)).toBe(true)
    expect(api.shouldHighlightSelectedCell(1, 0)).toBe(true)
  })

  it("preserves virtual selection metadata for ranges beyond the loaded cache", () => {
    const selectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
    const selectionAnchor = ref<{ rowIndex: number; colIndex: number; rowId: string | null } | null>(null)

    const api = useDataGridAppCellSelection({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => ({ rowId: `r${rowIndex + 1}` }),
          },
          selection: {
            hasSupport: () => true,
            setSnapshot: (snapshot: DataGridSelectionSnapshot) => {
              selectionSnapshot.value = snapshot
            },
          },
        },
        getBodyRowAtIndex: (rowIndex: number) => (
          rowIndex <= 1
            ? { rowId: `r${rowIndex + 1}` }
            : null
        ),
      } as never,
      totalRows: ref(10),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
      ] as never),
      viewportRowStart: ref(0),
      selectionSnapshot,
      selectionAnchor,
      isEditingCell: () => false,
      isVirtualSelectionMode: () => true,
      isRowLoadedAtIndex: rowIndex => rowIndex <= 1,
      resolveProjectionIdentity: () => ({
        rowModelKind: "server",
        revision: 1,
        datasetVersion: 4,
        projectionKey: "server-projection",
      }),
    })

    api.applySelectionRange({
      startRow: 0,
      endRow: 5,
      startColumn: 0,
      endColumn: 1,
    })

    const range = selectionSnapshot.value?.ranges[0]
    expect(range).toMatchObject({
      startRow: 0,
      endRow: 5,
      startCol: 0,
      endCol: 1,
      startRowId: "r1",
      endRowId: null,
      virtual: {
        startRowIndex: 0,
        endRowIndex: 5,
        startColumnIndex: 0,
        endColumnIndex: 1,
        datasetVersion: 4,
        isVirtualSelection: true,
        coverage: {
          isFullyLoaded: false,
          loadedRowCount: 2,
          totalRowCount: 6,
          missingIntervals: [{ startRow: 2, endRow: 5 }],
        },
      },
    })
    expect(api.resolveSelectionRange()).toEqual({
      startRow: 0,
      endRow: 5,
      startColumn: 0,
      endColumn: 1,
    })
  })
})
