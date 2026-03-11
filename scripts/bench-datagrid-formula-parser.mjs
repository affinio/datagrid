#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const BENCH_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_PARSER_ITERATIONS ?? "2000", 10)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-formula-parser.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-formula-parser.md",
)

const PERF_BUDGET_MAX_PARSE_CANONICAL_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_PARSE_CANONICAL_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_PARSE_SMARTSHEET_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_PARSE_SMARTSHEET_P95_MS ?? "Infinity",
)

if (!Number.isInteger(BENCH_ITERATIONS) || BENCH_ITERATIONS <= 0) {
  throw new Error("BENCH_FORMULA_PARSER_ITERATIONS must be a positive integer.")
}

function quantile(values, q) {
  if (values.length === 0) {
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
  if (values.length === 0) {
    return { mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    mean,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

async function loadFormulaApi() {
  const candidates = [
    resolve("packages/datagrid-core/dist/src/models/index.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }
    const module = await import(pathToFileURL(candidate).href)
    if (
      typeof module.parseDataGridFormulaExpression === "function"
      && typeof module.compileDataGridFormulaFieldDefinition === "function"
    ) {
      return {
        parseDataGridFormulaExpression: module.parseDataGridFormulaExpression,
        compileDataGridFormulaFieldDefinition: module.compileDataGridFormulaFieldDefinition,
      }
    }
  }

  throw new Error(
    "Unable to locate datagrid-core build artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
  )
}

function ensureOutputDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function formatMs(value) {
  return `${value.toFixed(3)} ms`
}

function buildCanonicalFormulas() {
  return [
    "=price * qty + tax",
    "balance[-1] + amount",
    "SUM(price[-2:0]) + taxRate",
    "IF(price > qty, subtotal + tax, 0)",
  ]
}

function buildSmartsheetFormulas() {
  return [
    "=[price]@row * [qty]@row + [tax]1",
    "=[balance]1 + [amount]@row",
    "=[subtotal]@row + [tax]5",
    "=IF([price]@row > [qty]@row, [subtotal]@row + [tax]1, 0)",
  ]
}

function sampleParseSet(parseDataGridFormulaExpression, formulas, options) {
  const startedAt = performance.now()
  for (const formula of formulas) {
    parseDataGridFormulaExpression(formula, options)
  }
  return performance.now() - startedAt
}

function sampleCompileSet(compileDataGridFormulaFieldDefinition, formulas, options) {
  const startedAt = performance.now()
  formulas.forEach((formula, index) => {
    compileDataGridFormulaFieldDefinition({
      name: `bench_${index}`,
      formula,
    }, options)
  })
  return performance.now() - startedAt
}

function assertBudget(label, value, budget) {
  if (value > budget) {
    throw new Error(`${label} exceeded budget: ${value.toFixed(3)}ms > ${budget.toFixed(3)}ms`)
  }
}

const api = await loadFormulaApi()
const canonicalFormulas = buildCanonicalFormulas()
const smartsheetFormulas = buildSmartsheetFormulas()

const canonicalParseSamples = []
const smartsheetParseSamples = []
const canonicalCompileSamples = []
const smartsheetCompileSamples = []

for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
  canonicalParseSamples.push(sampleParseSet(
    api.parseDataGridFormulaExpression,
    canonicalFormulas,
    {},
  ))
  smartsheetParseSamples.push(sampleParseSet(
    api.parseDataGridFormulaExpression,
    smartsheetFormulas,
    {
      referenceParserOptions: {
        syntax: "smartsheet",
      },
    },
  ))
  canonicalCompileSamples.push(sampleCompileSet(
    api.compileDataGridFormulaFieldDefinition,
    canonicalFormulas,
    {},
  ))
  smartsheetCompileSamples.push(sampleCompileSet(
    api.compileDataGridFormulaFieldDefinition,
    smartsheetFormulas,
    {
      referenceParserOptions: {
        syntax: "smartsheet",
      },
    },
  ))
}

const summary = {
  generatedAt: new Date().toISOString(),
  config: {
    iterations: BENCH_ITERATIONS,
    formulasPerSet: canonicalFormulas.length,
  },
  parse: {
    canonical: stats(canonicalParseSamples),
    smartsheet: stats(smartsheetParseSamples),
  },
  compile: {
    canonical: stats(canonicalCompileSamples),
    smartsheet: stats(smartsheetCompileSamples),
  },
}

assertBudget(
  "parse.canonical.p95",
  summary.parse.canonical.p95,
  PERF_BUDGET_MAX_PARSE_CANONICAL_P95_MS,
)
assertBudget(
  "parse.smartsheet.p95",
  summary.parse.smartsheet.p95,
  PERF_BUDGET_MAX_PARSE_SMARTSHEET_P95_MS,
)

ensureOutputDir(BENCH_OUTPUT_JSON)
ensureOutputDir(BENCH_OUTPUT_MARKDOWN)

writeFileSync(BENCH_OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
writeFileSync(BENCH_OUTPUT_MARKDOWN, [
  "# Formula Parser Benchmark",
  "",
  `Generated at: ${summary.generatedAt}`,
  "",
  `Iterations: ${BENCH_ITERATIONS}`,
  `Formulas per set: ${canonicalFormulas.length}`,
  "",
  "## Parse",
  "",
  `- canonical p95: ${formatMs(summary.parse.canonical.p95)}`,
  `- smartsheet p95: ${formatMs(summary.parse.smartsheet.p95)}`,
  "",
  "## Compile",
  "",
  `- canonical p95: ${formatMs(summary.compile.canonical.p95)}`,
  `- smartsheet p95: ${formatMs(summary.compile.smartsheet.p95)}`,
  "",
].join("\n"), "utf8")

console.log(JSON.stringify({
  json: BENCH_OUTPUT_JSON,
  markdown: BENCH_OUTPUT_MARKDOWN,
  parseCanonicalP95Ms: summary.parse.canonical.p95,
  parseSmartsheetP95Ms: summary.parse.smartsheet.p95,
  compileCanonicalP95Ms: summary.compile.canonical.p95,
  compileSmartsheetP95Ms: summary.compile.smartsheet.p95,
}))
