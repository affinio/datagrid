import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { performance } from "node:perf_hooks"
import { createTimeSeriesChartGeometry } from "../packages/charts-core/dist/index.js"

const sizes = [1_000, 10_000, 50_000]
const iterations = 5
const start = Date.UTC(2020, 0, 1)
const outputPath = resolve(process.env.CHART_BENCH_OUTPUT ?? "artifacts/performance/charts-time-series-baseline.json")

function createSeries(pointCount, adjustment = 0) {
  return ["balance", "equity"].map((id, seriesIndex) => ({
    id,
    label: id === "balance" ? "Balance" : "Equity",
    data: Array.from({ length: pointCount }, (_, index) => ({
      time: start + index * 60_000,
      value: 10_000 + index * 0.2 + Math.sin(index / 17 + seriesIndex) * (80 + seriesIndex * 30) + adjustment,
    })),
  }))
}

function render(series) {
  return createTimeSeriesChartGeometry({ series, size: { width: 1_200, height: 480 } })
}

function measure(callback) {
  const values = []
  for (let index = 0; index < iterations; index += 1) {
    const before = performance.now()
    callback(index)
    values.push(performance.now() - before)
  }
  return {
    medianMs: median(values),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
  }
}

const scenarios = sizes.map((pointCount) => {
  globalThis.gc?.()
  const heapBefore = process.memoryUsage().heapUsed
  const canonical = createSeries(pointCount)
  const initialRender = measure(() => render(canonical))
  const updateRender = measure((index) => render(createSeries(pointCount, index + 1)))
  const geometry = render(canonical)
  globalThis.gc?.()
  const heapAfter = process.memoryUsage().heapUsed

  return {
    pointCountPerSeries: pointCount,
    seriesCount: canonical.length,
    renderedPointCount: geometry.series.reduce((total, series) => total + series.points.length, 0),
    initialRender,
    updateRender,
    retainedHeapDeltaMb: Number(((heapAfter - heapBefore) / 1024 / 1024).toFixed(2)),
  }
})

const report = {
  generatedAt: new Date().toISOString(),
  runtime: process.version,
  renderer: "@affino/charts-core SVG geometry/path generation (no browser paint)",
  iterations,
  scenarios,
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}
