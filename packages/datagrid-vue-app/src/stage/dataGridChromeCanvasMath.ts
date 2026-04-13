function normalizeDevicePixelRatio(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function normalizeCssLineWidth(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function resolveDeviceAlignedCanvasLineWidth(
  cssLineWidth: number,
  devicePixelRatio: number,
): number {
  const normalizedCssLineWidth = normalizeCssLineWidth(cssLineWidth)
  if (normalizedCssLineWidth <= 0) {
    return 0
  }
  const normalizedDevicePixelRatio = normalizeDevicePixelRatio(devicePixelRatio)
  const physicalLineWidth = Math.max(1, Math.round(normalizedCssLineWidth * normalizedDevicePixelRatio))
  return physicalLineWidth / normalizedDevicePixelRatio
}

export function resolveDeviceAlignedCanvasStrokeCenter(
  boundaryPosition: number,
  cssLineWidth: number,
  devicePixelRatio: number,
): number {
  const normalizedDevicePixelRatio = normalizeDevicePixelRatio(devicePixelRatio)
  const alignedLineWidth = resolveDeviceAlignedCanvasLineWidth(cssLineWidth, normalizedDevicePixelRatio)
  const snappedBoundary = Math.round(boundaryPosition * normalizedDevicePixelRatio) / normalizedDevicePixelRatio
  return snappedBoundary - (alignedLineWidth / 2)
}