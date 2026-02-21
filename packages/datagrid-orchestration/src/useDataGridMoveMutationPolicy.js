function applyRecordValueForMove(record, columnKey, value) {
    if (!(columnKey in record)) {
        return false;
    }
    const current = record[columnKey];
    if (typeof current === "number") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return false;
        }
        record[columnKey] = numeric;
        return true;
    }
    if (typeof current === "boolean") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") {
            record[columnKey] = true;
            return true;
        }
        if (normalized === "false" || normalized === "0") {
            record[columnKey] = false;
            return true;
        }
        return false;
    }
    record[columnKey] = value;
    return true;
}
function clearRecordValueForMove(record, columnKey) {
    if (!(columnKey in record)) {
        return false;
    }
    const current = record[columnKey];
    if (typeof current === "number") {
        if (current === 0) {
            return false;
        }
        record[columnKey] = 0;
        return true;
    }
    if (typeof current === "boolean") {
        if (!current) {
            return false;
        }
        record[columnKey] = false;
        return true;
    }
    if (current == null || String(current) === "") {
        return false;
    }
    record[columnKey] = "";
    return true;
}
export function useDataGridMoveMutationPolicy(options) {
    function isBlockedColumn(columnKey) {
        return options.isBlockedColumn ? options.isBlockedColumn(columnKey) : false;
    }
    function applyValueForMove(row, columnKey, value) {
        if (isBlockedColumn(columnKey)) {
            return false;
        }
        if (!options.isEditableColumn(columnKey)) {
            return false;
        }
        options.applyEditedValue(row, columnKey, value);
        return true;
    }
    function clearValueForMove(row, columnKey) {
        if (isBlockedColumn(columnKey)) {
            return false;
        }
        if (!options.isEditableColumn(columnKey)) {
            return false;
        }
        return options.clearEditedValue(row, columnKey);
    }
    return {
        applyValueForMove,
        clearValueForMove,
    };
}
