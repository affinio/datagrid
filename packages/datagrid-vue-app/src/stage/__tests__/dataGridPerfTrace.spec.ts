import { effectScope, nextTick, ref } from "vue"
import { beforeEach, describe, expect, it } from "vitest"
import {
  DATA_GRID_PERF_STORE_KEY,
  createDataGridPerfStore,
  resolveDataGridPerfStore,
  resolveDataGridPerfTraceEnabled,
  recordDataGridPerfSampleIfEnabled,
} from "../../perf/dataGridPerfTrace"
import { useDataGridPerfTrace } from "../useDataGridPerfTrace"
import type { DataGridTableRow, DataGridTableStageViewportSection } from "../dataGridTableStage.types"

describe("dataGridPerfTrace", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[DATA_GRID_PERF_STORE_KEY]
    window.history.replaceState({}, "", "/")
    window.localStorage.clear()
  })

  it("resolves query params before local storage", () => {
    window.localStorage.setItem("affino-datagrid-perf-trace", "0")
    window.history.replaceState({}, "", "/?dgPerfTrace=1")

    expect(resolveDataGridPerfTraceEnabled()).toBe(true)
  })

  it("keeps only the latest perf samples", () => {
    const store = createDataGridPerfStore()

    for (let index = 0; index < 401; index += 1) {
      store.push({ scope: "stageWindowFlush", ts: index, totalMs: index })
    }

    expect(store.samples).toHaveLength(400)
    expect(store.samples[0]).toMatchObject({ ts: 1 })
    expect(store.latest()).toMatchObject({ ts: 400 })
    expect(store.latest("stageWindowFlush")).toMatchObject({ ts: 400 })
    expect(store.summary()).toEqual([
      {
        scope: "stageWindowFlush",
        count: 400,
        meanMs: expect.any(Number),
        p95Ms: expect.any(Number),
        maxMs: 400,
      },
    ])
  })

  it("records opt-in samples only when perf tracing is enabled", () => {
    recordDataGridPerfSampleIfEnabled({
      scope: "interactionPreventDefault",
      totalMs: 0,
      owner: "fill",
    })
    expect(resolveDataGridPerfStore()?.latest("interactionPreventDefault")).toBeNull()

    window.history.replaceState({}, "", "/?dgPerfTrace=1")
    recordDataGridPerfSampleIfEnabled({
      scope: "interactionPreventDefault",
      totalMs: 0,
      owner: "fill",
    })

    expect(resolveDataGridPerfStore()?.latest("interactionPreventDefault")).toMatchObject({
      scope: "interactionPreventDefault",
      owner: "fill",
    })
  })

  it("records stage perf samples when enabled", async () => {
    const viewport = ref<DataGridTableStageViewportSection>({
      viewportRowStart: 3,
      viewportRowEnd: 8,
      columnWindowStart: 0,
      topSpacerHeight: 12,
      bottomSpacerHeight: 24,
      leftColumnSpacerWidth: 0,
      rightColumnSpacerWidth: 0,
      headerViewportRef: () => undefined,
      bodyViewportRef: () => undefined,
      handleHeaderWheel: () => undefined,
      handleHeaderScroll: () => undefined,
      handleViewportScroll: () => undefined,
      handleViewportKeydown: () => undefined,
    })
    const displayRows = ref<readonly DataGridTableRow<{ region: string }>[]>([
      {
        rowId: "srv-000025",
        rowKey: "srv-000025",
        kind: "leaf",
        row: { region: "north" },
        data: { region: "north" },
        sourceIndex: 0,
        originalIndex: 0,
        displayIndex: 0,
        state: { selected: false, group: false, pinned: "none", expanded: false },
      },
    ])
    const bodyViewportScrollTop = ref(0)
    const scope = effectScope()

    scope.run(() => {
      useDataGridPerfTrace({
        viewport,
        displayRows,
        bodyViewportScrollTop,
        perfTraceEnabled: true,
      })
    })

    bodyViewportScrollTop.value = 128
    await nextTick()
    await nextTick()

    viewport.value = {
      ...viewport.value,
      viewportRowStart: 4,
      topSpacerHeight: 14,
      bottomSpacerHeight: 26,
    }

    await nextTick()
    await nextTick()

    const store = resolveDataGridPerfStore()
    expect(store?.latest("stageScrollFlush")).toMatchObject({
      scrollTop: 128,
      rowStart: 3,
      rowCount: 1,
    })
    expect(store?.latest("stageWindowFlush")).toMatchObject({
      rowStart: 4,
      rowCount: 1,
      topSpacerHeight: 14,
      bottomSpacerHeight: 26,
    })

    scope.stop()
  })
})
