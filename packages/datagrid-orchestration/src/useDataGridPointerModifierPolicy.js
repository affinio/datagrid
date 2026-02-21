export function useDataGridPointerModifierPolicy() {
    function isRangeMoveModifierActive(event) {
        return event.altKey || event.ctrlKey || event.metaKey;
    }
    return {
        isRangeMoveModifierActive,
    };
}
