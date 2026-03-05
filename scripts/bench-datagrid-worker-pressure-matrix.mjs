#!/usr/bin/env node

import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const SANDBOX_DIR = fileURLToPath(new URL("../packages/datagrid-sandbox", import.meta.url))

const DEFAULT_BASE_URL = "http://127.0.0.1:4173"
const DEFAULT_MAIN_ROUTE = "/vue/base-grid"
const DEFAULT_WORKER_ROUTE = "/vue/worker-grid"

const scaled = process.argv.includes("--scaled")

const rowOnlySamples = [10000, 20000, 50000, 100000, 200000]
const scaledSamples = [
  { rows: 10000, patchSize: 400 },
  { rows: 20000, patchSize: 800 },
  { rows: 50000, patchSize: 2000 },
  { rows: 100000, patchSize: 4000 },
  { rows: 200000, patchSize: 8000 },
]

const baseUrl = process.env.BENCH_BROWSER_BASE_URL ?? DEFAULT_BASE_URL
const routeMain = process.env.BENCH_BROWSER_ROUTE_MAIN_THREAD ?? DEFAULT_MAIN_ROUTE
const routeWorker = process.env.BENCH_BROWSER_ROUTE_WORKER_OWNED ?? DEFAULT_WORKER_ROUTE

function runCommand(command, args, env = process.env, stdio = "inherit") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio,
      shell: false,
    })

    child.on("error", reject)
    child.on("exit", code => {
      resolve(typeof code === "number" ? code : 1)
    })
  })
}

async function isReachable(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
    })
    return response.status >= 200 && response.status < 500
  } catch {
    return false
  }
}

async function waitForReachable(url, timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(url)) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

function startSandboxServer(url) {
  const parsed = new URL(url)
  const host = parsed.hostname
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80")

  const child = spawn(
    "pnpm",
    ["exec", "vite", "--host", host, "--port", String(port), "--strictPort"],
    {
      env: process.env,
      cwd: SANDBOX_DIR,
      stdio: "inherit",
      shell: false,
    },
  )

  return child
}

async function stopProcess(child) {
  if (child.exitCode != null || child.killed) {
    return
  }

  child.kill("SIGTERM")
  const closed = await new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 5000)
    child.once("exit", () => {
      clearTimeout(timer)
      resolve(true)
    })
  })

  if (!closed) {
    child.kill("SIGKILL")
  }
}

const run = async () => {
  const entryUrl = `${baseUrl}${routeMain}`
  let startedServer = null

  if (!(await isReachable(entryUrl))) {
    console.log(`[worker-pressure-matrix] sandbox is not reachable at ${baseUrl}; starting local dev server...`)
    startedServer = startSandboxServer(baseUrl)
    const ready = await waitForReachable(entryUrl, 90000)
    if (!ready) {
      await stopProcess(startedServer)
      console.error(`[worker-pressure-matrix] sandbox did not become ready at ${entryUrl} within timeout`)
      process.exit(1)
    }
  }

  const failures = []

  try {
    const samples = scaled ? scaledSamples : rowOnlySamples.map(rows => ({ rows, patchSize: null }))
    for (const sample of samples) {
      const patchLabel = sample.patchSize == null ? "default" : String(sample.patchSize)
      const outputDir = scaled ? "worker-pressure-matrix-scaled" : "worker-pressure-matrix"
      const outputFile = sample.patchSize == null
        ? `bench-datagrid-worker-pressure-rows-${sample.rows}.json`
        : `bench-datagrid-worker-pressure-rows-${sample.rows}-patch-${sample.patchSize}.json`

      console.log(`\n[worker-pressure${scaled ? "-scaled" : ""}] rows=${sample.rows} patchSize=${patchLabel}`)

      const runEnv = {
        ...process.env,
        BENCH_BROWSER_BASE_URL: baseUrl,
        BENCH_BROWSER_ROUTE_MAIN_THREAD: routeMain,
        BENCH_BROWSER_ROUTE_WORKER_OWNED: routeWorker,
        BENCH_WORKER_PRESSURE_ROW_COUNT: String(sample.rows),
        BENCH_OUTPUT_JSON: `artifacts/performance/${outputDir}/${outputFile}`,
      }

      if (sample.patchSize != null) {
        runEnv.BENCH_WORKER_PRESSURE_PATCH_SIZE = String(sample.patchSize)
      }

      const code = await runCommand("node", ["./scripts/bench-datagrid-worker-pressure.mjs"], runEnv)
      if (code !== 0) {
        failures.push({ sample, code })
      }
    }
  } finally {
    if (startedServer) {
      await stopProcess(startedServer)
    }
  }

  if (failures.length > 0) {
    console.error(`\n[worker-pressure-matrix] completed with ${failures.length} failed sample(s)`)
    process.exit(1)
  }

  console.log("\n[worker-pressure-matrix] all samples passed")
}

run().catch(async error => {
  console.error("[worker-pressure-matrix] unexpected failure", error)
  process.exit(1)
})
