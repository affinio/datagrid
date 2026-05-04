#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { chromium } from "@playwright/test"
import { ensureSandboxServer } from "./ensure-sandbox-server.mjs"

const BENCH_BROWSER_BASE_URL = process.env.BENCH_BROWSER_BASE_URL ?? "http://127.0.0.1:4173"
const BENCH_BROWSER_ROUTE = process.env.BENCH_BROWSER_ROUTE ?? "/vue/shell/base-grid"
const BENCH_BROWSER_SESSIONS = intEnv("BENCH_BROWSER_SESSIONS", 2)
const BENCH_BROWSER_ROW_COUNT = intEnv("BENCH_BROWSER_ROW_COUNT", 100000)
const BENCH_BROWSER_COLUMN_COUNT = intEnv("BENCH_BROWSER_COLUMN_COUNT", 32)
const BENCH_BROWSER_SCROLL_STEPS = intEnv("BENCH_BROWSER_SCROLL_STEPS", 240)
const BENCH_BROWSER_HORIZONTAL_STEPS = intEnv("BENCH_BROWSER_HORIZONTAL_STEPS", 96)
const BENCH_BROWSER_STEP_DELAY_MS = intEnv("BENCH_BROWSER_STEP_DELAY_MS", 6)
const BENCH_BROWSER_CELL_UPDATE_BURST = intEnv("BENCH_BROWSER_CELL_UPDATE_BURST", 4)
const BENCH_BROWSER_HEADLESS = (process.env.BENCH_BROWSER_HEADLESS ?? "true").trim().toLowerCase() !== "false"
const BENCH_ENABLE_FILTER = (process.env.BENCH_BROWSER_ENABLE_FILTER ?? "true").trim().toLowerCase() !== "false"
const BENCH_ENABLE_SORT = (process.env.BENCH_BROWSER_ENABLE_SORT ?? "true").trim().toLowerCase() !== "false"
const BENCH_ENABLE_CELL_UPDATES = (
  process.env.BENCH_BROWSER_ENABLE_CELL_UPDATES ?? "true"
).trim().toLowerCase() !== "false"
const BENCH_VIEWPORT_SELECTOR = ".table-wrap, .datagrid-sugar-stage__viewport, .datagrid-stage__viewport"
const BENCH_OUTPUT_JSON = process.env.BENCH_OUTPUT_JSON
  ? resolve(process.env.BENCH_OUTPUT_JSON)
  : resolve("artifacts/performance/bench-datagrid-enterprise-browser-frames.json")

