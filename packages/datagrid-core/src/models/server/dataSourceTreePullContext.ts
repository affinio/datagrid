import type { DataGridDataSourceTreePullContext } from "./dataSourceProtocol.js"

export function createDataSourceTreePullContextRuntime(options: {
  hasExpansion: () => boolean
  getToggledGroupKeys: () => readonly string[]
}) {
  function normalizeGroupKeys(groupKeys: readonly string[]): readonly string[] {
    const seen = new Set<string>()
    const normalized: string[] = []
    for (const rawGroupKey of groupKeys) {
      if (typeof rawGroupKey !== "string") continue
      const groupKey = rawGroupKey.trim()
      if (groupKey.length === 0 || seen.has(groupKey)) continue
      seen.add(groupKey)
      normalized.push(groupKey)
    }
    return normalized
  }

  function create(
    operation: DataGridDataSourceTreePullContext["operation"],
    groupKeys: readonly string[],
    scope: DataGridDataSourceTreePullContext["scope"] = "branch",
  ): DataGridDataSourceTreePullContext {
    return { operation, scope, groupKeys: normalizeGroupKeys(groupKeys) }
  }

  function createProjectionRefresh(): DataGridDataSourceTreePullContext | null {
    if (!options.hasExpansion()) return null
    return create("set-group-expansion", options.getToggledGroupKeys(), "all")
  }

  return { create, createProjectionRefresh }
}
