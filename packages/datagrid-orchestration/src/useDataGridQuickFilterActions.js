export function useDataGridQuickFilterActions(options) {
    function clearQuickFilter() {
        if (!options.resolveQuery()) {
            return;
        }
        options.setQuery("");
        options.setLastAction("Quick filter cleared");
    }
    return {
        clearQuickFilter,
    };
}