assertPositiveInteger(BENCH_BROWSER_SESSIONS, "BENCH_BROWSER_SESSIONS")
assertPositiveInteger(BENCH_BROWSER_ROW_COUNT, "BENCH_BROWSER_ROW_COUNT")
assertPositiveInteger(BENCH_BROWSER_COLUMN_COUNT, "BENCH_BROWSER_COLUMN_COUNT")
assertPositiveInteger(BENCH_BROWSER_SCROLL_STEPS, "BENCH_BROWSER_SCROLL_STEPS")
assertPositiveInteger(BENCH_BROWSER_HORIZONTAL_STEPS, "BENCH_BROWSER_HORIZONTAL_STEPS")
assertPositiveInteger(BENCH_BROWSER_STEP_DELAY_MS, "BENCH_BROWSER_STEP_DELAY_MS")
assertNonNegativeInteger(BENCH_BROWSER_CELL_UPDATE_BURST, "BENCH_BROWSER_CELL_UPDATE_BURST")

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10)
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`)
  }
  return value
}

function assertPositiveInteger(value, label) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

function quantile(values, q) {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const position = Math.max(0, Math.min(1, q)) * (sorted.length - 1)
  const base = Math.floor(position)
  const rest = position - base
  const current = sorted[base] ?? 0
  const next = sorted[base + 1] ?? current
  return current + (next - current) * rest
}

function stats(values) {
  const finite = values.filter(value => Number.isFinite(value))
  if (!finite.length) {
    return { mean: 0, stdev: 0, p50: 0, p95: 0, p99: 0, cvPct: 0, min: 0, max: 0 }
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length
  const stdev = Math.sqrt(variance)
  return {
    mean,
    stdev,
    p50: quantile(finite, 0.5),
    p95: quantile(finite, 0.95),
    p99: quantile(finite, 0.99),
    cvPct: mean === 0 ? 0 : (stdev / mean) * 100,
    min: Math.min(...finite),
    max: Math.max(...finite),
  }
}

function computeFrameMetrics(frameDeltas) {
  const filtered = normalizeFrameDeltas(frameDeltas)
  const frameStats = stats(filtered)
  const droppedFrames = filtered.filter(delta => delta > 20).length
  const longFramesOver16Ms = filtered.filter(delta => delta > 16).length
  const longFramesOver32Ms = filtered.filter(delta => delta > 32).length
  const droppedPct = filtered.length > 0 ? (droppedFrames / filtered.length) * 100 : 0
  const fps = frameStats.mean > 0 ? 1000 / frameStats.mean : 0
  return {
    sampleCount: filtered.length,
    frameStats,
    droppedFrames,
    droppedPct,
    longFramesOver16Ms,
    longFramesOver32Ms,
    fps,
  }
}

function normalizeFrameDeltas(frameDeltas) {
  return frameDeltas.filter(delta => Number.isFinite(delta) && delta > 0).slice(2)
}

async function configureSandbox(page) {
  return await page.evaluate(({ rowCount, columnCount }) => {
    function selectNearestByLabel(pattern, target) {
      const labels = Array.from(document.querySelectorAll("label"))
      const label = labels.find(candidate => pattern.test(candidate.textContent ?? ""))
      const select = label?.querySelector("select")
      if (!(select instanceof HTMLSelectElement)) {
        return { applied: false, requested: target, selected: null, reason: "select-not-found" }
      }
      const options = Array.from(select.options)
        .map(option => Number.parseInt(option.value, 10))
        .filter(value => Number.isFinite(value) && value > 0)
      if (!options.length) {
        return { applied: false, requested: target, selected: null, reason: "no-numeric-options" }
      }
      let nearest = options[0] ?? target
      let bestDistance = Math.abs(nearest - target)
      for (const option of options) {
        const distance = Math.abs(option - target)
        if (distance < bestDistance) {
          nearest = option
          bestDistance = distance
        }
      }
      if (select.value !== String(nearest)) {
        select.value = String(nearest)
        select.dispatchEvent(new Event("input", { bubbles: true }))
        select.dispatchEvent(new Event("change", { bubbles: true }))
      }
      return { applied: true, requested: target, selected: nearest, reason: null }
    }

    function selectValueByLabel(pattern, value) {
      const labels = Array.from(document.querySelectorAll("label"))
      const label = labels.find(candidate => pattern.test(candidate.textContent ?? ""))
      const select = label?.querySelector("select")
      if (!(select instanceof HTMLSelectElement)) {
        return false
      }
      if (!Array.from(select.options).some(option => option.value === value)) {
        return false
      }
      if (select.value !== value) {
        select.value = value
        select.dispatchEvent(new Event("input", { bubbles: true }))
        select.dispatchEvent(new Event("change", { bubbles: true }))
      }
      return true
    }

    return {
      rows: selectNearestByLabel(/^(\s*)Rows\b/i, rowCount),
      columns: selectNearestByLabel(/^(\s*)Cols\b/i, columnCount),
      renderVirtualization: selectValueByLabel(/^(\s*)Render\b/i, "virtualization"),
      viewTable: selectValueByLabel(/^(\s*)View\b/i, "table"),
      rowModeFixed: selectValueByLabel(/^(\s*)Row mode\b/i, "fixed"),
    }
  }, {
    rowCount: BENCH_BROWSER_ROW_COUNT,
    columnCount: BENCH_BROWSER_COLUMN_COUNT,
  })
}

async function runSession(page, sessionIndex) {
  const result = await page.evaluate(async (input) => {
    const viewport = document.querySelector(input.viewportSelector)
    if (!(viewport instanceof HTMLElement)) {
      throw new Error(`Datagrid viewport not found (${input.viewportSelector})`)
    }

    const stageRoot = viewport.closest(".grid-stage") ?? document.querySelector(".grid-stage")
    const frameDeltas = []
    const longTaskDurations = []
    const telemetrySamples = []
    const interactions = {
      verticalScrollSteps: 0,
      horizontalScrollSteps: 0,
      filterApplied: false,
      filterCleared: false,
      sortApplied: false,
      cellUpdatesAttempted: 0,
      cellEditorsOpened: 0,
      cellUpdatesCommitted: 0,
      skipped: [],
    }

    const pause = (ms) => new Promise(resolvePause => setTimeout(resolvePause, ms))
    const waitForPaint = () => new Promise(resolvePaint => {
      requestAnimationFrame(() => requestAnimationFrame(resolvePaint))
    })
    const captureTelemetry = (label) => {
      const performanceWithMemory = performance
      const usedHeap = typeof performanceWithMemory?.memory?.usedJSHeapSize === "number"
        ? performanceWithMemory.memory.usedJSHeapSize / (1024 * 1024)
        : null
      const totalHeap = typeof performanceWithMemory?.memory?.totalJSHeapSize === "number"
        ? performanceWithMemory.memory.totalJSHeapSize / (1024 * 1024)
        : null
      telemetrySamples.push({
        label,
        pageNodes: document.body ? document.body.querySelectorAll("*").length : 0,
        stageNodes: stageRoot instanceof HTMLElement ? stageRoot.querySelectorAll("*").length : 0,
        visibleCells: stageRoot instanceof HTMLElement ? stageRoot.querySelectorAll(".grid-cell").length : 0,
        viewportCells: viewport.querySelectorAll(".grid-cell").length,
        usedHeapMb: usedHeap,
        totalHeapMb: totalHeap,
        scrollTop: viewport.scrollTop,
        scrollLeft: viewport.scrollLeft,
      })
    }

    let running = true
    let last = performance.now()
    const tick = (timestamp) => {
      frameDeltas.push(timestamp - last)
      last = timestamp
      if (running) {
        requestAnimationFrame(tick)
      }
    }

    let longTaskObserver = null
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTaskDurations.push(entry.duration)
          }
        })
        longTaskObserver.observe({ entryTypes: ["longtask"] })
      } catch {
        longTaskObserver = null
      }
    }

    requestAnimationFrame(tick)
    const startedAt = performance.now()
    captureTelemetry("start")
    await waitForPaint()

    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)

    if (maxTop > 0) {
      for (let step = 1; step <= input.scrollSteps; step += 1) {
        viewport.scrollTop = Math.round((maxTop * step) / input.scrollSteps)
        interactions.verticalScrollSteps += 1
        if (step === 1 || step === input.scrollSteps || step % 40 === 0) {
          captureTelemetry(`vertical:${step}`)
        }
        await pause(input.stepDelayMs)
      }
    } else {
      interactions.skipped.push("vertical-scroll:no-scroll-range")
    }

    if (maxLeft > 0) {
      for (let step = 1; step <= input.horizontalSteps; step += 1) {
        const phase = (step + input.sessionIndex) % 2
        const position = phase === 0
          ? Math.round((maxLeft * step) / input.horizontalSteps)
          : Math.round(maxLeft - (maxLeft * step) / input.horizontalSteps)
        viewport.scrollLeft = position
        interactions.horizontalScrollSteps += 1
        if (step === 1 || step === input.horizontalSteps || step % 32 === 0) {
          captureTelemetry(`horizontal:${step}`)
        }
        await pause(input.stepDelayMs)
      }
    } else {
      interactions.skipped.push("horizontal-scroll:no-scroll-range")
    }

    if (maxLeft > 0) {
      viewport.scrollLeft = 0
      captureTelemetry("horizontal:reset")
      await waitForPaint()
    }

    if (input.enableFilter) {
      const filterInput = Array.from(document.querySelectorAll(".col-filter-input"))
        .find(candidate => candidate instanceof HTMLInputElement && !candidate.disabled)
      if (filterInput instanceof HTMLInputElement) {
        filterInput.value = `team-${input.sessionIndex}`
        filterInput.dispatchEvent(new Event("input", { bubbles: true }))
        interactions.filterApplied = true
        captureTelemetry("filter:applied")
        await waitForPaint()
        filterInput.value = ""
        filterInput.dispatchEvent(new Event("input", { bubbles: true }))
        interactions.filterCleared = true
        captureTelemetry("filter:cleared")
        await waitForPaint()
      } else {
        interactions.skipped.push("filter:no-enabled-header-filter")
      }
    }

    if (input.enableSort) {
      const preferredSortButton = document.querySelector(
        '.grid-cell--header[data-column-key="amount"] [data-datagrid-column-menu-button="true"]',
      )
      const sortButton = preferredSortButton ?? document.querySelector('[data-datagrid-column-menu-button="true"]')
      if (sortButton instanceof HTMLElement) {
        sortButton.click()
        await waitForPaint()
        const sortAction = document.querySelector('[data-datagrid-column-menu-action="sort-desc"]')
        if (sortAction instanceof HTMLElement && !sortAction.hasAttribute("disabled")) {
          sortAction.click()
          interactions.sortApplied = true
          captureTelemetry("sort:desc")
          await waitForPaint()
        } else {
          interactions.skipped.push("sort:no-sort-desc-action")
        }
      } else {
        interactions.skipped.push("sort:no-column-menu-button")
      }
    }

    if (input.enableCellUpdates && input.cellUpdateBurst > 0) {
      for (let index = 0; index < input.cellUpdateBurst; index += 1) {
        const cells = Array.from(
          document.querySelectorAll('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]'),
        ).filter(candidate => candidate instanceof HTMLElement)
        const cell = cells[index % Math.max(1, cells.length)]
        interactions.cellUpdatesAttempted += 1
        if (!(cell instanceof HTMLElement)) {
          interactions.skipped.push("cell-update:no-editable-amount-cell")
          break
        }
        cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }))
        await waitForPaint()
        const editor = cell.querySelector("input.cell-editor-input")
          ?? document.querySelector("input.cell-editor-input")
        if (!(editor instanceof HTMLInputElement)) {
          interactions.skipped.push("cell-update:no-inline-editor")
          continue
        }
        interactions.cellEditorsOpened += 1
        editor.value = String(1000 + input.sessionIndex * 100 + index)
        editor.dispatchEvent(new Event("input", { bubbles: true }))
        editor.dispatchEvent(new Event("change", { bubbles: true }))
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
        editor.blur()
        interactions.cellUpdatesCommitted += 1
        captureTelemetry(`cell-update:${index + 1}`)
        await waitForPaint()
      }
    }

    await pause(Math.max(32, input.stepDelayMs * 2))
    captureTelemetry("settled")
    const measuredElapsedMs = performance.now() - startedAt
    running = false
    await pause(24)
    longTaskObserver?.disconnect()

    const heapValues = telemetrySamples
      .map(sample => sample.usedHeapMb)
      .filter(value => typeof value === "number" && Number.isFinite(value))
    const firstHeap = heapValues[0] ?? null
    const lastHeap = heapValues[heapValues.length - 1] ?? null
    const peakHeap = heapValues.length ? Math.max(...heapValues) : null

    return {
      frameDeltas,
      longTaskDurations,
      telemetry: {
        sampleCount: telemetrySamples.length,
        firstSample: telemetrySamples[0] ?? null,
        finalSample: telemetrySamples[telemetrySamples.length - 1] ?? null,
        peakStageNodes: telemetrySamples.reduce((max, sample) => Math.max(max, sample.stageNodes), 0),
        peakPageNodes: telemetrySamples.reduce((max, sample) => Math.max(max, sample.pageNodes), 0),
        peakVisibleCells: telemetrySamples.reduce((max, sample) => Math.max(max, sample.visibleCells), 0),
        peakViewportCells: telemetrySamples.reduce((max, sample) => Math.max(max, sample.viewportCells), 0),
        firstUsedHeapMb: firstHeap,
        finalUsedHeapMb: lastHeap,
        peakUsedHeapMb: peakHeap,
        heapDeltaMb: firstHeap !== null && lastHeap !== null ? lastHeap - firstHeap : null,
        samples: telemetrySamples,
      },
      interactions,
      measuredElapsedMs,
      maxTop,
      maxLeft,
      finalTop: viewport.scrollTop,
      finalLeft: viewport.scrollLeft,
    }
  }, {
    viewportSelector: BENCH_VIEWPORT_SELECTOR,
    scrollSteps: BENCH_BROWSER_SCROLL_STEPS,
    horizontalSteps: BENCH_BROWSER_HORIZONTAL_STEPS,
    stepDelayMs: BENCH_BROWSER_STEP_DELAY_MS,
    cellUpdateBurst: BENCH_BROWSER_CELL_UPDATE_BURST,
    enableFilter: BENCH_ENABLE_FILTER,
    enableSort: BENCH_ENABLE_SORT,
    enableCellUpdates: BENCH_ENABLE_CELL_UPDATES,
    sessionIndex,
  })

  const frame = computeFrameMetrics(result.frameDeltas)
  const longTaskCount = result.longTaskDurations.length
  const longTaskTotalMs = result.longTaskDurations.reduce((sum, value) => sum + value, 0)
  const longTaskMaxMs = longTaskCount > 0 ? Math.max(...result.longTaskDurations) : 0

  return {
    session: sessionIndex + 1,
    ...frame,
    frameDeltas: result.frameDeltas,
    longTaskCount,
    longTaskTotalMs,
    longTaskMaxMs,
    longTaskDuration: stats(result.longTaskDurations),
    telemetry: result.telemetry,
    interactions: result.interactions,
    measuredElapsedMs: result.measuredElapsedMs,
    maxTop: result.maxTop,
    maxLeft: result.maxLeft,
    finalTop: result.finalTop,
    finalLeft: result.finalLeft,
  }
}

const startedAt = performance.now()

console.log("\nAffino DataGrid Enterprise Browser Frame Benchmark")
console.log(
  `baseUrl=${BENCH_BROWSER_BASE_URL} route=${BENCH_BROWSER_ROUTE} sessions=${BENCH_BROWSER_SESSIONS} rows=${BENCH_BROWSER_ROW_COUNT} columns=${BENCH_BROWSER_COLUMN_COUNT}`,
)

const sandboxServer = await ensureSandboxServer(BENCH_BROWSER_BASE_URL, BENCH_BROWSER_ROUTE, "enterprise-browser-frames")

const browser = await chromium.launch({
  headless: BENCH_BROWSER_HEADLESS,
  args: ["--disable-dev-shm-usage"],
})

const context = await browser.newContext({
  viewport: { width: 1680, height: 1050 },
})

const sessions = []
const setup = []

try {
  for (let session = 0; session < BENCH_BROWSER_SESSIONS; session += 1) {
    console.log(`[enterprise-browser-frames] session ${session + 1}/${BENCH_BROWSER_SESSIONS}...`)
    const page = await context.newPage()
    await page.goto(`${BENCH_BROWSER_BASE_URL}${BENCH_BROWSER_ROUTE}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    })
    await page.waitForSelector(BENCH_VIEWPORT_SELECTOR, { timeout: 30000 })
    const setupResult = await configureSandbox(page)
    setup.push({ session: session + 1, ...setupResult })
    await page.waitForTimeout(240)
    const metrics = await runSession(page, session)
    sessions.push(metrics)
    await page.close()
  }
} finally {
  await context.close()
  await browser.close()
  await sandboxServer.stop()
}

