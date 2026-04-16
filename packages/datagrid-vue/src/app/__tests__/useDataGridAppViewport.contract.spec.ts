import { computed, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"
import { useDataGridAppViewport } from "../useDataGridAppViewport"

function createScrollEvent(target: HTMLElement): Event {
  return { target } as unknown as Event
}

interface RafHarness {
  request: (callback: FrameRequestCallback) => number
  cancel: (handle: number) => void
  run: (handle: number) => void
  handles: () => number[]
}

function getScheduledFrameHandle(raf: RafHarness): number {
  const [handle] = raf.handles()

  expect(handle).toBeDefined()

  return handle as number
}

function createRafHarness(): RafHarness {
  let nextHandle = 1
  const callbacks = new Map<number, FrameRequestCallback>()

  return {
    request(callback) {
      const handle = nextHandle
      nextHandle += 1
      callbacks.set(handle, callback)
      return handle
    },
    cancel(handle) {
      callbacks.delete(handle)
    },
    run(handle) {
      const callback = callbacks.get(handle)
      callbacks.delete(handle)
      callback?.(0)
    },
    handles() {
      return [...callbacks.keys()]
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViewport(overrides: Partial<Parameters<typeof useDataGridAppViewport>[0]> = {}) {
  return useDataGridAppViewport({
    runtime: {
      syncBodyRowsInRange: () => [],
      setViewportRange: () => undefined,
      rowPartition: ref({ bodyRowCount: 0, pinnedTopRows: [], pinnedBottomRows: [] }),
      virtualWindow: ref({ rowStart: 0, rowEnd: 0 }),
    } as never,
    mode: computed(() => "base" as const),
    rowRenderMode: computed(() => "virtualization" as const),
    rowVirtualizationEnabled: computed(() => true),
    columnVirtualizationEnabled: computed(() => true),
    visibleColumns: ref([]),
    normalizedBaseRowHeight: ref(32),
    ...overrides,
  })
}

function makeColumns(count: number, width = 140): DataGridColumnSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `col-${i}`,
    pin: "center",
    width,
  })) as unknown as DataGridColumnSnapshot[]
}

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    rowId: `r${i}`,
    displayIndex: i,
    kind: "leaf",
  }))
}

