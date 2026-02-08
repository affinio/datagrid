export type DataGridSemver = `${number}.${number}.${number}`

export interface DataGridDeprecationWindow {
  id: string
  deprecatedIn: DataGridSemver
  removeIn: DataGridSemver
  replacement: string
  codemodCommand?: string
  notes?: string
}

export type DataGridDeprecationStatus = "active" | "warning" | "removal-ready"

export interface DataGridDeprecationSnapshot extends DataGridDeprecationWindow {
  status: DataGridDeprecationStatus
}

export interface DataGridVersionedPublicProtocol {
  protocolVersion: DataGridSemver
  packageVersion: DataGridSemver
  stableEntrypoints: readonly string[]
  advancedEntrypoints: readonly string[]
  internalEntrypoints: readonly string[]
  forbiddenDeepImportPatterns: readonly string[]
  semverRules: readonly string[]
  deprecations: readonly DataGridDeprecationSnapshot[]
}

export const DATAGRID_PUBLIC_PROTOCOL_VERSION: DataGridSemver = "1.0.0"
export const DATAGRID_PUBLIC_PACKAGE_VERSION: DataGridSemver = "0.1.0"

export const DATAGRID_STABLE_ENTRYPOINTS = [
  "@affino/datagrid-core",
  "@affino/datagrid-vue",
] as const

export const DATAGRID_ADVANCED_ENTRYPOINTS = [
  "@affino/datagrid-core/advanced",
] as const

export const DATAGRID_INTERNAL_ENTRYPOINTS = [
  "@affino/datagrid-core/internal",
] as const

export const DATAGRID_FORBIDDEN_DEEP_IMPORT_PATTERNS = [
  "@affino/datagrid-core/src/*",
  "@affino/datagrid-core/viewport/*",
  "@affino/datagrid-vue/src/*",
] as const

export const DATAGRID_SEMVER_RULES = [
  "Only package root entrypoints are semver-safe for consumers.",
  "Advanced entrypoints are supported for power users and may evolve with tighter deprecation periods.",
  "Internal entrypoints are explicitly unsafe and are not covered by semver guarantees.",
  "Deep imports under /src and internal feature folders are unsupported for public integrations.",
  "Deprecated APIs remain supported until removeIn version, then can be removed in the next minor/major period.",
  "All deprecations must provide a replacement and codemod command before removal-ready status.",
] as const

export const DATAGRID_DEPRECATION_WINDOWS: readonly DataGridDeprecationWindow[] = [
  {
    id: "core.viewport.createTableViewportController",
    deprecatedIn: "0.2.0",
    removeIn: "0.4.0",
    replacement: "createDataGridViewportController from @affino/datagrid-core/advanced",
    codemodCommand: "pnpm run codemod:datagrid:public-protocol -- --write <path>",
    notes: "Use advanced import and DataGrid-named controller factory.",
  },
  {
    id: "vue.useTableViewport.serverIntegration-option",
    deprecatedIn: "0.2.0",
    removeIn: "0.4.0",
    replacement: "rowModel-driven integration via @affino/datagrid-core model contracts",
    codemodCommand: "pnpm run codemod:datagrid:public-protocol -- --write <path>",
    notes: "serverIntegration path is compatibility-only and will be removed after migration period.",
  },
] as const

interface ParsedSemver {
  major: number
  minor: number
  patch: number
}

function parseSemver(value: string): ParsedSemver {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  if (!match) {
    throw new Error(`[DataGridPublicProtocol] invalid semver "${value}". Expected "x.y.z".`)
  }
  return {
    major: Number.parseInt(match[1] ?? "0", 10),
    minor: Number.parseInt(match[2] ?? "0", 10),
    patch: Number.parseInt(match[3] ?? "0", 10),
  }
}

export function compareDatagridSemver(left: string, right: string): number {
  const a = parseSemver(left)
  const b = parseSemver(right)

  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

export function resolveDatagridDeprecationStatus(
  packageVersion: string,
  entry: DataGridDeprecationWindow,
): DataGridDeprecationStatus {
  if (compareDatagridSemver(packageVersion, entry.deprecatedIn) < 0) {
    return "active"
  }
  if (compareDatagridSemver(packageVersion, entry.removeIn) < 0) {
    return "warning"
  }
  return "removal-ready"
}

export function getDataGridVersionedPublicProtocol(
  packageVersion: DataGridSemver = DATAGRID_PUBLIC_PACKAGE_VERSION,
): DataGridVersionedPublicProtocol {
  return {
    protocolVersion: DATAGRID_PUBLIC_PROTOCOL_VERSION,
    packageVersion,
    stableEntrypoints: DATAGRID_STABLE_ENTRYPOINTS,
    advancedEntrypoints: DATAGRID_ADVANCED_ENTRYPOINTS,
    internalEntrypoints: DATAGRID_INTERNAL_ENTRYPOINTS,
    forbiddenDeepImportPatterns: DATAGRID_FORBIDDEN_DEEP_IMPORT_PATTERNS,
    semverRules: DATAGRID_SEMVER_RULES,
    deprecations: DATAGRID_DEPRECATION_WINDOWS.map((entry) => ({
      ...entry,
      status: resolveDatagridDeprecationStatus(packageVersion, entry),
    })),
  }
}
