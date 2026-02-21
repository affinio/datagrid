import { createDataGridMutableRowStore, forEachDataGridRangeCell, } from "./dataGridRangeMutationKernel";
function positiveModulo(value, divisor) {
    if (divisor <= 0) {
        return 0;
    }
    const remainder = value % divisor;
    return remainder < 0 ? remainder + divisor : remainder;
}
export function useDataGridRangeMutationEngine(options) {
    const isExcludedColumn = options.isExcludedColumn ?? (columnKey => columnKey === "select");
    const shouldRecomputeDerivedForColumn = options.shouldRecomputeDerivedForColumn ?? (() => false);
    function applyRangeMove() {
        const baseRange = options.resolveRangeMoveBaseRange();
        const targetRange = options.resolveRangeMovePreviewRange();
        if (!baseRange || !targetRange || options.areRangesEqual(baseRange, targetRange)) {
            return false;
        }
        const beforeSnapshot = options.captureBeforeSnapshot();
        const sourceRows = options.resolveSourceRows();
        const rowStore = createDataGridMutableRowStore({
            rows: sourceRows,
            resolveRowId: options.resolveSourceRowId,
            cloneRow: row => ({ ...row }),
        });
        const { sourceById, mutableById, getMutableRow } = rowStore;
        const needsRecompute = new Set();
        const moveEntries = [];
        let blocked = 0;
        const displayedRows = options.resolveDisplayedRows();
        forEachDataGridRangeCell(baseRange, ({ rowIndex, columnIndex, rowOffset, columnOffset }) => {
            const sourceRow = displayedRows[rowIndex];
            const targetRow = displayedRows[targetRange.startRow + rowOffset];
            if (!sourceRow || !targetRow) {
                blocked += 1;
                return;
            }
            const sourceColumnKey = options.resolveColumnKeyAtIndex(columnIndex);
            const targetColumnKey = options.resolveColumnKeyAtIndex(targetRange.startColumn + columnOffset);
            if (!sourceColumnKey || !targetColumnKey) {
                blocked += 1;
                return;
            }
            if (isExcludedColumn(sourceColumnKey) || isExcludedColumn(targetColumnKey)) {
                blocked += 1;
                return;
            }
            moveEntries.push({
                sourceRowId: options.resolveDisplayedRowId(sourceRow),
                sourceColumnKey,
                targetRowId: options.resolveDisplayedRowId(targetRow),
                targetColumnKey,
                value: options.normalizeClipboardValue(options.resolveDisplayedCellValue(sourceRow, sourceColumnKey)),
            });
        });
        if (!moveEntries.length) {
            if (blocked > 0) {
                options.setLastAction(`Move blocked (${blocked} cells)`);
            }
            return false;
        }
        const sourceCellsToClear = new Map();
        for (const entry of moveEntries) {
            const rowCells = sourceCellsToClear.get(entry.sourceRowId) ?? new Set();
            rowCells.add(entry.sourceColumnKey);
            sourceCellsToClear.set(entry.sourceRowId, rowCells);
        }
        for (const [rowId, columnKeys] of sourceCellsToClear.entries()) {
            const mutable = getMutableRow(rowId);
            if (!mutable) {
                blocked += columnKeys.size;
                continue;
            }
            for (const columnKey of columnKeys) {
                const didClear = options.clearValueForMove(mutable, columnKey);
                if (!didClear) {
                    blocked += 1;
                    continue;
                }
                if (shouldRecomputeDerivedForColumn(columnKey)) {
                    needsRecompute.add(rowId);
                }
            }
        }
        let applied = 0;
        for (const entry of moveEntries) {
            const mutable = getMutableRow(entry.targetRowId);
            if (!mutable) {
                blocked += 1;
                continue;
            }
            const didApply = options.applyValueForMove(mutable, entry.targetColumnKey, entry.value);
            if (!didApply) {
                blocked += 1;
                continue;
            }
            if (shouldRecomputeDerivedForColumn(entry.targetColumnKey)) {
                needsRecompute.add(entry.targetRowId);
            }
            applied += 1;
        }
        for (const rowId of needsRecompute) {
            const row = mutableById.get(rowId);
            if (!row) {
                continue;
            }
            options.recomputeDerived(row);
        }
        options.applySourceRows(rowStore.commitRows(sourceRows));
        options.setSelectionFromRange(targetRange, "start");
        void options.recordIntent({
            intent: "move",
            label: blocked > 0 ? `Move ${applied} cells (blocked ${blocked})` : `Move ${applied} cells`,
            affectedRange: targetRange,
        }, beforeSnapshot);
        options.setLastAction(blocked > 0 ? `Moved ${applied} cells, blocked ${blocked}` : `Moved ${applied} cells`);
        return applied > 0;
    }
    function applyFillPreview() {
        const baseRange = options.resolveFillBaseRange();
        const previewRange = options.resolveFillPreviewRange();
        if (!baseRange || !previewRange || options.areRangesEqual(baseRange, previewRange)) {
            return;
        }
        const beforeSnapshot = options.captureBeforeSnapshot();
        const displayedRows = options.resolveDisplayedRows();
        if (!displayedRows.length) {
            return;
        }
        const baseHeight = baseRange.endRow - baseRange.startRow + 1;
        if (baseHeight <= 0) {
            return;
        }
        const sourceRows = options.resolveSourceRows();
        const rowStore = createDataGridMutableRowStore({
            rows: sourceRows,
            resolveRowId: options.resolveSourceRowId,
            cloneRow: row => ({ ...row }),
        });
        const { sourceById, mutableById, getMutableRow } = rowStore;
        const needsRecompute = new Set();
        const baseEditableKeys = new Set();
        for (let columnIndex = baseRange.startColumn; columnIndex <= baseRange.endColumn; columnIndex += 1) {
            const columnKey = options.resolveColumnKeyAtIndex(columnIndex);
            if (!columnKey) {
                continue;
            }
            if (!options.isEditableColumn(columnKey) || isExcludedColumn(columnKey)) {
                continue;
            }
            baseEditableKeys.add(columnKey);
        }
        if (!baseEditableKeys.size) {
            return;
        }
        let changedCells = 0;
        forEachDataGridRangeCell(previewRange, ({ rowIndex, columnIndex }) => {
            const destinationDisplayRow = displayedRows[rowIndex];
            if (!destinationDisplayRow) {
                return;
            }
            if (options.isCellWithinRange(rowIndex, columnIndex, baseRange)) {
                return;
            }
            const columnKey = options.resolveColumnKeyAtIndex(columnIndex);
            if (!columnKey || isExcludedColumn(columnKey)) {
                return;
            }
            if (!options.isEditableColumn(columnKey) || !baseEditableKeys.has(columnKey)) {
                return;
            }
            const sourceRowIndex = baseRange.startRow + positiveModulo(rowIndex - baseRange.startRow, baseHeight);
            const sourceDisplayRow = displayedRows[sourceRowIndex];
            if (!sourceDisplayRow) {
                return;
            }
            const sourceRow = sourceById.get(options.resolveDisplayedRowId(sourceDisplayRow));
            const destinationRow = getMutableRow(options.resolveDisplayedRowId(destinationDisplayRow));
            if (!sourceRow || !destinationRow) {
                return;
            }
            options.applyEditedValue(destinationRow, columnKey, String(options.resolveSourceCellValue(sourceRow, columnKey) ?? ""));
            if (shouldRecomputeDerivedForColumn(columnKey)) {
                needsRecompute.add(options.resolveSourceRowId(destinationRow));
            }
            changedCells += 1;
        });
        if (changedCells === 0) {
            return;
        }
        for (const rowId of needsRecompute) {
            const row = mutableById.get(rowId);
            if (!row) {
                continue;
            }
            options.recomputeDerived(row);
        }
        options.applySourceRows(rowStore.commitRows(sourceRows));
        options.setSelectionFromRange(previewRange, "end");
        void options.recordIntent({
            intent: "fill",
            label: `Fill ${changedCells} cells`,
            affectedRange: previewRange,
        }, beforeSnapshot);
        options.setLastAction(`Fill applied (${changedCells} cells)`);
    }
    return {
        applyRangeMove,
        applyFillPreview,
    };
}
