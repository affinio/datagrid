#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { chromium } from "@playwright/test"
import { ensureSandboxServer } from "./ensure-sandbox-server.mjs"

const BENCH_BROWSER_BASE_URL = process.env.BENCH_BROWSER_BASE_URL ?? "http://127.0.0.1:4173"
const BENCH_BROWSER_ROUTE_MAIN_THREAD = process.env.BENCH_BROWSER_ROUTE_MAIN_THREAD ?? "/vue/base-grid"
const BENCH_BROWSER_ROUTE_WORKER_OWNED = process.env.BENCH_BROWSER_ROUTE_WORKER_OWNED ?? "/vue/worker-grid"
const BENCH_WORKER_MODES = (process.env.BENCH_WORKER_UX_MODES ?? "main-thread,worker-owned")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean)
const BENCH_SESSIONS = Number.parseInt(process.env.BENCH_WORKER_UX_SESSIONS ?? "4", 10)
const BENCH_ROW_COUNT = Number.parseInt(process.env.BENCH_WORKER_UX_ROW_COUNT ?? "100000", 10)
const BENCH_PATCH_ITERATIONS = Number.parseInt(process.env.BENCH_WORKER_UX_PATCH_ITERATIONS ?? "36", 10)
const BENCH_PATCH_SIZE = Number.parseInt(process.env.BENCH_WORKER_UX_PATCH_SIZE ?? "4000", 10)
const BENCH_FORMATTER_PASSES = Number.parseInt(process.env.BENCH_WORKER_UX_FORMATTER_PASSES ?? "4", 10)
const BENCH_DEEP_CLONE_PASSES = Number.parseInt(process.env.BENCH_WORKER_UX_DEEP_CLONE_PASSES ?? "3", 10)
const BENCH_VIEWPORT_SAMPLE_SIZE = Number.parseInt(process.env.BENCH_WORKER_UX_VIEWPORT_SAMPLE_SIZE ?? "220", 10)
const BENCH_INPUT_PROBE_INTERVAL_MS = Number.parseInt(process.env.BENCH_WORKER_UX_INPUT_PROBE_INTERVAL_MS ?? "8", 10)
const BENCH_HEADLESS = (process.env.BENCH_WORKER_UX_HEADLESS ?? "true").trim().toLowerCase() !== "false"
const BENCH_LAUNCH_RETRIES = Number.parseInt(process.env.BENCH_WORKER_UX_LAUNCH_RETRIES ?? "2", 10)
const BENCH_OUTPUT_JSON = process.env.BENCH_OUTPUT_JSON
  ? resolve(process.env.BENCH_OUTPUT_JSON)
  : resolve("artifacts/performance/bench-datagrid-worker-ux.json")
const BENCH_VIEWPORT_SELECTOR = ".table-wrap, .datagrid-sugar-stage__viewport, .datagrid-stage__viewport"

const PERF_BUDGET_TOTAL_MS = Number.parseFloat(process.env.PERF_BUDGET_TOTAL_MS ?? "Infinity")
const PERF_BUDGET_MAX_MAIN_FRAME_P95_MS = Number.parseFloat(process.env.PERF_BUDGET_MAX_MAIN_FRAME_P95_MS ?? "Infinity")
const PERF_BUDGET_MAX_MAIN_DROPPED_PCT = Number.parseFloat(process.env.PERF_BUDGET_MAX_MAIN_DROPPED_PCT ?? "Infinity")
const PERF_BUDGET_MAX_WORKER_FRAME_P95_MS = Number.parseFloat(process.env.PERF_BUDGET_MAX_WORKER_FRAME_P95_MS ?? "Infinity")
const PERF_BUDGET_MAX_WORKER_DROPPED_PCT = Number.parseFloat(process.env.PERF_BUDGET_MAX_WORKER_DROPPED_PCT ?? "Infinity")
const PERF_BUDGET_MAX_MAIN_EVENT_LOOP_P95_MS = Number.parseFloat(process.env.PERF_BUDGET_MAX_MAIN_EVENT_LOOP_P95_MS ?? "Infinity")
const PERF_BUDGET_MAX_WORKER_EVENT_LOOP_P95_MS = Number.parseFloat(process.env.PERF_BUDGET_MAX_WORKER_EVENT_LOOP_P95_MS ?? "Infinity")
const PERF_BUDGET_MAX_MAIN_LONGTASK_COUNT_P95 = Number.parseFloat(process.env.PERF_BUDGET_MAX_MAIN_LONGTASK_COUNT_P95 ?? "Infinity")
const PERF_BUDGET_MAX_WORKER_LONGTASK_COUNT_P95 = Number.parseFloat(process.env.PERF_BUDGET_MAX_WORKER_LONGTASK_COUNT_P95 ?? "Infinity")
const PERF_BUDGET_MAX_WORKER_EVENT_LOOP_DRIFT_PCT = Number.parseFloat(process.env.PERF_BUDGET_MAX_WORKER_EVENT_LOOP_DRIFT_PCT ?? "Infinity")
const PERF_BUDGET_MAX_VARIANCE_PCT = Number.parseFloat(process.env.PERF_BUDGET_MAX_VARIANCE_PCT ?? "Infinity")
const PERF_BUDGET_VARIANCE_MIN_MEAN_MS = Number.parseFloat(process.env.PERF_BUDGET_VARIANCE_MIN_MEAN_MS ?? "0.5")

