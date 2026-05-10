import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  createDataGridColumnModel,
} from "../../models"
import { createDataGridViewportCoreService } from "../dataGridViewportCoreService"
import type {
  DataGridViewportController,
  ViewportIntegrationSnapshot,
  ViewportSyncState,
} from "../dataGridViewportController"

function createSignal(value: number) {
  return { value }
}

function createSnapshot(overrides: Partial<ViewportIntegrationSnapshot> = {}): ViewportIntegrationSnapshot {
  return {
    scrollTop: 120,
    scrollLeft: 240,
    viewportHeight: 400,
    viewportWidth: 600,
    virtualWindow: {
      rowStart: 1,
      rowEnd: 1,
      rowTotal: 2,
      colStart: 1,
      colEnd: 1,
      colTotal: 2,
      overscan: { top: 0, bottom: 0, left: 0, right: 0 },
    },
    visibleRowRange: { start: 1, end: 1, total: 2 },
    visibleColumnRange: { start: 1, end: 1, total: 2 },
    pinnedWidth: { left: 0, right: 0 },
    overlaySync: { scrollTop: 120, scrollLeft: 240, pinnedOffsetLeft: 0, pinnedOffsetRight: 0 },
    recompute: {
      rowApplyCount: 0,
      columnApplyCount: 0,
      horizontalMetaRecomputeCount: 0,
      horizontalSizingRecomputeCount: 0,
      offscreenRowInvalidationSkips: 0,
      contentRowInvalidationApplyCount: 0,
    },
    ...overrides,
  }
}

describe("data grid viewport core service bridge", () => {
  it("exports semantic viewport position from controller integration snapshots", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: "r1", owner: "noc" }, rowId: "r1", originalIndex: 0 },
        { row: { id: "r2", owner: "ops" }, rowId: "r2", originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID" },
        { key: "owner", label: "Owner" },
      ],
    })
    const controller = {
      getIntegrationSnapshot: () => createSnapshot(),
      getViewportSyncState: (): ViewportSyncState => ({
        scrollTop: 0,
        scrollLeft: 0,
        pinnedOffsetLeft: 0,
        pinnedOffsetRight: 0,
      }),
    } as unknown as DataGridViewportController

    const service = createDataGridViewportCoreService({ controller, rowModel, columnModel })

    expect(service.getViewportPosition?.()).toEqual({
      version: 1,
      range: { start: 1, end: 1 },
      anchor: { rowId: "r2", rowIndex: 1, columnKey: "owner", columnIndex: 1 },
      scroll: { top: 120, left: 240 },
    })
  })

  it("restores semantic row and column anchors through controller commands", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, owner: "ops" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID" },
        { key: "owner", label: "Owner" },
      ],
    })
    const rowCalls: number[] = []
    const columnCalls: string[] = []
    const refreshCalls: boolean[] = []
    const controller = {
      input: {
        scrollTop: createSignal(0),
        scrollLeft: createSignal(0),
      },
      scrollToRow: (index: number) => rowCalls.push(index),
      scrollToColumn: (key: string) => columnCalls.push(key),
      refresh: (force?: boolean) => refreshCalls.push(force === true),
      getIntegrationSnapshot: () => createSnapshot(),
      getViewportSyncState: (): ViewportSyncState => ({
        scrollTop: 0,
        scrollLeft: 0,
        pinnedOffsetLeft: 0,
        pinnedOffsetRight: 0,
      }),
    } as unknown as DataGridViewportController

    const service = createDataGridViewportCoreService({ controller, rowModel, columnModel })

    service.setViewportPosition?.({
      version: 1,
      range: { start: 1, end: 1 },
      anchor: { rowId: 2, rowIndex: 0, columnKey: "owner", columnIndex: 0 },
      scroll: { top: 999, left: 888 },
    })

    expect(rowCalls).toEqual([1])
    expect(columnCalls).toEqual(["owner"])
    expect(refreshCalls).toEqual([true])
    expect(rowModel.getSnapshot().viewportRange).toEqual({ start: 1, end: 1 })
    expect(controller.input.scrollTop.value).toBe(0)
    expect(controller.input.scrollLeft.value).toBe(0)
  })

  it("falls back to stored scroll offsets when anchors cannot be resolved", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1, owner: "noc" }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const controller = {
      input: {
        scrollTop: createSignal(0),
        scrollLeft: createSignal(0),
      },
      scrollToRow: () => undefined,
      scrollToColumn: () => undefined,
      refresh: () => undefined,
      getIntegrationSnapshot: () => createSnapshot(),
      getViewportSyncState: (): ViewportSyncState => ({
        scrollTop: 0,
        scrollLeft: 0,
        pinnedOffsetLeft: 0,
        pinnedOffsetRight: 0,
      }),
    } as unknown as DataGridViewportController

    const service = createDataGridViewportCoreService({ controller, rowModel, columnModel })

    service.setViewportPosition?.({
      version: 1,
      range: { start: 0, end: 0 },
      anchor: { rowId: "missing", rowIndex: null, columnKey: "missing", columnIndex: null },
      scroll: { top: 72, left: 144 },
    })

    expect(controller.input.scrollTop.value).toBe(72)
    expect(controller.input.scrollLeft.value).toBe(144)
  })
})
