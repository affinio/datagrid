#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"

const INPUT_CANDIDATES = [
  process.env.FORMULA_BENCH_INPUT,
  "artifacts/performance/bench-datagrid-formula-engine.assert.json",
  "artifacts/performance/bench-datagrid-formula-engine.json",
].filter(value => typeof value === "string" && value.trim().length > 0)
  .map(value => resolve(value))

const BASELINE_OUTPUT_PATH = resolve(
  process.env.FORMULA_BASELINE_OUTPUT ?? "docs/perf/datagrid-formula-engine-baseline.json",
)
const CHECK_MODE = process.argv.includes("--check")

function normalizePathForBaseline(path) {
  const rel = relative(process.cwd(), path)
  const normalized = rel.length > 0 ? rel : path
  return normalized.split("\\").join("/")
}

function resolveExistingInputPath() {
  for (const candidate of INPUT_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  throw new Error(
    `No formula benchmark summary found. Checked: ${INPUT_CANDIDATES.join(", ")}`,
  )
}

function readJson(path) {
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw)
}

function toFiniteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeScenarioBaseline(scenario) {
  const patch = Array.isArray(scenario?.patch) ? scenario.patch : []
  return {
    name: String(scenario?.name ?? "unknown"),
    config: {
      rows: toFiniteNumber(scenario?.config?.rows),
      formulas: toFiniteNumber(scenario?.config?.formulas),
      depth: toFiniteNumber(scenario?.config?.depth),
    },
    compileMeanMs: toFiniteNumber(scenario?.compileMs?.mean),
    initMeanMs: toFiniteNumber(scenario?.initMs?.mean),
    fullRecomputeP95Ms: toFiniteNumber(scenario?.fullRecomputeP95Ms?.p95),
    fullEvaluationsPerSecMean: toFiniteNumber(scenario?.fullEvaluationsPerSec?.mean),
    patch: patch.map(entry => ({
      patchSize: toFiniteNumber(entry?.patchSize),
      p95Ms: toFiniteNumber(entry?.p95AcrossRunsMs?.p95),
      evaluationsPerSecMean: toFiniteNumber(entry?.evaluationsPerSec?.mean),
    })).sort((left, right) => left.patchSize - right.patchSize),
  }
}