assertPositiveInteger(BENCH_SESSIONS, "BENCH_WORKER_UX_SESSIONS")
assertPositiveInteger(BENCH_ROW_COUNT, "BENCH_WORKER_UX_ROW_COUNT")
assertPositiveInteger(BENCH_PATCH_ITERATIONS, "BENCH_WORKER_UX_PATCH_ITERATIONS")
assertPositiveInteger(BENCH_PATCH_SIZE, "BENCH_WORKER_UX_PATCH_SIZE")
assertNonNegativeInteger(BENCH_FORMATTER_PASSES, "BENCH_WORKER_UX_FORMATTER_PASSES")
assertNonNegativeInteger(BENCH_DEEP_CLONE_PASSES, "BENCH_WORKER_UX_DEEP_CLONE_PASSES")
assertPositiveInteger(BENCH_VIEWPORT_SAMPLE_SIZE, "BENCH_WORKER_UX_VIEWPORT_SAMPLE_SIZE")
assertPositiveInteger(BENCH_INPUT_PROBE_INTERVAL_MS, "BENCH_WORKER_UX_INPUT_PROBE_INTERVAL_MS")
assertPositiveInteger(BENCH_LAUNCH_RETRIES, "BENCH_WORKER_UX_LAUNCH_RETRIES")
if (!BENCH_WORKER_MODES.length) {
  throw new Error("BENCH_WORKER_UX_MODES must include at least one runtime mode")
}

function assertPositiveInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

function quantile(values, q) {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((left, right) => left - right)
  const position = Math.max(0, Math.min(1, q)) * (sorted.length - 1)
  const base = Math.floor(position)
  const rest = position - base
  const current = sorted[base] ?? 0
  const next = sorted[base + 1] ?? current
  return current + (next - current) * rest
}

