#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(new URL("..", import.meta.url).pathname)
const artifactPath = resolve(root, process.env.PACKAGE_FOOTPRINT_ARTIFACT ?? "artifacts/performance/bench-datagrid-package-footprint.json")
const baselinePath = resolve(root, process.env.PACKAGE_FOOTPRINT_BASELINE ?? "docs/perf/datagrid-package-footprint-baseline.json")
const maxGrowthPct = Number.parseFloat(process.env.PERF_BUDGET_MAX_PACKAGE_FOOTPRINT_GROWTH_PCT ?? "15")
const maxStartupGrowthPct = Number.parseFloat(process.env.PERF_BUDGET_MAX_PACKAGE_STARTUP_GROWTH_PCT ?? "25")

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")) }
  catch (error) { throw new Error(`Unable to read JSON ${path}: ${error instanceof Error ? error.message : String(error)}`) }
}
function growthPct(candidate, baseline) {
  if (!Number.isFinite(candidate) || !Number.isFinite(baseline) || baseline <= 0) return null
  return ((candidate - baseline) / baseline) * 100
}

const artifact = readJson(artifactPath)
const baseline = readJson(baselinePath)
const baselineProfiles = baseline.profiles ?? {}
const failures = []
for (const profile of artifact.profiles ?? []) {
  const expected = baselineProfiles[profile.name]
  if (!expected) { failures.push(`${profile.name}: missing baseline profile`); continue }
  for (const metric of ["distBytes", "gzipBytes", "brotliBytes"]) {
    const growth = growthPct(profile[metric], expected[metric])
    if (growth != null && growth > maxGrowthPct) failures.push(`${profile.name} ${metric} growth ${growth.toFixed(2)}% > ${maxGrowthPct}%`)
  }
  const startupGrowth = growthPct(profile.startupMs?.p50, expected.startupMs?.p50)
  if (startupGrowth != null && startupGrowth > maxStartupGrowthPct) failures.push(`${profile.name} startup p50 growth ${startupGrowth.toFixed(2)}% > ${maxStartupGrowthPct}%`)
  console.log(`${profile.name}: footprint growth ${["distBytes", "gzipBytes", "brotliBytes"].map(metric => `${metric}=${(growthPct(profile[metric], expected[metric]) ?? 0).toFixed(2)}%`).join(", ")}; startupP50=${(startupGrowth ?? 0).toFixed(2)}%`)
}
if (failures.length) {
  console.error("\nPackage footprint regression gate failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log("Package footprint regression gate: OK")
