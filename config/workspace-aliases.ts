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
  "@affino/datagrid-formula-engine-enterprise": "packages/datagrid-formula-engine-enterprise/src/index.ts",
  "@affino/datagrid-formula-engine-enterprise/*": "packages/datagrid-formula-engine-enterprise/src/*",
  "@affino/datagrid-pivot": "packages/datagrid-pivot/src/index.ts",
  "@affino/datagrid-pivot/*": "packages/datagrid-pivot/src/*",
  "@affino/datagrid-core/advanced": "packages/datagrid-core/src/advanced.ts",
  "@affino/datagrid-core/internal": "packages/datagrid-core/src/internal.ts",
  "@affino/datagrid-core": "packages/datagrid-core/src/index.ts",
  "@affino/datagrid-core/*": "packages/datagrid-core/src/*",
  "@affino/datagrid-orchestration": "packages/datagrid-orchestration/src/index.ts",
  "@affino/datagrid-orchestration/*": "packages/datagrid-orchestration/src/*",
  "@affino/datagrid-gantt": "packages/datagrid-gantt/src/index.ts",
  "@affino/datagrid-gantt/*": "packages/datagrid-gantt/src/*",
  "@affino/datagrid-vue/advanced": "packages/datagrid-vue/src/advanced.ts",
  "@affino/datagrid-vue/worker": "packages/datagrid-vue/src/worker.ts",
  "@affino/datagrid-vue": "packages/datagrid-vue/src/index.ts",
  "@affino/datagrid-vue/*": "packages/datagrid-vue/src/*",
  "@affino/datagrid-diagnostics-enterprise": "packages/datagrid-diagnostics-enterprise/src/index.ts",
  "@affino/datagrid-diagnostics-enterprise/*": "packages/datagrid-diagnostics-enterprise/src/*",
  "@affino/datagrid-vue-app-enterprise": "packages/datagrid-vue-app-enterprise/src/index.ts",
  "@affino/datagrid-vue-app-enterprise/*": "packages/datagrid-vue-app-enterprise/src/*",
  "@affino/datagrid-vue-app/internal": "packages/datagrid-vue-app/src/internal.ts",
  "@affino/datagrid-vue-app": "packages/datagrid-vue-app/src/index.ts",
  "@affino/datagrid-vue-app/*": "packages/datagrid-vue-app/src/*",
  "@affino/datagrid-spreadsheet-vue-app": "packages/datagrid-spreadsheet-vue-app/src/index.ts",
  "@affino/datagrid-spreadsheet-vue-app/*": "packages/datagrid-spreadsheet-vue-app/src/*",
  "@affino/datagrid-laravel": "packages/datagrid-laravel/resources/js/index.ts",
  "@affino/datagrid-laravel/*": "packages/datagrid-laravel/resources/js/*",
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
