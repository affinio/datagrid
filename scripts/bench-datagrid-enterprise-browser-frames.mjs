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
const BENCH_BROWSER_WIDE_ROW_COUNT = intEnv("BENCH_BROWSER_WIDE_ROW_COUNT", BENCH_BROWSER_ROW_COUNT)
const BENCH_BROWSER_WIDE_ROW_SCENARIOS = parseCsvEnv("BENCH_BROWSER_WIDE_ROW_SCENARIOS")
const BENCH_BROWSER_COLUMN_COUNT = intEnv("BENCH_BROWSER_COLUMN_COUNT", 32)
const BENCH_BROWSER_WIDE_COLUMN_COUNT = intEnv("BENCH_BROWSER_WIDE_COLUMN_COUNT", BENCH_BROWSER_COLUMN_COUNT)
const BENCH_BROWSER_WIDE_COLUMN_SCENARIOS = parseCsvEnv("BENCH_BROWSER_WIDE_COLUMN_SCENARIOS")
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
const BENCH_BROWSER_SCENARIO_FILTER = parseCsvEnv("BENCH_BROWSER_SCENARIOS")
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
const BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS = boolEnv(
  "BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS",
  false,
)
const BENCH_RENDERING_FAIL_ON_WARNINGS = boolEnv(
  "BENCH_RENDERING_FAIL_ON_WARNINGS",
  false,
)
const PERF_BUDGET_MAX_VARIANCE_PCT = floatEnv("PERF_BUDGET_MAX_VARIANCE_PCT", 999999)
const PERF_BUDGET_MAX_HEAP_DELTA_MB = floatEnv("PERF_BUDGET_MAX_HEAP_DELTA_MB", 999999)
const PERF_BUDGET_MAX_FRAME_P95_MS = floatEnv("PERF_BUDGET_MAX_FRAME_P95_MS", 120)
const PERF_BUDGET_MAX_DROPPED_FRAME_PCT = floatEnv("PERF_BUDGET_MAX_DROPPED_FRAME_PCT", 80)
const PERF_BUDGET_MAX_LONG_TASK_COUNT = floatEnv("PERF_BUDGET_MAX_LONG_TASK_COUNT", 999999)
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
const PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS = floatEnv(
  "PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS",
  180,
)
const PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS = floatEnv(
  "PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS",
  10,
)
const PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95 = floatEnv(
  "PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95",
  180,
)
const PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95 = floatEnv(
  "PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95",
  160,
)
const PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS = floatEnv(
  "PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS",
  0,
)
const PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS = floatEnv(
  "PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS",
  220,
)
const PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE = floatEnv(
  "PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE",
  999999,
)
const PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE = floatEnv(
  "PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE",
  999999,
)
const PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE = floatEnv(
  "PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE",
  999999,
)
const PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE = floatEnv(
  "PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE",
  999999,
)

