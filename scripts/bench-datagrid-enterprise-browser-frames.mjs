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
const BENCH_BROWSER_SMOOTH_SCROLL_STEPS = intEnv(
  "BENCH_BROWSER_SMOOTH_SCROLL_STEPS",
  Math.max(BENCH_BROWSER_SCROLL_STEPS * 4, 960),
)
const BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX = intEnv("BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX", 96)
const BENCH_BROWSER_HORIZONTAL_STEPS = intEnv("BENCH_BROWSER_HORIZONTAL_STEPS", 96)
const BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS = intEnv("BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS", 16)
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
const BENCH_INTERACTION_DEVICE_PROFILE = process.env.BENCH_INTERACTION_DEVICE_PROFILE ?? "desktop-ci"
const INTERACTION_DEVICE_PROFILES = {
  "desktop-ci": {
    description: "Chromium desktop CI baseline",
    failOnWarnings: true,
    context: {
      viewport: { width: 1680, height: 1050 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
    budgets: {
      previewP95Ms: 8,
      autoScrollP95Ms: 12,
      focusRestoreMaxMs: 4,
      scrollSyncDriftPx: 2,
    },
  },
  "touch-tablet-ci": {
    description: "Chromium tablet/coarse-pointer CI baseline",
    failOnWarnings: true,
    context: {
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    budgets: {
      previewP95Ms: 12,
      autoScrollP95Ms: 18,
      focusRestoreMaxMs: 6,
      scrollSyncDriftPx: 3,
    },
  },
  "touch-phone-ci": {
    description: "Chromium phone/coarse-pointer CI baseline",
    failOnWarnings: true,
    context: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    budgets: {
      previewP95Ms: 14,
      autoScrollP95Ms: 20,
      focusRestoreMaxMs: 7,
      scrollSyncDriftPx: 4,
    },
  },
}
const interactionDeviceProfile = resolveInteractionDeviceProfile(BENCH_INTERACTION_DEVICE_PROFILE)
const BENCH_INTERACTION_FAIL_ON_WARNINGS = boolEnv(
  "BENCH_INTERACTION_FAIL_ON_WARNINGS",
  interactionDeviceProfile.failOnWarnings,
)
const PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS = floatEnv(
  "PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS",
  interactionDeviceProfile.budgets.previewP95Ms,
)
const PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS = floatEnv(
  "PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS",
  interactionDeviceProfile.budgets.autoScrollP95Ms,
)
const PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS = floatEnv(
  "PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS",
  interactionDeviceProfile.budgets.focusRestoreMaxMs,
)
const PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX = floatEnv(
  "PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX",
  interactionDeviceProfile.budgets.scrollSyncDriftPx,
)

const SCENARIOS = [
  {
    id: "vertical-scroll-only",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    smoothScroll: false,
    horizontalScroll: false,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "vertical-smooth-scroll",
    verticalScroll: false,
    verticalSmoothScroll: true,
    verticalDiagnostics: true,
    smoothScroll: true,
    horizontalScroll: false,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "horizontal-scroll-only",
    verticalScroll: false,
    verticalSmoothScroll: false,
    horizontalScroll: true,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "sort-only",
    verticalScroll: false,
    verticalSmoothScroll: false,
    horizontalScroll: false,
    filter: false,
    sort: true,
    sortDiagnostics: true,
    cellUpdates: false,
  },
  {
    id: "inline-edit-burst-only",
    verticalScroll: false,
    verticalSmoothScroll: false,
    horizontalScroll: false,
    filter: false,
    sort: false,
    cellUpdates: true,
  },
  {
    id: "combined",
    verticalScroll: true,
    verticalSmoothScroll: false,
    horizontalScroll: true,
    filter: true,
    sort: true,
    cellUpdates: true,
  },
  {
    id: "interaction-drag-selection",
    route: "/vue/base-grid",
    interaction: "drag-selection",
    interactionDiagnostics: true,
  },
  {
    id: "interaction-drag-selection-pinned",
    route: "/vue/base-grid",
    interaction: "drag-selection-pinned",
    interactionDiagnostics: true,
  },
  {
    id: "interaction-fill-autoscroll",
    route: "/vue/base-grid",
    interaction: "fill-autoscroll",
    interactionDiagnostics: true,
  },
  {
    id: "interaction-range-autoscroll",
    route: "/vue/base-grid",
    interaction: "range-autoscroll",
    interactionDiagnostics: true,
  },
  {
    id: "interaction-resize-drag",
    route: "/vue/base-grid",
    interaction: "resize-drag",
    interactionDiagnostics: true,
  },
  {
    id: "interaction-context-menu",
    route: "/vue/base-grid",
    interaction: "context-menu",
    interactionDiagnostics: true,
  },
]

assertPositiveInteger(BENCH_BROWSER_SESSIONS, "BENCH_BROWSER_SESSIONS")
assertPositiveInteger(BENCH_BROWSER_ROW_COUNT, "BENCH_BROWSER_ROW_COUNT")
assertPositiveInteger(BENCH_BROWSER_COLUMN_COUNT, "BENCH_BROWSER_COLUMN_COUNT")
assertPositiveInteger(BENCH_BROWSER_SCROLL_STEPS, "BENCH_BROWSER_SCROLL_STEPS")
assertPositiveInteger(BENCH_BROWSER_SMOOTH_SCROLL_STEPS, "BENCH_BROWSER_SMOOTH_SCROLL_STEPS")
assertPositiveInteger(BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX, "BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX")
assertPositiveInteger(BENCH_BROWSER_HORIZONTAL_STEPS, "BENCH_BROWSER_HORIZONTAL_STEPS")
assertPositiveInteger(BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS, "BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS")
assertPositiveInteger(BENCH_BROWSER_STEP_DELAY_MS, "BENCH_BROWSER_STEP_DELAY_MS")
assertNonNegativeInteger(BENCH_BROWSER_CELL_UPDATE_BURST, "BENCH_BROWSER_CELL_UPDATE_BURST")
for (const [value, label] of [
  [PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS, "PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS"],
  [PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS, "PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS"],
  [PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS, "PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS"],
  [PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX, "PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX"],
]) {
  if (value < 0) {
    throw new Error(`${label} must be non-negative`)
  }
}

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10)
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`)
  }
  return value
}

function floatEnv(name, fallback) {
  const value = Number.parseFloat(process.env[name] ?? String(fallback))
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`)
  }
  return value
}

function boolEnv(name, fallback) {
  const raw = process.env[name]
  if (raw == null) {
    return Boolean(fallback)
  }
  const normalized = raw.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }
  throw new Error(`${name} must be a boolean`)
}

