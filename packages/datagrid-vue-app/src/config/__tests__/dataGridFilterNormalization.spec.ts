import { describe, expect, it } from "vitest"
import {
  normalizeDataGridAppFilterModel,
  normalizeDataGridAppUnifiedStateFilters,
} from "../dataGridFilterNormalization"
import { resolveDataGridColumns } from "../dataGridFormulaOptions"
import type { DataGridFilterSnapshot, DataGridUnifiedState } from "@affino/datagrid-vue"
import type { DataGridAppColumnInput } from "../dataGridFormulaOptions"

interface DemoRow {
  id: string
  roi: number
  status: string
}

const columns: readonly DataGridAppColumnInput<DemoRow>[] = [
  {
    key: "roi",
    label: "ROI",
    filter: {
      normalizeValue: ({ value }) => typeof value === "number" ? value / 100 : value,
    },
  },
  {
    key: "status",
    label: "Status",
    filter: {
      valueSet: false,
    },
  },
]

describe("data grid filter normalization", () => {
  it("normalizes predicate and advanced expression values by column hook", () => {
    const filterModel: DataGridFilterSnapshot = {
      columnFilters: {
        roi: { kind: "predicate", operator: "gte", value: 25 },
      },
      advancedFilters: {
        roi: {
          type: "number",
          clauses: [{ operator: "lte", value: 50 }],
        },
      },
      advancedExpression: {
        kind: "condition",
        key: "roi",
        type: "number",
        operator: "gt",
        value: 10,
      },
    }

    expect(normalizeDataGridAppFilterModel(filterModel, columns)).toMatchObject({
      columnFilters: {
        roi: { value: 0.25 },
      },
      advancedFilters: {
        roi: { clauses: [{ value: 0.5 }] },
      },
      advancedExpression: {
        value: 0.1,
      },
    })
  })

  it("removes disabled value-set filters from saved unified state snapshots", () => {
    const state = {
      version: 1,
      rows: {
        snapshot: {
          kind: "client",
          rowCount: 0,
          loading: false,
          error: null,
          viewportRange: { start: 0, end: 0 },
          pagination: { enabled: false, pageSize: 0, currentPage: 0, pageCount: 0, totalRowCount: 0, startIndex: 0, endIndex: 0 },
          sortModel: [],
          filterModel: {
            columnFilters: {
              status: { kind: "valueSet", tokens: ["string:open"] },
              roi: { kind: "predicate", operator: "gte", value: 15 },
            },
            advancedFilters: {
              status: { type: "set", clauses: [{ operator: "in", value: ["open"] }] },
            },
            advancedExpression: {
              kind: "condition",
              key: "status",
              type: "set",
              operator: "in",
              value: ["open"],
            },
          },
          groupBy: null,
          groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
          pivotModel: null,
        },
        aggregationModel: null,
      },
      columns: {
        order: ["status", "roi"],
        visibility: {},
        widths: {},
        pins: {},
      },
      selection: null,
      rowSelection: null,
      transaction: null,
    } satisfies DataGridUnifiedState<DemoRow>

    const normalized = normalizeDataGridAppUnifiedStateFilters(state, columns)

    expect(normalized.rows.snapshot.filterModel?.columnFilters.status).toBeUndefined()
    expect(normalized.rows.snapshot.filterModel?.advancedFilters.status).toBeUndefined()
    expect(normalized.rows.snapshot.filterModel?.advancedExpression).toBeNull()
    expect(normalized.rows.snapshot.filterModel?.columnFilters.roi).toMatchObject({ value: 0.15 })
  })

  it("keeps app filter options out of resolved core column definitions", () => {
    expect(resolveDataGridColumns(columns)[0]).not.toHaveProperty("filter")
  })
})
