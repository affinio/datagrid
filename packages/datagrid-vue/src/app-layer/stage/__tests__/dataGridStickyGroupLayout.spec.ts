import { describe, expect, it } from "vitest"
import type { DataGridRowNode } from "@affino/datagrid-vue/headless"
import {
  buildStickyRootGroupIntervals,
  resolveStickyRootGroupPlacement,
} from "../dataGridStickyGroupLayout"

function group(rowId: string, level: number, expanded = true): DataGridRowNode<Record<string, unknown>> {
  return {
    kind: "group",
    rowId,
    rowKey: rowId,
    displayIndex: 0,
    sourceIndex: 0,
    originalIndex: 0,
    data: {},
    row: {},
    state: { selected: false, group: true, pinned: "none", expanded },
    groupMeta: { groupKey: rowId, groupField: "field", groupValue: rowId, level, childrenCount: 1 },
  }
}

function leaf(rowId: string): DataGridRowNode<Record<string, unknown>> {
  return { ...group(rowId, -1), kind: "leaf", groupMeta: undefined }
}

describe("dataGridStickyGroupLayout", () => {
  it("indexes root group subtree boundaries while excluding nested group starts", () => {
    const rows = [group("a", 0), group("a/nested", 1), leaf("a/leaf"), group("b", 0), leaf("b/leaf")]
    const groups = buildStickyRootGroupIntervals(rows.length, index => rows[index] ?? null)

    expect(groups).toEqual([
      { nodeId: "a", sourceIndex: 0, subtreeEndIndex: 3, expanded: true },
      { nodeId: "b", sourceIndex: 3, subtreeEndIndex: 5, expanded: true },
    ])
  })

  it("moves from natural placement to sticky placement, then pushes off at the subtree end", () => {
    const groups = [{ nodeId: "a", sourceIndex: 0, subtreeEndIndex: 5, expanded: true }]
    const geometry = {
      enabled: true,
      viewportWidth: 500,
      viewportHeight: 120,
      topInset: 0,
      resolveRowOffset: (index: number) => index * 20,
      resolveRowHeight: () => 20,
    }

    expect(resolveStickyRootGroupPlacement(groups, { ...geometry, scrollTop: 0 })).toBeNull()
    expect(resolveStickyRootGroupPlacement(groups, { ...geometry, scrollTop: 20 })).toMatchObject({
      nodeId: "a",
      naturalViewportY: -20,
      viewportY: 0,
      height: 20,
      visibleRect: { y: 0, height: 20, width: 500 },
    })
    expect(resolveStickyRootGroupPlacement(groups, { ...geometry, scrollTop: 88 })).toMatchObject({
      viewportY: -8,
      visibleRect: { y: 0, height: 12 },
    })
    expect(resolveStickyRootGroupPlacement(groups, { ...geometry, scrollTop: 100 })).toBeNull()
  })

  it("does not place collapsed or taller-than-viewport groups", () => {
    const groups = [
      { nodeId: "collapsed", sourceIndex: 0, subtreeEndIndex: 1, expanded: false },
      { nodeId: "large", sourceIndex: 2, subtreeEndIndex: 4, expanded: true },
    ]
    const geometry = {
      enabled: true,
      scrollTop: 50,
      viewportWidth: 100,
      viewportHeight: 40,
      topInset: 0,
      resolveRowOffset: (index: number) => index * 20,
      resolveRowHeight: () => 45,
    }

    expect(resolveStickyRootGroupPlacement(groups, geometry)).toBeNull()
  })
})