function resolveInteractionDeviceProfile(name) {
  const profile = INTERACTION_DEVICE_PROFILES[name]
  if (profile) {
    return profile
  }
  throw new Error(
    `BENCH_INTERACTION_DEVICE_PROFILE must be one of: ${Object.keys(INTERACTION_DEVICE_PROFILES).join(", ")}`,
  )
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

function buildScenarioUrl(scenario) {
  const url = new URL(scenario.route ?? BENCH_BROWSER_ROUTE, BENCH_BROWSER_BASE_URL)
  if (scenario.verticalDiagnostics || scenario.sortDiagnostics || scenario.interactionDiagnostics) {
    url.searchParams.set("dgPerfTrace", "1")
  }
  return url.toString()
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

async function runScenario(page, sessionIndex, scenario) {
  const result = await page.evaluate(async (input) => {
    const viewport = document.querySelector(input.viewportSelector)
    if (!(viewport instanceof HTMLElement)) {
      throw new Error(`Datagrid viewport not found (${input.viewportSelector})`)
    }

    const stageRoot = viewport.closest(".grid-stage") ?? document.querySelector(".grid-stage")
    const frameDeltas = []
    const frameSamples = []
    const longTaskEntries = []
    const telemetrySamples = []
    const isVerticalDiagnosticsScenario = Boolean(input.scenario.verticalDiagnostics)
    const isSortDiagnosticsScenario = Boolean(input.scenario.sortDiagnostics)
    const isInteractionDiagnosticsScenario = Boolean(input.scenario.interactionDiagnostics)
    const createMutationSummary = () => ({
      callbackCount: 0,
      childListMutations: 0,
      attributesMutations: 0,
      addedNodes: 0,
      removedNodes: 0,
      addedRowNodes: 0,
      removedRowNodes: 0,
      addedCellNodes: 0,
      removedCellNodes: 0,
    })
    const interactions = {
      scenarioId: input.scenario.id,
      verticalScrollSteps: 0,
      verticalSmoothScrollSteps: 0,
      horizontalScrollSteps: 0,
      filterApplied: false,
      filterCleared: false,
      sortApplied: false,
      cellUpdatesAttempted: 0,
      cellEditorsOpened: 0,
      cellUpdatesCommitted: 0,
      skipped: [],
    }
    const verticalDiagnostics = isVerticalDiagnosticsScenario
      ? {
          enabled: true,
          scrollContainer: null,
          scrollEvents: {
            count: 0,
            first: null,
            last: null,
            samples: [],
          },
          renderedSnapshots: [],
          scrollWrites: [],
          rangeChangeCount: 0,
          rangeSampleCount: 0,
          uniqueRangeCount: 0,
          mutationSummary: createMutationSummary(),
          layoutReadSamples: [],
          appPerf: null,
          longTasks: [],
        }
      : null
    const sortDiagnostics = isSortDiagnosticsScenario
      ? {
          enabled: true,
          phases: {},
          renderedSnapshots: [],
          mutationSummary: createMutationSummary(),
          frameWindow: null,
          longTasks: [],
          appPerf: null,
          sortAction: null,
          visibleRowsRefresh: null,
      }
      : null
    const interactionDiagnostics = isInteractionDiagnosticsScenario
      ? {
          enabled: true,
          kind: input.scenario.interaction,
          skipped: [],
          scrollSyncDrift: null,
          traceSummary: {},
          appPerf: null,
        }
      : null

    const pause = (ms) => new Promise(resolvePause => setTimeout(resolvePause, ms))
    const waitForFrame = () => new Promise(resolveFrame => requestAnimationFrame(resolveFrame))
    const waitForCondition = async (predicate, timeoutMs = 2000) => {
      const started = performance.now()
      while (performance.now() - started < timeoutMs) {
        if (predicate()) {
          return true
        }
        await waitForFrame()
      }
      return predicate()
    }
    const waitForSmoothScrollFrame = async () => {
      await waitForFrame()
      const extraDelayMs = Math.max(0, input.smoothFrameDelayMs - 16)
      if (extraDelayMs > 0) {
        await pause(extraDelayMs)
      }
    }
    const waitForPaint = () => new Promise(resolvePaint => {
      requestAnimationFrame(() => requestAnimationFrame(resolvePaint))
    })
    const summarizeNumbers = (values) => {
      const finite = values.filter(value => Number.isFinite(value))
      if (!finite.length) {
        return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 }
      }
      const sorted = [...finite].sort((a, b) => a - b)
      const pick = (q) => {
        const position = Math.max(0, Math.min(1, q)) * (sorted.length - 1)
        const base = Math.floor(position)
        const rest = position - base
        const current = sorted[base] ?? 0
        const next = sorted[base + 1] ?? current
        return current + (next - current) * rest
      }
      return {
        count: finite.length,
        mean: finite.reduce((sum, value) => sum + value, 0) / finite.length,
        p50: pick(0.5),
        p95: pick(0.95),
        p99: pick(0.99),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      }
    }
    const summarizePerfSamplesByScope = (samples) => {
      const grouped = {}
      for (const sample of samples) {
        if (!sample || typeof sample.scope !== "string") {
          continue
        }
        const bucket = grouped[sample.scope] ?? { count: 0, totalMs: [], samples: [] }
        bucket.count += 1
        if (typeof sample.totalMs === "number" && Number.isFinite(sample.totalMs)) {
          bucket.totalMs.push(sample.totalMs)
        }
        if (bucket.samples.length < 12) {
          bucket.samples.push(sample)
        }
        grouped[sample.scope] = bucket
      }
      return Object.fromEntries(Object.entries(grouped).map(([scope, bucket]) => [
        scope,
        {
          count: bucket.count,
          totalMs: summarizeNumbers(bucket.totalMs),
          samples: bucket.samples,
        },
      ]))
    }
    const resolveElementDescriptor = (element) => {
      if (!(element instanceof HTMLElement)) {
        return null
      }
      return {
        tagName: element.tagName.toLowerCase(),
        id: element.id || null,
        className: element.className || null,
        role: element.getAttribute("role"),
        tabIndex: element.tabIndex,
      }
    }
    const parsePx = (value) => {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    const buildRenderedSnapshot = (label) => {
      const rowElements = Array.from(viewport.querySelectorAll(".grid-row"))
        .filter(candidate => candidate instanceof HTMLElement)
      const cellElements = Array.from(viewport.querySelectorAll(".grid-cell"))
        .filter(candidate => candidate instanceof HTMLElement)
      const rowIndexes = []
      for (const element of cellElements) {
        const rowIndex = Number.parseInt(element.getAttribute("data-row-index") ?? "", 10)
        if (Number.isFinite(rowIndex)) {
          rowIndexes.push(rowIndex)
        }
      }
      const firstRowIndex = rowIndexes.length ? Math.min(...rowIndexes) : null
      const lastRowIndex = rowIndexes.length ? Math.max(...rowIndexes) : null
      const topSpacer = viewport.querySelector(".grid-spacer--top")
        ?? viewport.querySelector(".grid-top-spacer")
        ?? viewport.querySelector('[data-datagrid-spacer="top"]')
      const bottomSpacer = viewport.querySelector(".grid-spacer--bottom")
        ?? viewport.querySelector(".grid-bottom-spacer")
        ?? viewport.querySelector('[data-datagrid-spacer="bottom"]')
      const snapshot = {
        label,
        atMs: performance.now(),
        scrollTop: viewport.scrollTop,
        scrollLeft: viewport.scrollLeft,
        rowNodes: rowElements.length,
        cellNodes: cellElements.length,
        stageNodes: stageRoot instanceof HTMLElement ? stageRoot.querySelectorAll("*").length : 0,
        firstRowIndex,
        lastRowIndex,
        rangeSignature: `${firstRowIndex ?? "null"}:${lastRowIndex ?? "null"}:${rowElements.length}:${cellElements.length}`,
        topSpacerHeight: topSpacer instanceof HTMLElement
          ? (parsePx(topSpacer.style.height) ?? topSpacer.offsetHeight)
          : null,
        bottomSpacerHeight: bottomSpacer instanceof HTMLElement
          ? (parsePx(bottomSpacer.style.height) ?? bottomSpacer.offsetHeight)
          : null,
      }
      return snapshot
    }
    const captureRenderedSnapshot = (label) => {
      if (!verticalDiagnostics) {
        return null
      }
      const snapshot = buildRenderedSnapshot(label)
      verticalDiagnostics.renderedSnapshots.push(snapshot)
      return snapshot
    }
    const captureSortRenderedSnapshot = (label) => {
      if (!sortDiagnostics) {
        return null
      }
      const snapshot = buildRenderedSnapshot(label)
      sortDiagnostics.renderedSnapshots.push(snapshot)
      return snapshot
    }
    const buildVisibleRowsSignature = () => {
      const rowElements = Array.from(viewport.querySelectorAll(".grid-row"))
        .filter(candidate => candidate instanceof HTMLElement)
      if (!rowElements.length) {
        return "empty"
      }
      return rowElements
        .slice(0, 12)
        .map((rowElement, index) => {
          const cells = Array.from(rowElement.querySelectorAll(".grid-cell"))
            .filter(candidate => candidate instanceof HTMLElement)
          const rowIndex = cells
            .map(cell => cell.getAttribute("data-row-index"))
            .find(Boolean)
          const rowKey = rowElement.getAttribute("data-row-key")
            ?? rowElement.getAttribute("data-row-id")
            ?? rowIndex
            ?? String(index)
          const amountCell = cells.find(cell => cell.getAttribute("data-column-key") === "amount")
          const amountText = amountCell?.textContent?.trim() ?? ""
          return `${rowKey}:${amountText}`
        })
        .join("|")
    }
    const summarizeFrameWindow = (startMs, endMs) => {
      const samples = frameSamples
        .filter(sample => sample.timestamp >= startMs && sample.timestamp <= endMs)
        .map(sample => sample.delta)
      return summarizeNumbers(samples)
    }
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
    const captureScrollContainerDiagnostics = () => {
      if (!verticalDiagnostics) {
        return
      }
      const style = window.getComputedStyle(viewport)
      const bodyContent = viewport.querySelector(".grid-body-content")
      const rect = viewport.getBoundingClientRect()
      verticalDiagnostics.scrollContainer = {
        viewport: resolveElementDescriptor(viewport),
        stageRoot: resolveElementDescriptor(stageRoot),
        dimensions: {
          clientWidth: viewport.clientWidth,
          clientHeight: viewport.clientHeight,
          scrollWidth: viewport.scrollWidth,
          scrollHeight: viewport.scrollHeight,
          offsetWidth: viewport.offsetWidth,
          offsetHeight: viewport.offsetHeight,
          maxTop: Math.max(0, viewport.scrollHeight - viewport.clientHeight),
          maxLeft: Math.max(0, viewport.scrollWidth - viewport.clientWidth),
          rectWidth: rect.width,
          rectHeight: rect.height,
        },
        style: {
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          position: style.position,
          contain: style.contain,
          willChange: style.willChange,
          transform: style.transform,
        },
        bodyContent: bodyContent instanceof HTMLElement
          ? {
              className: bodyContent.className || null,
              transform: bodyContent.style.transform || window.getComputedStyle(bodyContent).transform,
              height: bodyContent.style.height || null,
            }
          : null,
      }
    }
    const countGridElementNodes = (nodes) => {
      const counts = { rows: 0, cells: 0 }
      for (const node of nodes) {
        if (!(node instanceof Element)) {
          continue
        }
        if (node.matches(".grid-row")) {
          counts.rows += 1
        }
        if (node.matches(".grid-cell")) {
          counts.cells += 1
        }
        counts.rows += node.querySelectorAll(".grid-row").length
        counts.cells += node.querySelectorAll(".grid-cell").length
      }
      return counts
    }
    const perfWindow = window
    const traceDiagnosticsEnabled = isVerticalDiagnosticsScenario || isSortDiagnosticsScenario || isInteractionDiagnosticsScenario
    const resolveDataGridPerfStore = () => traceDiagnosticsEnabled && perfWindow.__AFFINO_DATAGRID_PERF__
      ? perfWindow.__AFFINO_DATAGRID_PERF__
      : null
    resolveDataGridPerfStore()?.clear?.()

    const recordMutationSummary = (summary, mutations) => {
      summary.callbackCount += 1
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const addedGridNodes = countGridElementNodes(mutation.addedNodes)
          const removedGridNodes = countGridElementNodes(mutation.removedNodes)
          summary.childListMutations += 1
          summary.addedNodes += mutation.addedNodes.length
          summary.removedNodes += mutation.removedNodes.length
          summary.addedRowNodes += addedGridNodes.rows
          summary.removedRowNodes += removedGridNodes.rows
          summary.addedCellNodes += addedGridNodes.cells
          summary.removedCellNodes += removedGridNodes.cells
        } else if (mutation.type === "attributes") {
          summary.attributesMutations += 1
        }
      }
    }
    let mutationObserver = null
    if ((verticalDiagnostics || sortDiagnostics) && typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver((mutations) => {
        if (verticalDiagnostics) {
          recordMutationSummary(verticalDiagnostics.mutationSummary, mutations)
        }
        if (sortDiagnostics) {
          recordMutationSummary(sortDiagnostics.mutationSummary, mutations)
        }
      })
      mutationObserver.observe(sortDiagnostics && document.body ? document.body : viewport, {
        childList: true,
        subtree: true,
      })
    }
    const handleMeasuredScrollEvent = () => {
      if (!verticalDiagnostics) {
        return
      }
      const sample = {
        atMs: performance.now(),
        scrollTop: viewport.scrollTop,
        scrollLeft: viewport.scrollLeft,
      }
      verticalDiagnostics.scrollEvents.count += 1
      verticalDiagnostics.scrollEvents.first ??= sample
      verticalDiagnostics.scrollEvents.last = sample
      if (
        verticalDiagnostics.scrollEvents.samples.length < 12
        || verticalDiagnostics.scrollEvents.count % 40 === 0
      ) {
        verticalDiagnostics.scrollEvents.samples.push(sample)
      }
    }
    if (verticalDiagnostics) {
      viewport.addEventListener("scroll", handleMeasuredScrollEvent, { passive: true })
    }

    let running = true
    let last = performance.now()
    let lastRafTimestamp = last
    const tick = (timestamp) => {
      const delta = timestamp - last
      frameDeltas.push(delta)
      frameSamples.push({ timestamp, delta })
      last = timestamp
      lastRafTimestamp = timestamp
      if (running) {
        requestAnimationFrame(tick)
      }
    }

    let longTaskObserver = null
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const attribution = Array.isArray(entry.attribution)
              ? entry.attribution.map(item => ({
                  name: item.name ?? null,
                  entryType: item.entryType ?? null,
                  containerType: item.containerType ?? null,
                  containerName: item.containerName ?? null,
                  containerId: item.containerId ?? null,
                  containerSrc: item.containerSrc ?? null,
                }))
              : []
            longTaskEntries.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              attribution,
            })
          }
        })
        longTaskObserver.observe({ entryTypes: ["longtask"] })
      } catch {
        longTaskObserver = null
      }
    }

    requestAnimationFrame(tick)
    const startedAt = performance.now()
    captureScrollContainerDiagnostics()
    captureTelemetry("start")
    captureRenderedSnapshot("start")
    await waitForPaint()

    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)

    if (input.scenario.verticalScroll && maxTop > 0) {
      let previousSnapshot = captureRenderedSnapshot("vertical:before-loop")
      for (let step = 1; step <= input.scrollSteps; step += 1) {
        const previousTop = viewport.scrollTop
        const targetTop = Math.round((maxTop * step) / input.scrollSteps)
        const beforeWriteMs = performance.now()
        const rafBeforeWriteMs = lastRafTimestamp
        viewport.scrollTop = targetTop
        const afterWriteMs = performance.now()
        interactions.verticalScrollSteps += 1
        const writeRecord = verticalDiagnostics
          ? {
              step,
              previousTop,
              targetTop,
              appliedTop: viewport.scrollTop,
              requestedDelta: targetTop - previousTop,
              appliedDelta: viewport.scrollTop - previousTop,
              beforeWriteMs,
              afterWriteMs,
              writeCostMs: afterWriteMs - beforeWriteMs,
              msSinceLastRafBeforeWrite: beforeWriteMs - rafBeforeWriteMs,
          }
          : null
        const shouldCaptureRangeSnapshot = step === 1 || step === input.scrollSteps || step % 10 === 0
        if (verticalDiagnostics && (step === 1 || step === input.scrollSteps || step % 20 === 0)) {
          const layoutReadStartMs = performance.now()
          const rect = viewport.getBoundingClientRect()
          verticalDiagnostics.layoutReadSamples.push({
            step,
            durationMs: performance.now() - layoutReadStartMs,
            clientHeight: viewport.clientHeight,
            scrollHeight: viewport.scrollHeight,
            rectTop: rect.top,
            rectHeight: rect.height,
          })
        }
        if (step === 1 || step === input.scrollSteps || step % 40 === 0) {
          captureTelemetry(`vertical:${step}`)
        }
        await pause(input.stepDelayMs)
        if (verticalDiagnostics && writeRecord) {
          const afterPauseMs = performance.now()
          const nextSnapshot = shouldCaptureRangeSnapshot
            ? captureRenderedSnapshot(`vertical:${step}`)
            : null
          writeRecord.afterPauseMs = afterPauseMs
          writeRecord.waitedAfterWriteMs = afterPauseMs - afterWriteMs
          writeRecord.rafAfterPauseMs = lastRafTimestamp
          writeRecord.msFromWriteToLatestRaf = lastRafTimestamp - afterWriteMs
          writeRecord.rangeSignature = nextSnapshot?.rangeSignature ?? null
          writeRecord.rangeChanged = nextSnapshot
            ? previousSnapshot?.rangeSignature !== nextSnapshot.rangeSignature
            : null
          verticalDiagnostics.scrollWrites.push(writeRecord)
          if (nextSnapshot) {
            verticalDiagnostics.rangeSampleCount += 1
            if (writeRecord.rangeChanged) {
              verticalDiagnostics.rangeChangeCount += 1
            }
            previousSnapshot = nextSnapshot
          }
        }
      }
    } else if (input.scenario.verticalScroll) {
      interactions.skipped.push("vertical-scroll:no-scroll-range")
    }

    if (input.scenario.verticalSmoothScroll && maxTop > 0) {
      let previousSnapshot = captureRenderedSnapshot("vertical-smooth:before-loop")
      const smoothDeltaPx = Math.max(1, Math.trunc(input.smoothScrollDeltaPx))
      const smoothDistancePx = Math.min(maxTop, smoothDeltaPx * input.smoothScrollSteps)
      const smoothEndTop = Math.min(maxTop, viewport.scrollTop + smoothDistancePx)
      for (
        let step = 1;
        step <= input.smoothScrollSteps && viewport.scrollTop < smoothEndTop;
        step += 1
      ) {
        const previousTop = viewport.scrollTop
        const targetTop = Math.min(smoothEndTop, previousTop + smoothDeltaPx)
        const beforeWriteMs = performance.now()
        const rafBeforeWriteMs = lastRafTimestamp
        const wheelEvent = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaX: 0,
          deltaY: targetTop - previousTop,
          view: window,
        })
        const wheelDispatched = viewport.dispatchEvent(wheelEvent)
        let usedScrollFallback = false
        if (viewport.scrollTop === previousTop) {
          viewport.scrollBy({
            top: targetTop - previousTop,
            left: 0,
            behavior: "instant",
          })
          usedScrollFallback = true
        }
        const afterWriteMs = performance.now()
        interactions.verticalSmoothScrollSteps += 1
        const writeRecord = verticalDiagnostics
          ? {
              step,
              previousTop,
              targetTop,
              appliedTop: viewport.scrollTop,
              requestedDelta: targetTop - previousTop,
              appliedDelta: viewport.scrollTop - previousTop,
              beforeWriteMs,
              afterWriteMs,
              writeCostMs: afterWriteMs - beforeWriteMs,
              msSinceLastRafBeforeWrite: beforeWriteMs - rafBeforeWriteMs,
              wheelDefaultPrevented: wheelEvent.defaultPrevented || !wheelDispatched,
              usedScrollFallback,
            }
          : null
        const shouldCaptureRangeSnapshot = step === 1
          || step === input.smoothScrollSteps
          || viewport.scrollTop >= smoothEndTop
          || step % 20 === 0
        if (verticalDiagnostics && (step === 1 || viewport.scrollTop >= smoothEndTop || step % 80 === 0)) {
          const layoutReadStartMs = performance.now()
          const rect = viewport.getBoundingClientRect()
          verticalDiagnostics.layoutReadSamples.push({
            step,
            durationMs: performance.now() - layoutReadStartMs,
            clientHeight: viewport.clientHeight,
            scrollHeight: viewport.scrollHeight,
            rectTop: rect.top,
            rectHeight: rect.height,
          })
        }
        if (step === 1 || viewport.scrollTop >= smoothEndTop || step % 160 === 0) {
          captureTelemetry(`vertical-smooth:${step}`)
        }
        await waitForSmoothScrollFrame()
        if (verticalDiagnostics && writeRecord) {
          const afterPauseMs = performance.now()
          const nextSnapshot = shouldCaptureRangeSnapshot
            ? captureRenderedSnapshot(`vertical-smooth:${step}`)
            : null
          writeRecord.afterPauseMs = afterPauseMs
          writeRecord.waitedAfterWriteMs = afterPauseMs - afterWriteMs
          writeRecord.rafAfterPauseMs = lastRafTimestamp
          writeRecord.msFromWriteToLatestRaf = lastRafTimestamp - afterWriteMs
          writeRecord.rangeSignature = nextSnapshot?.rangeSignature ?? null
          writeRecord.rangeChanged = nextSnapshot
            ? previousSnapshot?.rangeSignature !== nextSnapshot.rangeSignature
            : null
          verticalDiagnostics.scrollWrites.push(writeRecord)
          if (nextSnapshot) {
            verticalDiagnostics.rangeSampleCount += 1
            if (writeRecord.rangeChanged) {
              verticalDiagnostics.rangeChangeCount += 1
            }
            previousSnapshot = nextSnapshot
          }
        }
      }
    } else if (input.scenario.verticalSmoothScroll) {
      interactions.skipped.push("vertical-smooth-scroll:no-scroll-range")
    }

    if (input.scenario.horizontalScroll && maxLeft > 0) {
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
    } else if (input.scenario.horizontalScroll) {
      interactions.skipped.push("horizontal-scroll:no-scroll-range")
    }

    if (maxLeft > 0 && (input.scenario.filter || input.scenario.sort || input.scenario.cellUpdates)) {
      viewport.scrollLeft = 0
      captureTelemetry("horizontal:reset")
      await waitForPaint()
    }

    if (input.scenario.filter && input.enableFilter) {
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
    } else if (input.scenario.filter) {
      interactions.skipped.push("filter:disabled-by-config")
    }

    if (input.scenario.sort && input.enableSort) {
      const preferredSortButton = document.querySelector(
        '.grid-cell--header[data-column-key="amount"] [data-datagrid-column-menu-button="true"]',
      )
      const sortButton = preferredSortButton ?? document.querySelector('[data-datagrid-column-menu-button="true"]')
      if (sortDiagnostics) {
        sortDiagnostics.sortAction = {
          preferredButtonFound: preferredSortButton instanceof HTMLElement,
          fallbackButtonFound: sortButton instanceof HTMLElement,
          menuPanelFound: false,
          sortDescActionFound: false,
          sortDescActionDisabled: null,
        }
      }
      if (sortButton instanceof HTMLElement) {
        captureSortRenderedSnapshot("sort:before-menu")
        const beforeMenuSignature = buildVisibleRowsSignature()
        const menuClickStartMs = performance.now()
        sortButton.click()
        const menuClickEndMs = performance.now()
        await waitForPaint()
        const menuPaintEndMs = performance.now()
        const menuPanel = document.querySelector('[data-datagrid-column-menu-panel="true"]')
        if (sortDiagnostics) {
          sortDiagnostics.sortAction.menuPanelFound = menuPanel instanceof HTMLElement
          sortDiagnostics.phases.menuClickStartMs = menuClickStartMs
          sortDiagnostics.phases.menuClickEndMs = menuClickEndMs
          sortDiagnostics.phases.menuClickMs = menuClickEndMs - menuClickStartMs
          sortDiagnostics.phases.menuPaintEndMs = menuPaintEndMs
          sortDiagnostics.phases.menuOpenToPaintMs = menuPaintEndMs - menuClickStartMs
          sortDiagnostics.visibleRowsRefresh = {
            beforeMenuSignature,
            beforeSortSignature: null,
            afterClickSignature: null,
            finalSignature: null,
            changedSynchronously: false,
            changedAfterFrame: false,
            frameCountUntilChange: 0,
            timeoutMs: 2000,
          }
          captureSortRenderedSnapshot("sort:after-menu-open")
        }
        const sortAction = document.querySelector('[data-datagrid-column-menu-action="sort-desc"]')
        if (sortDiagnostics) {
          sortDiagnostics.sortAction.sortDescActionFound = sortAction instanceof HTMLElement
          sortDiagnostics.sortAction.sortDescActionDisabled = sortAction instanceof HTMLElement
            ? sortAction.hasAttribute("disabled")
            : null
        }
        if (sortAction instanceof HTMLElement && !sortAction.hasAttribute("disabled")) {
          const beforeSortSignature = buildVisibleRowsSignature()
          if (sortDiagnostics?.visibleRowsRefresh) {
            sortDiagnostics.visibleRowsRefresh.beforeSortSignature = beforeSortSignature
          }
          const sortClickStartMs = performance.now()
          sortAction.click()
          const sortClickEndMs = performance.now()
          const afterClickSignature = buildVisibleRowsSignature()
          interactions.sortApplied = true
          captureTelemetry("sort:desc")
          let finalSignature = afterClickSignature
          let changedSynchronously = afterClickSignature !== beforeSortSignature
          let changedAfterFrame = false
          let frameCountUntilChange = 0
          const refreshWaitStartMs = performance.now()
          while (!changedSynchronously && !changedAfterFrame && performance.now() - refreshWaitStartMs < 2000) {
            await waitForFrame()
            frameCountUntilChange += 1
            finalSignature = buildVisibleRowsSignature()
            changedAfterFrame = finalSignature !== beforeSortSignature
          }
          const visibleRefreshEndMs = performance.now()
          await waitForPaint()
          const sortPaintEndMs = performance.now()
          if (sortDiagnostics) {
            sortDiagnostics.phases.sortClickStartMs = sortClickStartMs
            sortDiagnostics.phases.sortClickEndMs = sortClickEndMs
            sortDiagnostics.phases.sortClickMs = sortClickEndMs - sortClickStartMs
            sortDiagnostics.phases.visibleRowsRefreshEndMs = visibleRefreshEndMs
            sortDiagnostics.phases.visibleRowsRefreshMs = visibleRefreshEndMs - sortClickStartMs
            sortDiagnostics.phases.sortPaintEndMs = sortPaintEndMs
            sortDiagnostics.phases.sortClickToPaintMs = sortPaintEndMs - sortClickStartMs
            sortDiagnostics.phases.totalSortInteractionMs = sortPaintEndMs - menuClickStartMs
            sortDiagnostics.visibleRowsRefresh = {
              ...sortDiagnostics.visibleRowsRefresh,
              afterClickSignature,
              finalSignature,
              changedSynchronously,
              changedAfterFrame,
              frameCountUntilChange,
            }
            sortDiagnostics.frameWindow = {
              startMs: menuClickStartMs,
              endMs: sortPaintEndMs,
              sortStartMs: sortClickStartMs,
              sortEndMs: sortClickEndMs,
              summary: summarizeFrameWindow(menuClickStartMs, sortPaintEndMs),
              sortApplySummary: summarizeFrameWindow(sortClickStartMs, sortPaintEndMs),
            }
            captureSortRenderedSnapshot("sort:after-desc")
          }
        } else {
          interactions.skipped.push("sort:no-sort-desc-action")
        }
      } else {
        interactions.skipped.push("sort:no-column-menu-button")
      }
    } else if (input.scenario.sort) {
      interactions.skipped.push("sort:disabled-by-config")
    }

    if (input.scenario.cellUpdates && input.enableCellUpdates && input.cellUpdateBurst > 0) {
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
    } else if (input.scenario.cellUpdates && !input.enableCellUpdates) {
      interactions.skipped.push("cell-update:disabled-by-config")
    } else if (input.scenario.cellUpdates) {
      interactions.skipped.push("cell-update:empty-burst")
    }

    if (interactionDiagnostics) {
      const elementCenter = (element) => {
        const rect = element.getBoundingClientRect()
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        }
      }
      const dispatchElementMouse = (element, type, point, init = {}) => {
        element.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: init.button ?? 0,
          buttons: init.buttons ?? (type === "mouseup" ? 0 : 1),
          clientX: point.x,
          clientY: point.y,
          view: window,
        }))
      }
      const dispatchWindowMouse = (type, point, init = {}) => {
        window.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: init.button ?? 0,
          buttons: init.buttons ?? (type === "mouseup" ? 0 : 1),
          clientX: point.x,
          clientY: point.y,
          view: window,
        }))
      }
      const firstAmountCell = () => document.querySelector('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]')
      const amountCellByViewportRow = (rowIndex) => {
        const cells = Array.from(
          document.querySelectorAll('.grid-body-viewport .grid-row:not(.row--group) .grid-cell[data-column-key="amount"]'),
        ).filter(candidate => candidate instanceof HTMLElement)
        return cells[rowIndex] ?? cells[0] ?? null
      }
      const viewportEdgePoint = () => {
        const rect = viewport.getBoundingClientRect()
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.bottom - 6),
        }
      }
      const outsidePoint = () => ({ x: 8, y: 8 })
      const readScrollSyncDrift = () => {
        const headerViewport = document.querySelector(".grid-header-viewport")
        const leftPaneContent = document.querySelector(".grid-body-pane--left .grid-pane-content")
        const parseTransformY = (element) => {
          if (!(element instanceof HTMLElement)) {
            return null
          }
          const transform = element.style.transform || window.getComputedStyle(element).transform
          if (!transform || transform === "none") {
            return 0
          }
          const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
          if (matrixMatch) {
            const parts = matrixMatch[1].split(",").map(part => Number.parseFloat(part.trim()))
            return Number.isFinite(parts[5]) ? parts[5] : null
          }
          const translateMatch = transform.match(/translate3?d?\([^,]+,\s*(-?\d+(?:\.\d+)?)px/)
          return translateMatch ? Number.parseFloat(translateMatch[1]) : null
        }
        const headerDrift = headerViewport instanceof HTMLElement
          ? Math.abs(headerViewport.scrollLeft - viewport.scrollLeft)
          : 0
        const leftPaneTransformY = parseTransformY(leftPaneContent)
        const pinnedVerticalDrift = leftPaneTransformY == null
          ? 0
          : Math.abs(leftPaneTransformY + viewport.scrollTop)
        return {
          headerDriftPx: headerDrift,
          pinnedVerticalDriftPx: pinnedVerticalDrift,
          maxAbsPx: Math.max(headerDrift, pinnedVerticalDrift),
        }
      }
      const selectSourceCell = async () => {
        const sourceCell = firstAmountCell()
        if (!(sourceCell instanceof HTMLElement)) {
          interactionDiagnostics.skipped.push("interaction:no-amount-cell")
          return null
        }
        const point = elementCenter(sourceCell)
        dispatchElementMouse(sourceCell, "mousedown", point)
        dispatchWindowMouse("mouseup", point)
        sourceCell.click()
        await waitForPaint()
        return sourceCell
      }
      const startRangeMove = async () => {
        const sourceCell = await selectSourceCell()
        const targetCell = amountCellByViewportRow(1)
        if (!(sourceCell instanceof HTMLElement) || !(targetCell instanceof HTMLElement)) {
          interactionDiagnostics.skipped.push("range-move:no-target-cell")
          return null
        }
        dispatchElementMouse(sourceCell, "mousedown", elementCenter(sourceCell))
        dispatchWindowMouse("mousemove", elementCenter(targetCell), { buttons: 1 })
        await waitForPaint()
        return sourceCell
      }
      const runInteraction = async () => {
        switch (input.scenario.interaction) {
          case "drag-selection": {
            const sourceCell = document.querySelector('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-key="name"]')
              ?? firstAmountCell()
            if (!(sourceCell instanceof HTMLElement)) {
              interactionDiagnostics.skipped.push("drag-selection:no-source-cell")
              return
            }
            dispatchElementMouse(sourceCell, "mousedown", elementCenter(sourceCell))
            dispatchWindowMouse("mousemove", viewportEdgePoint(), { buttons: 1 })
            await waitForPaint()
            dispatchWindowMouse("mouseup", viewportEdgePoint())
            break
          }
          case "drag-selection-pinned": {
            const sourceCell = document.querySelector('.grid-body-pane--left .grid-cell[data-row-index="0"]')
              ?? document.querySelector('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-key="name"]')
              ?? firstAmountCell()
            if (!(sourceCell instanceof HTMLElement)) {
              interactionDiagnostics.skipped.push("drag-selection-pinned:no-source-cell")
              return
            }
            dispatchElementMouse(sourceCell, "mousedown", elementCenter(sourceCell))
            dispatchWindowMouse("mousemove", viewportEdgePoint(), { buttons: 1 })
            await waitForPaint()
            dispatchWindowMouse("mouseup", viewportEdgePoint())
            break
          }
          case "fill-autoscroll": {
            const sourceCell = await selectSourceCell()
            await waitForCondition(() => document.querySelector(".cell-fill-handle") != null, 1500)
            const fillHandle = sourceCell?.querySelector(".cell-fill-handle")
              ?? document.querySelector(".cell-fill-handle")
            if (!(fillHandle instanceof HTMLElement)) {
              interactionDiagnostics.skipped.push("fill:no-fill-handle")
              return
            }
            dispatchElementMouse(fillHandle, "mousedown", elementCenter(fillHandle))
            dispatchWindowMouse("mousemove", viewportEdgePoint(), { buttons: 1 })
            await waitForPaint()
            dispatchWindowMouse("mouseup", outsidePoint())
            break
          }
          case "range-autoscroll": {
            const sourceCell = await startRangeMove()
            dispatchWindowMouse("mousemove", viewportEdgePoint(), { buttons: 1 })
            await waitForPaint()
            if (sourceCell instanceof HTMLElement) {
              sourceCell.dispatchEvent(new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Escape",
              }))
            }
            dispatchWindowMouse("mouseup", viewportEdgePoint())
            break
          }
          case "resize-drag": {
            const headerResize = document.querySelector('.grid-cell--header[data-column-key="name"] .col-resize')
              ?? document.querySelector(".grid-cell--header .col-resize")
            if (headerResize instanceof HTMLElement) {
              const start = elementCenter(headerResize)
              dispatchElementMouse(headerResize, "mousedown", start)
              dispatchWindowMouse("mousemove", { x: start.x + 80, y: start.y }, { buttons: 1 })
              dispatchWindowMouse("mouseup", { x: start.x + 80, y: start.y })
            } else {
              interactionDiagnostics.skipped.push("resize:no-column-handle")
            }
            const rowResize = document.querySelector('.grid-body-pane--left .grid-row[data-row-index="0"] .row-resize-handle')
            if (rowResize instanceof HTMLElement) {
              const start = elementCenter(rowResize)
              dispatchElementMouse(rowResize, "mousedown", start)
              dispatchWindowMouse("mousemove", { x: start.x, y: start.y + 32 }, { buttons: 1 })
              dispatchWindowMouse("mouseup", { x: start.x, y: start.y + 32 })
            } else {
              interactionDiagnostics.skipped.push("resize:no-row-handle")
            }
            break
          }
          case "context-menu": {
            const targetCell = await startRangeMove()
            if (targetCell instanceof HTMLElement) {
              const point = elementCenter(targetCell)
              window.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                button: 2,
                clientX: point.x,
                clientY: point.y,
                view: window,
              }))
            }
            await waitForPaint()
            const header = document.querySelector('.grid-cell--header[data-column-key="amount"]')
              ?? document.querySelector(".grid-cell--header")
            if (header instanceof HTMLElement) {
              const point = elementCenter(header)
              header.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                button: 2,
                clientX: point.x,
                clientY: point.y,
                view: window,
              }))
              await waitForCondition(() => document.querySelector("[data-datagrid-column-menu-action]") != null, 1500)
              document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" }))
            } else {
              interactionDiagnostics.skipped.push("context-menu:no-header")
            }
            dispatchWindowMouse("mouseup", outsidePoint())
            break
          }
          default:
            interactionDiagnostics.skipped.push(`interaction:unknown-${input.scenario.interaction}`)
        }
      }
      await runInteraction()
      await waitForPaint()
      const dataGridPerfStore = resolveDataGridPerfStore()
      const samples = Array.isArray(dataGridPerfStore?.samples) ? dataGridPerfStore.samples.slice() : []
      interactionDiagnostics.appPerf = dataGridPerfStore
        ? {
            samples,
            summary: typeof dataGridPerfStore.summary === "function" ? dataGridPerfStore.summary() : [],
          }
        : null
      interactionDiagnostics.traceSummary = summarizePerfSamplesByScope(samples)
      interactionDiagnostics.scrollSyncDrift = readScrollSyncDrift()
      interactions.skipped.push(...interactionDiagnostics.skipped)
    }

    await pause(Math.max(32, input.stepDelayMs * 2))
    captureTelemetry("settled")
    captureRenderedSnapshot("settled")
    const measuredElapsedMs = performance.now() - startedAt
    running = false
    await pause(24)
    longTaskObserver?.disconnect()
    mutationObserver?.disconnect()
    if (verticalDiagnostics) {
      viewport.removeEventListener("scroll", handleMeasuredScrollEvent)
      const uniqueRanges = new Set(
        verticalDiagnostics.scrollWrites
          .map(write => write.rangeSignature)
          .filter(value => typeof value === "string"),
      )
      const writeDeltas = verticalDiagnostics.scrollWrites.map(write => write.appliedDelta)
      const writeCosts = verticalDiagnostics.scrollWrites.map(write => write.writeCostMs)
      const waitAfterWrite = verticalDiagnostics.scrollWrites.map(write => write.waitedAfterWriteMs)
      const writeToRaf = verticalDiagnostics.scrollWrites.map(write => write.msFromWriteToLatestRaf)
      const eventSamples = [
        verticalDiagnostics.scrollEvents.first,
        ...verticalDiagnostics.scrollEvents.samples,
        verticalDiagnostics.scrollEvents.last,
      ].filter(Boolean)
      const eventDeltas = eventSamples
        .slice(1)
        .map((sample, index) => sample.scrollTop - (eventSamples[index]?.scrollTop ?? 0))
      verticalDiagnostics.uniqueRangeCount = uniqueRanges.size
      verticalDiagnostics.summary = {
        scrollTopDelta: summarizeNumbers(writeDeltas),
        scrollWriteCostMs: summarizeNumbers(writeCosts),
        waitAfterWriteMs: summarizeNumbers(waitAfterWrite),
        writeToLatestRafMs: summarizeNumbers(writeToRaf),
        scrollEventDelta: summarizeNumbers(eventDeltas),
        rangeChangedPct: verticalDiagnostics.rangeSampleCount > 0
          ? (verticalDiagnostics.rangeChangeCount / verticalDiagnostics.rangeSampleCount) * 100
          : 0,
        scrollEventsPerWrite: verticalDiagnostics.scrollWrites.length > 0
          ? verticalDiagnostics.scrollEvents.count / verticalDiagnostics.scrollWrites.length
          : 0,
        mutationCallbacksPerWrite: verticalDiagnostics.scrollWrites.length > 0
          ? verticalDiagnostics.mutationSummary.callbackCount / verticalDiagnostics.scrollWrites.length
          : 0,
        addedRowsPerWrite: verticalDiagnostics.scrollWrites.length > 0
          ? verticalDiagnostics.mutationSummary.addedRowNodes / verticalDiagnostics.scrollWrites.length
          : 0,
        removedRowsPerWrite: verticalDiagnostics.scrollWrites.length > 0
          ? verticalDiagnostics.mutationSummary.removedRowNodes / verticalDiagnostics.scrollWrites.length
          : 0,
        addedCellsPerWrite: verticalDiagnostics.scrollWrites.length > 0
          ? verticalDiagnostics.mutationSummary.addedCellNodes / verticalDiagnostics.scrollWrites.length
          : 0,
        removedCellsPerWrite: verticalDiagnostics.scrollWrites.length > 0
          ? verticalDiagnostics.mutationSummary.removedCellNodes / verticalDiagnostics.scrollWrites.length
          : 0,
        rangeSampleCount: verticalDiagnostics.rangeSampleCount,
      }
      const dataGridPerfStore = resolveDataGridPerfStore()
      verticalDiagnostics.appPerf = dataGridPerfStore
        ? {
            samples: Array.isArray(dataGridPerfStore.samples) ? dataGridPerfStore.samples.slice() : [],
            summary: typeof dataGridPerfStore.summary === "function" ? dataGridPerfStore.summary() : [],
          }
        : null
      verticalDiagnostics.longTasks = longTaskEntries.map(entry => ({
        startTime: entry.startTime,
        duration: entry.duration,
        name: entry.name,
        attribution: entry.attribution,
      }))
    }
    if (sortDiagnostics) {
      const frameWindow = sortDiagnostics.frameWindow
      if (frameWindow) {
        sortDiagnostics.frameWindow = {
          ...frameWindow,
          summary: summarizeFrameWindow(frameWindow.startMs, frameWindow.endMs),
          sortApplySummary: summarizeFrameWindow(frameWindow.sortStartMs, frameWindow.endMs),
        }
        sortDiagnostics.longTasks = longTaskEntries
          .filter(entry => entry.startTime >= frameWindow.startMs && entry.startTime <= frameWindow.endMs)
          .map(entry => ({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
            attribution: entry.attribution,
          }))
      }
      const dataGridPerfStore = resolveDataGridPerfStore()
      sortDiagnostics.appPerf = dataGridPerfStore
        ? {
            samples: Array.isArray(dataGridPerfStore.samples) ? dataGridPerfStore.samples.slice() : [],
            summary: typeof dataGridPerfStore.summary === "function" ? dataGridPerfStore.summary() : [],
          }
        : null
      const appPerfSamples = sortDiagnostics.appPerf?.samples ?? []
      const latestAppSortRequest = [...appPerfSamples]
        .reverse()
        .find(sample => sample?.scope === "columnMenuSortRequest") ?? null
      const latestAppSortApply = [...appPerfSamples]
        .reverse()
        .find(sample => sample?.scope === "columnMenuSortApply") ?? null
      const latestViewportRaf = [...appPerfSamples]
        .reverse()
        .find(sample => sample?.scope === "viewportRaf") ?? null
      sortDiagnostics.appSort = {
        request: latestAppSortRequest,
        apply: latestAppSortApply,
        viewport: latestViewportRaf,
      }
      sortDiagnostics.phaseBreakdown = {
        sortActionClickToHandlerStartMs: typeof latestAppSortRequest?.handlerStartMs === "number"
          && typeof sortDiagnostics.phases.sortClickStartMs === "number"
          ? latestAppSortRequest.handlerStartMs - sortDiagnostics.phases.sortClickStartMs
          : null,
        clickHandlerMs: typeof latestAppSortApply?.handlerMs === "number"
          ? latestAppSortApply.handlerMs
          : null,
        handlerToApplyStartMs: typeof latestAppSortApply?.handlerToApplyStartMs === "number"
          ? latestAppSortApply.handlerToApplyStartMs
          : null,
        setSortModelMs: typeof latestAppSortApply?.setSortModelMs === "number"
          ? latestAppSortApply.setSortModelMs
          : null,
        projectionRebuildMs: typeof latestAppSortApply?.projectionRebuildMs === "number"
          ? latestAppSortApply.projectionRebuildMs
          : null,
        projectionSortMs: typeof latestAppSortApply?.projectionSortMs === "number"
          ? latestAppSortApply.projectionSortMs
          : null,
        projectionFilterMs: typeof latestAppSortApply?.projectionFilterMs === "number"
          ? latestAppSortApply.projectionFilterMs
          : null,
        projectionGroupMs: typeof latestAppSortApply?.projectionGroupMs === "number"
          ? latestAppSortApply.projectionGroupMs
          : null,
        viewportUpdateMs: typeof latestViewportRaf?.totalMs === "number"
          ? latestViewportRaf.totalMs
          : null,
        visibleRowsMs: typeof latestViewportRaf?.visibleRowsMs === "number"
          ? latestViewportRaf.visibleRowsMs
          : null,
        firstPaintAfterSortMs: typeof latestAppSortApply?.setSortModelEndMs === "number"
          && typeof sortDiagnostics.phases.sortPaintEndMs === "number"
          ? sortDiagnostics.phases.sortPaintEndMs - latestAppSortApply.setSortModelEndMs
          : null,
      }
      sortDiagnostics.summary = {
        addedRows: sortDiagnostics.mutationSummary.addedRowNodes,
        removedRows: sortDiagnostics.mutationSummary.removedRowNodes,
        addedCells: sortDiagnostics.mutationSummary.addedCellNodes,
        removedCells: sortDiagnostics.mutationSummary.removedCellNodes,
        longTaskCount: sortDiagnostics.longTasks.length,
        longTaskTotalMs: sortDiagnostics.longTasks.reduce((sum, entry) => sum + entry.duration, 0),
      }
    }

    const heapValues = telemetrySamples
      .map(sample => sample.usedHeapMb)
      .filter(value => typeof value === "number" && Number.isFinite(value))
    const firstHeap = heapValues[0] ?? null
    const lastHeap = heapValues[heapValues.length - 1] ?? null
    const peakHeap = heapValues.length ? Math.max(...heapValues) : null

    return {
      frameDeltas,
      longTaskDurations: longTaskEntries.map(entry => entry.duration),
      longTaskEntries,
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
      verticalDiagnostics,
      sortDiagnostics,
      interactionDiagnostics,
    }
  }, {
    scenario,
    viewportSelector: BENCH_VIEWPORT_SELECTOR,
    scrollSteps: BENCH_BROWSER_SCROLL_STEPS,
    smoothScrollSteps: BENCH_BROWSER_SMOOTH_SCROLL_STEPS,
    smoothScrollDeltaPx: BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX,
    smoothFrameDelayMs: BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS,
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
    scenario: scenario.id,
    session: sessionIndex + 1,
    ...frame,
    frameDeltas: result.frameDeltas,
    longTaskCount,
    longTaskTotalMs,
    longTaskMaxMs,
    longTaskDuration: stats(result.longTaskDurations),
    longTaskEntries: result.longTaskEntries,
    telemetry: result.telemetry,
    interactions: result.interactions,
    measuredElapsedMs: result.measuredElapsedMs,
    maxTop: result.maxTop,
    maxLeft: result.maxLeft,
    finalTop: result.finalTop,
    finalLeft: result.finalLeft,
    verticalDiagnostics: result.verticalDiagnostics,
    sortDiagnostics: result.sortDiagnostics,
    interactionDiagnostics: result.interactionDiagnostics,
  }
}