const elapsedMs = performance.now() - startedAt
const aggregate = {
  elapsedMs,
  measuredElapsedMs: stats(sessions.map(session => session.measuredElapsedMs)),
  frameMs: stats(sessions.flatMap(session => normalizeFrameDeltas(session.frameDeltas ?? []))),
  frameP50Ms: stats(sessions.map(session => session.frameStats.p50)),
  frameP95Ms: stats(sessions.map(session => session.frameStats.p95)),
  frameP99Ms: stats(sessions.map(session => session.frameStats.p99)),
  fps: stats(sessions.map(session => session.fps)),
  droppedFramePct: stats(sessions.map(session => session.droppedPct)),
  droppedFrames: stats(sessions.map(session => session.droppedFrames)),
  longFramesOver16Ms: stats(sessions.map(session => session.longFramesOver16Ms)),
  longFramesOver32Ms: stats(sessions.map(session => session.longFramesOver32Ms)),
  longTaskCount: stats(sessions.map(session => session.longTaskCount)),
  longTaskTotalMs: stats(sessions.map(session => session.longTaskTotalMs)),
  longTaskMaxMs: stats(sessions.map(session => session.longTaskMaxMs)),
  peakUsedHeapMb: stats(sessions.map(session => session.telemetry.peakUsedHeapMb ?? 0)),
  heapDeltaMb: stats(sessions.map(session => session.telemetry.heapDeltaMb ?? 0)),
  peakPageNodes: stats(sessions.map(session => session.telemetry.peakPageNodes)),
  peakStageNodes: stats(sessions.map(session => session.telemetry.peakStageNodes)),
  peakVisibleCells: stats(sessions.map(session => session.telemetry.peakVisibleCells)),
  peakViewportCells: stats(sessions.map(session => session.telemetry.peakViewportCells)),
  cellUpdatesAttempted: stats(sessions.map(session => session.interactions.cellUpdatesAttempted)),
  cellUpdatesCommitted: stats(sessions.map(session => session.interactions.cellUpdatesCommitted)),
}