function stats(values) {
  if (!values.length) {
    return { mean: 0, stdev: 0, p50: 0, p95: 0, p99: 0, cvPct: 0, min: 0, max: 0 }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const stdev = Math.sqrt(variance)
  return {
    mean,
    stdev,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    cvPct: mean === 0 ? 0 : (stdev / mean) * 100,
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function shouldEnforceVariance(metric) {
  return (
    PERF_BUDGET_MAX_VARIANCE_PCT !== Number.POSITIVE_INFINITY
    && metric.mean >= PERF_BUDGET_VARIANCE_MIN_MEAN_MS
  )
}

function computeFrameMetrics(frameDeltas) {
  const normalized = frameDeltas.filter(delta => Number.isFinite(delta) && delta > 0).slice(2)
  const frameStats = stats(normalized)
  const droppedFrames = normalized.filter(delta => delta > 20).length
  const droppedPct = normalized.length > 0 ? (droppedFrames / normalized.length) * 100 : 0
  return {
    sampleCount: normalized.length,
    frameStats,
    droppedFrames,
    droppedPct,
  }
}

function resolveRouteForMode(mode) {
  if (mode === "main-thread") {
    return BENCH_BROWSER_ROUTE_MAIN_THREAD
  }
  if (mode === "worker-owned") {
    return BENCH_BROWSER_ROUTE_WORKER_OWNED
  }
  return BENCH_BROWSER_ROUTE_WORKER_OWNED
}

async function launchChromiumWithFallback() {
  const profiles = [
    {
      label: "default",
      options: {
        headless: BENCH_HEADLESS,
        args: ["--disable-dev-shm-usage"],
      },
    },
    {
      label: "single-process-fallback",
      options: {
        headless: BENCH_HEADLESS,
        args: ["--disable-dev-shm-usage", "--disable-gpu", "--single-process", "--renderer-process-limit=1"],
      },
    },
    {
      label: "minimal-fallback",
      options: {
        headless: BENCH_HEADLESS,
        args: [],
      },
    },
  ]
  const failures = []
  for (const profile of profiles) {
    for (let attempt = 1; attempt <= BENCH_LAUNCH_RETRIES; attempt += 1) {
      try {
        if (attempt > 1) {
          console.warn(`[worker-ux] retry launch profile=${profile.label} attempt=${attempt}/${BENCH_LAUNCH_RETRIES}`)
        }
        return await chromium.launch(profile.options)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`profile=${profile.label} attempt=${attempt}: ${message}`)
        await new Promise(resolvePause => setTimeout(resolvePause, 120))
      }
    }
  }
  throw new Error(`failed to launch Chromium for worker-ux benchmark:\n${failures.join("\n")}`)
}

async function runUxSession(page, mode, sessionIndex) {
  const route = resolveRouteForMode(mode)
  await page.goto(`${BENCH_BROWSER_BASE_URL}${route}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  })
  await page.waitForSelector(BENCH_VIEWPORT_SELECTOR, { timeout: 30000 })
  await page.evaluate((targetRows) => {
    const labels = Array.from(document.querySelectorAll("label"))
    const rowsLabel = labels.find(label => /rows/i.test(label.textContent ?? ""))
    const select = rowsLabel?.querySelector("select")
    if (!(select instanceof HTMLSelectElement)) {
      return
    }
    const options = Array.from(select.options)
      .map(option => Number.parseInt(option.value, 10))
      .filter(value => Number.isFinite(value) && value > 0)
    if (options.length === 0) {
      return
    }
    let nearest = options[0] ?? targetRows
    let best = Math.abs(nearest - targetRows)
    for (const option of options) {
      const distance = Math.abs(option - targetRows)
      if (distance < best) {
        nearest = option
        best = distance
      }
    }
    if (select.value !== String(nearest)) {
      select.value = String(nearest)
      select.dispatchEvent(new Event("input", { bubbles: true }))
      select.dispatchEvent(new Event("change", { bubbles: true }))
    }
  }, BENCH_ROW_COUNT)

  await page.waitForTimeout(120)
  const result = await page.evaluate(async (input) => {
    const viewport = document.querySelector(input.viewportSelector)
    if (!(viewport instanceof HTMLElement)) {
      throw new Error(`Datagrid viewport not found (${input.viewportSelector})`)
    }

    const labels = Array.from(document.querySelectorAll("label"))
    const resolveSelect = (pattern) => {
      const label = labels.find(entry => pattern.test(entry.textContent ?? ""))
      const select = label?.querySelector("select")
      return select instanceof HTMLSelectElement ? select : null
    }
    const resolveInput = (pattern) => {
      const label = labels.find(entry => pattern.test(entry.textContent ?? ""))
      const field = label?.querySelector("input")
      return field instanceof HTMLInputElement ? field : null
    }

    const sortSelect = resolveSelect(/sort/i)
    const filterInput = resolveInput(/filter/i)
    const sortValues = sortSelect ? Array.from(sortSelect.options).map(option => option.value) : []
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)

    const frameDeltas = []
    const eventLoopLags = []
    const longTaskDurations = []
    let active = true
    let lastTs = performance.now()
    let expectedTick = performance.now() + input.inputProbeIntervalMs
    const tick = (ts) => {
      frameDeltas.push(ts - lastTs)
      lastTs = ts
      if (active) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)

    const loopProbe = () => {
      if (!active) {
        return
      }
      setTimeout(() => {
        const now = performance.now()
        eventLoopLags.push(Math.max(0, now - expectedTick))
        expectedTick = now + input.inputProbeIntervalMs
        loopProbe()
      }, input.inputProbeIntervalMs)
    }
    loopProbe()

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

    const waitForPaint = () => new Promise(resolveWait => {
      requestAnimationFrame(() => requestAnimationFrame(resolveWait))
    })
    const quantileLocal = (values, q) => {
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

    let sortApplyMs = 0
    let filterApplyMs = 0
    const dispatchDurations = []
    const appliedDurations = []
    const startedAt = performance.now()

    if (sortSelect && sortValues.length > 1) {
      const before = performance.now()
      sortSelect.value = sortValues[1] ?? sortValues[0] ?? "none"
      sortSelect.dispatchEvent(new Event("input", { bubbles: true }))
      sortSelect.dispatchEvent(new Event("change", { bubbles: true }))
      await waitForPaint()
      sortApplyMs = performance.now() - before
    }

    if (filterInput) {
      const before = performance.now()
      filterInput.value = `seed-${input.sessionIndex}`
      filterInput.dispatchEvent(new Event("input", { bubbles: true }))
      await waitForPaint()
      filterApplyMs = performance.now() - before
    }

    for (let iteration = 0; iteration < input.patchIterations; iteration += 1) {
      const dispatchStart = performance.now()

      if (sortSelect && sortValues.length > 0) {
        const sortIndex = (iteration + input.sessionIndex) % sortValues.length
        sortSelect.value = sortValues[sortIndex] ?? sortValues[0] ?? "none"
        sortSelect.dispatchEvent(new Event("input", { bubbles: true }))
        sortSelect.dispatchEvent(new Event("change", { bubbles: true }))
      }

      if (filterInput) {
        filterInput.value = `q-${input.sessionIndex}-${iteration % 31}`
        filterInput.dispatchEvent(new Event("input", { bubbles: true }))
      }

      for (let pass = 0; pass < input.formatterPasses; pass += 1) {
        const value = `${iteration}:${pass}`.toUpperCase().toLowerCase()
        if (value.length === 0) {
          break
        }
      }

      const dispatchEnd = performance.now()
      dispatchDurations.push(dispatchEnd - dispatchStart)

      if (maxTop > 0) {
        viewport.scrollTop = Math.round((maxTop * ((iteration % input.viewportSampleSize) + 1)) / input.viewportSampleSize)
      }
      await waitForPaint()

      let cloneTarget = { iteration, mode: input.mode }
      for (let pass = 0; pass < input.deepClonePasses; pass += 1) {
        cloneTarget = structuredClone(cloneTarget)
      }
      if (!cloneTarget) {
        throw new Error("clone target unexpectedly empty")
      }

      appliedDurations.push(performance.now() - dispatchStart)
    }

    if (filterInput) {
      filterInput.value = ""
      filterInput.dispatchEvent(new Event("input", { bubbles: true }))
      await waitForPaint()
    }

    const totalElapsedMs = performance.now() - startedAt
    await new Promise(resolvePause => setTimeout(resolvePause, 32))
    active = false
    await new Promise(resolvePause => setTimeout(resolvePause, 24))
    longTaskObserver?.disconnect()

    return {
      report: {
        mode: input.mode,
        rowCount: input.rowCount,
        patchIterations: input.patchIterations,
        patchSize: input.patchSize,
        totalElapsedMs,
        sortApplyMs,
        groupApplyMs: 0,
        aggregationApplyMs: 0,
        filterApplyMs,
        patchDispatchP95Ms: quantileLocal(dispatchDurations, 0.95),
        patchAppliedP95Ms: quantileLocal(appliedDurations, 0.95),
        patchAppliedP99Ms: quantileLocal(appliedDurations, 0.99),
        pressureChecksum: appliedDurations.length,
        longTaskCount: longTaskDurations.length,
        longTaskTotalMs: longTaskDurations.reduce((sum, value) => sum + value, 0),
        longTaskMaxMs: longTaskDurations.length > 0 ? Math.max(...longTaskDurations) : 0,
      },
      frameDeltas,
      eventLoopLags,
      longTaskDurations,
    }
  }, {
    mode,
    rowCount: BENCH_ROW_COUNT,
    patchIterations: BENCH_PATCH_ITERATIONS,
    patchSize: BENCH_PATCH_SIZE,
    formatterPasses: BENCH_FORMATTER_PASSES,
    deepClonePasses: BENCH_DEEP_CLONE_PASSES,
    viewportSampleSize: BENCH_VIEWPORT_SAMPLE_SIZE,
    inputProbeIntervalMs: BENCH_INPUT_PROBE_INTERVAL_MS,
    viewportSelector: BENCH_VIEWPORT_SELECTOR,
    sessionIndex,
  })

  return {
    mode,
    route,
    report: result.report,
    frame: computeFrameMetrics(result.frameDeltas),
    eventLoopLag: stats(result.eventLoopLags.filter(value => Number.isFinite(value) && value >= 0)),
    longTaskDuration: stats(result.longTaskDurations.filter(value => Number.isFinite(value) && value >= 0)),
  }
}

const budgetErrors = []
const varianceSkippedChecks = []
const startedAt = performance.now()

console.log("\nAffino DataGrid Worker UX Benchmark")
console.log(
  `baseUrl=${BENCH_BROWSER_BASE_URL} modes=${BENCH_WORKER_MODES.join(",")} sessions=${BENCH_SESSIONS} rows=${BENCH_ROW_COUNT}`,
)

const sandboxServer = await ensureSandboxServer(
  BENCH_BROWSER_BASE_URL,
  resolveRouteForMode(BENCH_WORKER_MODES[0]),
  "worker-ux",
)

const browser = await launchChromiumWithFallback()
const context = await browser.newContext({
  viewport: { width: 1680, height: 1050 },
})

const sessions = []

try {
  for (const mode of BENCH_WORKER_MODES) {
    for (let session = 0; session < BENCH_SESSIONS; session += 1) {
      console.log(`[worker-ux] mode=${mode} session ${session + 1}/${BENCH_SESSIONS}...`)
      const page = await context.newPage()
      const metrics = await runUxSession(page, mode, session)
      sessions.push({
        mode,
        session: session + 1,
        ...metrics,
      })
      await page.close()
    }
  }
} finally {
  await context.close()
  await browser.close()
  await sandboxServer.stop()
}

const elapsedMs = performance.now() - startedAt
if (elapsedMs > PERF_BUDGET_TOTAL_MS) {
  budgetErrors.push(`elapsed ${elapsedMs.toFixed(3)}ms exceeds PERF_BUDGET_TOTAL_MS=${PERF_BUDGET_TOTAL_MS}ms`)
}

const byMode = {}
for (const mode of BENCH_WORKER_MODES) {
  const modeSessions = sessions.filter(entry => entry.mode === mode)
  byMode[mode] = {
    frameP95Ms: stats(modeSessions.map(entry => entry.frame.frameStats.p95)),
    frameP99Ms: stats(modeSessions.map(entry => entry.frame.frameStats.p99)),
    droppedPct: stats(modeSessions.map(entry => entry.frame.droppedPct)),
    totalElapsedMs: stats(modeSessions.map(entry => entry.report.totalElapsedMs)),
    patchAppliedP95Ms: stats(modeSessions.map(entry => entry.report.patchAppliedP95Ms)),
    patchAppliedP99Ms: stats(modeSessions.map(entry => entry.report.patchAppliedP99Ms)),
    eventLoopLagP95Ms: stats(modeSessions.map(entry => entry.eventLoopLag.p95)),
    eventLoopLagP99Ms: stats(modeSessions.map(entry => entry.eventLoopLag.p99)),
    longTaskCount: stats(modeSessions.map(entry => entry.report.longTaskCount)),
    longTaskTotalMs: stats(modeSessions.map(entry => entry.report.longTaskTotalMs)),
    longTaskMaxMs: stats(modeSessions.map(entry => entry.report.longTaskMaxMs)),
  }
}

if (byMode["main-thread"]) {
  if (byMode["main-thread"].frameP95Ms.p95 > PERF_BUDGET_MAX_MAIN_FRAME_P95_MS) {
    budgetErrors.push(
      `main-thread frame p95 ${byMode["main-thread"].frameP95Ms.p95.toFixed(3)}ms exceeds PERF_BUDGET_MAX_MAIN_FRAME_P95_MS=${PERF_BUDGET_MAX_MAIN_FRAME_P95_MS}ms`,
    )
  }
  if (byMode["main-thread"].droppedPct.p95 > PERF_BUDGET_MAX_MAIN_DROPPED_PCT) {
    budgetErrors.push(
      `main-thread dropped p95 ${byMode["main-thread"].droppedPct.p95.toFixed(2)}% exceeds PERF_BUDGET_MAX_MAIN_DROPPED_PCT=${PERF_BUDGET_MAX_MAIN_DROPPED_PCT}%`,
    )
  }
  if (byMode["main-thread"].eventLoopLagP95Ms.p95 > PERF_BUDGET_MAX_MAIN_EVENT_LOOP_P95_MS) {
    budgetErrors.push(
      `main-thread event-loop p95 ${byMode["main-thread"].eventLoopLagP95Ms.p95.toFixed(3)}ms exceeds PERF_BUDGET_MAX_MAIN_EVENT_LOOP_P95_MS=${PERF_BUDGET_MAX_MAIN_EVENT_LOOP_P95_MS}ms`,
    )
  }
  if (byMode["main-thread"].longTaskCount.p95 > PERF_BUDGET_MAX_MAIN_LONGTASK_COUNT_P95) {
    budgetErrors.push(
      `main-thread longtask count p95 ${byMode["main-thread"].longTaskCount.p95.toFixed(3)} exceeds PERF_BUDGET_MAX_MAIN_LONGTASK_COUNT_P95=${PERF_BUDGET_MAX_MAIN_LONGTASK_COUNT_P95}`,
    )
  }
}

if (byMode["worker-owned"]) {
  if (byMode["worker-owned"].frameP95Ms.p95 > PERF_BUDGET_MAX_WORKER_FRAME_P95_MS) {
    budgetErrors.push(
      `worker-owned frame p95 ${byMode["worker-owned"].frameP95Ms.p95.toFixed(3)}ms exceeds PERF_BUDGET_MAX_WORKER_FRAME_P95_MS=${PERF_BUDGET_MAX_WORKER_FRAME_P95_MS}ms`,
    )
  }
  if (byMode["worker-owned"].droppedPct.p95 > PERF_BUDGET_MAX_WORKER_DROPPED_PCT) {
    budgetErrors.push(
      `worker-owned dropped p95 ${byMode["worker-owned"].droppedPct.p95.toFixed(2)}% exceeds PERF_BUDGET_MAX_WORKER_DROPPED_PCT=${PERF_BUDGET_MAX_WORKER_DROPPED_PCT}%`,
    )
  }
  if (byMode["worker-owned"].eventLoopLagP95Ms.p95 > PERF_BUDGET_MAX_WORKER_EVENT_LOOP_P95_MS) {
    budgetErrors.push(
      `worker-owned event-loop p95 ${byMode["worker-owned"].eventLoopLagP95Ms.p95.toFixed(3)}ms exceeds PERF_BUDGET_MAX_WORKER_EVENT_LOOP_P95_MS=${PERF_BUDGET_MAX_WORKER_EVENT_LOOP_P95_MS}ms`,
    )
  }
  if (byMode["worker-owned"].longTaskCount.p95 > PERF_BUDGET_MAX_WORKER_LONGTASK_COUNT_P95) {
    budgetErrors.push(
      `worker-owned longtask count p95 ${byMode["worker-owned"].longTaskCount.p95.toFixed(3)} exceeds PERF_BUDGET_MAX_WORKER_LONGTASK_COUNT_P95=${PERF_BUDGET_MAX_WORKER_LONGTASK_COUNT_P95}`,
    )
  }
}

if (byMode["main-thread"] && byMode["worker-owned"]) {
  const mainEventLoop = byMode["main-thread"].eventLoopLagP95Ms.p95
  if (mainEventLoop > 0 && PERF_BUDGET_MAX_WORKER_EVENT_LOOP_DRIFT_PCT !== Number.POSITIVE_INFINITY) {
    const eventLoopDriftPct = ((byMode["worker-owned"].eventLoopLagP95Ms.p95 - mainEventLoop) / mainEventLoop) * 100
    if (eventLoopDriftPct > PERF_BUDGET_MAX_WORKER_EVENT_LOOP_DRIFT_PCT) {
      budgetErrors.push(
        `worker-owned event-loop drift ${eventLoopDriftPct.toFixed(2)}% exceeds PERF_BUDGET_MAX_WORKER_EVENT_LOOP_DRIFT_PCT=${PERF_BUDGET_MAX_WORKER_EVENT_LOOP_DRIFT_PCT}%`,
      )
    }
  }
}

for (const mode of BENCH_WORKER_MODES) {
  const aggregate = byMode[mode]
  if (!aggregate) {
    continue
  }
  for (const metric of [
    { name: `${mode} frame p95`, stat: aggregate.frameP95Ms },
    { name: `${mode} event-loop p95`, stat: aggregate.eventLoopLagP95Ms },
    { name: `${mode} elapsed`, stat: aggregate.totalElapsedMs },
  ]) {
    if (PERF_BUDGET_MAX_VARIANCE_PCT === Number.POSITIVE_INFINITY) {
      continue
    }
    if (!shouldEnforceVariance(metric.stat)) {
      varianceSkippedChecks.push(
        `${metric.name} CV gate skipped (mean ${metric.stat.mean.toFixed(3)} < PERF_BUDGET_VARIANCE_MIN_MEAN_MS=${PERF_BUDGET_VARIANCE_MIN_MEAN_MS})`,
      )
      continue
    }
    if (metric.stat.cvPct > PERF_BUDGET_MAX_VARIANCE_PCT) {
      budgetErrors.push(
        `${metric.name} CV ${metric.stat.cvPct.toFixed(2)}% exceeds PERF_BUDGET_MAX_VARIANCE_PCT=${PERF_BUDGET_MAX_VARIANCE_PCT}%`,
      )
    }
  }
}

const summary = {
  benchmark: "datagrid-worker-ux",
  generatedAt: new Date().toISOString(),
  config: {
    baseUrl: BENCH_BROWSER_BASE_URL,
    routeByMode: {
      "main-thread": resolveRouteForMode("main-thread"),
      "worker-owned": resolveRouteForMode("worker-owned"),
    },
    modes: BENCH_WORKER_MODES,
    sessions: BENCH_SESSIONS,
    rowCount: BENCH_ROW_COUNT,
    patchIterations: BENCH_PATCH_ITERATIONS,
    patchSize: BENCH_PATCH_SIZE,
    formatterPasses: BENCH_FORMATTER_PASSES,
    deepClonePasses: BENCH_DEEP_CLONE_PASSES,
    viewportSampleSize: BENCH_VIEWPORT_SAMPLE_SIZE,
    inputProbeIntervalMs: BENCH_INPUT_PROBE_INTERVAL_MS,
    headless: BENCH_HEADLESS,
  },
  budgets: {
    totalMs: PERF_BUDGET_TOTAL_MS,
    maxMainFrameP95Ms: PERF_BUDGET_MAX_MAIN_FRAME_P95_MS,
    maxMainDroppedPct: PERF_BUDGET_MAX_MAIN_DROPPED_PCT,
    maxWorkerFrameP95Ms: PERF_BUDGET_MAX_WORKER_FRAME_P95_MS,
    maxWorkerDroppedPct: PERF_BUDGET_MAX_WORKER_DROPPED_PCT,
    maxMainEventLoopP95Ms: PERF_BUDGET_MAX_MAIN_EVENT_LOOP_P95_MS,
    maxWorkerEventLoopP95Ms: PERF_BUDGET_MAX_WORKER_EVENT_LOOP_P95_MS,
    maxMainLongTaskCountP95: PERF_BUDGET_MAX_MAIN_LONGTASK_COUNT_P95,
    maxWorkerLongTaskCountP95: PERF_BUDGET_MAX_WORKER_LONGTASK_COUNT_P95,
    maxWorkerEventLoopDriftPct: PERF_BUDGET_MAX_WORKER_EVENT_LOOP_DRIFT_PCT,
    maxVariancePct: PERF_BUDGET_MAX_VARIANCE_PCT,
    varianceMinMeanMs: PERF_BUDGET_VARIANCE_MIN_MEAN_MS,
  },
  aggregate: {
    elapsedMs,
    byMode,
  },
  varianceSkippedChecks,
  sessions,
  budgetErrors,
  ok: budgetErrors.length === 0,
}

mkdirSync(dirname(BENCH_OUTPUT_JSON), { recursive: true })
writeFileSync(BENCH_OUTPUT_JSON, JSON.stringify(summary, null, 2))

console.log(`\nBenchmark summary written: ${BENCH_OUTPUT_JSON}`)
for (const mode of BENCH_WORKER_MODES) {
  const aggregate = byMode[mode]
  if (!aggregate) {
    continue
  }
  console.log(
    `${mode}: frame p95=${aggregate.frameP95Ms.p95.toFixed(3)}ms dropped p95=${aggregate.droppedPct.p95.toFixed(2)}% eventLoop p95=${aggregate.eventLoopLagP95Ms.p95.toFixed(3)}ms longTask p95=${aggregate.longTaskCount.p95.toFixed(2)} total p95=${aggregate.totalElapsedMs.p95.toFixed(2)}ms`,
  )
}

if (budgetErrors.length > 0) {
  console.error("\nWorker UX benchmark budget check failed:")
  for (const error of budgetErrors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}