function aggregateRuns(runs) {
  const sortDiagnosticsRuns = runs.map(run => run.sortDiagnostics).filter(Boolean)
  const interactionDiagnosticsRuns = runs.map(run => run.interactionDiagnostics).filter(Boolean)
  const interactionScopeStats = (scope) => stats(
    interactionDiagnosticsRuns.map(diagnostics => diagnostics.traceSummary?.[scope]?.totalMs?.p95),
  )
  return {
    measuredElapsedMs: stats(runs.map(run => run.measuredElapsedMs)),
    interactionDurationMs: stats(runs.map(run => run.measuredElapsedMs)),
    frameMs: stats(runs.flatMap(run => normalizeFrameDeltas(run.frameDeltas ?? []))),
    frameP50Ms: stats(runs.map(run => run.frameStats.p50)),
    frameP95Ms: stats(runs.map(run => run.frameStats.p95)),
    frameP99Ms: stats(runs.map(run => run.frameStats.p99)),
    fps: stats(runs.map(run => run.fps)),
    droppedFramePct: stats(runs.map(run => run.droppedPct)),
    droppedFrames: stats(runs.map(run => run.droppedFrames)),
    longFramesOver16Ms: stats(runs.map(run => run.longFramesOver16Ms)),
    longFramesOver32Ms: stats(runs.map(run => run.longFramesOver32Ms)),
    longTaskCount: stats(runs.map(run => run.longTaskCount)),
    longTaskTotalMs: stats(runs.map(run => run.longTaskTotalMs)),
    longTaskMaxMs: stats(runs.map(run => run.longTaskMaxMs)),
    peakUsedHeapMb: stats(runs.map(run => run.telemetry.peakUsedHeapMb ?? 0)),
    heapDeltaMb: stats(runs.map(run => run.telemetry.heapDeltaMb ?? 0)),
    peakPageNodes: stats(runs.map(run => run.telemetry.peakPageNodes)),
    peakStageNodes: stats(runs.map(run => run.telemetry.peakStageNodes)),
    peakVisibleCells: stats(runs.map(run => run.telemetry.peakVisibleCells)),
    peakViewportCells: stats(runs.map(run => run.telemetry.peakViewportCells)),
    cellUpdatesAttempted: stats(runs.map(run => run.interactions.cellUpdatesAttempted)),
    cellUpdatesCommitted: stats(runs.map(run => run.interactions.cellUpdatesCommitted)),
    sortDiagnostics: {
      menuClickMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phases?.menuClickMs)),
      menuOpenToPaintMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phases?.menuOpenToPaintMs)),
      sortClickMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phases?.sortClickMs)),
      sortClickToPaintMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phases?.sortClickToPaintMs)),
      visibleRowsRefreshMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phases?.visibleRowsRefreshMs)),
      totalSortInteractionMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phases?.totalSortInteractionMs)),
      addedRows: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.summary?.addedRows)),
      removedRows: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.summary?.removedRows)),
      addedCells: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.summary?.addedCells)),
      removedCells: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.summary?.removedCells)),
      sortWindowFrameP95Ms: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.frameWindow?.summary?.p95)),
      sortApplyFrameP95Ms: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.frameWindow?.sortApplySummary?.p95)),
      sortWindowLongTaskCount: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.summary?.longTaskCount)),
      sortWindowLongTaskTotalMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.summary?.longTaskTotalMs)),
      sortActionClickToHandlerStartMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.sortActionClickToHandlerStartMs)),
      clickHandlerMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.clickHandlerMs)),
      handlerToApplyStartMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.handlerToApplyStartMs)),
      setSortModelMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.setSortModelMs)),
      projectionRebuildMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.projectionRebuildMs)),
      projectionSortMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.projectionSortMs)),
      projectionFilterMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.projectionFilterMs)),
      projectionGroupMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.projectionGroupMs)),
      viewportUpdateMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.viewportUpdateMs)),
      visibleRowsMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.visibleRowsMs)),
      firstPaintAfterSortMs: stats(sortDiagnosticsRuns.map(diagnostics => diagnostics.phaseBreakdown?.firstPaintAfterSortMs)),
    },
    interactionDiagnostics: {
      previewP95Ms: interactionScopeStats("interactionPreview"),
      autoScrollP95Ms: interactionScopeStats("interactionAutoScroll"),
      focusRestoreMaxMs: stats(interactionDiagnosticsRuns.map(diagnostics => diagnostics.traceSummary?.stageFocusRestore?.totalMs?.max)),
      preventDefaultCount: stats(interactionDiagnosticsRuns.map(diagnostics => diagnostics.traceSummary?.interactionPreventDefault?.count ?? 0)),
      cancelCount: stats(interactionDiagnosticsRuns.map(diagnostics => diagnostics.traceSummary?.interactionCancel?.count ?? 0)),
      scrollSyncDriftPx: stats(interactionDiagnosticsRuns.map(diagnostics => diagnostics.scrollSyncDrift?.maxAbsPx)),
    },
  }
}

