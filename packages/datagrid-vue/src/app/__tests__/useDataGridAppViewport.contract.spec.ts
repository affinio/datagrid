import { computed, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"
import { useDataGridAppViewport } from "../useDataGridAppViewport"

function createScrollEvent(target: HTMLElement): Event {
  return { target } as unknown as Event
}

describe("useDataGridAppViewport contract", () => {
  it("falls back to snapshot widths when column overrides are empty", () => {
    const visibleColumns = ref([
      { key: "alpha", pin: "center", width: 180 },
      { key: "beta", pin: "center", width: 220 },
    ] as unknown as readonly DataGridColumnSnapshot[])

    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: () => [],
        rowPartition: ref({ bodyRowCount: 0, pinnedTopRows: [], pinnedBottomRows: [] }),
        virtualWindow: ref({ rowStart: 0, rowEnd: 0 }),
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => true),
      columnVirtualizationEnabled: computed(() => true),
      visibleColumns,
      normalizedBaseRowHeight: ref(31),
      columnWidths: ref({}),
      defaultColumnWidth: 140,
      indexColumnWidth: 72,
    })

    expect(viewport.mainTrackStyle.value.width).toBe("400px")
    expect(viewport.gridContentStyle.value.width).toBe("472px")
    expect(viewport.columnStyle("alpha").width).toBe("180px")
    expect(viewport.columnStyle("beta").width).toBe("220px")
  })

  it("does not resync visible rows when scroll stays within the same virtual range", () => {
    const syncRowsInRange = vi.fn(() => [])
    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: syncRowsInRange,
        rowPartition: ref({ bodyRowCount: 100, pinnedTopRows: [], pinnedBottomRows: [] }),
        virtualWindow: ref({ rowStart: 0, rowEnd: 9 }),
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => true),
      columnVirtualizationEnabled: computed(() => false),
      visibleColumns: ref([] as unknown as readonly DataGridColumnSnapshot[]),
      normalizedBaseRowHeight: ref(20),
      rowOverscan: computed(() => 0),
    })

    const element = {
      scrollTop: 10,
      scrollLeft: 0,
      clientHeight: 100,
      clientWidth: 320,
    } as HTMLElement

    viewport.handleViewportScroll(createScrollEvent(element))
    viewport.handleViewportScroll(createScrollEvent({ ...element, scrollTop: 19 } as HTMLElement))

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)

    viewport.handleViewportScroll(createScrollEvent({ ...element, scrollTop: 20 } as HTMLElement))

    expect(syncRowsInRange).toHaveBeenCalledTimes(2)
  })

  it("partitions pinned bottom rows out of the body viewport without relying on tail order", () => {
    const rows = [
      { rowId: "r1", state: { pinned: "none" } },
      { rowId: "r2", state: { pinned: "bottom" } },
      { rowId: "r3", state: { pinned: "none" } },
      { rowId: "r4", state: { pinned: "none" } },
      { rowId: "r5", state: { pinned: "bottom" } },
      { rowId: "r6", state: { pinned: "none" } },
    ] as const
    const bodyRows = [rows[0], rows[2], rows[3], rows[5]] as const
    const pinnedBottomRows = ref([rows[1], rows[4]] as unknown as readonly (typeof rows)[number][])

    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: ({ start, end }) => bodyRows.slice(start, end + 1) as never,
        rowPartition: computed(() => ({
          bodyRowCount: bodyRows.length,
          pinnedTopRows: [],
          pinnedBottomRows: pinnedBottomRows.value,
        })),
        virtualWindow: ref({ rowStart: 0, rowEnd: rows.length - 1 }),
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => false),
      columnVirtualizationEnabled: computed(() => false),
      visibleColumns: ref([] as unknown as readonly DataGridColumnSnapshot[]),
      normalizedBaseRowHeight: ref(20),
    })

    viewport.bodyViewportRef.value = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 200,
      clientWidth: 320,
    } as HTMLElement

    viewport.syncViewportFromDom()

    expect(viewport.displayRows.value.map(row => row.rowId)).toEqual(["r1", "r3", "r4", "r6"])
    expect(viewport.pinnedBottomRows.value.map(row => row.rowId)).toEqual(["r2", "r5"])
    expect(viewport.bottomSpacerHeight.value).toBe(0)
    expect(viewport.viewportRowEnd.value).toBe(3)
  })
})