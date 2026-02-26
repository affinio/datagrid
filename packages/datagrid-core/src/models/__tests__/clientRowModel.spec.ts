import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  createDataGridDependencyGraph,
  createDataGridProjectionPolicy,
  normalizeViewportRange,
} from "../index"
import type { VisibleRow } from "../../types"
import type { DataGridRowNodeInput } from "../rowModel"

function buildRows(count: number): VisibleRow<{ id: number }>[] {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: index },
    rowId: index,
    originalIndex: index,
    displayIndex: index,
  }))
}

function encodeGroupKey(segments: readonly { field: string; value: string }[]): string {
  let encoded = "group:"
  for (const segment of segments) {
    encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`
  }
  return encoded
}

function encodeTreePathGroupKey(segments: readonly string[]): string {
  let encoded = "tree:path:"
  for (const segment of segments) {
    encoded += `${segment.length}:${segment}`
  }
  return encoded
}

describe("createClientRowModel", () => {
  it("normalizes viewport range to row count", () => {
    expect(normalizeViewportRange({ start: 10, end: 100 }, 3)).toEqual({ start: 2, end: 2 })
    expect(normalizeViewportRange({ start: -10, end: -1 }, 0)).toEqual({ start: 0, end: 0 })
  })

  it("updates viewport range and notifies subscribers", () => {
    const model = createClientRowModel({ rows: buildRows(20) })
    let notifications = 0
    const unsubscribe = model.subscribe(snapshot => {
      notifications += 1
      expect(snapshot.rowCount).toBe(20)
    })

    model.setViewportRange({ start: 2, end: 8 })
    expect(model.getSnapshot().viewportRange).toEqual({ start: 2, end: 8 })
    expect(notifications).toBe(1)

    model.setViewportRange({ start: 2, end: 8 })
    expect(notifications).toBe(1)

    unsubscribe()
    model.dispose()
  })

  it("supports pagination state roundtrip and deterministic page projection", () => {
    const model = createClientRowModel({ rows: buildRows(23) })

    model.setPagination({ pageSize: 5, currentPage: 2 })
    const snapshot = model.getSnapshot()
    expect(snapshot.pagination).toEqual({
      enabled: true,
      pageSize: 5,
      currentPage: 2,
      pageCount: 5,
      totalRowCount: 23,
      startIndex: 10,
      endIndex: 14,
    })
    expect(snapshot.rowCount).toBe(5)
    expect(model.getRowsInRange({ start: 0, end: 4 }).map(row => row.row.id)).toEqual([10, 11, 12, 13, 14])

    model.setPageSize(10)
    expect(model.getSnapshot().pagination.currentPage).toBe(0)
    expect(model.getSnapshot().rowCount).toBe(10)

    model.setCurrentPage(2)
    expect(model.getRowsInRange({ start: 0, end: 9 }).map(row => row.row.id)).toEqual([20, 21, 22])

    model.refresh("manual")
    expect(model.getSnapshot().pagination.currentPage).toBe(2)

    model.setPageSize(null)
    expect(model.getSnapshot().pagination.enabled).toBe(false)
    expect(model.getSnapshot().rowCount).toBe(23)

    model.dispose()
  })

  it("reorders client source rows deterministically and updates projection snapshot", () => {
    const model = createClientRowModel({
      rows: buildRows(6),
    })

    const moved = model.reorderRows({ fromIndex: 0, toIndex: 6 })
    expect(moved).toBe(true)
    expect(model.getRowsInRange({ start: 0, end: 5 }).map(row => row.row.id)).toEqual([1, 2, 3, 4, 5, 0])

    model.setPageSize(3)
    model.setCurrentPage(1)
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => row.row.id)).toEqual([4, 5, 0])

    model.dispose()
  })

  it("returns rows in canonical range", () => {
    const rows = buildRows(10)
    const model = createClientRowModel({ rows })
    const node = model.getRow(3)
    expect(node?.row.id).toBe(3)
    expect(node?.rowKey).toBe(3)
    expect(node?.sourceIndex).toBe(3)
    expect(node?.displayIndex).toBe(3)
    expect(node?.state).toEqual({
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    })
    expect(model.getRowsInRange({ start: 2, end: 5 }).map(row => row.row.id)).toEqual([2, 3, 4, 5])
    model.dispose()
  })

  it("normalizes both legacy and canonical row-node inputs", () => {
    const rows: DataGridRowNodeInput<{ id: number }>[] = [
      {
        kind: "leaf",
        data: { id: 10 },
        row: { id: 10 },
        rowKey: "a",
        rowId: "a",
        sourceIndex: 0,
        originalIndex: 0,
        displayIndex: 0,
        state: { selected: true, group: false, pinned: "none", expanded: false },
      },
      {
        row: { id: 11 },
        rowId: "b",
        originalIndex: 1,
        displayIndex: 1,
      },
      {
        row: { id: 12 },
        rowId: "c",
        originalIndex: 2,
        displayIndex: 2,
        state: { pinned: "bottom" },
      },
    ]
    const model = createClientRowModel({ rows })

    const first = model.getRow(0)
    const second = model.getRow(1)
    const third = model.getRow(2)

    expect(first?.data.id).toBe(10)
    expect(first?.row.id).toBe(10)
    expect(first?.rowKey).toBe("a")
    expect(first?.state.selected).toBe(true)
    expect(second?.data.id).toBe(11)
    expect(second?.row.id).toBe(11)
    expect(second?.rowKey).toBe("b")
    expect(second?.state.pinned).toBe("none")
    expect(third?.data.id).toBe(12)
    expect(third?.state.pinned).toBe("bottom")

    model.dispose()
  })

  it("throws when row identity is missing and no resolver is configured", () => {
    expect(() =>
      createClientRowModel({
        rows: [{ row: { id: 999 }, originalIndex: 0, displayIndex: 0 } as unknown as DataGridRowNodeInput<{ id: number }>],
      }),
    ).toThrowError(/Missing row identity/)
  })

  it("resolves row identity through explicit resolver", () => {
    const model = createClientRowModel({
      rows: [{ row: { id: 42 }, originalIndex: 0, displayIndex: 0 } as unknown as DataGridRowNodeInput<{ id: number }>],
      resolveRowId: row => row.id,
    })

    const row = model.getRow(0)
    expect(row?.rowKey).toBe(42)
    expect(row?.rowId).toBe(42)
    model.dispose()
  })

  it("returns snapshot copies that do not mutate internal state", () => {
    const model = createClientRowModel({
      rows: buildRows(5),
    })

    model.setSortModel([{ key: "id", direction: "asc" }])
    model.setFilterModel({
      columnFilters: { id: { kind: "valueSet", tokens: ["string:1"] } },
      advancedFilters: {},
    })
    model.setGroupBy({ fields: ["id"], expandedByDefault: true })

    const snapshot = model.getSnapshot()
    const snapshotSort = [...snapshot.sortModel]
    snapshotSort[0] = { key: "id", direction: "desc" }
    const snapshotIdFilter = snapshot.filterModel?.columnFilters.id
    if (Array.isArray(snapshotIdFilter)) {
      snapshotIdFilter.push("2")
    } else if (snapshotIdFilter?.kind === "valueSet") {
      snapshotIdFilter.tokens.push("string:2")
    }
    ;(snapshot.groupBy?.fields ?? []).push("owner")

    const nextSnapshot = model.getSnapshot()
    expect(nextSnapshot.sortModel).toEqual([{ key: "id", direction: "asc" }])
    expect(nextSnapshot.filterModel).toEqual({
      columnFilters: { id: { kind: "valueSet", tokens: ["string:1"] } },
      advancedFilters: {},
    })
    expect(nextSnapshot.groupBy).toEqual({ fields: ["id"], expandedByDefault: true })
    expect(nextSnapshot.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })

    model.dispose()
  })

  it("normalizes and toggles group by state through row model API", () => {
    const model = createClientRowModel({
      rows: buildRows(3),
    })

    model.setGroupBy({ fields: ["", " owner ", "owner"], expandedByDefault: false })
    expect(model.getSnapshot().groupBy).toEqual({
      fields: ["owner"],
      expandedByDefault: false,
    })
    model.toggleGroup("owner=alice")
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["owner=alice"],
    })

    model.setGroupBy({ fields: [] })
    expect(model.getSnapshot().groupBy).toBeNull()
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })

    model.dispose()
  })

  it("supports deterministic expansion snapshot roundtrip and explicit expand/collapse APIs", () => {
    const model = createClientRowModel({
      rows: buildRows(6),
    })

    model.setGroupBy({ fields: ["owner"], expandedByDefault: false })
    model.expandGroup("owner=alice")
    model.collapseGroup("owner=alice")
    model.expandAllGroups()
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })

    model.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: ["owner=alice", "owner=bob"],
    })
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["owner=alice", "owner=bob"],
    })

    model.collapseAllGroups()
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })

    model.dispose()
  })

  it("applies deterministic projection order: filter -> sort -> group -> flatten", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 3, team: "A", score: 30 }, rowId: "r3", originalIndex: 0, displayIndex: 0 },
        { row: { id: 1, team: "B", score: 10 }, rowId: "r1", originalIndex: 1, displayIndex: 1 },
        { row: { id: 2, team: "A", score: 20 }, rowId: "r2", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setFilterModel({
      columnFilters: { team: { kind: "valueSet", tokens: ["string:A"] } },
      advancedFilters: {},
    })
    model.setSortModel([{ key: "id", direction: "desc" }])
    model.setGroupBy({ fields: ["team"], expandedByDefault: true })

    const first = model.getRowsInRange({ start: 0, end: 4 })
    expect(first).toHaveLength(3)
    expect(first[0]?.kind).toBe("group")
    expect(first[0]?.groupMeta?.groupField).toBe("team")
    expect(first[0]?.groupMeta?.groupValue).toBe("A")
    expect(first[1]?.kind).toBe("leaf")
    expect((first[1]?.row as { id?: number })?.id).toBe(3)
    expect((first[2]?.row as { id?: number })?.id).toBe(2)
    expect(first[0]?.displayIndex).toBe(0)
    expect(first[1]?.displayIndex).toBe(1)
    expect(first[2]?.displayIndex).toBe(2)

    const groupKey = String(first[0]?.groupMeta?.groupKey ?? "")
    model.toggleGroup(groupKey)
    const collapsed = model.getRowsInRange({ start: 0, end: 4 })
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.kind).toBe("group")
    expect(collapsed[0]?.state.expanded).toBe(false)

    model.dispose()
  })

  it("supports batched sort+filter update with a single projection recompute cycle", () => {
    const rows = [
      { row: { id: "r1", owner: "noc", score: 20 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
      { row: { id: "r2", owner: "ops", score: 40 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      { row: { id: "r3", owner: "noc", score: 10 }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
    ]

    const batched = createClientRowModel({ rows })
    const beforeBatched = batched.getSnapshot().projection?.recomputeVersion ?? 0
    batched.setSortAndFilterModel({
      filterModel: {
        columnFilters: { owner: { kind: "valueSet", tokens: ["string:noc"] } },
        advancedFilters: {},
      },
      sortModel: [{ key: "score", direction: "desc" }],
    })
    const afterBatched = batched.getSnapshot().projection?.recomputeVersion ?? 0
    expect(afterBatched - beforeBatched).toBe(1)
    expect(batched.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual(["r1", "r3"])

    const sequential = createClientRowModel({ rows })
    const beforeSequential = sequential.getSnapshot().projection?.recomputeVersion ?? 0
    sequential.setFilterModel({
      columnFilters: { owner: { kind: "valueSet", tokens: ["string:noc"] } },
      advancedFilters: {},
    })
    sequential.setSortModel([{ key: "score", direction: "desc" }])
    const afterSequential = sequential.getSnapshot().projection?.recomputeVersion ?? 0
    expect(afterSequential - beforeSequential).toBe(2)

    batched.dispose()
    sequential.dispose()
  })

  it("builds per-column histogram from filtered projection and can ignore self filter", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "Alice", team: "A" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, owner: "Bob", team: "A" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, owner: "Alice", team: "B" }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setFilterModel({
      columnFilters: {
        team: { kind: "valueSet", tokens: ["string:A"] },
        owner: { kind: "valueSet", tokens: ["string:Alice"] },
      },
      advancedFilters: {},
    })

    expect(model.getColumnHistogram("owner")).toEqual([
      { token: "string:Alice", value: "Alice", count: 1, text: "Alice" },
    ])
    expect(model.getColumnHistogram("owner", { ignoreSelfFilter: true })).toEqual([
      { token: "string:Alice", value: "Alice", count: 1, text: "Alice" },
      { token: "string:Bob", value: "Bob", count: 1, text: "Bob" },
    ])
    expect(model.getColumnHistogram("team", { ignoreSelfFilter: true })).toEqual([
      { token: "string:A", value: "A", count: 1, text: "A" },
      { token: "string:B", value: "B", count: 1, text: "B" },
    ])
    expect(model.getColumnHistogram("owner", { scope: "sourceAll" })).toEqual([
      { token: "string:Alice", value: "Alice", count: 2, text: "Alice" },
      { token: "string:Bob", value: "Bob", count: 1, text: "Bob" },
    ])

    model.dispose()
  })

  it("computes group aggregates when aggregation model is configured", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, team: "B", score: 5 }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
      initialAggregationModel: {
        columns: [
          { key: "score", op: "sum" },
          { key: "id", op: "count" },
        ],
      },
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    const groups = rows.filter(row => row.kind === "group")
    expect(groups).toHaveLength(2)
    expect(groups[0]?.groupMeta?.aggregates).toEqual({
      score: 30,
      id: 2,
    })
    expect(groups[1]?.groupMeta?.aggregates).toEqual({
      score: 5,
      id: 1,
    })

    model.dispose()
  })

  it("patches grouped identity without aggregate recompute when stage stays in refresh-only pass", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10, label: "one" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20, label: "two" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
      initialAggregationModel: {
        columns: [{ key: "score", op: "sum" }],
      },
    })

    const before = model.getRowsInRange({ start: 0, end: 10 })
    const beforeGroup = before.find(row => row.kind === "group")
    expect(beforeGroup?.groupMeta?.aggregates).toEqual({ score: 30 })

    model.patchRows([{ rowId: "r1", data: { label: "one-updated" } }])

    const after = model.getRowsInRange({ start: 0, end: 10 })
    const afterGroup = after.find(row => row.kind === "group")
    const leaf = after.find(row => String(row.rowId) === "r1")
    expect((leaf?.row as { label?: string })?.label).toBe("one-updated")
    expect(afterGroup?.groupMeta?.aggregates).toEqual({ score: 30 })

    model.dispose()
  })

  it("updates aggregates reactively when aggregation model changes at runtime", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
    })

    const before = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(before?.groupMeta?.aggregates).toBeUndefined()

    model.setAggregationModel({ columns: [{ key: "score", op: "sum" }] })
    expect(model.getAggregationModel()).toEqual({ columns: [{ key: "score", op: "sum" }] })
    const afterSet = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(afterSet?.groupMeta?.aggregates).toEqual({ score: 30 })

    model.setAggregationModel(null)
    expect(model.getAggregationModel()).toBeNull()
    const afterReset = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(afterReset?.groupMeta?.aggregates).toBeUndefined()

    model.dispose()
  })

  it("projects treeData path mode deterministically and toggles expansion by group key", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, path: ["infra", "api"] }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, path: ["infra", "web"] }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialTreeData: {
        mode: "path",
        getDataPath: row => row.path,
        expandedByDefault: true,
      },
    })

    const expandedRows = model.getRowsInRange({ start: 0, end: 10 })
    expect(expandedRows.map(row => row.kind)).toEqual([
      "group", // infra
      "group", // infra/api
      "leaf",  // r1
      "group", // infra/web
      "leaf",  // r2
    ])
    const topGroupKey = String(expandedRows[0]?.groupMeta?.groupKey ?? "")
    expect(topGroupKey.startsWith("tree:path:")).toBe(true)

    model.toggleGroup(topGroupKey)
    const collapsedRows = model.getRowsInRange({ start: 0, end: 10 })
    expect(collapsedRows).toHaveLength(1)
    expect(collapsedRows[0]?.kind).toBe("group")
    expect(collapsedRows[0]?.state.expanded).toBe(false)

    model.dispose()
  })

  it("computes tree path aggregates from matched leaf rows and keeps them on collapse", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "r1", path: ["workspace", "docs"], score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: "r2", path: ["workspace", "design"], score: 5 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialTreeData: {
        mode: "path",
        getDataPath: row => row.path,
        expandedByDefault: true,
      },
      initialAggregationModel: {
        columns: [{ key: "score", op: "sum" }],
      },
    })

    const expanded = model.getRowsInRange({ start: 0, end: 10 })
    expect(expanded[0]?.kind).toBe("group")
    expect(expanded[0]?.groupMeta?.aggregates).toEqual({ score: 15 })
    expect(expanded[1]?.kind).toBe("group")
    expect(expanded[1]?.groupMeta?.aggregates).toEqual({ score: 10 })
    expect(expanded[3]?.kind).toBe("group")
    expect(expanded[3]?.groupMeta?.aggregates).toEqual({ score: 5 })

    const workspaceGroupKey = String(expanded[0]?.groupMeta?.groupKey ?? "")
    model.toggleGroup(workspaceGroupKey)
    const collapsed = model.getRowsInRange({ start: 0, end: 10 })
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.groupMeta?.aggregates).toEqual({ score: 15 })

    model.dispose()
  })

  it("keeps unrelated root leaves visible when collapsing a path group", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "r1", path: ["workspace", "docs"] }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: "r2", path: [] }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialTreeData: {
        mode: "path",
        getDataPath: row => row.path,
        expandedByDefault: true,
      },
    })

    const before = model.getRowsInRange({ start: 0, end: 10 })
    const workspaceGroupKey = String(before.find(row => row.kind === "group")?.rowId ?? "")
    expect(before.map(row => String(row.rowId))).toEqual([
      workspaceGroupKey,
      encodeTreePathGroupKey(["workspace", "docs"]),
      "r1",
      "r2",
    ])

    model.toggleGroup(workspaceGroupKey)
    const collapsed = model.getRowsInRange({ start: 0, end: 10 })
    expect(collapsed.map(row => String(row.rowId))).toEqual([workspaceGroupKey, "r2"])
    expect(collapsed[0]?.state.expanded).toBe(false)

    model.toggleGroup(workspaceGroupKey)
    const expandedAgain = model.getRowsInRange({ start: 0, end: 10 })
    expect(expandedAgain.map(row => String(row.rowId))).toEqual([
      workspaceGroupKey,
      encodeTreePathGroupKey(["workspace", "docs"]),
      "r1",
      "r2",
    ])

    model.dispose()
  })

  it("projects treeData parent mode with root orphan policy and cycle-edge ignore", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "a", parentId: "b" }, rowId: "a", originalIndex: 0, displayIndex: 0 },
        { row: { id: "b", parentId: "a" }, rowId: "b", originalIndex: 1, displayIndex: 1 },
        { row: { id: "c", parentId: "missing-parent" }, rowId: "c", originalIndex: 2, displayIndex: 2 },
        { row: { id: "d", parentId: "b" }, rowId: "d", originalIndex: 3, displayIndex: 3 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
        orphanPolicy: "root",
        cyclePolicy: "ignore-edge",
      },
    })

    const rows = model.getRowsInRange({ start: 0, end: 20 })
    expect(rows.find(row => row.rowId === "c")).toBeDefined() // orphan promoted to root
    expect(rows.find(row => row.rowId === "a")?.kind).toBe("group")
    expect(rows.find(row => row.rowId === "b")?.kind).toBe("group")
    expect(rows.find(row => row.rowId === "d")?.kind).toBe("leaf")
    expect(model.getSnapshot().treeDataDiagnostics).toEqual({
      orphans: 1,
      cycles: 1,
      duplicates: 0,
      lastError: null,
    })

    model.dispose()
  })

  it("computes tree parent aggregates from descendant leaves and keeps them on collapse", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root", parentId: null, score: 1 }, rowId: "root", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-a", parentId: "root", score: 10 }, rowId: "child-a", originalIndex: 1, displayIndex: 1 },
        { row: { id: "child-b", parentId: "root", score: 5 }, rowId: "child-b", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
      },
      initialAggregationModel: {
        columns: [{ key: "score", op: "sum" }],
      },
    })

    const expanded = model.getRowsInRange({ start: 0, end: 10 })
    expect(expanded.map(row => String(row.rowId))).toEqual(["root", "child-a", "child-b"])
    expect(expanded[0]?.kind).toBe("group")
    expect(expanded[0]?.groupMeta?.aggregates).toEqual({ score: 15 })

    model.toggleGroup("tree:parent:root")
    const collapsed = model.getRowsInRange({ start: 0, end: 10 })
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.groupMeta?.aggregates).toEqual({ score: 15 })

    model.dispose()
  })

  it("keeps sibling roots visible when collapsing a parent group", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root-a", parentId: null }, rowId: "root-a", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-a", parentId: "root-a" }, rowId: "child-a", originalIndex: 1, displayIndex: 1 },
        { row: { id: "root-b", parentId: null }, rowId: "root-b", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
      },
    })

    const expanded = model.getRowsInRange({ start: 0, end: 10 })
    expect(expanded.map(row => String(row.rowId))).toEqual(["root-a", "child-a", "root-b"])

    model.toggleGroup("tree:parent:root-a")
    const collapsed = model.getRowsInRange({ start: 0, end: 10 })
    expect(collapsed.map(row => String(row.rowId))).toEqual(["root-a", "root-b"])
    expect(collapsed[0]?.state.expanded).toBe(false)

    model.toggleGroup("tree:parent:root-a")
    const expandedAgain = model.getRowsInRange({ start: 0, end: 10 })
    expect(expandedAgain.map(row => String(row.rowId))).toEqual(["root-a", "child-a", "root-b"])

    model.dispose()
  })

  it("orders parent-tree root groups by sort model instead of source index", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root-a", parentId: null, score: 10 }, rowId: "root-a", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-a", parentId: "root-a", score: 1 }, rowId: "child-a", originalIndex: 1, displayIndex: 1 },
        { row: { id: "root-b", parentId: null, score: 20 }, rowId: "root-b", originalIndex: 2, displayIndex: 2 },
        { row: { id: "child-b", parentId: "root-b", score: 2 }, rowId: "child-b", originalIndex: 3, displayIndex: 3 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
      },
    })

    model.setSortModel([{ key: "score", direction: "desc" }])
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual([
      "root-b",
      "child-b",
      "root-a",
      "child-a",
    ])

    model.setSortModel([{ key: "score", direction: "asc" }])
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual([
      "root-a",
      "child-a",
      "root-b",
      "child-b",
    ])

    model.dispose()
  })

  it("rejects duplicate row identity in tree mode and preserves previous snapshot revision", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, path: ["infra", "api"] }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, path: ["infra", "web"] }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialTreeData: {
        mode: "path",
        getDataPath: row => row.path,
        expandedByDefault: true,
      },
    })

    const before = model.getSnapshot()
    expect(() => {
      model.setRows([
        { row: { id: 3, path: ["infra", "worker"] }, rowId: "dup", originalIndex: 0, displayIndex: 0 },
        { row: { id: 4, path: ["infra", "jobs"] }, rowId: "dup", originalIndex: 1, displayIndex: 1 },
      ])
    }).toThrow(/Duplicate rowId/)

    const after = model.getSnapshot()
    expect(after.revision).toBe(before.revision)
    expect(after.rowCount).toBe(before.rowCount)
    expect(after.treeDataDiagnostics?.duplicates).toBe(1)
    expect(after.treeDataDiagnostics?.lastError).toMatch(/Duplicate rowId/)

    model.dispose()
  })

  it("uses include-parents tree filter mode by default for parent treeData", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root", parentId: null, value: "root" }, rowId: "root", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-1", parentId: "root", value: "keep" }, rowId: "child-1", originalIndex: 1, displayIndex: 1 },
        { row: { id: "child-2", parentId: "root", value: "drop" }, rowId: "child-2", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
      },
    })

    model.setFilterModel({
      columnFilters: { value: { kind: "valueSet", tokens: ["string:keep"] } },
      advancedFilters: {},
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows.map(row => row.rowId)).toEqual(["root", "child-1"])
    expect(rows[0]?.kind).toBe("group")
    expect(rows[1]?.kind).toBe("leaf")

    model.dispose()
  })

  it("uses aggregation basis filtered by default for grouped rows under active filter", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10, status: "active" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20, status: "inactive" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
      initialAggregationModel: { columns: [{ key: "score", op: "sum" }] },
    })

    model.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:active"] } },
      advancedFilters: {},
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    const group = rows.find(row => row.kind === "group")
    expect(group?.groupMeta?.aggregates).toEqual({ score: 10 })

    model.dispose()
  })

  it("supports aggregation basis source for group and tree projections", () => {
    const groupedModel = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10, status: "active" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20, status: "inactive" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
      initialAggregationModel: { basis: "source", columns: [{ key: "score", op: "sum" }] },
    })
    groupedModel.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:active"] } },
      advancedFilters: {},
    })
    const groupedRows = groupedModel.getRowsInRange({ start: 0, end: 10 })
    const groupedRoot = groupedRows.find(row => row.kind === "group")
    expect(groupedRoot?.groupMeta?.aggregates).toEqual({ score: 30 })
    groupedModel.dispose()

    const treeModel = createClientRowModel({
      rows: [
        { row: { id: "root", parentId: null, score: 0, status: "root" }, rowId: "root", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-a", parentId: "root", score: 10, status: "active" }, rowId: "child-a", originalIndex: 1, displayIndex: 1 },
        { row: { id: "child-b", parentId: "root", score: 20, status: "inactive" }, rowId: "child-b", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
      },
      initialAggregationModel: { basis: "source", columns: [{ key: "score", op: "sum" }] },
    })
    treeModel.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:active"] } },
      advancedFilters: {},
    })
    const treeRows = treeModel.getRowsInRange({ start: 0, end: 10 })
    expect(treeRows.map(row => String(row.rowId))).toEqual(["root", "child-a"])
    expect(treeRows[0]?.groupMeta?.aggregates).toEqual({ score: 30 })
    treeModel.dispose()
  })

  it("uses aggregation basis filtered by default for tree projections under active filter", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root", parentId: null, score: 0, status: "root" }, rowId: "root", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-a", parentId: "root", score: 10, status: "active" }, rowId: "child-a", originalIndex: 1, displayIndex: 1 },
        { row: { id: "child-b", parentId: "root", score: 20, status: "inactive" }, rowId: "child-b", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
      },
      initialAggregationModel: { columns: [{ key: "score", op: "sum" }] },
    })

    model.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:active"] } },
      advancedFilters: {},
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows.map(row => String(row.rowId))).toEqual(["root", "child-a"])
    expect(rows[0]?.groupMeta?.aggregates).toEqual({ score: 10 })

    model.dispose()
  })

  it("uses leaf-only tree filter mode to avoid ancestor projection", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root", parentId: null, value: "root" }, rowId: "root", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-1", parentId: "root", value: "keep" }, rowId: "child-1", originalIndex: 1, displayIndex: 1 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
        filterMode: "leaf-only",
      },
    })

    model.setFilterModel({
      columnFilters: { value: { kind: "valueSet", tokens: ["string:keep"] } },
      advancedFilters: {},
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows.map(row => row.rowId)).toEqual(["child-1"])
    expect(rows[0]?.kind).toBe("leaf")

    model.dispose()
  })

  it("uses include-descendants tree filter mode to keep matched subtree", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root", parentId: null, value: "root" }, rowId: "root", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-1", parentId: "root", value: "drop-1" }, rowId: "child-1", originalIndex: 1, displayIndex: 1 },
        { row: { id: "child-2", parentId: "root", value: "drop-2" }, rowId: "child-2", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
        filterMode: "include-descendants",
      },
    })

    model.setFilterModel({
      columnFilters: { value: { kind: "valueSet", tokens: ["string:root"] } },
      advancedFilters: {},
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows.map(row => row.rowId)).toEqual(["root", "child-1", "child-2"])
    expect(rows[0]?.kind).toBe("group")

    model.dispose()
  })

  it("applies advanced expression filters before sort/group projection", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", latencyMs: 120, status: "active" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, owner: "ops", latencyMs: 75, status: "warning" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, owner: "noc", latencyMs: 50, status: "inactive" }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setFilterModel({
      columnFilters: {},
      advancedFilters: {},
      advancedExpression: {
        kind: "group",
        operator: "and",
        children: [
          {
            kind: "condition",
            key: "status",
            operator: "in",
            value: ["active", "warning"],
            type: "text",
          },
          {
            kind: "condition",
            key: "latencyMs",
            operator: "gt",
            value: 90,
            type: "number",
          },
        ],
      },
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows).toHaveLength(1)
    expect((rows[0]?.row as { id?: number })?.id).toBe(1)
    expect((model.getSnapshot().filterModel?.advancedExpression as { kind?: string })?.kind).toBe("group")

    model.dispose()
  })

  it("normalizes column filter keys/values and matches non-string runtime values", () => {
    const model = createClientRowModel({
      rows: [
        {
          row: { id: 1, status: 1, flags: { active: true } },
          rowId: "r1",
          originalIndex: 0,
          displayIndex: 0,
        },
        {
          row: { id: 2, status: 2, flags: { active: false } },
          rowId: "r2",
          originalIndex: 1,
          displayIndex: 1,
        },
      ],
    })

    model.setFilterModel({
      columnFilters: {
        " status ": { kind: "valueSet", tokens: ["number:1"] },
        "flags.active": { kind: "valueSet", tokens: ["boolean:true"] },
      },
      advancedFilters: {},
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows.map(row => String(row.rowId))).toEqual(["r1"])

    model.dispose()
  })

  it("supports array index access in readByPath-backed filters", () => {
    const model = createClientRowModel({
      rows: [
        {
          row: { id: 1, items: [{ name: "alpha" }] },
          rowId: "r1",
          originalIndex: 0,
          displayIndex: 0,
        },
        {
          row: { id: 2, items: [{ name: "beta" }] },
          rowId: "r2",
          originalIndex: 1,
          displayIndex: 1,
        },
      ],
    })

    model.setFilterModel({
      columnFilters: {
        "items.0.name": { kind: "valueSet", tokens: ["string:alpha"] },
      },
      advancedFilters: {},
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows.map(row => String(row.rowId))).toEqual(["r1"])

    model.dispose()
  })

  it("materializes sort keys once per row during each sort projection pass", () => {
    let scoreReads = 0
    const makeRow = (id: number, score: number): { id: number; score: number } => {
      const row = { id } as { id: number; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReads += 1
          return score
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: makeRow(1, 30), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: makeRow(2, 10), rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: makeRow(3, 20), rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    const sorted = model.getRowsInRange({ start: 0, end: 3 })

    expect(sorted.map(row => (row.row as { id: number }).id)).toEqual([2, 3, 1])
    expect(scoreReads).toBe(3)

    model.dispose()
  })

  it("reuses sort value cache when only sort direction flips", () => {
    let scoreReads = 0
    const makeRow = (id: number, score: number): { id: number; score: number } => {
      const row = { id } as { id: number; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReads += 1
          return score
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: makeRow(1, 30), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: makeRow(2, 10), rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: makeRow(3, 20), rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    expect(scoreReads).toBe(3)

    model.setSortModel([{ key: "score", direction: "desc" }])
    expect(scoreReads).toBe(3)
    expect(model.getRowsInRange({ start: 0, end: 3 }).map(row => String(row.rowId))).toEqual(["r1", "r3", "r2"])

    model.dispose()
  })

  it("sorts tree path rows from filtered projection for include-parents mode", () => {
    let latencyReads = 0
    const makeRow = (id: string, owner: string, latency: number, path: string[]): {
      id: string
      owner: string
      latency: number
      path: string[]
    } => {
      const row = { id, owner, path } as { id: string; owner: string; latency: number; path: string[] }
      Object.defineProperty(row, "latency", {
        enumerable: true,
        configurable: false,
        get() {
          latencyReads += 1
          return latency
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: makeRow("r1", "noc", 300, ["org", "svc-a"]), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: makeRow("r2", "ops", 900, ["org", "svc-b"]), rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: makeRow("r3", "noc", 100, ["org", "svc-c"]), rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "path",
        expandedByDefault: true,
        filterMode: "include-parents",
        getDataPath: row => row.path,
      },
    })

    model.setFilterModel({
      columnFilters: { owner: { kind: "valueSet", tokens: ["string:noc"] } },
      advancedFilters: {},
    })
    model.setSortModel([{ key: "latency", direction: "desc" }])

    // Only filtered rows should materialize sort values in path include-parents mode.
    expect(latencyReads).toBe(2)
    expect(model.getRowsInRange({ start: 0, end: 20 }).filter(row => row.kind === "leaf").map(row => String(row.rowId))).toEqual([
      "r1",
      "r3",
    ])

    model.dispose()
  })

  it("sorts tree path rows from filtered projection for include-descendants mode", () => {
    let latencyReads = 0
    let pathReads = 0
    const makeRow = (id: string, owner: string, latency: number, path: string[]): {
      id: string
      owner: string
      latency: number
      path: string[]
    } => {
      const row = { id, owner, path } as { id: string; owner: string; latency: number; path: string[] }
      Object.defineProperty(row, "latency", {
        enumerable: true,
        configurable: false,
        get() {
          latencyReads += 1
          return latency
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: makeRow("r1", "noc", 300, ["org", "svc-a"]), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: makeRow("r2", "ops", 900, ["org", "svc-b"]), rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: makeRow("r3", "noc", 100, ["org", "svc-c"]), rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "path",
        expandedByDefault: true,
        filterMode: "include-descendants",
        getDataPath: row => {
          pathReads += 1
          return row.path
        },
      },
    })

    model.setFilterModel({
      columnFilters: { owner: { kind: "valueSet", tokens: ["string:noc"] } },
      advancedFilters: {},
    })
    model.setSortModel([{ key: "latency", direction: "desc" }])

    expect(latencyReads).toBe(2)
    expect(pathReads).toBe(7)
    expect(model.getRowsInRange({ start: 0, end: 20 }).filter(row => row.kind === "leaf").map(row => String(row.rowId))).toEqual([
      "r1",
      "r3",
    ])

    model.dispose()
  })

  it("uses rowId as deterministic tie-breaker for equal sort values", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, score: 10 }, rowId: "z", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, score: 10 }, rowId: "a", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, score: 10 }, rowId: "m", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    const sorted = model.getRowsInRange({ start: 0, end: 10 })
    expect(sorted.map(row => String(row.rowId))).toEqual(["a", "m", "z"])

    model.dispose()
  })

  it("reuses derived sort cache across grouping expansion changes when rows/sort stay stable", () => {
    let scoreReads = 0
    const makeRow = (id: number, team: string, score: number): { id: number; team: string; score: number } => {
      const row = { id, team } as { id: number; team: string; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReads += 1
          return score
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: makeRow(1, "a", 30), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: makeRow(2, "a", 10), rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: makeRow(3, "b", 20), rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    expect(scoreReads).toBe(3)
    const afterSort = model.getDerivedCacheDiagnostics()

    model.setGroupBy({ fields: ["team"], expandedByDefault: true })
    const grouped = model.getRowsInRange({ start: 0, end: 10 })
    const groupKey = String(grouped.find(row => row.kind === "group")?.groupMeta?.groupKey ?? "")
    model.toggleGroup(groupKey)

    const afterToggle = model.getDerivedCacheDiagnostics()
    expect(scoreReads).toBe(3)
    expect(afterToggle.sortValueHits).toBe(afterSort.sortValueHits)
    expect(afterToggle.sortValueMisses).toBe(afterSort.sortValueMisses)

    model.dispose()
  })

  it("invalidates filter predicate cache only when filter revision changes", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, owner: "ops" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    const baseline = model.getDerivedCacheDiagnostics()

    model.setFilterModel({
      columnFilters: { owner: { kind: "valueSet", tokens: ["string:noc"] } },
      advancedFilters: {},
    })
    const afterFirstFilter = model.getDerivedCacheDiagnostics()
    expect(afterFirstFilter.filterPredicateMisses).toBeGreaterThan(baseline.filterPredicateMisses)

    model.setGroupBy({ fields: ["owner"], expandedByDefault: true })
    const afterGroup = model.getDerivedCacheDiagnostics()
    expect(afterGroup.filterPredicateMisses).toBe(afterFirstFilter.filterPredicateMisses)
    expect(afterGroup.filterPredicateHits).toBe(afterFirstFilter.filterPredicateHits)

    model.setFilterModel({
      columnFilters: { owner: { kind: "valueSet", tokens: ["string:ops"] } },
      advancedFilters: {},
    })
    const afterSecondFilter = model.getDerivedCacheDiagnostics()
    expect(afterSecondFilter.filterPredicateMisses).toBeGreaterThan(afterGroup.filterPredicateMisses)
    expect(afterSecondFilter.revisions.filter).toBeGreaterThan(afterGroup.revisions.filter)

    model.dispose()
  })

  it("keeps current row order when patchRows updates sort key by default (freeze mode)", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, tested_at: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, tested_at: 300 }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "tested_at", direction: "desc" }])
    const before = model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))
    expect(before).toEqual(["r3", "r2", "r1"])

    model.patchRows([{ rowId: "r1", data: { tested_at: 999 } }])

    const after = model.getRowsInRange({ start: 0, end: 10 })
    expect(after.map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])
    expect((after[2]?.row as { tested_at?: number })?.tested_at).toBe(999)

    model.dispose()
  })

  it("recomputes row order when patchRows updates sort key with recomputeSort=true", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, tested_at: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, tested_at: 300 }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "tested_at", direction: "desc" }])
    model.patchRows(
      [{ rowId: "r1", data: { tested_at: 999 } }],
      { recomputeSort: true },
    )

    const after = model.getRowsInRange({ start: 0, end: 10 })
    expect(after.map(row => String(row.rowId))).toEqual(["r1", "r3", "r2"])

    model.dispose()
  })

  it("tracks projection diagnostics version and stale stage markers", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, tested_at: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "tested_at", direction: "asc" }])
    const before = model.getSnapshot().projection
    expect(before?.version).toBeGreaterThan(0)
    expect(before?.cycleVersion).toBe(before?.version)
    expect(before?.recomputeVersion).toBeGreaterThan(0)
    expect(before?.staleStages).toEqual([])

    model.patchRows(
      [{ rowId: "r1", data: { tested_at: 999 } }],
      { recomputeSort: false },
    )
    const staleSnapshot = model.getSnapshot().projection
    expect(staleSnapshot?.version).toBeGreaterThan(before?.version ?? 0)
    expect(staleSnapshot?.recomputeVersion).toBe(before?.recomputeVersion)
    expect(staleSnapshot?.staleStages).toContain("sort")

    model.patchRows(
      [{ rowId: "r2", data: { tested_at: 5 } }],
      { recomputeSort: true },
    )
    const healedSnapshot = model.getSnapshot().projection
    expect(healedSnapshot?.version).toBeGreaterThan(staleSnapshot?.version ?? 0)
    expect(healedSnapshot?.recomputeVersion).toBeGreaterThan(staleSnapshot?.recomputeVersion ?? 0)
    expect(healedSnapshot?.staleStages).not.toContain("sort")

    model.dispose()
  })

  it("skips sort-stage invalidation when patched fields do not affect active sort", () => {
    let scoreReads = 0
    const rowWithScore = (id: number, score: number, label: string) => {
      const row = { id, label } as { id: number; label: string; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReads += 1
          return score
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: rowWithScore(1, 10, "alpha"), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: rowWithScore(2, 20, "bravo"), rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "desc" }])
    expect(scoreReads).toBe(2)

    model.patchRows([{ rowId: "r1", data: { label: "alpha-updated" } }])
    expect(scoreReads).toBe(2)
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r2", "r1"])

    model.dispose()
  })

  it("invalidates sort when patched fields intersect sort dependencyFields", () => {
    const rowWithDerivedScore = (id: number, label: string) => {
      const row = { id, label } as { id: number; label: string; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          return this.label.length
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: rowWithDerivedScore(1, "zzzz"), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: rowWithDerivedScore(2, "aa"), rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc", dependencyFields: ["label"] }])
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r2", "r1"])

    model.patchRows(
      [{ rowId: "r1", data: { label: "a" } }],
      { recomputeSort: true },
    )
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r2"])

    model.dispose()
  })

  it("propagates transitive dependency graph fields into sort invalidation", () => {
    const dependencyGraph = createDataGridDependencyGraph([
      { sourceField: "rawScore", dependentField: "computedScore" },
      { sourceField: "computedScore", dependentField: "score" },
    ])
    const projectionPolicy = createDataGridProjectionPolicy({ dependencyGraph })

    const rowWithDerivedScore = (id: number, rawScore: number) => {
      const row = { id, rawScore, computedScore: rawScore } as {
        id: number
        rawScore: number
        computedScore: number
        score: number
      }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          return this.rawScore
        },
      })
      return row
    }

    const model = createClientRowModel({
      projectionPolicy,
      rows: [
        { row: rowWithDerivedScore(1, 10), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: rowWithDerivedScore(2, 20), rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r2"])

    model.patchRows(
      [{ rowId: "r1", data: { rawScore: 30 } }],
      { recomputeSort: true },
    )
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r2", "r1"])

    model.dispose()
  })

  it("supports projection policy that disables sort-value caching", () => {
    const projectionPolicy = {
      ...createDataGridProjectionPolicy(),
      shouldCacheSortValues: () => false,
    }
    const model = createClientRowModel({
      projectionPolicy,
      rows: [
        { row: { id: 1, score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, score: 20 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "desc" }])
    const beforeRefresh = model.getDerivedCacheDiagnostics()
    model.refresh("manual")
    const afterRefresh = model.getDerivedCacheDiagnostics()

    expect(afterRefresh.sortValueHits).toBe(beforeRefresh.sortValueHits)
    expect(afterRefresh.sortValueMisses).toBeGreaterThan(beforeRefresh.sortValueMisses)

    model.dispose()
  })

  it("keeps filter membership frozen by default and applies it with recomputeFilter=true", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, status: "active" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, status: "inactive" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:active"] } },
      advancedFilters: {},
    })
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual(["r1"])

    model.patchRows([{ rowId: "r2", data: { status: "active" } }])
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual(["r1"])

    model.patchRows(
      [{ rowId: "r1", data: { status: "inactive" } }],
      { recomputeFilter: true },
    )
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual(["r2"])

    model.dispose()
  })

  it("recomputes aggregate stage only when patch touches aggregation fields", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10, label: "one" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20, label: "two" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
      initialAggregationModel: { columns: [{ key: "score", op: "sum" }] },
    })

    const before = model.getSnapshot().projection
    const baselineGroup = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(baselineGroup?.groupMeta?.aggregates).toEqual({ score: 30 })

    model.patchRows([{ rowId: "r1", data: { label: "one-updated" } }])
    const afterUnrelated = model.getSnapshot().projection
    const unchangedGroup = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(unchangedGroup?.groupMeta?.aggregates).toEqual({ score: 30 })
    expect(afterUnrelated?.recomputeVersion).toBe(before?.recomputeVersion)

    model.patchRows(
      [{ rowId: "r1", data: { score: 50 } }],
      { recomputeGroup: true },
    )
    const afterScore = model.getSnapshot().projection
    const updatedGroup = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(updatedGroup?.groupMeta?.aggregates).toEqual({ score: 70 })
    expect(afterScore?.recomputeVersion).toBeGreaterThan(afterUnrelated?.recomputeVersion ?? 0)

    model.dispose()
  })

  it("applies incremental aggregate delta for supported ops even when recomputeGroup=false", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
      initialAggregationModel: {
        columns: [
          { key: "score", op: "sum" },
          { key: "avgScore", field: "score", op: "avg" },
          { key: "countRows", field: "score", op: "count" },
        ],
      },
    })

    const before = model.getSnapshot().projection
    model.patchRows([{ rowId: "r1", data: { score: 100 } }], { recomputeGroup: false })
    const afterPatch = model.getSnapshot().projection
    const updatedGroup = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(afterPatch?.staleStages).not.toContain("aggregate")
    expect(updatedGroup?.groupMeta?.aggregates).toEqual({
      score: 120,
      avgScore: 60,
      countRows: 2,
    })
    expect(afterPatch?.recomputeVersion).toBe(before?.recomputeVersion)

    model.dispose()
  })

  it("keeps aggregate stage stale for unsupported incremental ops when recomputeGroup=false", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", score: 20 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
      initialAggregationModel: { columns: [{ key: "score", op: "min" }] },
    })

    model.patchRows([{ rowId: "r1", data: { score: 100 } }], { recomputeGroup: false })
    const staleSnapshot = model.getSnapshot().projection
    const staleGroup = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(staleSnapshot?.staleStages).toContain("aggregate")
    expect(staleGroup?.groupMeta?.aggregates).toEqual({ score: 10 })

    model.refresh("manual")
    const healedSnapshot = model.getSnapshot().projection
    const healedGroup = model.getRowsInRange({ start: 0, end: 10 }).find(row => row.kind === "group")
    expect(healedSnapshot?.staleStages).not.toContain("aggregate")
    expect(healedGroup?.groupMeta?.aggregates).toEqual({ score: 20 })

    model.dispose()
  })

  it("applies incremental tree parent aggregation when dependency fields isolate structure", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "root", parentId: null, score: 0 }, rowId: "root", originalIndex: 0, displayIndex: 0 },
        { row: { id: "child-1", parentId: "root", score: 10 }, rowId: "child-1", originalIndex: 1, displayIndex: 1 },
        { row: { id: "child-2", parentId: "root", score: 20 }, rowId: "child-2", originalIndex: 2, displayIndex: 2 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        dependencyFields: ["parentId"],
        expandedByDefault: true,
      },
      initialAggregationModel: {
        columns: [{ key: "score", op: "sum" }],
      },
    })

    const before = model.getSnapshot().projection
    const baseline = model.getRowsInRange({ start: 0, end: 10 })
    expect(baseline[0]?.groupMeta?.aggregates).toEqual({ score: 30 })

    model.patchRows([{ rowId: "child-1", data: { score: 100 } }], { recomputeGroup: false })

    const afterPatch = model.getSnapshot().projection
    const rowsAfter = model.getRowsInRange({ start: 0, end: 10 })
    expect(rowsAfter[0]?.groupMeta?.aggregates).toEqual({ score: 120 })
    expect(afterPatch?.staleStages).not.toContain("aggregate")
    expect(afterPatch?.recomputeVersion).toBe(before?.recomputeVersion)

    model.dispose()
  })

  it("keeps sort stage blocked when recomputeSort=false even if filter stage is recomputed", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, status: "inactive", tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, status: "active", tested_at: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, status: "active", tested_at: 300 }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "tested_at", direction: "desc" }])
    model.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:active"] } },
      advancedFilters: {},
    })
    expect(model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))).toEqual(["r3", "r2"])

    model.patchRows(
      [{ rowId: "r1", data: { status: "active", tested_at: 999 } }],
      { recomputeFilter: true, recomputeSort: false },
    )

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows.map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])
    expect(model.getSnapshot().projection?.staleStages).toContain("sort")

    model.dispose()
  })

  it("keeps stale grouping by default and restores consistency when recomputeGroup=true", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", label: "one" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, team: "A", label: "two" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, team: "B", label: "three" }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setGroupBy({ fields: ["team"], expandedByDefault: true })
    const baseline = model.getRowsInRange({ start: 0, end: 10 }).map(row => String(row.rowId))
    expect(baseline).toEqual([
      encodeGroupKey([{ field: "team", value: "A" }]),
      "r1",
      "r2",
      encodeGroupKey([{ field: "team", value: "B" }]),
      "r3",
    ])

    model.patchRows([{ rowId: "r1", data: { team: "B" } }])
    const stale = model.getRowsInRange({ start: 0, end: 10 })
    expect(stale.map(row => String(row.rowId))).toEqual(baseline)
    expect((stale[1]?.row as { team?: string })?.team).toBe("B")
    expect(stale[0]?.groupMeta?.childrenCount).toBe(2)

    model.patchRows(
      [{ rowId: "r2", data: { label: "two-updated" } }],
      { recomputeGroup: true },
    )
    const regrouped = model.getRowsInRange({ start: 0, end: 10 })
    expect(regrouped.map(row => String(row.rowId))).toEqual([
      encodeGroupKey([{ field: "team", value: "B" }]),
      "r1",
      "r3",
      encodeGroupKey([{ field: "team", value: "A" }]),
      "r2",
    ])
    expect(regrouped[0]?.groupMeta?.childrenCount).toBe(2)
    expect(regrouped[3]?.groupMeta?.childrenCount).toBe(1)

    model.dispose()
  })

  it("skips tree grouping invalidation when patch fields do not intersect tree dependencyFields", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: "r1", parentId: null, label: "Root" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: "r2", parentId: "r1", label: "Child" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        dependencyFields: ["parentId"],
        expandedByDefault: true,
      },
    })

    const before = model.getSnapshot().projection
    model.patchRows([{ rowId: "r2", data: { label: "Child-updated" } }])
    const after = model.getSnapshot().projection
    const rows = model.getRowsInRange({ start: 0, end: 10 })

    expect(rows.map(row => String(row.rowId))).toEqual(["r1", "r2"])
    expect((rows[1]?.row as { label?: string })?.label).toBe("Child-updated")
    expect(after?.staleStages).toEqual([])
    expect(after?.recomputeVersion).toBe(before?.recomputeVersion)
    expect(after?.version).toBeGreaterThan(before?.version ?? 0)

    model.toggleGroup("tree:parent:r1")
    model.toggleGroup("tree:parent:r1")
    const afterToggle = model.getRowsInRange({ start: 0, end: 10 })
    expect(afterToggle.map(row => String(row.rowId))).toEqual(["r1", "r2"])
    expect((afterToggle[1]?.row as { label?: string })?.label).toBe("Child-updated")

    model.dispose()
  })

  it("invalidates derived sort cache on row revision to avoid stale sort values", () => {
    let scoreReads = 0
    const rowWithScore = (id: number, score: number) => {
      const row = { id } as { id: number; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReads += 1
          return score
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: rowWithScore(1, 10), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: rowWithScore(2, 20), rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "desc" }])
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => (row.row as { id: number }).id)).toEqual([2, 1])
    expect(scoreReads).toBe(2)

    model.setRows([
      { row: rowWithScore(1, 50), rowId: "r1", originalIndex: 0, displayIndex: 0 },
      { row: rowWithScore(2, 5), rowId: "r2", originalIndex: 1, displayIndex: 1 },
    ])

    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => (row.row as { id: number }).id)).toEqual([1, 2])
    expect(scoreReads).toBe(4)
    const diagnostics = model.getDerivedCacheDiagnostics()
    expect(diagnostics.revisions.row).toBeGreaterThan(0)
    expect(diagnostics.sortValueMisses).toBeGreaterThanOrEqual(4)

    model.dispose()
  })

  it("keeps unaffected sort cache entries hot across patch + refresh via row versions", () => {
    const scoreReadsByRowId = new Map<string, number>()
    const rowWithDerivedScore = (rowId: string, label: string) => {
      const row = { id: rowId, label } as { id: string; label: string; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReadsByRowId.set(rowId, (scoreReadsByRowId.get(rowId) ?? 0) + 1)
          return this.label.length
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: rowWithDerivedScore("r1", "zzzz"), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: rowWithDerivedScore("r2", "aa"), rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r2", "r1"])
    expect(scoreReadsByRowId.get("r1")).toBe(1)
    expect(scoreReadsByRowId.get("r2")).toBe(1)

    model.patchRows([{ rowId: "r1", data: { label: "a" } }], { recomputeSort: false })
    model.refresh("manual")

    expect(model.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r2"])
    expect(scoreReadsByRowId.get("r1")).toBe(2)
    expect(scoreReadsByRowId.get("r2")).toBe(1)

    model.dispose()
  })

  it("rejects mutating API calls after dispose", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
      ],
    })

    model.dispose()
    expect(() => {
      model.setSortModel([{ key: "score", direction: "asc" }])
    }).toThrow(/disposed/i)
  })
})
