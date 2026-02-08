import { describe, expect, it } from "vitest"
import {
  getDataGridRowRenderMeta,
  isDataGridGroupRowNode,
  isDataGridLeafRowNode,
  normalizeRowNode,
} from "../index"
import {
  cloneGroupBySpec,
  isGroupExpanded,
  isSameGroupBySpec,
  normalizeGroupBySpec,
  toggleGroupExpansionKey,
} from "../rowModel"

describe("rowModel normalization", () => {
  it("defaults to leaf kind for regular rows", () => {
    const row = normalizeRowNode(
      {
        row: { id: 1, owner: "alice" },
        rowId: "r-1",
        originalIndex: 0,
        displayIndex: 0,
      },
      0,
    )

    expect(row.kind).toBe("leaf")
    expect(row.state.group).toBe(false)
    expect(row.groupMeta).toBeUndefined()
    expect(isDataGridLeafRowNode(row)).toBe(true)
    expect(isDataGridGroupRowNode(row)).toBe(false)
  })

  it("infers group kind from legacy state.group and normalizes group meta defaults", () => {
    const row = normalizeRowNode(
      {
        row: { label: "EU" },
        rowId: "region=EU",
        originalIndex: 4,
        displayIndex: 4,
        state: { group: true, expanded: true },
      },
      4,
    )

    expect(row.kind).toBe("group")
    expect(row.state.group).toBe(true)
    expect(row.groupMeta).toEqual({
      groupKey: "region=EU",
      groupField: "",
      groupValue: "region=EU",
      level: 0,
      childrenCount: 0,
    })
    expect(isDataGridGroupRowNode(row)).toBe(true)
    expect(isDataGridLeafRowNode(row)).toBe(false)
  })

  it("keeps explicit group kind and clamps group meta shape", () => {
    const row = normalizeRowNode(
      {
        kind: "group",
        row: { label: "service=api" },
        rowId: "service=api",
        originalIndex: 8,
        displayIndex: 8,
        groupMeta: {
          groupKey: "service=api",
          groupField: "service",
          groupValue: "api",
          level: -4,
          childrenCount: -9,
        },
      },
      8,
    )

    expect(row.kind).toBe("group")
    expect(row.groupMeta).toEqual({
      groupKey: "service=api",
      groupField: "service",
      groupValue: "api",
      level: 0,
      childrenCount: 0,
    })
  })

  it("builds adapter render meta from canonical row kinds without viewport coupling", () => {
    const groupRow = normalizeRowNode(
      {
        kind: "group",
        row: { label: "region=EU" },
        rowId: "region=EU",
        originalIndex: 0,
        displayIndex: 0,
        state: { group: true, expanded: true },
        groupMeta: {
          groupKey: "region=EU",
          groupField: "region",
          groupValue: "EU",
          level: 2,
          childrenCount: 4,
        },
      },
      0,
    )
    const leafRow = normalizeRowNode(
      {
        row: { id: 10 },
        rowId: "leaf-10",
        originalIndex: 1,
        displayIndex: 1,
      },
      1,
    )

    expect(getDataGridRowRenderMeta(groupRow)).toEqual({
      level: 2,
      isGroup: true,
      isExpanded: true,
      hasChildren: true,
    })
    expect(getDataGridRowRenderMeta(leafRow)).toEqual({
      level: 0,
      isGroup: false,
    })
  })

  it("normalizes group-by spec deterministically", () => {
    const normalized = normalizeGroupBySpec({
      fields: ["", " owner ", "owner", "service"],
      expandedByDefault: 1 as unknown as boolean,
    })
    expect(normalized).toEqual({
      fields: ["owner", "service"],
      expandedByDefault: true,
    })
    expect(cloneGroupBySpec(normalized)).toEqual(normalized)
    expect(isSameGroupBySpec(normalized, { fields: ["owner", "service"], expandedByDefault: true })).toBe(true)
    expect(isSameGroupBySpec(normalized, { fields: ["service", "owner"], expandedByDefault: true })).toBe(false)
  })

  it("toggles expansion keys deterministically", () => {
    const toggled = new Set<string>()
    expect(toggleGroupExpansionKey(toggled, " owner=alice ")).toBe(true)
    expect(isGroupExpanded({ expandedByDefault: false, toggledGroupKeys: [...toggled] }, "owner=alice")).toBe(true)
    expect(toggleGroupExpansionKey(toggled, "owner=alice")).toBe(true)
    expect(isGroupExpanded({ expandedByDefault: false, toggledGroupKeys: [...toggled] }, "owner=alice")).toBe(false)
    expect(toggleGroupExpansionKey(toggled, "   ")).toBe(false)
  })
})
