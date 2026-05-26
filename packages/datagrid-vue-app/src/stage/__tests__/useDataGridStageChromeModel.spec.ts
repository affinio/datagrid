import { computed, ref } from "vue"
import { describe, expect, it } from "vitest"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
} from "../dataGridTableStageBody.types"
import type {
  DataGridTableStageLayoutSection,
  DataGridTableStageRowsSection,
  DataGridTableStageViewportSection,
} from "../dataGridTableStage.types"
import { useDataGridStageChromeModel } from "../useDataGridStageChromeModel"

function createRect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 0,
    bottom: top + height,
    width: 0,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

function setRect(element: HTMLElement, top: number, height: number): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => createRect(top, height),
  })
}

describe("useDataGridStageChromeModel", () => {
  it("builds chrome render inputs and signatures from stage refs", () => {
    const mode = ref("base")
    const rowHeightMode = ref("auto")
    const bodyViewportScrollTop = ref(100)
    const bodyViewportScrollLeft = ref(16)
    const bodyViewportClientWidth = ref(320)
    const bodyViewportClientHeight = ref(180)
    const pinnedBottomViewportClientHeight = ref(42)
    const headerShellHeight = ref(28)
    const headerViewportClientWidth = ref(320)
    const bodyViewportEl = ref<HTMLElement | null>(null)
    const indexColumnWidthPx = computed(() => 72)
    const leftPaneWidth = computed(() => 152)
    const rightPaneWidth = computed(() => 90)

    const displayRows = computed<readonly DataGridTableStageBodyRow[]>(() => ([
      { rowId: "row-0", displayIndex: 0 } as unknown as DataGridTableStageBodyRow,
      { rowId: "row-1", displayIndex: 1 } as unknown as DataGridTableStageBodyRow,
    ]))
    const pinnedBottomRows = computed<readonly DataGridTableStageBodyRow[]>(() => ([
      { rowId: "pinned-0", displayIndex: 2 } as unknown as DataGridTableStageBodyRow,
    ]))

    const visibleColumns = computed<readonly DataGridTableStageBodyColumn[]>(() => ([
      {
        key: "left",
        pin: "left",
        width: 72,
        column: { meta: {} },
      } as unknown as DataGridTableStageBodyColumn,
      {
        key: "center",
        pin: "none",
        width: 120,
        column: { meta: { affinoPivotHeader: { groupLabels: ["group-a", "group-b"] } } },
      } as unknown as DataGridTableStageBodyColumn,
      {
        key: "center-extra",
        pin: "none",
        width: 140,
        column: { meta: {} },
      } as unknown as DataGridTableStageBodyColumn,
      {
        key: "right",
        pin: "right",
        width: 90,
        column: { meta: {} },
      } as unknown as DataGridTableStageBodyColumn,
    ]))
    const renderedColumns = computed<readonly DataGridTableStageBodyColumn[]>(() => [visibleColumns.value[1]!])
    const pinnedLeftColumns = computed(() => [visibleColumns.value[0]!])
    const pinnedRightColumns = computed(() => [visibleColumns.value[3]!])

    const layout = computed(() => ({
      columnStyle: (key: string) => ({ width: key === "left" ? "72px" : "120px" }),
      gridContentStyle: { width: "320px", minWidth: "320px" },
      mainTrackStyle: {},
      indexColumnStyle: {},
      stageStyle: {},
      bodyShellStyle: {},
    } as DataGridTableStageLayoutSection))

    const viewport = computed(() => ({
      topSpacerHeight: 60,
      bottomSpacerHeight: 0,
      viewportRowStart: 0,
      viewportRowEnd: 1,
      virtualRowTotal: 10,
      baseRowHeight: 31,
      resolveRowHeight: undefined,
      resolveRowOffset: undefined,
      columnWindowStart: 0,
      leftColumnSpacerWidth: 12,
      rightColumnSpacerWidth: 8,
      headerViewportRef: () => {},
      bodyViewportRef: () => {},
      handleHeaderWheel: () => {},
      handleHeaderScroll: () => {},
      handleViewportScroll: () => {},
      handleViewportKeydown: () => {},
    } as DataGridTableStageViewportSection))

    const rows = computed(() => ({
      rowStyle(row: DataGridTableStageBodyRow) {
        return row.rowId === "pinned-0"
          ? { height: "42px" }
          : { height: "31px" }
      },
      rowClass(row: DataGridTableStageBodyRow) {
        if (row.rowId === "row-0") {
          return "row--group row--pivot"
        }
        if (row.rowId === "pinned-0") {
          return "row--tree"
        }
        return ""
      },
      stripedRows: true,
      rowHover: false,
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>))

    const row0 = document.createElement("div")
    row0.className = "grid-row"
    const row1 = document.createElement("div")
    row1.className = "grid-row"
    const content = document.createElement("div")
    content.className = "grid-body-content"
    content.append(row0, row1)
    const viewportEl = document.createElement("div")
    viewportEl.scrollTop = 100
    setRect(viewportEl, 10, 180)
    setRect(row0, 18, 31)
    setRect(row1, 49, 31)
    viewportEl.append(content)
    bodyViewportEl.value = viewportEl

    const result = useDataGridStageChromeModel({
      mode,
      rowHeightMode,
      layout,
      viewport,
      rows,
      visibleColumns,
      renderedColumns,
      displayRows,
      pinnedBottomRows,
      selectionTotalRowCount: computed(() => 5),
      leftPaneWidth,
      rightPaneWidth,
      bodyViewportScrollTop,
      bodyViewportScrollLeft,
      bodyViewportClientWidth,
      bodyViewportClientHeight,
      pinnedBottomViewportClientHeight,
      headerShellHeight,
      headerViewportClientWidth,
      bodyViewportEl,
      indexColumnWidthPx,
      pinnedLeftColumns,
      pinnedRightColumns,
      resolveColumnWidth: column => column.width ?? 0,
      resolveLeftColumnSpacerWidth: () => 12,
      resolveRightColumnSpacerWidth: () => 8,
      resolveAbsoluteRowIndex: row => row.displayIndex ?? 0,
      resolveViewportRowOffset: row => (row.displayIndex ?? 0) - viewport.value.viewportRowStart,
      isHoveredRow: () => false,
      isStripedRow: (_row, rowOffset) => rowOffset % 2 === 1,
      readPivotHeaderMeta: column => column.key === "center"
        ? { groupLabels: ["group-a", "group-b"] }
        : null,
    })

    expect(result.rowMetrics.value).toEqual([
      { top: 108, height: 31 },
      { top: 139, height: 31 },
    ])
    expect(result.pinnedBottomRowMetrics.value).toEqual([
      { top: 0, height: 42 },
    ])
    expect(result.leftChromeColumnsSignature.value).toBe("72|72")
    expect(result.centerChromeColumnsSignature.value).toBe("12|120|8")
    expect(result.rightChromeColumnsSignature.value).toBe("90")
    expect(result.rowMetricsSignature.value).toBe("108:31|139:31")
    expect(result.pinnedBottomRowMetricsSignature.value).toBe("0:42")
    expect(result.rowBandsSignature.value).toContain("pivot-group:108:31")
    expect(result.rowBandsSignature.value).toContain("striped:139:31")
    expect(result.pinnedBottomRowBandsSignature.value).toBe("tree:0:42")
    expect(result.headerPivotGroupsSignature.value).toBe("none")

    mode.value = "pivot"
    expect(result.hasPivotHeaderGroups.value).toBe(true)
    expect(result.headerPivotGroupsSignature.value).toBe("left:|center:group-a>group-b|center-extra:|right:")
  })

  it("uses virtualized center columns for pinned native prototype chrome", () => {
    const columns = computed<readonly DataGridTableStageBodyColumn[]>(() => ([
      { key: "left", pin: "left", width: 72, column: { meta: {} } } as unknown as DataGridTableStageBodyColumn,
      { key: "center-a", pin: "none", width: 120, column: { meta: {} } } as unknown as DataGridTableStageBodyColumn,
      { key: "center-b", pin: "none", width: 140, column: { meta: {} } } as unknown as DataGridTableStageBodyColumn,
      { key: "right", pin: "right", width: 90, column: { meta: {} } } as unknown as DataGridTableStageBodyColumn,
    ]))
    const result = useDataGridStageChromeModel({
      mode: ref("base"),
      rowHeightMode: ref("fixed"),
      layout: computed(() => ({
        columnStyle: () => ({}),
        gridContentStyle: {},
        mainTrackStyle: {},
        indexColumnStyle: {},
        stageStyle: {},
        bodyShellStyle: {},
      } as DataGridTableStageLayoutSection)),
      viewport: computed(() => ({
        topSpacerHeight: 360,
        bottomSpacerHeight: 0,
        viewportRowStart: 10,
        viewportRowEnd: 10,
        columnWindowStart: 0,
        leftColumnSpacerWidth: 24,
        rightColumnSpacerWidth: 48,
        headerViewportRef: () => {},
        bodyViewportRef: () => {},
        handleHeaderWheel: () => {},
        handleHeaderScroll: () => {},
        handleViewportScroll: () => {},
        handleViewportKeydown: () => {},
      } as DataGridTableStageViewportSection)),
      rows: computed(() => ({
        rowStyle: () => ({ height: "31px" }),
        rowClass: () => "",
      } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)),
      visibleColumns: columns,
      renderedColumns: computed(() => [columns.value[1]!]),
      pinnedNativeScrollPrototypeEnabled: ref(true),
      displayRows: computed(() => [{ rowId: "row-10", kind: "leaf", data: {} }] as unknown as readonly DataGridTableStageBodyRow[]),
      pinnedBottomRows: computed(() => []),
      selectionTotalRowCount: computed(() => 0),
      leftPaneWidth: computed(() => 72),
      rightPaneWidth: computed(() => 90),
      bodyViewportScrollTop: ref(360),
      bodyViewportScrollLeft: ref(0),
      bodyViewportClientWidth: ref(320),
      bodyViewportClientHeight: ref(180),
      pinnedBottomViewportClientHeight: ref(0),
      headerShellHeight: ref(28),
      headerViewportClientWidth: ref(320),
      bodyViewportEl: ref(null),
      indexColumnWidthPx: computed(() => 0),
      pinnedLeftColumns: computed(() => [columns.value[0]!]),
      pinnedRightColumns: computed(() => [columns.value[3]!]),
      resolveColumnWidth: column => column.width ?? 0,
      resolveLeftColumnSpacerWidth: () => 24,
      resolveRightColumnSpacerWidth: () => 48,
      resolveAbsoluteRowIndex: () => 0,
      resolveViewportRowOffset: () => 0,
      isHoveredRow: () => false,
      isStripedRow: () => false,
      readPivotHeaderMeta: () => null,
    })

    expect(result.centerChromeColumnsSignature.value).toBe("24|120|48")
    expect(result.rowMetrics.value[0]).toEqual({ top: 0, height: 31 })
    expect(result.chromeRenderModel.value.center.horizontalLines[0]?.position).toBe(31)
    expect(result.chromeRenderModel.value.center.width).toBe(320)
    expect(result.headerChromeRenderModel.value.center.width).toBe(320)
  })

})
