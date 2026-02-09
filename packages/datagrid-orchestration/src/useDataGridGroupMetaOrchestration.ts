export interface DataGridGroupMetaSnapshot {
  starts: Set<string>
  values: Map<string, string>
  counts: Map<string, number>
  groups: number
}

export interface UseDataGridGroupMetaOrchestrationOptions<TRow, TGroupByKey extends string> {
  rows: readonly TRow[]
  groupBy: TGroupByKey | "none"
  resolveRowId: (row: TRow) => string | number
  resolveGroupValue: (row: TRow, groupBy: TGroupByKey) => string | null | undefined
}

export function normalizeDataGridGroupValue(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : "(empty)"
}

export function useDataGridGroupMetaOrchestration<TRow, TGroupByKey extends string>(
  options: UseDataGridGroupMetaOrchestrationOptions<TRow, TGroupByKey>,
): DataGridGroupMetaSnapshot {
  const starts = new Set<string>()
  const values = new Map<string, string>()
  const counts = new Map<string, number>()

  if (options.groupBy === "none") {
    return { starts, values, counts, groups: 0 }
  }

  let previousGroupValue: string | null = null
  let currentStartRowId: string | null = null

  for (const row of options.rows) {
    const rowId = String(options.resolveRowId(row))
    const currentGroupValue = normalizeDataGridGroupValue(options.resolveGroupValue(row, options.groupBy))
    if (previousGroupValue === null || currentGroupValue !== previousGroupValue) {
      starts.add(rowId)
      values.set(rowId, currentGroupValue)
      counts.set(rowId, 1)
      previousGroupValue = currentGroupValue
      currentStartRowId = rowId
      continue
    }
    if (!currentStartRowId) {
      continue
    }
    counts.set(currentStartRowId, (counts.get(currentStartRowId) ?? 0) + 1)
  }

  return { starts, values, counts, groups: starts.size }
}

export function isDataGridGroupStartRow(snapshot: DataGridGroupMetaSnapshot, rowId: string | number): boolean {
  return snapshot.starts.has(String(rowId))
}

export function resolveDataGridGroupBadgeText(snapshot: DataGridGroupMetaSnapshot, rowId: string | number): string {
  const normalizedRowId = String(rowId)
  const groupValue = snapshot.values.get(normalizedRowId) ?? ""
  const count = snapshot.counts.get(normalizedRowId) ?? 0
  return `${groupValue} (${count})`
}

export function resolveDataGridGroupBySummary<TGroupByKey extends string>(groupBy: TGroupByKey | "none"): string {
  return groupBy === "none" ? "none" : String(groupBy)
}
