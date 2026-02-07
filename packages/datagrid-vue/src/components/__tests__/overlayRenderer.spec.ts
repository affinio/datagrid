import { describe, expect, it } from "vitest"
import {
  createOverlayNodeCache,
  renderOverlayRectGroup,
  type OverlayRectLike,
} from "../overlayRenderer"

function createRect(id: string, left: number, top: number, width = 120, height = 32): OverlayRectLike {
  return {
    id,
    left,
    top,
    width,
    height,
    pin: "none",
  }
}

function createPinnedRect(
  id: string,
  pin: "left" | "none" | "right",
  left: number,
  top: number,
  width = 120,
  height = 32,
): OverlayRectLike {
  return {
    id,
    left,
    top,
    width,
    height,
    pin,
  }
}

describe("overlayRenderer keyed diff + pool reuse", () => {
  it("reuses existing nodes when keys stay stable and only geometry changes", () => {
    const target = document.createElement("div")
    const cache = createOverlayNodeCache()

    const first = renderOverlayRectGroup({
      target,
      cache,
      transform: { pinnedLeftTranslateX: 0, pinnedRightTranslateX: 0 },
      rects: [createRect("range-0", 0, 0), createRect("range-1", 140, 0)],
    })
    const firstNodeA = target.children.item(0) as HTMLDivElement
    const firstNodeB = target.children.item(1) as HTMLDivElement

    const second = renderOverlayRectGroup({
      target,
      cache,
      transform: { pinnedLeftTranslateX: 0, pinnedRightTranslateX: 0 },
      rects: [createRect("range-0", 0, 32), createRect("range-1", 140, 32)],
    })

    expect(first.created).toBe(2)
    expect(second.created).toBe(0)
    expect(second.reused).toBe(2)
    expect(second.released).toBe(0)
    expect(target.children.item(0)).toBe(firstNodeA)
    expect(target.children.item(1)).toBe(firstNodeB)
  })

  it("releases stale nodes to pool and uses pool for new keys", () => {
    const target = document.createElement("div")
    const cache = createOverlayNodeCache()

    renderOverlayRectGroup({
      target,
      cache,
      transform: { pinnedLeftTranslateX: 0, pinnedRightTranslateX: 0 },
      rects: [createRect("a", 0, 0), createRect("b", 120, 0), createRect("c", 240, 0)],
    })

    const second = renderOverlayRectGroup({
      target,
      cache,
      transform: { pinnedLeftTranslateX: 0, pinnedRightTranslateX: 0 },
      rects: [createRect("a", 0, 32), createRect("c", 240, 32), createRect("d", 360, 32)],
    })

    expect(second.released).toBe(1)
    expect(second.created).toBe(1)
    expect(second.reused).toBe(2)
    expect(target.children.length).toBe(3)
  })

  it("updates pinned coordinates via transform without creating new nodes", () => {
    const target = document.createElement("div")
    const cache = createOverlayNodeCache()

    renderOverlayRectGroup({
      target,
      cache,
      transform: { pinnedLeftTranslateX: 10, pinnedRightTranslateX: -20 },
      rects: [
        createPinnedRect("left", "left", 0, 0, 100),
        createPinnedRect("center", "none", 120, 0, 100),
        createPinnedRect("right", "right", 240, 0, 100),
      ],
    })

    const second = renderOverlayRectGroup({
      target,
      cache,
      transform: { pinnedLeftTranslateX: 25, pinnedRightTranslateX: -40 },
      rects: [
        createPinnedRect("left", "left", 0, 0, 100),
        createPinnedRect("center", "none", 120, 0, 100),
        createPinnedRect("right", "right", 240, 0, 100),
      ],
    })

    expect(second.created).toBe(0)
    expect(second.reused).toBe(3)
    expect((target.children.item(0) as HTMLDivElement).style.transform).toBe("translate3d(25px, 0px, 0)")
    expect((target.children.item(1) as HTMLDivElement).style.transform).toBe("translate3d(120px, 0px, 0)")
    expect((target.children.item(2) as HTMLDivElement).style.transform).toBe("translate3d(200px, 0px, 0)")
  })
})

describe("overlayRenderer perf budgets (drag/select/fill)", () => {
  it("stays within DOM-creation budget after warmup frames", () => {
    const target = document.createElement("div")
    const cache = createOverlayNodeCache()

    const warmup = 5
    const frames = 80

    let dragMaxCreated = 0
    for (let frame = 0; frame < frames; frame += 1) {
      const metrics = renderOverlayRectGroup({
        target,
        cache,
        transform: { pinnedLeftTranslateX: 0, pinnedRightTranslateX: 0 },
        rects: [
          createRect("drag-range-0", 0, frame * 4),
          createRect("drag-range-1", 140, frame * 4),
          createRect("drag-range-2", 280, frame * 4),
        ],
      })
      if (frame >= warmup) {
        dragMaxCreated = Math.max(dragMaxCreated, metrics.created)
      }
    }

    let selectMaxCreated = 0
    for (let frame = 0; frame < frames; frame += 1) {
      const width = 100 + (frame % 6) * 8
      const metrics = renderOverlayRectGroup({
        target,
        cache,
        transform: { pinnedLeftTranslateX: 0, pinnedRightTranslateX: 0 },
        rects: [
          createRect("select-0", 0, 0, width, 32),
          createRect("select-1", 120, 0, width, 32),
        ],
      })
      if (frame >= warmup) {
        selectMaxCreated = Math.max(selectMaxCreated, metrics.created)
      }
    }

    let fillMaxCreated = 0
    for (let frame = 0; frame < frames; frame += 1) {
      const metrics = renderOverlayRectGroup({
        target,
        cache,
        transform: { pinnedLeftTranslateX: 0, pinnedRightTranslateX: 0 },
        rects: [createRect("fill-preview-0", 360, frame * 3, 100, 32)],
      })
      if (frame >= warmup) {
        fillMaxCreated = Math.max(fillMaxCreated, metrics.created)
      }
    }

    expect(dragMaxCreated).toBeLessThanOrEqual(0)
    expect(selectMaxCreated).toBeLessThanOrEqual(0)
    expect(fillMaxCreated).toBeLessThanOrEqual(0)
  })
})
