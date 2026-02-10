import { describe, expect, it } from "vitest"
import { createClientRowModel, createDataGridColumnModel, type DataGridViewportRange } from "../../models"
import { createDataGridViewportController } from "../dataGridViewportController"
import type { DataGridViewportHostEnvironment } from "../viewportHostEnvironment"
import { createFakeRafScheduler } from "./utils/fakeRafScheduler"

interface MutableElementMetrics {
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
}

function createMeasuredElement(initial: MutableElementMetrics) {
  const state: MutableElementMetrics = { ...initial }
  const element = document.createElement("div") as HTMLDivElement

  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    get: () => state.clientWidth,
  })
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => state.clientHeight,
  })
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    get: () => state.scrollWidth,
  })
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => state.scrollHeight,
  })

  return {
    element,
    state,
  }
}

function createRows(count: number): Array<{ rowId: string; message: string }> {
  return Array.from({ length: count }, (_, index) => ({
    rowId: `row-${index + 1}`,
    message: `Message ${index + 1}`,
  }))
}

function createHostEnvironment(
  container: HTMLDivElement,
  header: HTMLElement,
  resolveMeasurements: (range: DataGridViewportRange) => Array<{ index: number; height: number }>,
): DataGridViewportHostEnvironment {
  return {
    addScrollListener(target, listener, options) {
      target.addEventListener("scroll", listener as EventListener, options)
    },
    removeScrollListener(target, listener, options) {
      target.removeEventListener("scroll", listener as EventListener, options)
    },
    readContainerMetrics() {
      return {
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
      }
    },
    readHeaderMetrics() {
      return {
        height: header.clientHeight,
      }
    },
    getBoundingClientRect(target) {
      return target.getBoundingClientRect()
    },
    isEventFromContainer(event, host) {
      return event.currentTarget === host
    },
    normalizeScrollLeft(target) {
      return target.scrollLeft
    },
    queryDebugDomStats() {
      return {
        rowLayers: 0,
        cells: 0,
        fillers: 0,
      }
    },
    readVisibleRowHeights(_host, range) {
      return resolveMeasurements(range)
    },
  }
}

describe("viewport auto row-height contract", () => {
  it("uses bounded measured cache and resets on structural row invalidation", () => {
    const rowModel = createClientRowModel({
      rows: createRows(300),
      resolveRowId: row => row.rowId,
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "message", label: "Message", width: 300, pin: "none", visible: true }],
    })

    const containerMetrics = createMeasuredElement({
      clientWidth: 800,
      clientHeight: 420,
      scrollWidth: 800,
      scrollHeight: 12_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 800,
      clientHeight: 40,
      scrollWidth: 800,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    let phase = 0
    const hostEnvironment = createHostEnvironment(
      containerMetrics.element,
      headerMetrics.element,
      range => {
        const heights = phase === 0
          ? [50, 52, 54, 56, 58, 60]
          : [34, 36, 38, 40, 42, 44]
        return heights.map((height, offset) => ({
          index: range.start + offset,
          height,
        }))
      },
    )

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      hostEnvironment,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
    })

    controller.attach(containerMetrics.element, headerMetrics.element)
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.setBaseRowHeight(38)
    controller.setRowHeightMode("auto")

    controller.refresh(true)
    controller.refresh(true)

    const firstEstimate = controller.core.effectiveRowHeight.value
    expect(firstEstimate).toBeGreaterThan(44)

    phase = 1
    controller.measureRowHeight()
    controller.refresh(true)
    controller.refresh(true)

    const secondEstimate = controller.core.effectiveRowHeight.value
    expect(secondEstimate).toBeLessThan(firstEstimate)
    expect(secondEstimate).toBeGreaterThanOrEqual(34)

    rowModel.setRows(createRows(300))
    controller.refresh(true)
    controller.refresh(true)

    expect(controller.core.effectiveRowHeight.value).toBeCloseTo(38, 4)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("keeps near-bottom scroll stable when auto estimate would otherwise shrink", () => {
    const rowModel = createClientRowModel({
      rows: createRows(1800),
      resolveRowId: row => row.rowId,
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "message", label: "Message", width: 320, pin: "none", visible: true }],
    })

    const containerMetrics = createMeasuredElement({
      clientWidth: 920,
      clientHeight: 460,
      scrollWidth: 920,
      scrollHeight: 120_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 920,
      clientHeight: 40,
      scrollWidth: 920,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    let phase: "tall" | "compact" = "tall"
    const hostEnvironment = createHostEnvironment(
      containerMetrics.element,
      headerMetrics.element,
      range => {
        const heights = phase === "tall"
          ? [62, 64, 66, 68, 70, 72]
          : [26, 28, 30, 32, 34, 36]
        return heights.map((height, offset) => ({
          index: range.start + offset,
          height,
        }))
      },
    )

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      hostEnvironment,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
    })

    controller.attach(containerMetrics.element, headerMetrics.element)
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.setBaseRowHeight(38)
    controller.setRowHeightMode("auto")

    controller.refresh(true)
    controller.refresh(true)

    const initialEstimate = controller.core.effectiveRowHeight.value
    expect(initialEstimate).toBeGreaterThan(50)

    containerMetrics.element.scrollTop = 1_000_000
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)

    const bottomEstimateBefore = controller.core.effectiveRowHeight.value
    const bottomScrollBefore = controller.input.scrollTop.value

    phase = "compact"
    containerMetrics.element.scrollTop = 1_000_000
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)
    controller.refresh(true)

    const bottomEstimateAfter = controller.core.effectiveRowHeight.value
    const bottomScrollAfter = controller.input.scrollTop.value

    expect(bottomEstimateAfter).toBeGreaterThanOrEqual(bottomEstimateBefore - 0.1)
    expect(bottomScrollAfter).toBeGreaterThanOrEqual(bottomScrollBefore - 1)

    containerMetrics.element.scrollTop = 0
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)
    controller.refresh(true)

    expect(controller.core.effectiveRowHeight.value).toBeLessThan(bottomEstimateBefore)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })
})
