import { describe, expect, it } from "vitest"
import { buildGroupedRowsProjection } from "../groupProjectionController"
import type { DataGridGroupExpansionSnapshot, DataGridRowNode } from "../rowModel"

interface TeamRow {
  id: string
  team: string
}

function createLeafRow(id: string, team: string, index: number): DataGridRowNode<TeamRow> {
  return {
    kind: "leaf",
    data: { id, team },
    row: { id, team },
    rowKey: id,
    rowId: id,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
  }
}

function project(
  inputRows: readonly DataGridRowNode<TeamRow>[],
  cache: Map<string, string>,
  maxGroupValueCacheSize: number,
): void {
  const expansionSnapshot: DataGridGroupExpansionSnapshot = {
    expandedByDefault: true,
    toggledGroupKeys: [],
  }
  buildGroupedRowsProjection({
    inputRows,
    groupBy: {
      fields: ["team"],
      expandedByDefault: true,
    },
    expansionSnapshot,
    readRowField: (rowNode, key) => rowNode.data[key as keyof TeamRow],
    normalizeText: value => String(value ?? ""),
    normalizeLeafRow: row => row,
    groupValueCache: cache,
    maxGroupValueCacheSize,
  })
}

describe("groupProjectionController cache policy", () => {
  it("evicts oldest keys instead of clearing entire cache on overflow", () => {
    const cache = new Map<string, string>()
    project(
      [
        createLeafRow("r1", "a", 0),
        createLeafRow("r2", "b", 1),
        createLeafRow("r3", "c", 2),
      ],
      cache,
      2,
    )

    expect(cache.size).toBe(2)
    expect(cache.has("r1::team")).toBe(false)
    expect(cache.has("r2::team")).toBe(true)
    expect(cache.has("r3::team")).toBe(true)
  })

  it("touches cached keys on hit so hot entries survive eviction", () => {
    const cache = new Map<string, string>([
      ["r1::team", "a"],
      ["r2::team", "b"],
    ])

    project(
      [
        createLeafRow("r1", "a", 0),
        createLeafRow("r3", "c", 1),
      ],
      cache,
      2,
    )

    expect(cache.size).toBe(2)
    expect(cache.has("r1::team")).toBe(true)
    expect(cache.has("r2::team")).toBe(false)
    expect(cache.has("r3::team")).toBe(true)
  })
})
