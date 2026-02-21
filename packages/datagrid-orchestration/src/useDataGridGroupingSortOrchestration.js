export function withGroupingSortPriority(model, groupByKey) {
    if (groupByKey === "none") {
        return model;
    }
    const withoutGroupKey = model.filter(entry => entry.key !== groupByKey);
    const groupEntry = model.find(entry => entry.key === groupByKey);
    return [{ key: groupByKey, direction: groupEntry?.direction ?? "asc" }, ...withoutGroupKey];
}
export function resolveDataGridSortSummary(model) {
    if (!model.length) {
        return "none";
    }
    return model
        .map((entry, index) => `${index + 1}:${entry.key}:${entry.direction}`)
        .join(" | ");
}
export function useDataGridGroupingSortOrchestration(options) {
    return {
        effectiveSortModel: withGroupingSortPriority(options.sortState, options.groupBy),
        sortSummary: resolveDataGridSortSummary(options.sortState),
    };
}
