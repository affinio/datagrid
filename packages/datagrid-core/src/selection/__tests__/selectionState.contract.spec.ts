import { describe, expect, it } from "vitest"
import {
  addRange,
  applyGroupSelectionPolicy,
  clampGridSelectionPoint,
  clampSelectionArea,
  createGridSelectionContextFromFlattenedRows,
  createGridSelectionRange,
  createGridSelectionRangeFromInput,
  isCellSelected,
  mergeRanges,
  normalizeGridSelectionRange,
  rangesFromSelection,
  removeRange,
  resolveSelectionBounds,
  selectionFromAreas,
  type GridSelectionFlattenedRow,
  type GridSelectionRange,
  type SelectionArea,
} from "../selectionState"

describe("selection state geometry contract", () => {
  it("resolves row ids from context and handles invalid row indexes deterministically", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [{ rowId: "row-1" }, { rowId: "row-2" }],
      colCount: 3,
    })

    expect(context.getRowIdByIndex?.(Number.NaN)).toBeNull()
    expect(context.getRowIdByIndex?.(10)).toBeNull()

    const point = clampGridSelectionPoint({ rowIndex: 1, colIndex: 2 }, context)
    expect(point).toEqual({ rowIndex: 1, colIndex: 2, rowId: "row-2" })
  })

  it("keeps group selection unchanged when policy preconditions are not met", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [{ rowId: "group-a", isGroup: true }, { rowId: "leaf-a", isGroup: false }],
      colCount: 4,
    })
    const range = createGridSelectionRange(
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 1, colIndex: 1 },
      context,
    )

    const multiRow = applyGroupSelectionPolicy(range, {
      rows: [{ rowId: "group-a", isGroup: true, level: 0 }],
      groupSelectsChildren: true,
    })
    expect(multiRow).toEqual(range)

    const single = createGridSelectionRange(
      { rowIndex: 1, colIndex: 1 },
      { rowIndex: 1, colIndex: 1 },
      context,
    )
    const nonGroup = applyGroupSelectionPolicy(single, {
      rows: [{ rowId: "group-a", isGroup: true, level: 0 }, { rowId: "leaf-a", isGroup: false, level: 1 }],
      groupSelectsChildren: true,
    })
    expect(nonGroup).toEqual(single)
  })

  it("expands group range with sparse child rows and fallback levels", () => {
    const rows = [
      { rowId: "group-root", isGroup: true, level: Number.NaN },
      undefined,
      { rowId: "leaf-a", isGroup: false, level: 2 },
      { rowId: "group-next", isGroup: true, level: 0 },
    ] as unknown as readonly GridSelectionFlattenedRow<string>[]
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [
        { rowId: "group-root", isGroup: true, level: 0 },
        { rowId: "leaf-a", isGroup: false, level: 1 },
        { rowId: "group-next", isGroup: true, level: 0 },
      ],
      colCount: 3,
    })
    const single = createGridSelectionRange(
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 0 },
      context,
    )

    const expanded = applyGroupSelectionPolicy(single, {
      rows,
      groupSelectsChildren: true,
    })

    expect(expanded.startRow).toBe(0)
    expect(expanded.endRow).toBe(2)
    expect(expanded.focus.rowIndex).toBe(2)
    expect(expanded.endRowId).toBe("leaf-a")
  })

  it("keeps single group selection unchanged when no descendants are selected", () => {
    const rows = [
      { rowId: "group-eu", isGroup: true, level: 0 },
      { rowId: "group-us", isGroup: true, level: 0 },
    ] as const
    const context = createGridSelectionContextFromFlattenedRows({
      rows,
      colCount: 2,
    })
    const single = createGridSelectionRange(
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 0, colIndex: 1 },
      context,
    )

    const unchanged = applyGroupSelectionPolicy(single, {
      rows,
      groupSelectsChildren: true,
    })

    expect(unchanged).toEqual(single)
  })

  it("returns null when normalization context has empty dimensions", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [],
      colCount: 0,
    })

    const range: GridSelectionRange<string> = {
      startRow: 3,
      endRow: 1,
      startCol: 2,
      endCol: 0,
      anchor: { rowIndex: 3, colIndex: 2, rowId: "a" },
      focus: { rowIndex: 1, colIndex: 0, rowId: "b" },
    }

    expect(normalizeGridSelectionRange(range, context)).toBeNull()
    expect(clampSelectionArea({ startRow: 0, endRow: 1, startCol: 0, endCol: 1 }, context)).toBeNull()
  })

  it("normalizes valid selection ranges in non-empty contexts", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [{ rowId: "r0" }, { rowId: "r1" }],
      colCount: 2,
    })
    const range: GridSelectionRange<string> = {
      startRow: 1,
      endRow: 0,
      startCol: 1,
      endCol: 0,
      anchor: { rowIndex: 1, colIndex: 1, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 0, rowId: "r0" },
    }

    const normalized = normalizeGridSelectionRange(range, context)
    expect(normalized).toEqual({
      startRow: 0,
      endRow: 1,
      startCol: 0,
      endCol: 1,
      startRowId: "r0",
      endRowId: "r1",
      anchor: { rowIndex: 1, colIndex: 1, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 0, rowId: "r0" },
    })
  })

  it("creates range from input defaults and clamps to bounds", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [{ rowId: "r0" }, { rowId: "r1" }, { rowId: "r2" }],
      colCount: 2,
    })

    const range = createGridSelectionRangeFromInput(
      {
        startRow: 9,
        endRow: -2,
        startCol: 5,
        endCol: -1,
      },
      context,
    )

    expect(range.startRow).toBe(0)
    expect(range.endRow).toBe(2)
    expect(range.startCol).toBe(0)
    expect(range.endCol).toBe(1)
    expect(range.startRowId).toBe("r0")
    expect(range.endRowId).toBe("r2")
  })

  it("resolves fallback full-bounds selection and area clamping", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [{ rowId: "r0" }, { rowId: "r1" }],
      colCount: 3,
    })

    expect(resolveSelectionBounds(null, context, false)).toBeNull()
    expect(resolveSelectionBounds(null, context, true)).toEqual({
      startRow: 0,
      endRow: 1,
      startCol: 0,
      endCol: 2,
    })

    expect(
      clampSelectionArea(
        { startRow: Number.POSITIVE_INFINITY, endRow: Number.NEGATIVE_INFINITY, startCol: 0, endCol: 1 },
        context,
      ),
    ).toBeNull()

    expect(
      clampSelectionArea(
        { startRow: -10, endRow: 10, startCol: -10, endCol: 10 },
        context,
      ),
    ).toEqual({
      startRow: 0,
      endRow: 1,
      startCol: 0,
      endCol: 2,
    })
  })

  it("prefers explicit range bounds over fallback-to-all", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [{ rowId: "r0" }, { rowId: "r1" }, { rowId: "r2" }],
      colCount: 4,
    })
    const selected = createGridSelectionRange(
      { rowIndex: 1, colIndex: 1 },
      { rowIndex: 2, colIndex: 2 },
      context,
    )

    const bounds = resolveSelectionBounds(selected, context, true)
    expect(bounds).toEqual({
      startRow: 1,
      endRow: 2,
      startCol: 1,
      endCol: 2,
    })
  })

  it("returns null for fallback-to-all when grid context is empty", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [],
      colCount: 3,
    })

    expect(resolveSelectionBounds(null, context, true)).toBeNull()
  })

  it("merges and removes ranges deterministically", () => {
    const merged = mergeRanges([
      { startRow: 2, endRow: 0, startCol: 2, endCol: 0 },
      { startRow: 1, endRow: 3, startCol: 1, endCol: 3 },
      { startRow: 10, endRow: 11, startCol: 0, endCol: 0 },
    ])
    expect(merged).toEqual([
      { startRow: 0, endRow: 3, startCol: 0, endCol: 3 },
      { startRow: 10, endRow: 11, startCol: 0, endCol: 0 },
    ])

    const removed = removeRange(
      [{ startRow: 0, endRow: 4, startCol: 0, endCol: 4 }],
      { startRow: 1, endRow: 3, startCol: 1, endCol: 3 },
    )
    expect(removed).toEqual([
      { startRow: 0, endRow: 0, startCol: 0, endCol: 4 },
      { startRow: 4, endRow: 4, startCol: 0, endCol: 4 },
      { startRow: 1, endRow: 3, startCol: 0, endCol: 0 },
      { startRow: 1, endRow: 3, startCol: 4, endCol: 4 },
    ])

    const fullyRemoved = removeRange(
      [{ startRow: 2, endRow: 5, startCol: 2, endCol: 5 }],
      { startRow: 2, endRow: 5, startCol: 2, endCol: 5 },
    )
    expect(fullyRemoved).toEqual([])
  })

  it("adds ranges and resolves cell inclusion predicates", () => {
    const added = addRange(
      [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0 }],
      { startRow: 0, endRow: 1, startCol: 0, endCol: 1 },
    )
    expect(added).toEqual([{ startRow: 0, endRow: 1, startCol: 0, endCol: 1 }])

    expect(isCellSelected(added, 1, 1)).toBe(true)
    expect(isCellSelected(added, 4, 4)).toBe(false)
  })

  it("round-trips between selection ranges and plain areas", () => {
    const areas: SelectionArea[] = [
      { startRow: 2, endRow: 0, startCol: 1, endCol: 0 },
      { startRow: 3, endRow: 3, startCol: 2, endCol: 2 },
    ]

    const selection = selectionFromAreas(areas, (rowIndex, colIndex) => ({ rowIndex, colIndex }))
    expect(selection).toEqual([
      {
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 1,
        anchor: { rowIndex: 0, colIndex: 0 },
        focus: { rowIndex: 2, colIndex: 1 },
      },
      {
        startRow: 3,
        endRow: 3,
        startCol: 2,
        endCol: 2,
        anchor: { rowIndex: 3, colIndex: 2 },
        focus: { rowIndex: 3, colIndex: 2 },
      },
    ])

    expect(rangesFromSelection(selection)).toEqual([
      { startRow: 0, endRow: 2, startCol: 0, endCol: 1 },
      { startRow: 3, endRow: 3, startCol: 2, endCol: 2 },
    ])
  })
})
