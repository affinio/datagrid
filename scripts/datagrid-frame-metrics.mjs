export function normalizeFrameDeltas(frameDeltas) {
  return frameDeltas.filter(delta => Number.isFinite(delta) && delta > 0).slice(2)
}

export function computeFrameMetrics(frameDeltas, refreshRateHz = 60) {
  const filtered = normalizeFrameDeltas(frameDeltas)
  const frameStats = stats(filtered)
  const refreshBudgetMs = 1000 / (Number.isFinite(refreshRateHz) && refreshRateHz > 0 ? refreshRateHz : 60)
  let refreshOpportunities = 0
  let refreshAwareDroppedFrames = 0
  for (const delta of filtered) {
    const opportunities = Math.max(1, Math.ceil(delta / refreshBudgetMs))
    refreshOpportunities += opportunities
    refreshAwareDroppedFrames += Math.max(0, opportunities - 1)
  }
  const droppedFrames = filtered.filter(delta => delta > 20).length
  const longFramesOver16Ms = filtered.filter(delta => delta > 16).length
  const longFramesOver32Ms = filtered.filter(delta => delta > 32).length
  return {
    sampleCount: filtered.length,
    frameStats,
    droppedFrames,
    droppedPct: filtered.length > 0 ? (droppedFrames / filtered.length) * 100 : 0,
    refreshRateHz: refreshRateHz,
    refreshAwareDroppedFrames,
    refreshAwareDroppedPct: refreshOpportunities > 0 ? (refreshAwareDroppedFrames / refreshOpportunities) * 100 : 0,
    longFramesOver16Ms,
    longFramesOver32Ms,
    fps: frameStats.mean > 0 ? 1000 / frameStats.mean : 0,
  }
}

function quantile(values, q) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] ?? 0
}

function stats(values) {
  if (!values.length) return { mean: 0, stdev: 0, p50: 0, p95: 0, p99: 0, cvPct: 0, min: 0, max: 0 }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const stdev = Math.sqrt(variance)
  return { mean, stdev, p50: quantile(values, 0.5), p95: quantile(values, 0.95), p99: quantile(values, 0.99), cvPct: mean === 0 ? 0 : (stdev / mean) * 100, min: Math.min(...values), max: Math.max(...values) }
}
