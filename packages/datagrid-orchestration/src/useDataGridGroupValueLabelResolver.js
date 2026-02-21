export function useDataGridGroupValueLabelResolver(options) {
    const emptyLabel = options.emptyLabel ?? "(empty)";
    const disabledGroupKeySet = new Set(options.disabledGroupKeys ?? []);
    function resolveGroupValueLabel(row, groupKey) {
        if (disabledGroupKeySet.has(groupKey)) {
            return "";
        }
        const raw = options.resolveCellValue(row, groupKey);
        const normalized = String(raw ?? "").trim();
        return normalized.length > 0 ? normalized : emptyLabel;
    }
    return {
        resolveGroupValueLabel,
    };
}