function buildScenarioSummary(runs) {
  const byScenario = {}
  for (const scenario of SCENARIOS) {
    const scenarioRuns = runs.filter(run => run.scenario === scenario.id)
    byScenario[scenario.id] = {
      aggregate: aggregateRuns(scenarioRuns),
      sessions: scenarioRuns,
    }
  }
  return byScenario
}

function resolveWorstScenario(scenarios) {
  let worst = null
  for (const [id, report] of Object.entries(scenarios)) {
    const frameP95 = report.aggregate.frameP95Ms.p50
    if (!Number.isFinite(frameP95)) {
      continue
    }
    if (!worst || frameP95 > worst.frameP95Ms) {
      worst = { id, frameP95Ms: frameP95 }
    }
  }
  return worst
}

function addWarningIfAbove(warnings, label, actual, budget) {
  if (!Number.isFinite(actual) || actual <= budget) {
    return
  }
  warnings.push(`${label} ${actual.toFixed(3)} exceeds warning budget ${budget}`)
}

function buildInteractionBudgetWarnings(scenarioReports) {
  const warnings = []
  for (const [scenarioId, report] of Object.entries(scenarioReports)) {
    if (!scenarioId.startsWith("interaction-")) {
      continue
    }
    const diagnostics = report.aggregate.interactionDiagnostics
    addWarningIfAbove(
      warnings,
      `${scenarioId} interactionPreview p95`,
      diagnostics.previewP95Ms.p95,
      PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} interactionAutoScroll p95`,
      diagnostics.autoScrollP95Ms.p95,
      PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} stageFocusRestore max`,
      diagnostics.focusRestoreMaxMs.max,
      PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} scroll sync drift`,
      diagnostics.scrollSyncDriftPx.max,
      PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX,
    )
    const skipped = report.sessions.flatMap(session => session.interactionDiagnostics?.skipped ?? [])
    for (const reason of skipped) {
      warnings.push(`${scenarioId} skipped ${reason}`)
    }
  }
  return warnings
}

const startedAt = performance.now()

console.log("\nAffino DataGrid Enterprise Browser Frame Benchmark")
console.log(
  `baseUrl=${BENCH_BROWSER_BASE_URL} route=${BENCH_BROWSER_ROUTE} sessions=${BENCH_BROWSER_SESSIONS} rows=${BENCH_BROWSER_ROW_COUNT} columns=${BENCH_BROWSER_COLUMN_COUNT} deviceProfile=${BENCH_INTERACTION_DEVICE_PROFILE}`,
)

const sandboxServer = await ensureSandboxServer(BENCH_BROWSER_BASE_URL, BENCH_BROWSER_ROUTE, "enterprise-browser-frames")

const browser = await chromium.launch({
  headless: BENCH_BROWSER_HEADLESS,
  args: ["--disable-dev-shm-usage"],
})

const context = await browser.newContext(interactionDeviceProfile.context)

const sessions = []
const setup = []

try {
  for (let session = 0; session < BENCH_BROWSER_SESSIONS; session += 1) {
    for (const scenario of SCENARIOS) {
      console.log(
        `[enterprise-browser-frames] scenario=${scenario.id} session ${session + 1}/${BENCH_BROWSER_SESSIONS}...`,
      )
      const page = await context.newPage()
      await page.goto(buildScenarioUrl(scenario), {
        waitUntil: "networkidle",
        timeout: 120000,
      })
      await page.waitForSelector(BENCH_VIEWPORT_SELECTOR, { timeout: 30000 })
      const setupResult = await configureSandbox(page)
      setup.push({ scenario: scenario.id, session: session + 1, ...setupResult })
      await page.waitForTimeout(240)
      const metrics = await runScenario(page, session, scenario)
      sessions.push(metrics)
      await page.close()
    }
  }
} finally {
  await context.close()
  await browser.close()
  await sandboxServer.stop()
}

const elapsedMs = performance.now() - startedAt
const scenarioReports = buildScenarioSummary(sessions)
const budgetWarnings = buildInteractionBudgetWarnings(scenarioReports)
const budgetErrors = BENCH_INTERACTION_FAIL_ON_WARNINGS ? [...budgetWarnings] : []
const aggregate = {
  elapsedMs,
  ...aggregateRuns(sessions),
  worstScenarioByFrameP95: resolveWorstScenario(scenarioReports),
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
    smoothScrollSteps: BENCH_BROWSER_SMOOTH_SCROLL_STEPS,
    smoothScrollDeltaPx: BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX,
    smoothFrameDelayMs: BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS,
    horizontalSteps: BENCH_BROWSER_HORIZONTAL_STEPS,
    stepDelayMs: BENCH_BROWSER_STEP_DELAY_MS,
    cellUpdateBurst: BENCH_BROWSER_CELL_UPDATE_BURST,
    enableFilter: BENCH_ENABLE_FILTER,
    enableSort: BENCH_ENABLE_SORT,
    enableCellUpdates: BENCH_ENABLE_CELL_UPDATES,
    interactionDeviceProfile: BENCH_INTERACTION_DEVICE_PROFILE,
    interactionDeviceProfileDescription: interactionDeviceProfile.description,
    browserContext: interactionDeviceProfile.context,
    interactionFailOnWarnings: BENCH_INTERACTION_FAIL_ON_WARNINGS,
    interactionBudgets: {
      previewP95Ms: PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS,
      autoScrollP95Ms: PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS,
      focusRestoreMaxMs: PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS,
      scrollSyncDriftPx: PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX,
    },
    headless: BENCH_BROWSER_HEADLESS,
    scenarios: SCENARIOS.map(scenario => scenario.id),
  },
  setup,
  aggregate,
  scenarios: scenarioReports,
  sessions,
  budgetWarnings,
  budgetErrors,
  ok: budgetErrors.length === 0,
}

mkdirSync(dirname(BENCH_OUTPUT_JSON), { recursive: true })
writeFileSync(BENCH_OUTPUT_JSON, JSON.stringify(summary, null, 2))

console.log(`\nBenchmark summary written: ${BENCH_OUTPUT_JSON}`)
console.log(
  `frame p50=${aggregate.frameP50Ms.p50.toFixed(3)}ms p95=${aggregate.frameP95Ms.p50.toFixed(3)}ms p99=${aggregate.frameP99Ms.p50.toFixed(3)}ms fps p50=${aggregate.fps.p50.toFixed(2)} dropped p95=${aggregate.droppedFramePct.p95.toFixed(2)}%`,
)
for (const scenario of SCENARIOS) {
  const report = scenarioReports[scenario.id]
  console.log(
    `${scenario.id}: frame p50=${report.aggregate.frameP50Ms.p50.toFixed(3)}ms p95=${report.aggregate.frameP95Ms.p50.toFixed(3)}ms p99=${report.aggregate.frameP99Ms.p50.toFixed(3)}ms fps p50=${report.aggregate.fps.p50.toFixed(2)} dropped p95=${report.aggregate.droppedFramePct.p95.toFixed(2)}%`,
  )
}
if (budgetWarnings.length > 0) {
  console.warn("\nInteraction performance warnings:")
  for (const warning of budgetWarnings) {
    console.warn(`- ${warning}`)
  }
}
if (budgetErrors.length > 0) {
  process.exitCode = 1
}
