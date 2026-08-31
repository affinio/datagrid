import type { ChartAnchorRect, ChartInteractionPoint, ChartTooltipPlacement } from "./types"

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

export interface ChartTooltipPlacementInput {
  pointer: ChartInteractionPoint
  container: { width: number; height: number }
  tooltip: { width: number; height: number }
  offsetX: number
  offsetY: number
  padding: number
  constrainToChart: boolean
}

export interface ChartTooltipPlacementResult {
  left: number
  top: number
  placement: ChartTooltipPlacement
}

export function resolveChartTooltipPlacement(
  input: ChartTooltipPlacementInput,
): ChartTooltipPlacementResult {
  const width = Math.max(0, input.tooltip.width)
  const height = Math.max(0, input.tooltip.height)
  const offsetX = Math.max(0, input.offsetX)
  const offsetY = Math.max(0, input.offsetY)
  const padding = Math.max(0, input.padding)
  const containerWidth = Math.max(0, input.container.width)
  const containerHeight = Math.max(0, input.container.height)

  if (!input.constrainToChart) {
    return {
      left: input.pointer.x + offsetX,
      top: input.pointer.y + offsetY,
      placement: "right-bottom",
    }
  }

  const fitsRight = input.pointer.x + offsetX + width <= containerWidth - padding
  const fitsLeft = input.pointer.x - offsetX - width >= padding
  const fitsBottom = input.pointer.y + offsetY + height <= containerHeight - padding
  const fitsTop = input.pointer.y - offsetY - height >= padding
  const horizontal: "right" | "left" = fitsRight || !fitsLeft ? "right" : "left"
  const vertical: "bottom" | "top" = fitsBottom || !fitsTop ? "bottom" : "top"
  const placement = (horizontal + "-" + vertical) as ChartTooltipPlacement
  const rawLeft = horizontal === "right"
    ? input.pointer.x + offsetX
    : input.pointer.x - offsetX - width
  const rawTop = vertical === "bottom"
    ? input.pointer.y + offsetY
    : input.pointer.y - offsetY - height

  return {
    left: clamp(rawLeft, padding, Math.max(padding, containerWidth - width - padding)),
    top: clamp(rawTop, padding, Math.max(padding, containerHeight - height - padding)),
    placement,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
