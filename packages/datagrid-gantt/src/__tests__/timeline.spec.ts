import { describe, expect, it } from "vitest"
import {
  buildDataGridTimelineModel,
  buildDataGridTimelineRenderModels,
  resolveDataGridWorkingCalendar,
  resolveDataGridTimelineDateToPixel,
  resolveDataGridTimelinePixelToDate,
  resolveDataGridTimelineRange,
  resolveDataGridTimelineViewport,
} from "../index"

describe("datagrid timeline engine", () => {
  it("builds two-level day timeline segments from the visible viewport", () => {
    const timeline = {
      startMs: Date.parse("2026-05-01T00:00:00.000Z"),
      endMs: Date.parse("2026-05-20T00:00:00.000Z"),
      pixelsPerDay: 24,
      totalWidth: 19 * 24,
      zoomLevel: "day" as const,
    }

    const model = buildDataGridTimelineModel({
      timeline,
      scrollLeft: 0,
      viewportWidth: 24 * 7,
      bufferPx: 0,
    })

    expect(model.primarySegments.length).toBeGreaterThan(0)
    expect(model.secondarySegments.length).toBe(7)
    expect(model.nonWorkingSpans).toHaveLength(2)
    expect(new Date(model.secondarySegments[0]!.startMs).toISOString()).toBe("2026-05-01T00:00:00.000Z")
    expect(new Date(model.secondarySegments[1]!.startMs).toISOString()).toBe("2026-05-02T00:00:00.000Z")
    expect(model.secondarySegments[0]!.label).toBe("1")
    expect(model.secondarySegments[1]!.label).toBe("2")
  })

  it("builds week zoom segments without incremental pixel drift", () => {
    const timeline = {
      startMs: Date.parse("2026-05-01T00:00:00.000Z"),
      endMs: Date.parse("2026-07-01T00:00:00.000Z"),
      pixelsPerDay: 33.333,
      totalWidth: 61 * 33.333,
      zoomLevel: "week" as const,
    }

    const model = buildDataGridTimelineModel({
      timeline,
      scrollLeft: 0,
      viewportWidth: 500,
      bufferPx: 0,
    })

    const weekStartMs = model.secondarySegments[1]!.startMs
    expect(model.secondarySegments[1]!.x).toBeCloseTo(
      resolveDataGridTimelineDateToPixel(weekStartMs, timeline),
      6,
    )
    expect(model.secondarySegments[1]!.width).toBeCloseTo(7 * 33.333, 6)
    expect(model.secondarySegments[0]!.label.startsWith("W")).toBe(true)
  })

  it("converts timeline pixels to dates and resolves buffered viewport ranges", () => {
    const timeline = {
      startMs: Date.parse("2026-01-01T00:00:00.000Z"),
      endMs: Date.parse("2026-02-01T00:00:00.000Z"),
      pixelsPerDay: 10,
      totalWidth: 31 * 10,
      zoomLevel: "month" as const,
    }

    const viewport = resolveDataGridTimelineViewport({
      timeline,
      scrollLeft: 50,
      viewportWidth: 100,
      bufferPx: 20,
    })

    expect(viewport.startX).toBe(30)
    expect(viewport.endX).toBe(170)
    expect(viewport.startMs).toBe(Date.parse("2026-01-04T00:00:00.000Z"))
    expect(viewport.endMs).toBe(Date.parse("2026-01-18T00:00:00.000Z"))
    const dateMs = resolveDataGridTimelinePixelToDate(20, timeline)
    expect(dateMs).toBe(Date.parse("2026-01-03T00:00:00.000Z"))
    expect(Number.isInteger(dateMs)).toBe(true)
  })

  it("floors pixel-to-date conversion for fractional zoom scales", () => {
    const timeline = {
      startMs: Date.parse("2026-05-01T00:00:00.000Z"),
      endMs: Date.parse("2026-06-01T00:00:00.000Z"),
      pixelsPerDay: 33.333,
      totalWidth: 31 * 33.333,
      zoomLevel: "day" as const,
    }

    const dateMs = resolveDataGridTimelinePixelToDate(17, timeline)

    expect(Number.isInteger(dateMs)).toBe(true)
    expect(dateMs).toBeLessThanOrEqual(
      timeline.startMs + ((17 / timeline.pixelsPerDay) * 24 * 60 * 60 * 1000),
    )
  })

  it("resolves aligned timeline range from task bounds", () => {
    const range = resolveDataGridTimelineRange({
      minTaskDateMs: Date.parse("2026-05-01T10:30:00.000Z"),
      maxTaskDateMs: Date.parse("2026-05-04T14:15:00.000Z"),
      pixelsPerDay: 24,
    })

    expect(new Date(range.startMs).toISOString()).toBe("2026-05-01T00:00:00.000Z")
    expect(new Date(range.endMs).toISOString()).toBe("2026-05-05T00:00:00.000Z")
    expect(range.totalWidth).toBe(4 * 24)
  })

  it("falls back to a default duration when task bounds are missing", () => {
    const range = resolveDataGridTimelineRange({
      pixelsPerDay: 10,
      fallbackDateMs: Date.parse("2026-06-12T15:45:00.000Z"),
      fallbackDurationDays: 7,
    })

    expect(new Date(range.startMs).toISOString()).toBe("2026-06-12T00:00:00.000Z")
    expect(new Date(range.endMs).toISOString()).toBe("2026-06-19T00:00:00.000Z")
    expect(range.totalWidth).toBe(7 * 10)
  })

  it("extends timeline range with symmetric padding days", () => {
    const range = resolveDataGridTimelineRange({
      minTaskDateMs: Date.parse("2026-05-01T10:30:00.000Z"),
      maxTaskDateMs: Date.parse("2026-05-04T14:15:00.000Z"),
      pixelsPerDay: 24,
      rangePaddingDays: 2,
    })

    expect(new Date(range.startMs).toISOString()).toBe("2026-04-29T00:00:00.000Z")
    expect(new Date(range.endMs).toISOString()).toBe("2026-05-07T00:00:00.000Z")
    expect(range.totalWidth).toBe(8 * 24)
  })

  it("builds separate header and body models so header stays independent from body buffer", () => {
    const timeline = {
      startMs: Date.parse("2026-05-01T00:00:00.000Z"),
      endMs: Date.parse("2026-06-01T00:00:00.000Z"),
      pixelsPerDay: 10,
      totalWidth: 31 * 10,
      zoomLevel: "day" as const,
    }

    const models = buildDataGridTimelineRenderModels({
      timeline,
      scrollLeft: 50,
      viewportWidth: 100,
      workingCalendar: resolveDataGridWorkingCalendar(null),
      headerBufferPx: 0,
      bodyBufferPx: 20,
    })

    expect(models.header.viewport.startX).toBe(50)
    expect(models.body.viewport.startX).toBe(30)
    expect(models.header.secondarySegments[0]!.x).toBeLessThanOrEqual(0)
    expect(models.body.secondarySegments[0]!.x).toBeLessThan(models.header.secondarySegments[0]!.x)
    expect(models.body.nonWorkingSpans.length).toBeGreaterThanOrEqual(models.header.nonWorkingSpans.length)
    expect(models.header.nonWorkingSpans[0]!.x).toBeGreaterThanOrEqual(0)
  })

  it("builds non-working spans from a custom working calendar with holidays", () => {
    const timeline = {
      startMs: Date.parse("2026-05-01T00:00:00.000Z"),
      endMs: Date.parse("2026-05-08T00:00:00.000Z"),
      pixelsPerDay: 24,
      totalWidth: 7 * 24,
      zoomLevel: "day" as const,
    }

    const model = buildDataGridTimelineModel({
      timeline,
      scrollLeft: 0,
      viewportWidth: 24 * 7,
      workingCalendar: resolveDataGridWorkingCalendar({
        workingWeekdays: [1, 2, 3, 4, 5],
        holidays: ["2026-05-04T00:00:00.000Z"],
      }),
      bufferPx: 0,
    })

    expect(model.nonWorkingSpans.map(span => new Date(span.startMs).toISOString())).toEqual([
      "2026-05-02T00:00:00.000Z",
      "2026-05-03T00:00:00.000Z",
      "2026-05-04T00:00:00.000Z",
    ])
  })

  it("caps generated segments to guard against runaway loops", () => {
    const startMs = Date.parse("2026-01-01T00:00:00.000Z")
    const endMs = Date.parse("2086-01-01T00:00:00.000Z")
    const pixelsPerDay = 0.5
    const timeline = {
      startMs,
      endMs,
      pixelsPerDay,
      totalWidth: ((endMs - startMs) / (24 * 60 * 60 * 1000)) * pixelsPerDay,
      zoomLevel: "day" as const,
    }

    const model = buildDataGridTimelineModel({
      timeline,
      scrollLeft: 0,
      viewportWidth: 20_000,
      bufferPx: 0,
    })

    expect(model.secondarySegments.length).toBeLessThanOrEqual(10_000)
  })
})
