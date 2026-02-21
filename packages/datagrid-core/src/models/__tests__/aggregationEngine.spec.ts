import { describe, expect, it } from "vitest"
import { createDataGridAggregationEngine } from "../aggregationEngine"
import type { DataGridRowNode } from "../rowModel"

interface MetricRow {
  id: string
  value: number | null
  nested?: { value?: number | null }
}

function createLeafRow(
  id: string,
  value: number | null,
  index: number,
): DataGridRowNode<MetricRow> {
  return {
    kind: "leaf",
    data: { id, value },
    row: { id, value },
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

function createGroupRow(groupKey: string, level: number, childrenCount: number): DataGridRowNode<MetricRow> {
  const rowData = {
    id: groupKey,
    value: null,
  }
  return {
    kind: "group",
    data: rowData,
    row: rowData,
    rowKey: groupKey,
    rowId: groupKey,
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: -1,
    state: {
      selected: false,
      group: true,
      pinned: "none",
      expanded: true,
    },
    groupMeta: {
      groupKey,
      groupField: "team",
      groupValue: groupKey,
      level,
      childrenCount,
    },
  }
}

describe("aggregationEngine", () => {
  it("computes built-in aggregate ops over leaf rows", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      basis: "filtered",
      columns: [
        { key: "value", field: "value", op: "sum" },
        { key: "avgValue", field: "value", op: "avg" },
        { key: "minValue", field: "value", op: "min" },
        { key: "maxValue", field: "value", op: "max" },
        { key: "rowCount", field: "value", op: "count" },
        { key: "nonnullCount", field: "value", op: "countNonNull" },
        { key: "firstValue", field: "value", op: "first" },
        { key: "lastValue", field: "value", op: "last" },
      ],
    })

    const aggregates = engine.computeAggregatesForLeaves([
      createLeafRow("r1", 1, 0),
      createLeafRow("r2", 2, 1),
      createLeafRow("r3", null, 2),
      createLeafRow("r4", 4, 3),
    ])

    expect(aggregates.value).toBe(7)
    expect(aggregates.avgValue).toBeCloseTo(7 / 3, 6)
    expect(aggregates.minValue).toBe(1)
    expect(aggregates.maxValue).toBe(4)
    expect(aggregates.rowCount).toBe(4)
    expect(aggregates.nonnullCount).toBe(3)
    expect(aggregates.firstValue).toBe(1)
    expect(aggregates.lastValue).toBe(4)
  })

  it("evaluates countNonNull after coerce", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      columns: [
        {
          key: "nonnullAfterCoerce",
          field: "value",
          op: "countNonNull",
          coerce: (value) => {
            if (value === 0) {
              return null
            }
            return typeof value === "number" ? value : null
          },
        },
      ],
    })

    const aggregates = engine.computeAggregatesForLeaves([
      createLeafRow("r1", 0, 0),
      createLeafRow("r2", 1, 1),
      createLeafRow("r3", null, 2),
    ])
    expect(aggregates.nonnullAfterCoerce).toBe(1)
  })

  it("supports custom aggregation lifecycle handlers", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      columns: [
        {
          key: "customScore",
          field: "value",
          op: "custom",
          createState: () => ({ total: 0 }),
          add: (state, value) => {
            const candidate = Number(value)
            if (Number.isFinite(candidate)) {
              ;(state as { total: number }).total += candidate
            }
          },
          remove: (state, value) => {
            const candidate = Number(value)
            if (Number.isFinite(candidate)) {
              ;(state as { total: number }).total -= candidate
            }
          },
          finalize: state => (state as { total: number }).total * 2,
        },
      ],
    })

    const compiled = engine.getCompiledColumns()
    expect(typeof compiled[0]?.remove).toBe("function")
    expect(engine.computeAggregatesForLeaves([
      createLeafRow("r1", 2, 0),
      createLeafRow("r2", 4, 1),
    ])).toEqual({
      customScore: 12,
    })
  })

  it("reads nested field paths for compiled accessors", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      columns: [
        { key: "nestedSum", field: "nested.value", op: "sum" },
      ],
    })
    const row1 = createLeafRow("r1", 1, 0)
    const row2 = createLeafRow("r2", 2, 1)
    row1.data.nested = { value: 3 }
    row1.row.nested = { value: 3 }
    row2.data.nested = { value: 7 }
    row2.row.nested = { value: 7 }

    expect(engine.computeAggregatesForLeaves([row1, row2])).toEqual({
      nestedSum: 10,
    })
  })

  it("computes grouped aggregates from pre-order grouped projection", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      columns: [
        { key: "value", field: "value", op: "sum" },
      ],
    })

    const aggregatesByGroup = engine.computeAggregatesForGroupedRows([
      createGroupRow("group:A", 0, 3),
      createGroupRow("group:A:x", 1, 2),
      createLeafRow("r1", 1, 0),
      createLeafRow("r2", 2, 1),
      createGroupRow("group:A:y", 1, 1),
      createLeafRow("r3", 3, 2),
      createGroupRow("group:B", 0, 1),
      createLeafRow("r4", 4, 3),
    ])

    expect(aggregatesByGroup.get("group:A")).toEqual({ value: 6 })
    expect(aggregatesByGroup.get("group:A:x")).toEqual({ value: 3 })
    expect(aggregatesByGroup.get("group:A:y")).toEqual({ value: 3 })
    expect(aggregatesByGroup.get("group:B")).toEqual({ value: 4 })
  })

  it("keeps first/last semantics by encountered projection order in merged path", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      columns: [
        { key: "firstValue", field: "value", op: "first" },
        { key: "lastValue", field: "value", op: "last" },
      ],
    })

    const grouped = engine.computeAggregatesForGroupedRows([
      createGroupRow("group:A", 0, 3),
      createGroupRow("group:A:x", 1, 1),
      createLeafRow("r1", 10, 0),
      createGroupRow("group:A:y", 1, 2),
      createLeafRow("r2", 20, 1),
      createLeafRow("r3", 30, 2),
    ])

    expect(grouped.get("group:A:x")).toEqual({ firstValue: 10, lastValue: 10 })
    expect(grouped.get("group:A:y")).toEqual({ firstValue: 20, lastValue: 30 })
    expect(grouped.get("group:A")).toEqual({ firstValue: 10, lastValue: 30 })
  })

  it("supports grouped aggregation with custom merge lifecycle", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      columns: [
        {
          key: "customSum",
          field: "value",
          op: "custom",
          createState: () => ({ total: 0 }),
          add: (state, value) => {
            const numeric = Number(value)
            if (Number.isFinite(numeric)) {
              ;(state as { total: number }).total += numeric
            }
          },
          merge: (state, childState) => {
            ;(state as { total: number }).total += (childState as { total: number }).total
          },
          finalize: state => (state as { total: number }).total,
        },
      ],
    })

    const grouped = engine.computeAggregatesForGroupedRows([
      createGroupRow("group:A", 0, 2),
      createGroupRow("group:A:x", 1, 2),
      createLeafRow("r1", 2, 0),
      createLeafRow("r2", 3, 1),
    ])

    expect(grouped.get("group:A:x")).toEqual({ customSum: 5 })
    expect(grouped.get("group:A")).toEqual({ customSum: 5 })
  })

  it("falls back to additive stack path when custom merge is not provided", () => {
    const engine = createDataGridAggregationEngine<MetricRow>({
      columns: [
        {
          key: "customSum",
          field: "value",
          op: "custom",
          createState: () => ({ total: 0 }),
          add: (state, value) => {
            const numeric = Number(value)
            if (Number.isFinite(numeric)) {
              ;(state as { total: number }).total += numeric
            }
          },
          finalize: state => (state as { total: number }).total,
        },
      ],
    })

    const grouped = engine.computeAggregatesForGroupedRows([
      createGroupRow("group:A", 0, 3),
      createGroupRow("group:A:x", 1, 2),
      createLeafRow("r1", 1, 0),
      createLeafRow("r2", 2, 1),
      createGroupRow("group:A:y", 1, 1),
      createLeafRow("r3", 3, 2),
    ])

    expect(grouped.get("group:A:x")).toEqual({ customSum: 3 })
    expect(grouped.get("group:A:y")).toEqual({ customSum: 3 })
    expect(grouped.get("group:A")).toEqual({ customSum: 6 })
  })
})