const summary = {
  benchmark: "datagrid-enterprise-browser-frames",
  mode: "observation",
  generatedAt: new Date().toISOString(),
  config: {
    baseUrl: BENCH_BROWSER_BASE_URL,
    route: BENCH_BROWSER_ROUTE,
    sessions: BENCH_BROWSER_SESSIONS,
    rowCount: BENCH_BROWSER_ROW_COUNT,
    columnCount: BENCH_BROWSER_COLUMN_COUNT,
    scrollSteps: BENCH_BROWSER_SCROLL_STEPS,
    horizontalSteps: BENCH_BROWSER_HORIZONTAL_STEPS,
    stepDelayMs: BENCH_BROWSER_STEP_DELAY_MS,
    cellUpdateBurst: BENCH_BROWSER_CELL_UPDATE_BURST,
    enableFilter: BENCH_ENABLE_FILTER,
    enableSort: BENCH_ENABLE_SORT,
    enableCellUpdates: BENCH_ENABLE_CELL_UPDATES,
    headless: BENCH_BROWSER_HEADLESS,
  },
  setup,
  aggregate,
  sessions,
  budgetErrors: [],
  ok: true,
}

mkdirSync(dirname(BENCH_OUTPUT_JSON), { recursive: true })
writeFileSync(BENCH_OUTPUT_JSON, JSON.stringify(summary, null, 2))

console.log(`\nBenchmark summary written: ${BENCH_OUTPUT_JSON}`)
console.log(
  `frame p50=${aggregate.frameP50Ms.p50.toFixed(3)}ms p95=${aggregate.frameP95Ms.p50.toFixed(3)}ms p99=${aggregate.frameP99Ms.p50.toFixed(3)}ms fps p50=${aggregate.fps.p50.toFixed(2)} dropped p95=${aggregate.droppedFramePct.p95.toFixed(2)}%`,
)