function createFormulaBaseline(summary, sourcePath) {
  const scenarios = Array.isArray(summary?.aggregate?.scenarios)
    ? summary.aggregate.scenarios.map(normalizeScenarioBaseline)
        .sort((left, right) => left.name.localeCompare(right.name))
    : []
  if (scenarios.length === 0) {
    throw new Error("Formula benchmark summary is missing aggregate scenario data.")
  }

  return {
    baselineSchemaVersion: 1,
    benchmark: "datagrid-formula-engine",
    generatedAt: typeof summary?.generatedAt === "string" ? summary.generatedAt : null,
    source: {
      file: normalizePathForBaseline(sourcePath),
      runGeneratedAt: typeof summary?.generatedAt === "string" ? summary.generatedAt : null,
    },
    config: {
      scenarios: Array.isArray(summary?.config?.scenarios) ? [...summary.config.scenarios] : [],
      seeds: Array.isArray(summary?.config?.seeds) ? [...summary.config.seeds] : [],
      patchSizes: Array.isArray(summary?.config?.patchSizes) ? [...summary.config.patchSizes] : [],
      fullRecomputeIterations: toFiniteNumber(summary?.config?.fullRecomputeIterations),
      patchIterations: toFiniteNumber(summary?.config?.patchIterations),
      compileIterations: toFiniteNumber(summary?.config?.compileIterations),
      warmupRuns: toFiniteNumber(summary?.config?.warmupRuns),
    },
    budgets: isRecord(summary?.budgets) ? summary.budgets : null,
    aggregate: {
      elapsedP95Ms: toFiniteNumber(summary?.aggregate?.elapsedMs?.p95),
      heapDeltaP95Mb: toFiniteNumber(summary?.aggregate?.heapDeltaMb?.p95),
      fullRecomputeP95Ms: toFiniteNumber(summary?.aggregate?.fullRecomputeP95Ms?.p95),
      patchP95Ms: toFiniteNumber(summary?.aggregate?.patchP95Ms?.p95),
      fullEvaluationsPerSecMean: toFiniteNumber(summary?.aggregate?.fullEvaluationsPerSec?.mean),
      incrementalEvaluationsPerSecMean: toFiniteNumber(summary?.aggregate?.incrementalEvaluationsPerSec?.mean),
    },
    scenarios,
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null
}

function normalizePct(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function percentDelta(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) {
    return 0
  }
  return ((current - baseline) / baseline) * 100
}

function assertSameScenarioShape(baseline, candidate) {
  if (baseline.scenarios.length !== candidate.scenarios.length) {
    throw new Error(
      `Scenario count mismatch: baseline=${baseline.scenarios.length}, current=${candidate.scenarios.length}`,
    )
  }
  for (let index = 0; index < baseline.scenarios.length; index += 1) {
    const baseScenario = baseline.scenarios[index]
    const nextScenario = candidate.scenarios[index]
    if (!nextScenario || baseScenario.name !== nextScenario.name) {
      throw new Error(
        `Scenario mismatch at index ${index}: baseline='${baseScenario?.name ?? "n/a"}', current='${nextScenario?.name ?? "n/a"}'`,
      )
    }
    if (baseScenario.patch.length !== nextScenario.patch.length) {
      throw new Error(
        `Patch matrix mismatch for scenario '${baseScenario.name}': baseline=${baseScenario.patch.length}, current=${nextScenario.patch.length}`,
      )
    }
    for (let patchIndex = 0; patchIndex < baseScenario.patch.length; patchIndex += 1) {
      const basePatch = baseScenario.patch[patchIndex]
      const nextPatch = nextScenario.patch[patchIndex]
      if (!nextPatch || basePatch.patchSize !== nextPatch.patchSize) {
        throw new Error(
          `Patch size mismatch for scenario '${baseScenario.name}' at index ${patchIndex}: baseline=${basePatch?.patchSize ?? -1}, current=${nextPatch?.patchSize ?? -1}`,
        )
      }
    }
  }
}

function runCheckMode(baselinePath, candidateBaseline) {
  if (!existsSync(baselinePath)) {
    throw new Error(`Baseline file is missing: ${baselinePath}`)
  }
  const baseline = readJson(baselinePath)
  assertSameScenarioShape(baseline, candidateBaseline)

  const maxSlowdownPct = normalizePct(process.env.FORMULA_BASELINE_MAX_SLOWDOWN_PCT ?? 35)
  const maxThroughputDropPct = normalizePct(process.env.FORMULA_BASELINE_MAX_THROUGHPUT_DROP_PCT ?? 25)
  const failures = []

  const checkSlowMetric = (label, current, expected) => {
    const drift = percentDelta(current, expected)
    if (drift > maxSlowdownPct) {
      failures.push(`${label}: +${drift.toFixed(2)}% (max +${maxSlowdownPct}%)`)
    }
  }
  const checkThroughputMetric = (label, current, expected) => {
    const drift = percentDelta(current, expected)
    if (drift < -maxThroughputDropPct) {
      failures.push(`${label}: ${drift.toFixed(2)}% (max drop -${maxThroughputDropPct}%)`)
    }
  }

  checkSlowMetric(
    "aggregate.fullRecomputeP95Ms",
    candidateBaseline.aggregate.fullRecomputeP95Ms,
    baseline.aggregate.fullRecomputeP95Ms,
  )
  checkSlowMetric(
    "aggregate.patchP95Ms",
    candidateBaseline.aggregate.patchP95Ms,
    baseline.aggregate.patchP95Ms,
  )
  checkThroughputMetric(
    "aggregate.fullEvaluationsPerSecMean",
    candidateBaseline.aggregate.fullEvaluationsPerSecMean,
    baseline.aggregate.fullEvaluationsPerSecMean,
  )
  checkThroughputMetric(
    "aggregate.incrementalEvaluationsPerSecMean",
    candidateBaseline.aggregate.incrementalEvaluationsPerSecMean,
    baseline.aggregate.incrementalEvaluationsPerSecMean,
  )

  for (let index = 0; index < baseline.scenarios.length; index += 1) {
    const baseScenario = baseline.scenarios[index]
    const nextScenario = candidateBaseline.scenarios[index]
    checkSlowMetric(
      `scenario.${baseScenario.name}.fullRecomputeP95Ms`,
      nextScenario.fullRecomputeP95Ms,
      baseScenario.fullRecomputeP95Ms,
    )
    checkThroughputMetric(
      `scenario.${baseScenario.name}.fullEvaluationsPerSecMean`,
      nextScenario.fullEvaluationsPerSecMean,
      baseScenario.fullEvaluationsPerSecMean,
    )
    for (let patchIndex = 0; patchIndex < baseScenario.patch.length; patchIndex += 1) {
      const basePatch = baseScenario.patch[patchIndex]
      const nextPatch = nextScenario.patch[patchIndex]
      checkSlowMetric(
        `scenario.${baseScenario.name}.patch[${basePatch.patchSize}].p95Ms`,
        nextPatch.p95Ms,
        basePatch.p95Ms,
      )
      checkThroughputMetric(
        `scenario.${baseScenario.name}.patch[${basePatch.patchSize}].evaluationsPerSecMean`,
        nextPatch.evaluationsPerSecMean,
        basePatch.evaluationsPerSecMean,
      )
    }
  }

  if (failures.length > 0) {
    const details = failures.map(failure => ` - ${failure}`).join("\n")
    throw new Error(`Formula baseline check failed:\n${details}`)
  }

  console.log(
    `Formula baseline check passed: ${baselinePath} (slowdown<=${maxSlowdownPct}%, throughputDrop<=${maxThroughputDropPct}%)`,
  )
}

const inputPath = resolveExistingInputPath()
const benchmarkSummary = readJson(inputPath)
const baseline = createFormulaBaseline(benchmarkSummary, inputPath)

if (CHECK_MODE) {
  runCheckMode(BASELINE_OUTPUT_PATH, baseline)
} else {
  mkdirSync(dirname(BASELINE_OUTPUT_PATH), { recursive: true })
  writeFileSync(BASELINE_OUTPUT_PATH, `${JSON.stringify(baseline, null, 2)}\n`)

  console.log(`Formula benchmark baseline written: ${BASELINE_OUTPUT_PATH}`)
}
