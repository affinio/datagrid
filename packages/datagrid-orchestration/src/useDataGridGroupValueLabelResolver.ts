export interface UseDataGridGroupValueLabelResolverOptions<
  TRow,
  TGroupKey extends string,
> {
  resolveCellValue: (row: TRow, groupKey: TGroupKey) => unknown
  emptyLabel?: string
  disabledGroupKeys?: readonly TGroupKey[]
}

export interface UseDataGridGroupValueLabelResolverResult<
  TRow,
  TGroupKey extends string,
> {
  resolveGroupValueLabel: (row: TRow, groupKey: TGroupKey) => string
}

export function useDataGridGroupValueLabelResolver<
  TRow,
  TGroupKey extends string,
>(
  options: UseDataGridGroupValueLabelResolverOptions<TRow, TGroupKey>,
): UseDataGridGroupValueLabelResolverResult<TRow, TGroupKey> {
  const emptyLabel = options.emptyLabel ?? "(empty)"
  const disabledGroupKeySet = new Set(options.disabledGroupKeys ?? [])

  function resolveGroupValueLabel(row: TRow, groupKey: TGroupKey): string {
    if (disabledGroupKeySet.has(groupKey)) {
      return ""
    }
    const raw = options.resolveCellValue(row, groupKey)
    const normalized = String(raw ?? "").trim()
    return normalized.length > 0 ? normalized : emptyLabel
  }

  return {
    resolveGroupValueLabel,
  }
}
