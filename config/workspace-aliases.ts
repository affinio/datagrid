import { existsSync } from "node:fs"
import { dirname, join, parse } from "node:path"
import { fileURLToPath, URL } from "node:url"

const WORKSPACE_ALIAS_TARGETS: Record<string, string> = {
  "@affino/projection-engine": "packages/projection-engine/src/index.ts",
  "@affino/projection-engine/*": "packages/projection-engine/src/*",
  "@affino/datagrid-format": "packages/datagrid-format/src/index.ts",
  "@affino/datagrid-format/*": "packages/datagrid-format/src/*",
  "@affino/datagrid-theme": "packages/datagrid-theme/src/index.ts",
  "@affino/datagrid-theme/*": "packages/datagrid-theme/src/*",
  "@affino/datagrid-plugins": "packages/datagrid-plugins/src/index.ts",
  "@affino/datagrid-plugins/*": "packages/datagrid-plugins/src/*",
  "@affino/datagrid-worker": "packages/datagrid-worker/src/index.ts",
  "@affino/datagrid-worker/*": "packages/datagrid-worker/src/*",
  "@affino/datagrid-formula-engine": "packages/datagrid-formula-engine/src/index.ts",
  "@affino/datagrid-formula-engine/*": "packages/datagrid-formula-engine/src/*",
  "@affino/datagrid-server-client": "packages/datagrid-server-client/src/index.ts",
  "@affino/datagrid-server-client/*": "packages/datagrid-server-client/src/*",
  "@affino/datagrid-server-adapters": "packages/datagrid-server-adapters/src/index.ts",
  "@affino/datagrid-server-adapters/*": "packages/datagrid-server-adapters/src/*",
  "@affino/datagrid-pivot": "packages/datagrid-pivot/src/index.ts",
  "@affino/datagrid-pivot/*": "packages/datagrid-pivot/src/*",
  "@affino/datagrid-core/advanced": "packages/datagrid-core/src/advanced.ts",
  "@affino/datagrid-core/advanced-client-row-model": "packages/datagrid-core/src/advanced-client-row-model.ts",
  "@affino/datagrid-core/internal": "packages/datagrid-core/src/internal.ts",
  "@affino/datagrid-core": "packages/datagrid-core/src/index.ts",
  "@affino/datagrid-core/*": "packages/datagrid-core/src/*",
  "@affino/datagrid-orchestration": "packages/datagrid-orchestration/src/index.ts",
  "@affino/datagrid-orchestration/*": "packages/datagrid-orchestration/src/*",
  "@affino/datagrid-gantt": "packages/datagrid-gantt/src/index.ts",
  "@affino/datagrid-gantt/*": "packages/datagrid-gantt/src/*",
  "@affino/datagrid-chrome": "packages/datagrid-chrome/src/index.ts",
  "@affino/datagrid-chrome/*": "packages/datagrid-chrome/src/*",
  "@affino/datagrid-vue/headless/app/worker": "packages/datagrid-vue/src/app/worker.ts",
  "@affino/datagrid-vue/headless/app": "packages/datagrid-vue/src/app/index.ts",
  "@affino/datagrid-vue/headless/advanced/layout": "packages/datagrid-vue/src/advanced/layout.ts",
  "@affino/datagrid-vue/headless/advanced/pointer": "packages/datagrid-vue/src/advanced/pointer.ts",
  "@affino/datagrid-vue/headless/advanced/selection": "packages/datagrid-vue/src/advanced/selection.ts",
  "@affino/datagrid-vue/headless/advanced/editing": "packages/datagrid-vue/src/advanced/editing.ts",
  "@affino/datagrid-vue/headless/advanced/clipboard": "packages/datagrid-vue/src/advanced/clipboard.ts",
  "@affino/datagrid-vue/headless/advanced/filtering": "packages/datagrid-vue/src/advanced/filtering.ts",
  "@affino/datagrid-vue/headless/advanced/history": "packages/datagrid-vue/src/advanced/history.ts",
  "@affino/datagrid-vue/headless/advanced": "packages/datagrid-vue/src/advanced.ts",
  "@affino/datagrid-vue/headless/stable": "packages/datagrid-vue/src/stable.ts",
  "@affino/datagrid-vue/headless/worker": "packages/datagrid-vue/src/worker.ts",
  "@affino/datagrid-vue/headless": "packages/datagrid-vue/src/index.ts",
  "@affino/datagrid-vue/app/worker": "packages/datagrid-vue/src/app/worker.ts",
  "@affino/datagrid-vue/app": "packages/datagrid-vue/src/app/index.ts",
  "@affino/datagrid-vue/advanced/layout": "packages/datagrid-vue/src/advanced/layout.ts",
  "@affino/datagrid-vue/advanced/pointer": "packages/datagrid-vue/src/advanced/pointer.ts",
  "@affino/datagrid-vue/advanced/selection": "packages/datagrid-vue/src/advanced/selection.ts",
  "@affino/datagrid-vue/advanced/editing": "packages/datagrid-vue/src/advanced/editing.ts",
  "@affino/datagrid-vue/advanced/clipboard": "packages/datagrid-vue/src/advanced/clipboard.ts",
  "@affino/datagrid-vue/advanced/filtering": "packages/datagrid-vue/src/advanced/filtering.ts",
  "@affino/datagrid-vue/advanced/history": "packages/datagrid-vue/src/advanced/history.ts",
  "@affino/datagrid-vue/advanced": "packages/datagrid-vue/src/advanced.ts",
  "@affino/datagrid-vue/worker": "packages/datagrid-vue/src/worker.ts",
  "@affino/datagrid-vue/stable": "packages/datagrid-vue/src/stable.ts",
  "@affino/datagrid-vue/gantt": "packages/datagrid-vue/src/app-layer/gantt.ts",
  "@affino/datagrid-vue/aggregations": "packages/datagrid-vue/src/app-layer/aggregations.ts",
  "@affino/datagrid-vue/advanced-filter": "packages/datagrid-vue/src/app-layer/advanced-filter.ts",
  "@affino/datagrid-vue/quick-filter": "packages/datagrid-vue/src/app-layer/quick-filter.ts",
  "@affino/datagrid-vue/find-replace": "packages/datagrid-vue/src/app-layer/find-replace.ts",
  "@affino/datagrid-vue/internal": "packages/datagrid-vue/src/app-layer/internal.ts",
  "@affino/datagrid-vue": "packages/datagrid-vue/src/unified.ts",
  "@affino/datagrid-vue/*": "packages/datagrid-vue/src/*",
  "@affino/datagrid-spreadsheet-vue-app": "packages/datagrid-spreadsheet-vue-app/src/index.ts",
  "@affino/datagrid-spreadsheet-vue-app/*": "packages/datagrid-spreadsheet-vue-app/src/*",
  "@affino/datagrid-laravel": "packages/datagrid-laravel/resources/js/index.ts",
  "@affino/datagrid-laravel/*": "packages/datagrid-laravel/resources/js/*",
  "@affino/charts-core": "packages/charts-core/src/index.ts",
  "@affino/charts-core/*": "packages/charts-core/src/*",
  "@affino/charts-vue": "packages/charts-vue/src/index.ts",
  "@affino/charts-vue/*": "packages/charts-vue/src/*",
  "@affino/analytics-core": "packages/analytics-core/src/index.ts",
  "@affino/analytics-core/*": "packages/analytics-core/src/*",
  "@affino/world-map-core": "packages/world-map-core/src/index.ts",
  "@affino/world-map-core/*": "packages/world-map-core/src/*",
  "@affino/world-map-vue": "packages/world-map-vue/src/index.ts",
  "@affino/world-map-vue/*": "packages/world-map-vue/src/*",
}

export type AliasOverrides = Record<string, string>

export function createWorkspaceAliases(fromUrl: string | URL, overrides: AliasOverrides = {}): Record<string, string> {
  const workspaceRoot = findWorkspaceRootDir(fromUrl)
  const resolvedEntries = Object.entries({ ...WORKSPACE_ALIAS_TARGETS, ...overrides }).map(([alias, relativePath]) => {
    const targetUrl = new URL(relativePath, workspaceRoot)
    return [alias, fileURLToPath(targetUrl)] as const
  })
  return Object.fromEntries(resolvedEntries)
}

function findWorkspaceRootDir(fromUrl: string | URL): URL {
  let currentDir = dirname(fileURLToPath(fromUrl instanceof URL ? fromUrl : new URL(fromUrl)))
  const { root } = parse(currentDir)
  while (currentDir && currentDir !== root) {
    if (existsSync(join(currentDir, "pnpm-workspace.yaml"))) {
      return new URL(`${currentDir}/`, "file://")
    }
    currentDir = dirname(currentDir)
  }
  return new URL(`${currentDir}/`, "file://")
}
