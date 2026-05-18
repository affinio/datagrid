import type { ChartAnchorRect, ChartInteractionPoint } from "./types"

export interface ChartInteractionAnchor {
  clientPoint: ChartInteractionPoint
  anchorRect: ChartAnchorRect
}

export function createChartInteractionAnchor(element: Element | null): ChartInteractionAnchor {
  if (element === null) {
    return {
      clientPoint: { x: 0, y: 0 },
      anchorRect: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  const rect = element.getBoundingClientRect()
  const anchorRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }

  return {
    anchorRect,
    clientPoint: {
      x: anchorRect.x + anchorRect.width / 2,
      y: anchorRect.y + anchorRect.height / 2,
    },
  }
}
