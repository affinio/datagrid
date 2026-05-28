#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { basename } from "node:path"

const [baselinePath, candidatePath, ...requestedScenarios] = process.argv.slice(2)

function printUsage() {
  console.error("Usage: node scripts/compare-datagrid-enterprise-browser-frames.mjs <baseline.json> <candidate.json> [scenario ...]")
}

if (!baselinePath || !candidatePath) {
  printUsage()
  process.exit(2)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function readStat(value, field = "p95") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (value && typeof value === "object") {
    const nested = value[field]
    if (typeof nested === "number" && Number.isFinite(nested)) {
      return nested
    }
  }
  return null
}

function readPath(object, path, field = "p95") {
  let value = object
  for (const segment of path) {
    if (!value || typeof value !== "object") {
      return null
    }
    value = value[segment]
  }
  return readStat(value, field)
}

const metrics = [
  { label: "frameP95", path: ["frameP95Ms"] },
  { label: "frameP99", path: ["frameP99Ms"] },
  { label: "droppedPct", path: ["droppedFramePct"] },
  { label: "longTasks", path: ["longTaskCount"] },
  { label: "longTaskTotal", path: ["longTaskTotalMs"] },
  { label: "windowFlushP95", path: ["stageWindowFlushTelemetry", "totalMsP95"] },
  { label: "windowFlushMax", path: ["stageWindowFlushTelemetry", "totalMsMax"] },
  { label: "rowMount/write", path: ["churnTelemetry", "rowMountsPerScrollWrite"] },
  { label: "cellMount/write", path: ["churnTelemetry", "cellMountsPerScrollWrite"] },
  { label: "blankViewport", path: ["virtualizationTelemetry", "blankViewportCount"] },
]

function scenarioAggregate(report, scenarioId) {
  const scenario = report.scenarios?.[scenarioId]
  return scenario?.aggregate ?? null
}

function formatValue(value) {
  if (value == null) {
    return "n/a"
  }
  if (Math.abs(value) >= 100) {
    return value.toFixed(2)
  }
  if (Math.abs(value) >= 10) {
    return value.toFixed(3)
  }
  return value.toFixed(4)
}

function formatDelta(baseline, candidate) {
  if (baseline == null || candidate == null) {
    return "n/a"
  }
  const delta = candidate - baseline
  if (baseline === 0) {
    return (delta >= 0 ? "+" : "") + formatValue(delta)
  }
  const pct = (delta / Math.abs(baseline)) * 100
  return (delta >= 0 ? "+" : "") + formatValue(delta) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%)"
}

function resolveScenarios(baseline, candidate) {
  if (requestedScenarios.length > 0) {
    return requestedScenarios
  }
  const baselineScenarios = new Set(Object.keys(baseline.scenarios ?? {}))
  return Object.keys(candidate.scenarios ?? {}).filter(scenario => baselineScenarios.has(scenario))
}

const baseline = readJson(baselinePath)
const candidate = readJson(candidatePath)
const scenarios = resolveScenarios(baseline, candidate)
const failOnRegression = (process.env.COMPARE_FAIL_ON_REGRESSION ?? "false").toLowerCase() === "true"
const maxRelativeRegressionPct = Number.parseFloat(process.env.COMPARE_MAX_RELATIVE_REGRESSION_PCT ?? "10")
const maxAbsoluteRegression = Number.parseFloat(process.env.COMPARE_MAX_ABSOLUTE_REGRESSION ?? "0.5")
const failures = []

console.log("DataGrid enterprise browser-frame comparison: " + basename(baselinePath) + " -> " + basename(candidatePath))

for (const scenario of scenarios) {
  const baselineAggregate = scenarioAggregate(baseline, scenario)
  const candidateAggregate = scenarioAggregate(candidate, scenario)
  if (!baselineAggregate || !candidateAggregate) {
    console.log("\n## " + scenario + "\nmissing scenario in one artifact")
    continue
  }

  console.log("\n## " + scenario)
  console.log("| metric | baseline | candidate | delta |")
  console.log("| --- | ---: | ---: | ---: |")

  for (const metric of metrics) {
    const baselineValue = readPath(baselineAggregate, metric.path)
    const candidateValue = readPath(candidateAggregate, metric.path)
    console.log("| " + metric.label + " | " + formatValue(baselineValue) + " | " + formatValue(candidateValue) + " | " + formatDelta(baselineValue, candidateValue) + " |")

    if (!failOnRegression || baselineValue == null || candidateValue == null) {
      continue
    }
    const allowed = baselineValue === 0
      ? baselineValue + maxAbsoluteRegression
      : baselineValue * (1 + maxRelativeRegressionPct / 100)
    if (candidateValue > allowed) {
      failures.push(
        scenario + " " + metric.label + ": " + formatValue(candidateValue) + " > allowed " + formatValue(allowed) + " (baseline " + formatValue(baselineValue) + ")",
      )
    }
  }
}

if (failures.length > 0) {
  console.error("\nRegressions over threshold:")
  for (const failure of failures) {
    console.error("- " + failure)
  }
  process.exit(1)
}
