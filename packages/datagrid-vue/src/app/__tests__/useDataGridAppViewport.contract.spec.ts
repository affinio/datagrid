import { computed, ref } from "vue"
import { describe, expect, it } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"
import { useDataGridAppViewport } from "../useDataGridAppViewport"

describe("useDataGridAppViewport contract", () => {
  it("falls back to snapshot widths when column overrides are empty", () => {
    const visibleColumns = ref([
      { key: "alpha", pin: "center", width: 180 },
      { key: "beta", pin: "center", width: 220 },
    ] as unknown as readonly DataGridColumnSnapshot[])

    const viewport = useDataGridAppViewport({
      runtime: {
        syncRowsInRange: () => [],
        virtualWindow: ref({ rowStart: 0, rowEnd: 0 }),
        api: {
          rows: {
            getCount: () => 0,
          },
        },
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => true),
      columnVirtualizationEnabled: computed(() => true),
      totalRows: ref(0),
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
})