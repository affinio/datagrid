import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const SANDBOX_DIR = fileURLToPath(new URL("../packages/datagrid-sandbox", import.meta.url))

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

function startSandboxServer(baseUrl) {
  const parsed = new URL(baseUrl)
  const host = parsed.hostname
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80")

  return spawn(
    "pnpm",
    ["exec", "vite", "--host", host, "--port", String(port), "--strictPort"],
    {
      env: process.env,
      cwd: SANDBOX_DIR,
      stdio: "inherit",
      shell: false,
    },
  )
}

async function stopProcess(child) {
  if (!child || child.exitCode != null || child.killed) {
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

export async function ensureSandboxServer(baseUrl, route, label = "sandbox") {
  const entryUrl = `${baseUrl}${route}`
  if (await isReachable(entryUrl)) {
    return {
      started: false,
      async stop() {},
    }
  }

  console.log(`[${label}] sandbox is not reachable at ${baseUrl}; starting local dev server...`)
  const child = startSandboxServer(baseUrl)
  const ready = await waitForReachable(entryUrl, 90000)
  if (!ready) {
    await stopProcess(child)
    throw new Error(`[${label}] sandbox did not become ready at ${entryUrl} within timeout`)
  }

  return {
    started: true,
    async stop() {
      await stopProcess(child)
    },
  }
}
