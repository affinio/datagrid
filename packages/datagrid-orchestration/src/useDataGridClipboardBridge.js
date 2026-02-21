const DEFAULT_FLASH_MS = 1200;
function normalizeClipboardValue(value) {
    if (typeof value === "undefined" || value === null) {
        return "";
    }
    return String(value);
}
export function useDataGridClipboardBridge(options) {
    let copiedSelectionResetTimer = null;
    const flashMs = Number.isFinite(options.copiedSelectionFlashMs)
        ? Math.max(0, Math.trunc(options.copiedSelectionFlashMs))
        : DEFAULT_FLASH_MS;
    const canCopyColumn = options.isColumnCopyable ?? (columnKey => columnKey !== "select");
    function clearCopiedSelectionFlash() {
        options.copiedSelectionRange.value = null;
        if (copiedSelectionResetTimer !== null) {
            clearTimeout(copiedSelectionResetTimer);
            copiedSelectionResetTimer = null;
        }
    }
    function flashCopiedSelection(range) {
        options.copiedSelectionRange.value = { ...range };
        if (copiedSelectionResetTimer !== null) {
            clearTimeout(copiedSelectionResetTimer);
        }
        if (flashMs === 0) {
            return;
        }
        copiedSelectionResetTimer = setTimeout(() => {
            options.copiedSelectionRange.value = null;
            copiedSelectionResetTimer = null;
        }, flashMs);
    }
    function buildCopyPayload(range) {
        const rows = [];
        for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
            const row = options.getRowAtIndex(rowIndex);
            if (!row) {
                continue;
            }
            const cells = [];
            for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
                const columnKey = options.getColumnKeyAtIndex(columnIndex);
                if (!columnKey || !canCopyColumn(columnKey)) {
                    continue;
                }
                cells.push(normalizeClipboardValue(options.getCellValue(row, columnKey)));
            }
            rows.push(cells.join("\t"));
        }
        return rows.join("\n");
    }
    async function writeClipboardPayload(payload) {
        if (options.writeClipboardText) {
            await options.writeClipboardText(payload);
            return;
        }
        if (typeof navigator !== "undefined" &&
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function") {
            await navigator.clipboard.writeText(payload);
            return;
        }
        throw new Error("Clipboard API unavailable");
    }
    async function copySelection(trigger) {
        const range = options.resolveCopyRange();
        if (!range) {
            options.setLastAction("Copy skipped: no active selection");
            return false;
        }
        const payload = buildCopyPayload(range);
        if (!payload) {
            options.setLastAction("Copy skipped: empty selection");
            return false;
        }
        try {
            await writeClipboardPayload(payload);
        }
        catch {
            // Clipboard permissions can be unavailable in some environments.
        }
        options.lastCopiedPayload.value = payload;
        flashCopiedSelection(range);
        options.closeContextMenu();
        const rows = range.endRow - range.startRow + 1;
        const columns = range.endColumn - range.startColumn + 1;
        options.setLastAction(`Copied ${rows}x${columns} cells (${trigger})`);
        return true;
    }
    async function readClipboardPayload() {
        if (options.readClipboardText) {
            try {
                const payload = await options.readClipboardText();
                if (typeof payload === "string") {
                    return payload;
                }
            }
            catch {
                // Fallback to in-memory payload.
            }
            return options.lastCopiedPayload.value;
        }
        if (typeof navigator !== "undefined" &&
            navigator.clipboard &&
            typeof navigator.clipboard.readText === "function") {
            try {
                return await navigator.clipboard.readText();
            }
            catch {
                // Fallback to in-memory payload.
            }
        }
        return options.lastCopiedPayload.value;
    }
    function parseClipboardMatrix(payload) {
        const normalized = payload.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const rows = normalized
            .split("\n")
            .filter(row => row.length > 0)
            .map(row => row.split("\t"));
        return rows.length ? rows : [[]];
    }
    function dispose() {
        if (copiedSelectionResetTimer !== null) {
            clearTimeout(copiedSelectionResetTimer);
            copiedSelectionResetTimer = null;
        }
    }
    return {
        copySelection,
        readClipboardPayload,
        parseClipboardMatrix,
        clearCopiedSelectionFlash,
        flashCopiedSelection,
        dispose,
    };
}
