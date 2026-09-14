import { gzipSync, brotliCompressSync } from "node:zlib"
import { readFile, readdir, stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"
import { build } from "esbuild"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = resolve(process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-package-footprint.json")
const iterations = Math.max(1, Number(process.env.BENCH_STARTUP_ITERATIONS ?? 3))
const packageProfiles = [
  ["core:plain", "packages/datagrid-core", "dist/src/index.js"],
  ["core:advanced", "packages/datagrid-core", "dist/src/advanced.js"],
  ["vue:plain", "packages/datagrid-vue", "dist/index.js"],
  ["vue:advanced", "packages/datagrid-vue", "dist/advanced.js"],
  ["vue-app:plain", "packages/datagrid-vue-app", "dist/index.js"],
  ["pivot", "packages/datagrid-pivot", "dist/index.js"],
  ["worker", "packages/datagrid-worker", "dist/index.js"],
]

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else if (entry.isFile() && /\.(?:js|css)$/.test(entry.name)) files.push(path)
  }
  return files
}

async function treeShakenBundleSample(entry) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    write: false,
    sourcemap: false,
    logLevel: "silent",
  })
  const output = result.outputFiles[0]?.contents
  if (!output) throw new Error(`No tree-shaken output for ${entry}`)
  return {
    bytes: output.byteLength,
    gzipBytes: gzipSync(output, { level: 9 }).length,
    brotliBytes: brotliCompressSync(output).length,
  }
}

function startupSample(entry) {
  const code = `const started = performance.now(); await import(process.argv[1] + "?startup=" + Date.now()); console.log(JSON.stringify({startupMs: performance.now() - started}));`
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", code, pathToFileURL(entry).href], {
    cwd: root, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(`${result.stderr || result.stdout}`.trim())
  return JSON.parse(result.stdout.trim()).startupMs
}

const profiles = []
for (const [name, packagePath, entryRelative] of packageProfiles) {
  const dist = resolve(root, packagePath, "dist")
  const entry = resolve(root, packagePath, entryRelative)
  const files = await filesUnder(dist)
  const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size))
  const entryBytes = (await stat(entry)).size
  const sourceBytes = sizes.reduce((sum, size) => sum + size, 0)
  const payload = Buffer.concat(await Promise.all(files.map((file) => readFile(file))))
  const startupSamples = Array.from({ length: iterations }, () => startupSample(entry))
  startupSamples.sort((a, b) => a - b)
  const treeShaken = await treeShakenBundleSample(entry)
  profiles.push({
    name, package: packagePath, entry: entryRelative, fileCount: files.length, entryBytes, distBytes: sourceBytes,
    gzipBytes: gzipSync(payload, { level: 9 }).length, brotliBytes: brotliCompressSync(payload).length,
    treeShaken,
    startupMs: { p50: startupSamples[Math.floor(startupSamples.length / 2)], max: startupSamples.at(-1), samples: startupSamples },
  })
}

const report = { generatedAt: new Date().toISOString(), node: process.version, startupIterations: iterations, measurement: "all JS/CSS files in the production dist directory plus minified esbuild tree-shaken entry bundle; startup is isolated Node import of the documented entrypoint", profiles }
await import("node:fs/promises").then(({ mkdir, writeFile }) => mkdir(dirname(outputPath), { recursive: true }).then(() => writeFile(outputPath, JSON.stringify(report, null, 2) + "\n")))
for (const profile of profiles) console.log(`${profile.name}: dist=${profile.distBytes} gzip=${profile.gzipBytes} brotli=${profile.brotliBytes} treeShaken=${profile.treeShaken.bytes} startupP50=${profile.startupMs.p50.toFixed(2)}ms`)
