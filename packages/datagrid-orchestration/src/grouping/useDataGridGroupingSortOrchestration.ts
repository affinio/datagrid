import type { DataGridSortState } from "@affino/datagrid-core"

export interface DataGridGroupingSortSnapshot {
  effectiveSortModel: readonly DataGridSortState[]
  sortSummary: string
}

export interface UseDataGridGroupingSortOrchestrationOptions<TGroupByKey extends string> {
  sortState: readonly DataGridSortState[]
  groupBy: TGroupByKey | "none"
}

export function withGroupingSortPriority<TGroupByKey extends string>(
  model: readonly DataGridSortState[],
  groupByKey: TGroupByKey | "none",
): readonly DataGridSortState[] {
  if (groupByKey === "none") {
    return model
  }
  const withoutGroupKey = model.filter(entry => entry.key !== groupByKey)
  const groupEntry = model.find(entry => entry.key === groupByKey)
  return [{ key: groupByKey, direction: groupEntry?.direction ?? "asc" }, ...withoutGroupKey]
}

export function resolveDataGridSortSummary(model: readonly DataGridSortState[]): string {
  if (!model.length) {
    return "none"
  }
  return model
    .map((entry, index) => `${index + 1}:${entry.key}:${entry.direction}`)
    .join(" | ")
}

export function useDataGridGroupingSortOrchestration<TGroupByKey extends string>(
  options: UseDataGridGroupingSortOrchestrationOptions<TGroupByKey>,
): DataGridGroupingSortSnapshot {
  return {
    effectiveSortModel: withGroupingSortPriority(options.sortState, options.groupBy),
    sortSummary: resolveDataGridSortSummary(options.sortState),
  }
}
