const AUTO_ROW_HEIGHT_EPSILON = 0.6
const AUTO_ROW_HEIGHT_SMOOTHING = 0.5

export function normalizeAutoMeasuredHeight(height: number, layoutScale: number): number | null {
  if (!Number.isFinite(height) || height <= 0) return null
  const normalizedScale = Number.isFinite(layoutScale) && layoutScale > 0 ? layoutScale : 1
  const normalized = height / normalizedScale
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null
}

export function resolveAutoRowHeightEstimate(input: {
  currentEstimate: number
  cachedEstimate: number
  preserveLowerBound?: number
}): number | null {
  const lowerBound = Number.isFinite(input.preserveLowerBound)
    ? Math.max(1, input.preserveLowerBound as number)
    : null
  const candidate = lowerBound != null ? Math.max(input.cachedEstimate, lowerBound) : input.cachedEstimate
  if (!Number.isFinite(candidate) || candidate <= 0) return null
  const delta = candidate - input.currentEstimate
  if (Math.abs(delta) < AUTO_ROW_HEIGHT_EPSILON) return null
  const smoothed = input.currentEstimate + (delta * AUTO_ROW_HEIGHT_SMOOTHING)
  const normalized = Math.round(smoothed * 10) / 10
  return Math.abs(normalized - input.currentEstimate) < AUTO_ROW_HEIGHT_EPSILON ? null : normalized
}