function makeBodyViewport(scrollLeft = 0, clientWidth = 800): HTMLElement {
  return { scrollTop: 0, scrollLeft, clientHeight: 600, clientWidth } as HTMLElement
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

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
    const raf = createRafHarness()
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
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const element = {
      scrollTop: 10,
      scrollLeft: 0,
      clientHeight: 100,
      clientWidth: 320,
    } as HTMLElement
    viewport.bodyViewportRef.value = element

    viewport.handleViewportScroll(createScrollEvent(element))
    element.scrollTop = 19
    viewport.handleViewportScroll(createScrollEvent(element))
    expect(syncRowsInRange).toHaveBeenCalledTimes(0)

    const firstFrame = getScheduledFrameHandle(raf)
    raf.run(firstFrame)

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)

    element.scrollTop = 20
    viewport.handleViewportScroll(createScrollEvent(element))
    const secondFrame = getScheduledFrameHandle(raf)
    raf.run(secondFrame)

    expect(syncRowsInRange).toHaveBeenCalledTimes(2)
  })

  it("coalesces multiple scroll events into one visible-row sync per animation frame", () => {
    const raf = createRafHarness()
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
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const baseElement = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 100,
      clientWidth: 320,
    } as HTMLElement
    viewport.bodyViewportRef.value = baseElement

    baseElement.scrollTop = 20
    viewport.handleViewportScroll(createScrollEvent(baseElement))
    baseElement.scrollTop = 40
    viewport.handleViewportScroll(createScrollEvent(baseElement))
    baseElement.scrollTop = 60
    viewport.handleViewportScroll(createScrollEvent(baseElement))

    expect(syncRowsInRange).toHaveBeenCalledTimes(0)
    expect(raf.handles()).toHaveLength(1)

    const frame = getScheduledFrameHandle(raf)
    raf.run(frame)

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(syncRowsInRange).toHaveBeenLastCalledWith({ start: 3, end: 7 })
  })

  it("incrementally shifts visible rows when the viewport range overlaps the previous frame", () => {
    const raf = createRafHarness()
    const rows = makeRows(100)
    const syncRowsInRange = vi.fn(({ start, end }: { start: number; end: number }) => rows.slice(start, end + 1))
    const getBodyRowAtIndex = vi.fn((rowIndex: number) => rows[rowIndex] ?? null)
    const setViewportRange = vi.fn()
    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: syncRowsInRange,
        setViewportRange,
        getBodyRowAtIndex,
        rowPartition: ref({ bodyRowCount: 100, pinnedTopRows: [], pinnedBottomRows: [] }),
        virtualWindow: ref({ rowStart: 0, rowEnd: 4 }),
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => true),
      columnVirtualizationEnabled: computed(() => false),
      visibleColumns: ref([] as unknown as readonly DataGridColumnSnapshot[]),
      normalizedBaseRowHeight: ref(20),
      rowOverscan: computed(() => 0),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const element = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 100,
      clientWidth: 320,
    } as HTMLElement
    viewport.bodyViewportRef.value = element

    viewport.syncViewportFromDom()

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(viewport.displayRows.value.map(row => row.rowId)).toEqual(["r0", "r1", "r2", "r3", "r4"])
    expect(setViewportRange).not.toHaveBeenCalled()

    getBodyRowAtIndex.mockClear()
    element.scrollTop = 20
    viewport.handleViewportScroll(createScrollEvent(element))
    raf.run(getScheduledFrameHandle(raf))

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(getBodyRowAtIndex).toHaveBeenCalledTimes(1)
    expect(getBodyRowAtIndex).toHaveBeenLastCalledWith(5)
    expect(setViewportRange).toHaveBeenCalledTimes(1)
    expect(setViewportRange).toHaveBeenLastCalledWith({ start: 1, end: 5 })
    expect(viewport.displayRows.value.map(row => row.rowId)).toEqual(["r1", "r2", "r3", "r4", "r5"])
  })

  it("prefers fast virtual-window updates over full viewport sync during incremental shifts", () => {
    const raf = createRafHarness()
    const rows = makeRows(100)
    const syncRowsInRange = vi.fn(({ start, end }: { start: number; end: number }) => rows.slice(start, end + 1))
    const getBodyRowAtIndex = vi.fn((rowIndex: number) => rows[rowIndex] ?? null)
    const setViewportRange = vi.fn()
    const setVirtualWindowRange = vi.fn()
    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: syncRowsInRange,
        setViewportRange,
        setVirtualWindowRange,
        getBodyRowAtIndex,
        rowPartition: ref({ bodyRowCount: 100, pinnedTopRows: [], pinnedBottomRows: [] }),
        virtualWindow: ref({ rowStart: 0, rowEnd: 4 }),
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => true),
      columnVirtualizationEnabled: computed(() => false),
      visibleColumns: ref([] as unknown as readonly DataGridColumnSnapshot[]),
      normalizedBaseRowHeight: ref(20),
      rowOverscan: computed(() => 0),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const element = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 100,
      clientWidth: 320,
    } as HTMLElement
    viewport.bodyViewportRef.value = element

    viewport.syncViewportFromDom()

    getBodyRowAtIndex.mockClear()
    element.scrollTop = 20
    viewport.handleViewportScroll(createScrollEvent(element))
    raf.run(getScheduledFrameHandle(raf))

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(setVirtualWindowRange).toHaveBeenCalledTimes(1)
    expect(setVirtualWindowRange).toHaveBeenLastCalledWith({ start: 1, end: 5 })
    expect(setViewportRange).not.toHaveBeenCalled()
    expect(getBodyRowAtIndex).toHaveBeenCalledTimes(1)
    expect(viewport.displayRows.value.map(row => row.rowId)).toEqual(["r1", "r2", "r3", "r4", "r5"])
  })

  it("retains the last synced window while the visible range stays inside the overscan buffer", () => {
    const raf = createRafHarness()
    const rows = makeRows(200)
    const syncRowsInRange = vi.fn(({ start, end }: { start: number; end: number }) => rows.slice(start, end + 1))
    const getBodyRowAtIndex = vi.fn((rowIndex: number) => rows[rowIndex] ?? null)
    const setViewportRange = vi.fn()
    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: syncRowsInRange,
        setViewportRange,
        getBodyRowAtIndex,
        rowPartition: ref({ bodyRowCount: 200, pinnedTopRows: [], pinnedBottomRows: [] }),
        virtualWindow: ref({ rowStart: 0, rowEnd: 0 }),
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => true),
      columnVirtualizationEnabled: computed(() => false),
      visibleColumns: ref([] as unknown as readonly DataGridColumnSnapshot[]),
      normalizedBaseRowHeight: ref(20),
      rowOverscan: computed(() => 4),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const element = {
      scrollTop: 400,
      scrollLeft: 0,
      clientHeight: 100,
      clientWidth: 320,
    } as HTMLElement
    viewport.bodyViewportRef.value = element

    viewport.syncViewportFromDom()

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(syncRowsInRange).toHaveBeenLastCalledWith({ start: 16, end: 28 })
    expect(viewport.displayRows.value.map(row => row.rowId)).toEqual(rows.slice(16, 29).map(row => row.rowId))

    element.scrollTop = 440
    viewport.handleViewportScroll(createScrollEvent(element))
    raf.run(getScheduledFrameHandle(raf))

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(setViewportRange).not.toHaveBeenCalled()
    expect(getBodyRowAtIndex).not.toHaveBeenCalled()
    expect(viewport.displayRows.value.map(row => row.rowId)).toEqual(rows.slice(16, 29).map(row => row.rowId))

    element.scrollTop = 460
    viewport.handleViewportScroll(createScrollEvent(element))
    raf.run(getScheduledFrameHandle(raf))

    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(setViewportRange).toHaveBeenCalledTimes(1)
    expect(setViewportRange).toHaveBeenLastCalledWith({ start: 19, end: 31 })
    expect(getBodyRowAtIndex).toHaveBeenCalledTimes(3)
    expect(getBodyRowAtIndex.mock.calls.map(([rowIndex]) => rowIndex)).toEqual([29, 30, 31])
    expect(viewport.displayRows.value.map(row => row.rowId)).toEqual(rows.slice(19, 32).map(row => row.rowId))
  })

  // -------------------------------------------------------------------------
  // columnStyle() correctness
  // -------------------------------------------------------------------------

  it("columnStyle returns correct pixel widths for all columns via O(1) path", () => {
    const cols = makeColumns(200, 140)
    // Give every even column a distinct non-default width to exercise the lookup
    for (let i = 0; i < cols.length; i += 2) {
      ;(cols[i] as unknown as Record<string, unknown>).width = 80 + i
    }

    const viewport = makeViewport({ visibleColumns: ref(cols), columnVirtualizationEnabled: computed(() => false) })

    for (const col of cols) {
      const expected = `${(col as unknown as Record<string, unknown>).width}px`
      expect(viewport.columnStyle(col.key).width).toBe(expected)
      expect(viewport.columnStyle(col.key).minWidth).toBe(expected)
      expect(viewport.columnStyle(col.key).maxWidth).toBe(expected)
    }
  })

  it("columnStyle falls back to defaultColumnWidth for unknown key", () => {
    const viewport = makeViewport({
      visibleColumns: ref(makeColumns(5, 140)),
      defaultColumnWidth: 99,
    })
    const style = viewport.columnStyle("nonexistent-key")
    expect(style.width).toBe("99px")
  })

  // -------------------------------------------------------------------------
  // column virtualization — range correctness
  // -------------------------------------------------------------------------

  it("computes correct rendered column range at zero scroll", () => {
    const raf = createRafHarness()
    const COLS = makeColumns(50, 140) // 50 × 140 = 7 000 px total

    const viewport = makeViewport({
      visibleColumns: ref(COLS),
      columnVirtualizationEnabled: computed(() => true),
      columnOverscan: computed(() => 0),
      indexColumnWidth: 0,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const el = makeBodyViewport(0, 800) // viewport shows 0–799 px
    viewport.bodyViewportRef.value = el
    viewport.syncViewportFromDom()

    // columns 0–5 fit in 800 px (6 × 140 = 840 > 800, so 0-5 covers 0-839)
    // Actually: col0=0-140, col1=140-280, col2=280-420, col3=420-560, col4=560-700, col5=700-840
    // col5 right edge 840 > 800, so visibleEnd = 5
    expect(viewport.viewportColumnStart.value).toBe(0)
    expect(viewport.viewportColumnEnd.value).toBe(5)
    expect(viewport.leftColumnSpacerWidth.value).toBe(0)
    // rightSpacerWidth = totalWidth - left - rendered = 7000 - 0 - 6*140 = 6160
    expect(viewport.rightColumnSpacerWidth.value).toBe(7000 - 6 * 140)
  })

  it("computes correct rendered column range when scrolled to the middle", () => {
    const raf = createRafHarness()
    const COLS = makeColumns(100, 100) // 100 × 100 = 10 000 px total

    const viewport = makeViewport({
      visibleColumns: ref(COLS),
      columnVirtualizationEnabled: computed(() => true),
      columnOverscan: computed(() => 0),
      indexColumnWidth: 0,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    // Scroll to px 3000, viewport 800 wide → visible columns 30–37
    const el = makeBodyViewport(3000, 800)
    viewport.bodyViewportRef.value = el
    viewport.syncViewportFromDom()

    // col30 left edge = 3000, right = 3100. col37 right = 3800. col38 right = 3900 > 3800 → visibleEnd = 37
    expect(viewport.viewportColumnStart.value).toBe(30)
    expect(viewport.viewportColumnEnd.value).toBe(37)
    expect(viewport.leftColumnSpacerWidth.value).toBe(30 * 100)
    // renderedWidth = 8 * 100 = 800; rightSpacer = 10000 - 3000 - 800 = 6200
    expect(viewport.rightColumnSpacerWidth.value).toBe(10000 - 3000 - 8 * 100)
  })

  it("reuses renderedColumns ref when horizontal scroll stays within the same column range", () => {
    const raf = createRafHarness()
    const cols = makeColumns(100, 100)

    const viewport = makeViewport({
      visibleColumns: ref(cols),
      columnVirtualizationEnabled: computed(() => true),
      columnOverscan: computed(() => 0),
      indexColumnWidth: 0,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const el = makeBodyViewport(3010, 800)
    viewport.bodyViewportRef.value = el
    viewport.syncViewportFromDom()

    const firstRenderedColumns = viewport.renderedColumns.value

    el.scrollLeft = 3040
    viewport.handleViewportScroll(createScrollEvent(el))
    raf.run(getScheduledFrameHandle(raf))

    expect(viewport.viewportColumnStart.value).toBe(30)
    expect(viewport.viewportColumnEnd.value).toBe(38)
    expect(viewport.renderedColumns.value).toBe(firstRenderedColumns)
  })

  it("applies column overscan symmetrically around the visible range", () => {
    const raf = createRafHarness()
    const COLS = makeColumns(60, 100)

    const viewport = makeViewport({
      visibleColumns: ref(COLS),
      columnVirtualizationEnabled: computed(() => true),
      columnOverscan: computed(() => 3),
      indexColumnWidth: 0,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    // Scroll to px 1500, viewport 500 → visible cols 15–19 (5 cols)
    const el = makeBodyViewport(1500, 500)
    viewport.bodyViewportRef.value = el
    viewport.syncViewportFromDom()

    // overscan 3: start = max(0, 15-3) = 12, end = min(59, 19+3) = 22
    expect(viewport.viewportColumnStart.value).toBe(12)
    expect(viewport.viewportColumnEnd.value).toBe(22)
    expect(viewport.leftColumnSpacerWidth.value).toBe(12 * 100)
  })

  it("retains the last rendered column window while the visible range stays inside the overscan buffer", () => {
    const raf = createRafHarness()
    const cols = makeColumns(80, 100)

    const viewport = makeViewport({
      visibleColumns: ref(cols),
      columnVirtualizationEnabled: computed(() => true),
      columnOverscan: computed(() => 2),
      indexColumnWidth: 0,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const el = makeBodyViewport(1500, 800)
    viewport.bodyViewportRef.value = el
    viewport.syncViewportFromDom()

    const firstRenderedColumns = viewport.renderedColumns.value

    expect(viewport.viewportColumnStart.value).toBe(13)
    expect(viewport.viewportColumnEnd.value).toBe(24)

    el.scrollLeft = 1600
    viewport.handleViewportScroll(createScrollEvent(el))
    raf.run(getScheduledFrameHandle(raf))

    expect(viewport.viewportColumnStart.value).toBe(13)
    expect(viewport.viewportColumnEnd.value).toBe(24)
    expect(viewport.renderedColumns.value).toBe(firstRenderedColumns)

    el.scrollLeft = 1700
    viewport.handleViewportScroll(createScrollEvent(el))
    raf.run(getScheduledFrameHandle(raf))

    expect(viewport.viewportColumnStart.value).toBe(15)
    expect(viewport.viewportColumnEnd.value).toBe(26)
    expect(viewport.renderedColumns.value).not.toBe(firstRenderedColumns)
  })

  it("clamps column range to boundaries when scrolled past last column", () => {
    const raf = createRafHarness()
    const COLS = makeColumns(10, 100) // 1000 px total

    const viewport = makeViewport({
      visibleColumns: ref(COLS),
      columnVirtualizationEnabled: computed(() => true),
      columnOverscan: computed(() => 0),
      indexColumnWidth: 0,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const el = makeBodyViewport(5000, 800) // scrolled way past all columns
    viewport.bodyViewportRef.value = el
    viewport.syncViewportFromDom()

    expect(viewport.viewportColumnStart.value).toBe(9)
    expect(viewport.viewportColumnEnd.value).toBe(9)
    expect(viewport.rightColumnSpacerWidth.value).toBe(0)
  })

  it("mainTrackWidth equals sum of all column widths", () => {
    const COLS = makeColumns(200, 140)

    const viewport = makeViewport({
      visibleColumns: ref(COLS),
      columnVirtualizationEnabled: computed(() => false),
    })

    expect(viewport.mainTrackWidth.value).toBe(200 * 140)
  })

  it("mainTrackWidth updates reactively when column list changes", () => {
    const cols = ref(makeColumns(10, 100))
    const viewport = makeViewport({ visibleColumns: cols, columnVirtualizationEnabled: computed(() => false) })

    expect(viewport.mainTrackWidth.value).toBe(1000)
    cols.value = makeColumns(20, 100)
    expect(viewport.mainTrackWidth.value).toBe(2000)
  })

  // -------------------------------------------------------------------------
  // RAF lifecycle
  // -------------------------------------------------------------------------

  it("cancels a pending RAF when cancelScheduledViewportSync is called", () => {
    const raf = createRafHarness()
    const syncRowsInRange = vi.fn(() => [])
    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: syncRowsInRange,
        rowPartition: ref({ bodyRowCount: 10, pinnedTopRows: [], pinnedBottomRows: [] }),
        virtualWindow: ref({ rowStart: 0, rowEnd: 9 }),
      } as never,
      mode: computed(() => "base" as const),
      rowRenderMode: computed(() => "virtualization" as const),
      rowVirtualizationEnabled: computed(() => true),
      columnVirtualizationEnabled: computed(() => false),
      visibleColumns: ref([]),
      normalizedBaseRowHeight: ref(32),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    const el = { scrollTop: 100, scrollLeft: 0, clientHeight: 600, clientWidth: 800 } as HTMLElement
    viewport.bodyViewportRef.value = el
    viewport.handleViewportScroll({ target: el } as unknown as Event)

    expect(raf.handles()).toHaveLength(1)

    viewport.cancelScheduledViewportSync()
    expect(raf.handles()).toHaveLength(0)

    // Confirm the RAF was truly cancelled — no sync should happen
    expect(syncRowsInRange).not.toHaveBeenCalled()
  })

  it("refreshes viewport dimensions consistently across scroll and RAF commit boundaries", () => {
    const raf = createRafHarness()
    const widthReads = { clientWidth: 0, clientHeight: 0, shellClientWidth: 0 }
    let scrollTop = 0
    let scrollLeft = 0

    const parentElement = {} as HTMLElement
    Object.defineProperty(parentElement, "clientWidth", {
      configurable: true,
      get() {
        widthReads.shellClientWidth += 1
        return 640
      },
    })

    const element = { parentElement } as HTMLElement
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      get() {
        return scrollTop
      },
      set(value: number) {
        scrollTop = value
      },
    })
    Object.defineProperty(element, "scrollLeft", {
      configurable: true,
      get() {
        return scrollLeft
      },
      set(value: number) {
        scrollLeft = value
      },
    })
    Object.defineProperty(element, "clientWidth", {
      configurable: true,
      get() {
        widthReads.clientWidth += 1
        return 600
      },
    })
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      get() {
        widthReads.clientHeight += 1
        return 400
      },
    })

    const viewport = useDataGridAppViewport({
      runtime: {
        syncBodyRowsInRange: () => [],
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
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    viewport.bodyViewportRef.value = element
    viewport.syncViewportFromDom()

    widthReads.clientWidth = 0
    widthReads.clientHeight = 0
    widthReads.shellClientWidth = 0
    scrollTop = 20
    scrollLeft = 16

    viewport.handleViewportScroll(createScrollEvent(element))
    expect(widthReads.clientWidth).toBe(2)
    expect(widthReads.clientHeight).toBe(1)
    expect(widthReads.shellClientWidth).toBe(1)

    widthReads.clientWidth = 0
    widthReads.clientHeight = 0
    widthReads.shellClientWidth = 0

    raf.run(getScheduledFrameHandle(raf))

    expect(widthReads.clientWidth).toBe(2)
    expect(widthReads.clientHeight).toBe(1)
    expect(widthReads.shellClientWidth).toBe(1)
  })

  // -------------------------------------------------------------------------
  // Existing pinned-row test
  // -------------------------------------------------------------------------

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
        syncBodyRowsInRange: ({ start, end }: { start: number; end: number }) =>
          bodyRows.slice(start, end + 1) as never,
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