const ALL_SCENARIOS = [
  {
    id: "vertical-scroll-only",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
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
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
    horizontalScroll: true,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "rendering-plain-100k",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
    renderingTelemetryRequired: true,
    horizontalScroll: false,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "rendering-slow-custom-renderers",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
    renderingTelemetryRequired: true,
    cellRendererTelemetryRequired: true,
    renderProfile: "slow-custom-renderers",
    horizontalScroll: false,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "rendering-wide-pinned-horizontal",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
    renderingTelemetryRequired: true,
    pinnedColumnTelemetryRequired: true,
    pinnedProfile: "wide-pinned",
    horizontalScroll: true,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "rendering-auto-height-custom-renderers",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
    renderingTelemetryRequired: true,
    cellRendererTelemetryRequired: true,
    renderProfile: "slow-custom-renderers",
    rowHeightMode: "auto",
    horizontalScroll: false,
    filter: false,
    sort: false,
    cellUpdates: false,
  },
  {
    id: "rendering-overlay-heavy-selection-fill",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
    renderingTelemetryRequired: true,
    overlayTelemetryRequired: true,
    customOverlayTelemetryRequired: true,
    selectionOverlayTelemetryRequired: true,
    fillOverlayTelemetryRequired: true,
    renderProfile: "overlay-heavy",
    overlayStress: true,
    horizontalScroll: false,
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
    id: "server-datasource-placeholder-scroll",
    route: "/vue/server-data-source-grid?datasource=fake",
    verticalScroll: true,
    verticalSmoothScroll: false,
    verticalDiagnostics: true,
    virtualizationTelemetryRequired: true,
    datasourcePlaceholderDiagnostics: true,
    horizontalScroll: false,
    filter: false,
    sort: false,
    cellUpdates: false,
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
const SCENARIOS = BENCH_BROWSER_SCENARIO_FILTER.length > 0
  ? ALL_SCENARIOS.filter(scenario => BENCH_BROWSER_SCENARIO_FILTER.includes(scenario.id))
  : ALL_SCENARIOS
if (SCENARIOS.length === 0) {
  throw new Error(
    `BENCH_BROWSER_SCENARIOS did not match any scenario. Available: ${ALL_SCENARIOS.map(scenario => scenario.id).join(", ")}`,
  )
}

assertPositiveInteger(BENCH_BROWSER_SESSIONS, "BENCH_BROWSER_SESSIONS")
assertPositiveInteger(BENCH_BROWSER_ROW_COUNT, "BENCH_BROWSER_ROW_COUNT")
assertPositiveInteger(BENCH_BROWSER_WIDE_ROW_COUNT, "BENCH_BROWSER_WIDE_ROW_COUNT")
assertPositiveInteger(BENCH_BROWSER_COLUMN_COUNT, "BENCH_BROWSER_COLUMN_COUNT")
assertPositiveInteger(BENCH_BROWSER_WIDE_COLUMN_COUNT, "BENCH_BROWSER_WIDE_COLUMN_COUNT")
assertPositiveInteger(BENCH_BROWSER_SCROLL_STEPS, "BENCH_BROWSER_SCROLL_STEPS")
assertPositiveInteger(BENCH_BROWSER_SMOOTH_SCROLL_STEPS, "BENCH_BROWSER_SMOOTH_SCROLL_STEPS")
assertPositiveInteger(BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX, "BENCH_BROWSER_SMOOTH_SCROLL_DELTA_PX")
assertPositiveInteger(BENCH_BROWSER_HORIZONTAL_STEPS, "BENCH_BROWSER_HORIZONTAL_STEPS")
assertPositiveInteger(BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS, "BENCH_BROWSER_SMOOTH_FRAME_DELAY_MS")
assertPositiveInteger(BENCH_BROWSER_STEP_DELAY_MS, "BENCH_BROWSER_STEP_DELAY_MS")
assertNonNegativeInteger(BENCH_BROWSER_CELL_UPDATE_BURST, "BENCH_BROWSER_CELL_UPDATE_BURST")
for (const [value, label] of [
  [PERF_BUDGET_MAX_VARIANCE_PCT, "PERF_BUDGET_MAX_VARIANCE_PCT"],
  [PERF_BUDGET_MAX_HEAP_DELTA_MB, "PERF_BUDGET_MAX_HEAP_DELTA_MB"],
  [PERF_BUDGET_MAX_FRAME_P95_MS, "PERF_BUDGET_MAX_FRAME_P95_MS"],
  [PERF_BUDGET_MAX_DROPPED_FRAME_PCT, "PERF_BUDGET_MAX_DROPPED_FRAME_PCT"],
  [PERF_BUDGET_MAX_LONG_TASK_COUNT, "PERF_BUDGET_MAX_LONG_TASK_COUNT"],
  [PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS, "PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS"],
  [PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS, "PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS"],
  [PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS, "PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS"],
  [PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX, "PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX"],
  [PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS, "PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS"],
  [PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS, "PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS"],
  [PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95, "PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95"],
  [PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95, "PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95"],
  [PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS, "PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS"],
  [PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS, "PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS"],
  [PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE, "PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE"],
  [PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE, "PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE"],
  [PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE, "PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE"],
  [PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE, "PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE"],
]) {
  if (value < 0) {
    throw new Error(`${label} must be non-negative`)
  }
}

function parseCsvEnv(name) {
  return String(process.env[name] ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
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
  if (scenario.renderProfile) {
    url.searchParams.set("renderProfile", scenario.renderProfile)
  }
  if (scenario.pinnedProfile) {
    url.searchParams.set("pinnedProfile", scenario.pinnedProfile)
  }
  return url.toString()
}

function resolveScenarioColumnCount(scenario) {
  return BENCH_BROWSER_WIDE_COLUMN_SCENARIOS.includes(scenario.id)
    ? BENCH_BROWSER_WIDE_COLUMN_COUNT
    : BENCH_BROWSER_COLUMN_COUNT
}

function resolveScenarioRowCount(scenario) {
  return BENCH_BROWSER_WIDE_ROW_SCENARIOS.includes(scenario.id)
    ? BENCH_BROWSER_WIDE_ROW_COUNT
    : BENCH_BROWSER_ROW_COUNT
}

async function configureSandbox(page, config) {
  return await page.evaluate(({ rowCount, columnCount, rowHeightMode }) => {
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
      rowMode: selectValueByLabel(/^(\s*)Row mode\b/i, rowHeightMode),
    }
  }, config)
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
    const readDatasourcePlaceholderDiagnostics = () => {
      if (!input.scenario.datasourcePlaceholderDiagnostics) {
        return null
      }
      const element = document.querySelector("[data-datagrid-server-placeholder-exposure]")
      if (!(element instanceof HTMLElement)) {
        return null
      }
      const readNumber = (name) => {
        const value = Number(element.dataset[name] ?? "0")
        return Number.isFinite(value) ? value : 0
      }
      return {
        activeRows: readNumber("activeRows"),
        events: readNumber("events"),
        totalMs: readNumber("totalMs"),
        maxMs: readNumber("maxMs"),
        viewportAvailabilityMs: readNumber("viewportAvailabilityMs"),
        blankViewportActive: readNumber("blankViewportActive"),
        blankViewportEvents: readNumber("blankViewportEvents"),
        cacheHitRatio: readNumber("cacheHitRatio"),
        cacheMissRows: readNumber("cacheMissRows"),
        pullDurationMs: readNumber("pullDurationMs"),
        pullDurationMaxMs: readNumber("pullDurationMaxMs"),
      }
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

    if (input.scenario.datasourcePlaceholderDiagnostics) {
      const slowBackendButton = Array.from(document.querySelectorAll("button"))
        .find(button => button.textContent?.trim() === "Slow backend")
      slowBackendButton?.click()
      await waitForPaint()
    }

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

    const runOverlayStress = async () => {
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
      const bodyCells = Array.from(
        document.querySelectorAll(".grid-body-viewport .grid-cell"),
      ).filter(candidate => candidate instanceof HTMLElement)
      const sourceCell = document.querySelector('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-key="name"]')
        ?? bodyCells[0]
      const targetCell = bodyCells[Math.min(bodyCells.length - 1, 18)]
      if (sourceCell instanceof HTMLElement && targetCell instanceof HTMLElement) {
        dispatchElementMouse(sourceCell, "mousedown", elementCenter(sourceCell))
        dispatchWindowMouse("mousemove", elementCenter(targetCell), { buttons: 1 })
        await waitForPaint()
        captureTelemetry("overlay-stress:selection-preview")
        dispatchWindowMouse("mouseup", elementCenter(targetCell))
        await waitForPaint()
        captureTelemetry("overlay-stress:selection")
      } else {
        interactions.skipped.push("overlay-stress:no-selection-cells")
      }

      const amountCell = document.querySelector('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]')
      if (amountCell instanceof HTMLElement) {
        const point = elementCenter(amountCell)
        dispatchElementMouse(amountCell, "mousedown", point)
        dispatchWindowMouse("mouseup", point)
        amountCell.click()
        await waitForPaint()
      }
      await waitForCondition(() => document.querySelector(".cell-fill-handle") != null, 1500)
      const fillHandle = document.querySelector(".cell-fill-handle")
      if (fillHandle instanceof HTMLElement) {
        const handlePoint = elementCenter(fillHandle)
        const rect = viewport.getBoundingClientRect()
        const targetPoint = {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.bottom - 6),
        }
        dispatchElementMouse(fillHandle, "mousedown", handlePoint)
        dispatchWindowMouse("mousemove", targetPoint, { buttons: 1 })
        await waitForPaint()
        captureTelemetry("overlay-stress:fill-preview")
        dispatchWindowMouse("mouseup", targetPoint)
        await waitForPaint()
      } else {
        interactions.skipped.push("overlay-stress:no-fill-handle")
      }
    }

    if (input.scenario.overlayStress) {
      await runOverlayStress()
      captureRenderedSnapshot("overlay-stress")
    }

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
      verticalDiagnostics.churnTelemetry = {
        scrollWriteCount: verticalDiagnostics.scrollWrites.length,
        mutationCallbackCount: verticalDiagnostics.mutationSummary.callbackCount,
        childListMutationCount: verticalDiagnostics.mutationSummary.childListMutations,
        rowMountCount: verticalDiagnostics.mutationSummary.addedRowNodes,
        rowUnmountCount: verticalDiagnostics.mutationSummary.removedRowNodes,
        cellMountCount: verticalDiagnostics.mutationSummary.addedCellNodes,
        cellUnmountCount: verticalDiagnostics.mutationSummary.removedCellNodes,
        rowMountsPerScrollWrite: verticalDiagnostics.summary.addedRowsPerWrite,
        rowUnmountsPerScrollWrite: verticalDiagnostics.summary.removedRowsPerWrite,
        cellMountsPerScrollWrite: verticalDiagnostics.summary.addedCellsPerWrite,
        cellUnmountsPerScrollWrite: verticalDiagnostics.summary.removedCellsPerWrite,
      }
      const dataGridPerfStore = resolveDataGridPerfStore()
      verticalDiagnostics.appPerf = dataGridPerfStore
        ? {
            samples: Array.isArray(dataGridPerfStore.samples) ? dataGridPerfStore.samples.slice() : [],
            summary: typeof dataGridPerfStore.summary === "function" ? dataGridPerfStore.summary() : [],
          }
        : null
      const viewportPerfSamples = (verticalDiagnostics.appPerf?.samples ?? [])
        .filter(sample => sample?.scope === "viewportRaf")
      const renderWindowPerfSamples = (verticalDiagnostics.appPerf?.samples ?? [])
        .filter(sample => sample?.scope === "stageRenderWindow")
      const cellRendererPerfSamples = (verticalDiagnostics.appPerf?.samples ?? [])
        .filter(sample => sample?.scope === "cellRenderer")
      const groupCellRendererPerfSamples = (verticalDiagnostics.appPerf?.samples ?? [])
        .filter(sample => sample?.scope === "groupCellRenderer")
      const chromeDrawPerfSamples = (verticalDiagnostics.appPerf?.samples ?? [])
        .filter(sample => sample?.scope === "chromeDraw")
      const overlayComputePerfSamples = (verticalDiagnostics.appPerf?.samples ?? [])
        .filter(sample => sample?.scope === "overlayCompute")
      verticalDiagnostics.virtualizationTelemetry = {
        sampleCount: viewportPerfSamples.length,
        latest: viewportPerfSamples[viewportPerfSamples.length - 1] ?? null,
        renderedRows: summarizeNumbers(viewportPerfSamples.map(sample => sample.renderedRows)),
        renderedColumns: summarizeNumbers(viewportPerfSamples.map(sample => sample.renderedColumns)),
        rangeResolveMs: summarizeNumbers(viewportPerfSamples.map(sample => sample.rangeResolveMs)),
        viewportUpdateMs: summarizeNumbers(viewportPerfSamples.map(sample => sample.totalMs)),
        rowOverscan: summarizeNumbers(viewportPerfSamples.map(sample => sample.effectiveRowOverscan)),
        columnOverscan: summarizeNumbers(viewportPerfSamples.map(sample => sample.columnOverscan)),
        placeholderRows: summarizeNumbers(viewportPerfSamples.map(sample => sample.placeholderRows)),
        blankViewportCount: viewportPerfSamples
          .filter(sample => sample?.blankViewport === 1)
          .length,
        longTaskCount: longTaskEntries.length,
        placeholderExposure: readDatasourcePlaceholderDiagnostics(),
      }
      verticalDiagnostics.renderTelemetry = {
        renderWindowSampleCount: renderWindowPerfSamples.length,
        latestRenderWindow: renderWindowPerfSamples[renderWindowPerfSamples.length - 1] ?? null,
        rowNodeCount: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.rowNodeCount)),
        cellNodeCount: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.cellNodeCount)),
        cellSurfaceCount: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.cellSurfaceCount)),
        centerColumnCount: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.centerColumnCount)),
        pinnedColumnCount: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.pinnedColumnCount)),
        placeholderRows: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.placeholderRowCount)),
        selectionSegments: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.selectionSegmentCount)),
        overlayLanes: summarizeNumbers(renderWindowPerfSamples.map(sample => sample.overlayLaneCount)),
        cellRendererInvocationCount: cellRendererPerfSamples.length,
        groupCellRendererInvocationCount: groupCellRendererPerfSamples.length,
        cellRendererDurationMs: summarizeNumbers(cellRendererPerfSamples.map(sample => sample.totalMs)),
        groupCellRendererDurationMs: summarizeNumbers(groupCellRendererPerfSamples.map(sample => sample.totalMs)),
      }
      verticalDiagnostics.chromeTelemetry = {
        drawSampleCount: chromeDrawPerfSamples.length,
        latestDraw: chromeDrawPerfSamples[chromeDrawPerfSamples.length - 1] ?? null,
        drawDurationMs: summarizeNumbers(chromeDrawPerfSamples.map(sample => sample.totalMs)),
        drawnPaneCount: summarizeNumbers(chromeDrawPerfSamples.map(sample => sample.drawnPaneCount)),
        bodyLineCount: summarizeNumbers(chromeDrawPerfSamples.map(sample => sample.bodyLineCount)),
        headerLineCount: summarizeNumbers(chromeDrawPerfSamples.map(sample => sample.headerLineCount)),
        pinnedBottomLineCount: summarizeNumbers(chromeDrawPerfSamples.map(sample => sample.pinnedBottomLineCount)),
        bodyBandCount: summarizeNumbers(chromeDrawPerfSamples.map(sample => sample.bodyBandCount)),
        pinnedBottomBandCount: summarizeNumbers(chromeDrawPerfSamples.map(sample => sample.pinnedBottomBandCount)),
      }
      verticalDiagnostics.overlayTelemetry = {
        computeSampleCount: overlayComputePerfSamples.length,
        latestCompute: overlayComputePerfSamples[overlayComputePerfSamples.length - 1] ?? null,
        computeDurationMs: summarizeNumbers(overlayComputePerfSamples.map(sample => sample.totalMs)),
        segmentCount: summarizeNumbers(overlayComputePerfSamples.map(sample => sample.segmentCount)),
        laneCount: summarizeNumbers(overlayComputePerfSamples.map(sample => sample.laneCount)),
        selectionSegmentCount: summarizeNumbers(overlayComputePerfSamples
          .filter(sample => sample.overlayKind === "selection")
          .map(sample => sample.segmentCount)),
        fillPreviewSegmentCount: summarizeNumbers(overlayComputePerfSamples
          .filter(sample => sample.overlayKind === "fill-preview")
          .map(sample => sample.segmentCount)),
        movePreviewSegmentCount: summarizeNumbers(overlayComputePerfSamples
          .filter(sample => sample.overlayKind === "move-preview")
          .map(sample => sample.segmentCount)),
        customOverlaySegmentCount: summarizeNumbers(overlayComputePerfSamples
          .filter(sample => sample.overlayKind === "custom")
          .map(sample => sample.segmentCount)),
        customOverlayCount: summarizeNumbers(overlayComputePerfSamples.map(sample => sample.customOverlayCount)),
      }
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
      datasourcePlaceholderDiagnostics: readDatasourcePlaceholderDiagnostics(),
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
    datasourcePlaceholderDiagnostics: result.datasourcePlaceholderDiagnostics,
  }
}

