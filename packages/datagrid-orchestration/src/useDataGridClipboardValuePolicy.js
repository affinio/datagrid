export function useDataGridClipboardValuePolicy() {
    function normalizeClipboardValue(value) {
        if (typeof value === "undefined" || value === null) {
            return "";
        }
        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }
        return String(value);
    }
    return {
        normalizeClipboardValue,
    };
}
