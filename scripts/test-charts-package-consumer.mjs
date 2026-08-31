import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)))
const consumer = mkdtempSync(join(tmpdir(), "affino-charts-consumer-"))

try {
  run("pnpm", ["--filter", "@affino/charts-core", "build"], workspace)
  run("pnpm", ["--filter", "@affino/charts-vue", "build"], workspace)

  const coreTarball = pack(resolve(workspace, "packages/charts-core"))
  const vueTarball = pack(resolve(workspace, "packages/charts-vue"))

  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "affino-charts-packed-consumer",
    private: true,
    type: "module",
    scripts: { build: "vite build", typecheck: "vue-tsc --noEmit" },
    dependencies: {
      "@affino/charts-core": `file:${coreTarball}`,
      "@affino/charts-vue": `file:${vueTarball}`,
      vue: "3.4.38",
    },
    devDependencies: {
      "@vitejs/plugin-vue": "6.0.4",
      typescript: "5.9.3",
      vite: "7.3.2",
      "vue-tsc": "3.2.5",
    },
  }, null, 2))
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      jsx: "preserve",
      lib: ["ES2022", "DOM"],
      types: ["vite/client"],
      skipLibCheck: true,
    },
    include: ["src/**/*.ts", "src/**/*.vue"],
  }, null, 2))
  writeFileSync(join(consumer, "vite.config.ts"), [
    'import vue from "@vitejs/plugin-vue"',
    'import { defineConfig } from "vite"',
    'export default defineConfig({ plugins: [vue()] })',
    "",
  ].join("\n"))
  writeFileSync(join(consumer, "index.html"), '<div id="app"></div><script type="module" src="/src/main.ts"></script>\n')
  mkdirSync(join(consumer, "src"))
  writeFileSync(join(consumer, "src/main.ts"), [
    'import { createApp } from "vue"',
    'import App from "./App.vue"',
    'import "@affino/charts-vue/styles.css"',
    'createApp(App).mount("#app")',
    "",
  ].join("\n"))
  writeFileSync(join(consumer, "src/App.vue"), `<template>
  <AffinoTimeSeriesChart :series="series" />
</template>
<script setup lang="ts">
import { AffinoTimeSeriesChart } from "@affino/charts-vue"
import { createTimeSeriesChartGeometry, type TimeSeries } from "@affino/charts-core"
const series: TimeSeries[] = [
  { id: "balance", label: "Balance", data: [{ time: Date.UTC(2026, 0, 1), value: 100 }] },
  { id: "equity", label: "Equity", data: [{ time: Date.UTC(2026, 0, 1), value: 98 }] },
]
createTimeSeriesChartGeometry({ series, size: { width: 640, height: 360 } })
</script>
`)

  run("npm", ["install", "--no-package-lock", "--ignore-scripts"], consumer)
  run("node", ["--input-type=module", "-e", 'import("@affino/charts-core").then(m => console.log("core-esm", typeof m.createTimeSeriesChartGeometry))'], consumer)
  run("node", ["--input-type=module", "-e", 'import("@affino/charts-vue").then(m => console.log("vue-esm", typeof m.AffinoTimeSeriesChart))'], consumer)
  run("npm", ["run", "typecheck"], consumer)
  run("npm", ["run", "build"], consumer)
  console.log("AFFINO_CHART_PACKED_CONSUMER_OK")
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

function pack(packageDirectory) {
  const output = execFileSync("pnpm", ["pack", "--pack-destination", consumer], {
    cwd: packageDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim().split("\n").at(-1)
  if (!output) throw new Error(`pnpm pack produced no tarball for ${packageDirectory}`)
  return output
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" })
}