function aggregateRuns(runs) {
  const verticalDiagnosticsRuns = runs.map(run => run.verticalDiagnostics).filter(Boolean)
  const sortDiagnosticsRuns = runs.map(run => run.sortDiagnostics).filter(Boolean)
  const interactionDiagnosticsRuns = runs.map(run => run.interactionDiagnostics).filter(Boolean)
  const datasourcePlaceholderRuns = runs.map(run => run.datasourcePlaceholderDiagnostics).filter(Boolean)
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
    virtualizationTelemetry: {
      sampleCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.sampleCount)),
      renderedRows: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.renderedRows?.p95)),
      renderedColumns: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.renderedColumns?.p95)),
      rangeResolveMs: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.rangeResolveMs?.p95)),
      viewportUpdateMs: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.viewportUpdateMs?.p95)),
      rowOverscan: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.rowOverscan?.max)),
      columnOverscan: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.columnOverscan?.max)),
      placeholderRows: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.placeholderRows?.max)),
      blankViewportCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.blankViewportCount)),
      longTaskCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.virtualizationTelemetry?.longTaskCount)),
    },
    renderTelemetry: {
      renderWindowSampleCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.renderWindowSampleCount)),
      rowNodeCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.rowNodeCount?.p95)),
      cellNodeCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.cellNodeCount?.p95)),
      cellSurfaceCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.cellSurfaceCount?.p95)),
      centerColumnCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.centerColumnCount?.p95)),
      pinnedColumnCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.pinnedColumnCount?.p95)),
      placeholderRows: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.placeholderRows?.max)),
      selectionSegments: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.selectionSegments?.p95)),
      overlayLanes: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.overlayLanes?.p95)),
      cellRendererInvocationCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.cellRendererInvocationCount)),
      groupCellRendererInvocationCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.groupCellRendererInvocationCount)),
      cellRendererDurationMs: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.cellRendererDurationMs?.p95)),
      groupCellRendererDurationMs: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.renderTelemetry?.groupCellRendererDurationMs?.p95)),
    },
    churnTelemetry: {
      scrollWriteCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.scrollWriteCount)),
      mutationCallbackCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.mutationCallbackCount)),
      childListMutationCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.childListMutationCount)),
      rowMountCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.rowMountCount)),
      rowUnmountCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.rowUnmountCount)),
      cellMountCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.cellMountCount)),
      cellUnmountCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.cellUnmountCount)),
      rowMountsPerScrollWrite: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.rowMountsPerScrollWrite)),
      rowUnmountsPerScrollWrite: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.rowUnmountsPerScrollWrite)),
      cellMountsPerScrollWrite: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.cellMountsPerScrollWrite)),
      cellUnmountsPerScrollWrite: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.churnTelemetry?.cellUnmountsPerScrollWrite)),
    },
    chromeTelemetry: {
      drawSampleCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.drawSampleCount)),
      drawDurationMs: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.drawDurationMs?.p95)),
      drawnPaneCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.drawnPaneCount?.p95)),
      bodyLineCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.bodyLineCount?.p95)),
      headerLineCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.headerLineCount?.p95)),
      pinnedBottomLineCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.pinnedBottomLineCount?.p95)),
      bodyBandCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.bodyBandCount?.p95)),
      pinnedBottomBandCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.chromeTelemetry?.pinnedBottomBandCount?.p95)),
    },
    overlayTelemetry: {
      computeSampleCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.computeSampleCount)),
      computeDurationMs: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.computeDurationMs?.p95)),
      segmentCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.segmentCount?.p95)),
      laneCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.laneCount?.p95)),
      selectionSegmentCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.selectionSegmentCount?.p95)),
      fillPreviewSegmentCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.fillPreviewSegmentCount?.p95)),
      movePreviewSegmentCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.movePreviewSegmentCount?.p95)),
      customOverlaySegmentCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.customOverlaySegmentCount?.p95)),
      customOverlayCount: stats(verticalDiagnosticsRuns.map(diagnostics => diagnostics.overlayTelemetry?.customOverlayCount?.max)),
    },
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
    datasourcePlaceholderDiagnostics: {
      events: stats(datasourcePlaceholderRuns.map(diagnostics => diagnostics.events)),
      maxMs: stats(datasourcePlaceholderRuns.map(diagnostics => diagnostics.maxMs)),
      viewportAvailabilityMs: stats(datasourcePlaceholderRuns.map(diagnostics => diagnostics.viewportAvailabilityMs)),
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

function buildVirtualizationBudgetWarnings(scenarioReports) {
  const warnings = []
  for (const [scenarioId, report] of Object.entries(scenarioReports)) {
    const diagnostics = report.aggregate.virtualizationTelemetry
    if (!diagnostics || diagnostics.sampleCount.max <= 0) {
      continue
    }
    addWarningIfAbove(
      warnings,
      `${scenarioId} virtualization viewport update p95`,
      diagnostics.viewportUpdateMs.p95,
      PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} virtualization range resolve p95`,
      diagnostics.rangeResolveMs.p95,
      PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} virtualization rendered rows p95`,
      diagnostics.renderedRows.p95,
      PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} virtualization rendered columns p95`,
      diagnostics.renderedColumns.p95,
      PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} virtualization placeholder rows max`,
      diagnostics.placeholderRows.max,
      PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} virtualization blank viewport count`,
      diagnostics.blankViewportCount.max,
      PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS,
    )
  }
  for (const scenario of SCENARIOS) {
    if (!scenario.virtualizationTelemetryRequired) {
      continue
    }
    const diagnostics = scenarioReports[scenario.id]?.aggregate?.virtualizationTelemetry
    if (!diagnostics || diagnostics.sampleCount.max <= 0) {
      warnings.push(`${scenario.id} virtualization telemetry produced no viewport samples`)
    }
  }
  return warnings
}

function buildRenderChurnBudgetWarnings(scenarioReports) {
  const warnings = []
  for (const [scenarioId, report] of Object.entries(scenarioReports)) {
    const diagnostics = report.aggregate.churnTelemetry
    if (!diagnostics || diagnostics.scrollWriteCount.max <= 0) {
      continue
    }
    addWarningIfAbove(
      warnings,
      `${scenarioId} render row mounts per scroll write`,
      diagnostics.rowMountsPerScrollWrite.p95,
      PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} render row unmounts per scroll write`,
      diagnostics.rowUnmountsPerScrollWrite.p95,
      PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} render cell mounts per scroll write`,
      diagnostics.cellMountsPerScrollWrite.p95,
      PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE,
    )
    addWarningIfAbove(
      warnings,
      `${scenarioId} render cell unmounts per scroll write`,
      diagnostics.cellUnmountsPerScrollWrite.p95,
      PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE,
    )
  }
  return warnings
}

function buildRenderingTelemetryWarnings(scenarioReports) {
  const warnings = []
  for (const scenario of SCENARIOS) {
    if (!scenario.renderingTelemetryRequired) {
      continue
    }
    const aggregate = scenarioReports[scenario.id]?.aggregate
    const renderTelemetry = aggregate?.renderTelemetry
    const chromeTelemetry = aggregate?.chromeTelemetry
    const overlayTelemetry = aggregate?.overlayTelemetry
    const hasRenderWindowTelemetry = (renderTelemetry?.renderWindowSampleCount?.max ?? 0) > 0
    const hasCellRendererTelemetry = (renderTelemetry?.cellRendererInvocationCount?.max ?? 0) > 0
    if (!hasRenderWindowTelemetry && !(scenario.cellRendererTelemetryRequired && hasCellRendererTelemetry)) {
      warnings.push(`${scenario.id} rendering telemetry produced no render-window samples`)
    }
    if (!chromeTelemetry || chromeTelemetry.drawSampleCount.max <= 0) {
      warnings.push(`${scenario.id} rendering telemetry produced no chrome draw samples`)
    }
    if (scenario.cellRendererTelemetryRequired && (renderTelemetry?.cellRendererInvocationCount?.max ?? 0) <= 0) {
      warnings.push(`${scenario.id} rendering telemetry produced no cell renderer samples`)
    }
    if (
      scenario.pinnedColumnTelemetryRequired
      && (renderTelemetry?.pinnedColumnCount?.max ?? 0) <= 0
      && (chromeTelemetry?.drawnPaneCount?.max ?? 0) <= 1
    ) {
      warnings.push(`${scenario.id} rendering telemetry produced no pinned pane samples`)
    }
    if (scenario.overlayTelemetryRequired && (overlayTelemetry?.computeSampleCount?.max ?? 0) <= 0) {
      warnings.push(`${scenario.id} overlay telemetry produced no compute samples`)
    }
    if (scenario.customOverlayTelemetryRequired && (overlayTelemetry?.customOverlayCount?.max ?? 0) <= 0) {
      warnings.push(`${scenario.id} overlay telemetry produced no custom overlay samples`)
    }
    if (scenario.selectionOverlayTelemetryRequired && (overlayTelemetry?.selectionSegmentCount?.max ?? 0) <= 0) {
      warnings.push(`${scenario.id} overlay telemetry produced no selection overlay segments`)
    }
    if (scenario.fillOverlayTelemetryRequired && (overlayTelemetry?.fillPreviewSegmentCount?.max ?? 0) <= 0) {
      warnings.push(`${scenario.id} overlay telemetry produced no fill preview segments`)
    }
  }
  return warnings
}

function buildBrowserResourceBudgetWarnings(aggregate) {
  const warnings = []
  addWarningIfAbove(warnings, "enterprise browser frame p95", aggregate.frameP95Ms.p95, PERF_BUDGET_MAX_FRAME_P95_MS)
  addWarningIfAbove(
    warnings,
    "enterprise browser dropped frame pct p95",
    aggregate.droppedFramePct.p95,
    PERF_BUDGET_MAX_DROPPED_FRAME_PCT,
  )
  addWarningIfAbove(warnings, "enterprise browser long task count p95", aggregate.longTaskCount.p95, PERF_BUDGET_MAX_LONG_TASK_COUNT)
  addWarningIfAbove(warnings, "enterprise browser heap delta p95", aggregate.heapDeltaMb.p95, PERF_BUDGET_MAX_HEAP_DELTA_MB)
  return warnings
}

const startedAt = performance.now()

console.log("\nAffino DataGrid Enterprise Browser Frame Benchmark")
console.log(
  `baseUrl=${BENCH_BROWSER_BASE_URL} route=${BENCH_BROWSER_ROUTE} sessions=${BENCH_BROWSER_SESSIONS} rows=${BENCH_BROWSER_ROW_COUNT} wideRows=${BENCH_BROWSER_WIDE_ROW_COUNT} columns=${BENCH_BROWSER_COLUMN_COUNT} wideColumns=${BENCH_BROWSER_WIDE_COLUMN_COUNT} deviceProfile=${BENCH_INTERACTION_DEVICE_PROFILE}`,
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
      const setupResult = await configureSandbox(page, {
        rowCount: resolveScenarioRowCount(scenario),
        columnCount: resolveScenarioColumnCount(scenario),
        rowHeightMode: scenario.rowHeightMode ?? "fixed",
      })
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
const interactionBudgetWarnings = buildInteractionBudgetWarnings(scenarioReports)
const virtualizationBudgetWarnings = buildVirtualizationBudgetWarnings(scenarioReports)
const renderChurnBudgetWarnings = buildRenderChurnBudgetWarnings(scenarioReports)
const renderingTelemetryWarnings = buildRenderingTelemetryWarnings(scenarioReports)
const budgetWarnings = [
  ...interactionBudgetWarnings,
  ...virtualizationBudgetWarnings,
  ...renderChurnBudgetWarnings,
  ...renderingTelemetryWarnings,
]
const budgetErrors = [
  ...(BENCH_INTERACTION_FAIL_ON_WARNINGS ? interactionBudgetWarnings : []),
  ...(BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS ? virtualizationBudgetWarnings : []),
  ...(BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS ? renderChurnBudgetWarnings : []),
  ...(BENCH_RENDERING_FAIL_ON_WARNINGS ? renderingTelemetryWarnings : []),
]
const aggregate = {
  elapsedMs,
  ...aggregateRuns(sessions),
  worstScenarioByFrameP95: resolveWorstScenario(scenarioReports),
}
const browserResourceBudgetWarnings = buildBrowserResourceBudgetWarnings(aggregate)
budgetWarnings.push(...browserResourceBudgetWarnings)
if (BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS) {
  budgetErrors.push(...browserResourceBudgetWarnings)
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
    wideRowCount: BENCH_BROWSER_WIDE_ROW_COUNT,
    wideRowScenarios: BENCH_BROWSER_WIDE_ROW_SCENARIOS,
    columnCount: BENCH_BROWSER_COLUMN_COUNT,
    wideColumnCount: BENCH_BROWSER_WIDE_COLUMN_COUNT,
    wideColumnScenarios: BENCH_BROWSER_WIDE_COLUMN_SCENARIOS,
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
    virtualizationFailOnWarnings: BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS,
    renderingFailOnWarnings: BENCH_RENDERING_FAIL_ON_WARNINGS,
    interactionBudgets: {
      previewP95Ms: PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS,
      autoScrollP95Ms: PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS,
      focusRestoreMaxMs: PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS,
      scrollSyncDriftPx: PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX,
    },
    virtualizationBudgets: {
      viewportUpdateP95Ms: PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS,
      rangeResolveP95Ms: PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS,
      renderedRowsP95: PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95,
      renderedColumnsP95: PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95,
      blankViewportCount: PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS,
      placeholderRows: PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS,
    },
    renderChurnBudgets: {
      rowMountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE,
      rowUnmountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE,
      cellMountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE,
      cellUnmountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE,
    },
    resourceBudgets: {
      frameP95Ms: PERF_BUDGET_MAX_FRAME_P95_MS,
      droppedFramePct: PERF_BUDGET_MAX_DROPPED_FRAME_PCT,
      longTaskCount: PERF_BUDGET_MAX_LONG_TASK_COUNT,
      heapDeltaMb: PERF_BUDGET_MAX_HEAP_DELTA_MB,
    },
    headless: BENCH_BROWSER_HEADLESS,
    scenarios: SCENARIOS.map(scenario => scenario.id),
  },
  budgets: {
    maxVariancePct: PERF_BUDGET_MAX_VARIANCE_PCT,
    maxHeapDeltaMb: PERF_BUDGET_MAX_HEAP_DELTA_MB,
    maxFrameP95Ms: PERF_BUDGET_MAX_FRAME_P95_MS,
    maxDroppedFramePct: PERF_BUDGET_MAX_DROPPED_FRAME_PCT,
    maxLongTaskCount: PERF_BUDGET_MAX_LONG_TASK_COUNT,
    interaction: {
      previewP95Ms: PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS,
      autoScrollP95Ms: PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS,
      focusRestoreMaxMs: PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS,
      scrollSyncDriftPx: PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX,
    },
    virtualization: {
      viewportUpdateP95Ms: PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS,
      rangeResolveP95Ms: PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS,
      renderedRowsP95: PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95,
      renderedColumnsP95: PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95,
      blankViewportCount: PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS,
      placeholderRows: PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS,
    },
    renderChurn: {
      rowMountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE,
      rowUnmountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE,
      cellMountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE,
      cellUnmountsPerScrollWrite: PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE,
    },
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
  console.warn("\nEnterprise browser frame performance warnings:")
  for (const warning of budgetWarnings) {
    console.warn(`- ${warning}`)
  }
}
if (budgetErrors.length > 0) {
  process.exitCode = 1
}
