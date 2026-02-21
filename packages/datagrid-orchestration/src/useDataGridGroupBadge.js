export function useDataGridGroupBadge(options) {
    function isGroupStartRow(row) {
        return options.isGroupStartRowId(options.resolveRowId(row));
    }
    function shouldShowGroupBadge(row, columnKey) {
        if (!options.isGroupedByColumn(columnKey)) {
            return false;
        }
        return isGroupStartRow(row);
    }
    function resolveGroupBadgeText(row) {
        return options.resolveGroupBadgeTextByRowId(options.resolveRowId(row));
    }
    return {
        isGroupStartRow,
        shouldShowGroupBadge,
        resolveGroupBadgeText,
    };
}
