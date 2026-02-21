/**
 * Pure selection geometry helpers shared between framework adapters.
 * Encapsulates rectangular math so higher-level composables can focus on
 * wiring events and state.
 */
function clampIndex(value, min, max) {
    if (!Number.isFinite(value))
        return min;
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
function clampScalar(value, min, max) {
    if (!Number.isFinite(value))
        return min;
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
export function createGridSelectionContextFromFlattenedRows(options) {
    const flattenedRows = Array.isArray(options.rows) ? options.rows : [];
    const rowCount = flattenedRows.length;
    const colCount = Number.isFinite(options.colCount) ? Math.max(0, Math.trunc(options.colCount)) : 0;
    return {
        grid: {
            rowCount,
            colCount,
        },
        getRowIdByIndex(rowIndex) {
            const normalizedIndex = Number.isFinite(rowIndex) ? Math.trunc(rowIndex) : -1;
            if (normalizedIndex < 0 || normalizedIndex >= rowCount) {
                return null;
            }
            return flattenedRows[normalizedIndex]?.rowId ?? null;
        },
    };
}
function normalizeFlattenedRowLevel(row, fallback) {
    if (!row || !Number.isFinite(row.level)) {
        return fallback;
    }
    return Math.max(0, Math.trunc(row.level));
}
export function applyGroupSelectionPolicy(range, options) {
    if (!options.groupSelectsChildren) {
        return range;
    }
    if (range.startRow !== range.endRow) {
        return range;
    }
    const rows = Array.isArray(options.rows) ? options.rows : [];
    const groupRow = rows[range.startRow];
    if (!groupRow?.isGroup) {
        return range;
    }
    const groupLevel = normalizeFlattenedRowLevel(groupRow, 0);
    let endRow = range.startRow;
    for (let rowIndex = range.startRow + 1; rowIndex < rows.length; rowIndex += 1) {
        const candidate = rows[rowIndex];
        if (!candidate) {
            continue;
        }
        const candidateLevel = normalizeFlattenedRowLevel(candidate, groupLevel + 1);
        if (candidateLevel <= groupLevel) {
            break;
        }
        endRow = rowIndex;
    }
    if (endRow === range.endRow) {
        return range;
    }
    return {
        ...range,
        endRow,
        endRowId: rows[endRow]?.rowId ?? null,
        focus: {
            ...range.focus,
            rowIndex: endRow,
            rowId: rows[endRow]?.rowId ?? null,
        },
    };
}
export function clampGridSelectionPoint(point, context) {
    const rowCount = Math.max(0, context.grid.rowCount);
    const colCount = Math.max(0, context.grid.colCount);
    const maxRow = Math.max(rowCount - 1, 0);
    const maxCol = Math.max(colCount - 1, 0);
    const rowIndex = rowCount > 0 ? clampIndex(point.rowIndex, 0, maxRow) : 0;
    const colIndex = colCount > 0 ? clampIndex(point.colIndex, 0, maxCol) : 0;
    const resolveRowId = context.getRowIdByIndex;
    const rowId = point.rowId != null
        ? point.rowId
        : resolveRowId
            ? resolveRowId(rowIndex) ?? null
            : null;
    return {
        rowIndex,
        colIndex,
        rowId,
    };
}
export function createGridSelectionRange(anchor, focus, context) {
    const clampedAnchor = clampGridSelectionPoint(anchor, context);
    const clampedFocus = clampGridSelectionPoint(focus, context);
    const startRow = Math.min(clampedAnchor.rowIndex, clampedFocus.rowIndex);
    const endRow = Math.max(clampedAnchor.rowIndex, clampedFocus.rowIndex);
    const startCol = Math.min(clampedAnchor.colIndex, clampedFocus.colIndex);
    const endCol = Math.max(clampedAnchor.colIndex, clampedFocus.colIndex);
    const resolveRowId = context.getRowIdByIndex;
    const startRowIdCandidate = clampedAnchor.rowIndex === startRow ? clampedAnchor.rowId : null;
    const startRowIdFallback = clampedFocus.rowIndex === startRow ? clampedFocus.rowId : null;
    const endRowIdCandidate = clampedFocus.rowIndex === endRow ? clampedFocus.rowId : null;
    const endRowIdFallback = clampedAnchor.rowIndex === endRow ? clampedAnchor.rowId : null;
    const startRowId = startRowIdCandidate ??
        startRowIdFallback ??
        (resolveRowId ? resolveRowId(startRow) ?? null : null);
    const endRowId = endRowIdCandidate ??
        endRowIdFallback ??
        (resolveRowId ? resolveRowId(endRow) ?? null : null);
    return {
        anchor: clampedAnchor,
        focus: clampedFocus,
        startRow,
        endRow,
        startCol,
        endCol,
        startRowId: startRowId ?? null,
        endRowId: endRowId ?? null,
    };
}
export function normalizeGridSelectionRange(range, context) {
    if (context.grid.rowCount <= 0 || context.grid.colCount <= 0) {
        return null;
    }
    return createGridSelectionRange(range.anchor, range.focus, context);
}
export function createGridSelectionRangeFromInput(input, context) {
    const anchor = input.anchor ?? {
        rowIndex: Math.min(input.startRow, input.endRow),
        colIndex: Math.min(input.startCol, input.endCol),
    };
    const focus = input.focus ?? {
        rowIndex: Math.max(input.startRow, input.endRow),
        colIndex: Math.max(input.startCol, input.endCol),
    };
    return createGridSelectionRange(anchor, focus, context);
}
export function clampSelectionArea(area, context) {
    const normalized = normalizeArea(area);
    if (!Number.isFinite(normalized.startRow) ||
        !Number.isFinite(normalized.endRow) ||
        !Number.isFinite(normalized.startCol) ||
        !Number.isFinite(normalized.endCol)) {
        return null;
    }
    const rowCount = Math.max(0, context.grid.rowCount);
    const colCount = Math.max(0, context.grid.colCount);
    if (rowCount === 0 || colCount === 0) {
        return null;
    }
    const maxRow = Math.max(rowCount - 1, 0);
    const maxCol = Math.max(colCount - 1, 0);
    const startRow = clampScalar(normalized.startRow, 0, maxRow);
    const endRow = clampScalar(normalized.endRow, 0, maxRow);
    const startCol = clampScalar(normalized.startCol, 0, maxCol);
    const endCol = clampScalar(normalized.endCol, 0, maxCol);
    if (startRow > endRow || startCol > endCol) {
        return null;
    }
    return {
        startRow,
        endRow,
        startCol,
        endCol,
    };
}
export function resolveSelectionBounds(range, context, fallbackToAll = false) {
    if (range) {
        return clampSelectionArea(range, context);
    }
    if (!fallbackToAll) {
        return null;
    }
    const fullArea = {
        startRow: 0,
        endRow: context.grid.rowCount - 1,
        startCol: 0,
        endCol: context.grid.colCount - 1,
    };
    return clampSelectionArea(fullArea, context);
}
function normalizeArea(area) {
    const startRow = Math.min(area.startRow, area.endRow);
    const endRow = Math.max(area.startRow, area.endRow);
    const startCol = Math.min(area.startCol, area.endCol);
    const endCol = Math.max(area.startCol, area.endCol);
    return {
        startRow,
        endRow,
        startCol,
        endCol,
    };
}
function areasOverlap(a, b) {
    return (a.startRow <= b.endRow &&
        a.endRow >= b.startRow &&
        a.startCol <= b.endCol &&
        a.endCol >= b.startCol);
}
function mergePair(a, b) {
    return {
        startRow: Math.min(a.startRow, b.startRow),
        endRow: Math.max(a.endRow, b.endRow),
        startCol: Math.min(a.startCol, b.startCol),
        endCol: Math.max(a.endCol, b.endCol),
    };
}
export function mergeRanges(ranges) {
    const normalized = ranges.map(normalizeArea);
    const result = [];
    for (const range of normalized) {
        let merged = range;
        let keepMerging = true;
        while (keepMerging) {
            keepMerging = false;
            for (let index = 0; index < result.length; index += 1) {
                const current = result[index];
                if (!current)
                    continue;
                if (areasOverlap(current, merged)) {
                    merged = mergePair(current, merged);
                    result.splice(index, 1);
                    keepMerging = true;
                    break;
                }
            }
        }
        result.push(merged);
    }
    return result;
}
function subtractArea(base, removal) {
    const normalizedBase = normalizeArea(base);
    const normalizedRemoval = normalizeArea(removal);
    if (!areasOverlap(normalizedBase, normalizedRemoval)) {
        return [normalizedBase];
    }
    const overlapStartRow = Math.max(normalizedBase.startRow, normalizedRemoval.startRow);
    const overlapEndRow = Math.min(normalizedBase.endRow, normalizedRemoval.endRow);
    const overlapStartCol = Math.max(normalizedBase.startCol, normalizedRemoval.startCol);
    const overlapEndCol = Math.min(normalizedBase.endCol, normalizedRemoval.endCol);
    const pieces = [];
    if (normalizedBase.startRow <= overlapStartRow - 1) {
        pieces.push({
            startRow: normalizedBase.startRow,
            endRow: overlapStartRow - 1,
            startCol: normalizedBase.startCol,
            endCol: normalizedBase.endCol,
        });
    }
    if (overlapEndRow + 1 <= normalizedBase.endRow) {
        pieces.push({
            startRow: overlapEndRow + 1,
            endRow: normalizedBase.endRow,
            startCol: normalizedBase.startCol,
            endCol: normalizedBase.endCol,
        });
    }
    const middleRowStart = Math.max(normalizedBase.startRow, overlapStartRow);
    const middleRowEnd = Math.min(normalizedBase.endRow, overlapEndRow);
    if (middleRowStart <= middleRowEnd) {
        if (normalizedBase.startCol <= overlapStartCol - 1) {
            pieces.push({
                startRow: middleRowStart,
                endRow: middleRowEnd,
                startCol: normalizedBase.startCol,
                endCol: overlapStartCol - 1,
            });
        }
        if (overlapEndCol + 1 <= normalizedBase.endCol) {
            pieces.push({
                startRow: middleRowStart,
                endRow: middleRowEnd,
                startCol: overlapEndCol + 1,
                endCol: normalizedBase.endCol,
            });
        }
    }
    return pieces;
}
export function addRange(ranges, next) {
    return mergeRanges([...ranges, next]);
}
export function removeRange(ranges, target) {
    const normalizedTarget = normalizeArea(target);
    const result = [];
    for (const range of ranges) {
        const pieces = subtractArea(range, normalizedTarget);
        for (const piece of pieces) {
            result.push(piece);
        }
    }
    return mergeRanges(result);
}
export function isCellSelected(ranges, rowIndex, colIndex) {
    for (const range of ranges) {
        if (rowIndex >= range.startRow &&
            rowIndex <= range.endRow &&
            colIndex >= range.startCol &&
            colIndex <= range.endCol) {
            return true;
        }
    }
    return false;
}
export function rangesFromSelection(ranges) {
    return ranges.map(range => normalizeArea(range));
}
export function selectionFromAreas(areas, createAnchor) {
    return areas.map(area => {
        const normalized = normalizeArea(area);
        return {
            anchor: createAnchor(normalized.startRow, normalized.startCol),
            focus: createAnchor(normalized.endRow, normalized.endCol),
            ...normalized,
        };
    });
}
