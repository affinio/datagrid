import { describe, expect, it } from "vitest"
import type { DataGridDataSourcePullRequest } from "@affino/datagrid-core"
import {
  createAffinoDatasource,
  normalizeDataGridServerAdvancedExpression,
  normalizeDataGridServerAdvancedFilters,
  normalizeDataGridServerColumnFilters,
  normalizeDataGridServerGroupExpansion,
  normalizeDataGridServerGroupBy,
  normalizeDataGridServerPagination,
  normalizeDataGridServerQuickFilter,
  normalizeDataGridServerQuery,
  normalizeDataGridServerRange,
  normalizeDataGridServerSortModel,
  normalizeDataGridServerTreeData,
} from "./index"

function createPullRequest(
  overrides: Partial<DataGridDataSourcePullRequest> = {},
): DataGridDataSourcePullRequest {
  return {
    range: { start: 0, end: 9 },
    priority: "normal",
    reason: "viewport-change",
    signal: new AbortController().signal,
    sortModel: [],
    filterModel: null,
    groupBy: null,
    groupExpansion: { expandedByDefault: true, toggledGroupKeys: [] },
    treeData: null,
    pivot: null,
    pagination: {
      snapshot: {
        enabled: false,
        pageSize: 100,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 0,
        startIndex: -1,
        endIndex: -1,
      },
      cursor: null,
    },
    ...overrides,
  }
}

function createFetchRecorder(): {
  bodies: unknown[]
  fetchImpl: typeof fetch
} {
  const bodies: unknown[] = []
  const fetchImpl: typeof fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body ?? "null")) as unknown)
    return new Response(JSON.stringify({ rows: [], total: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  return { bodies, fetchImpl }
}

describe("normalizeDataGridServerQuickFilter", () => {
  it("normalizes query, columns, and mode", () => {
    expect(normalizeDataGridServerQuickFilter({
      query: " platform eu ",
      columns: [" owner ", "service", "owner", "", " region "],
      mode: "tokens",
    })).toEqual({
      query: "platform eu",
      columns: ["owner", "service", "region"],
      mode: "tokens",
    })
  })

  it("drops empty quick filters", () => {
    expect(normalizeDataGridServerQuickFilter(null)).toBeNull()
    expect(normalizeDataGridServerQuickFilter({
      query: "   ",
      columns: ["owner"],
      mode: "tokens",
    })).toBeNull()
  })

  it("uses a configurable mode fallback without creating a top-level search value", () => {
    const normalized = normalizeDataGridServerQuickFilter({
      query: "platform",
      mode: "invalid" as "contains",
    }, {
      quickFilterModeFallback: "tokens",
    })

    expect(normalized).toEqual({
      query: "platform",
      mode: "tokens",
    })
    expect(normalized).not.toHaveProperty("search")
  })
})

describe("normalizeDataGridServerAdvancedExpression", () => {
  it("preserves nested advanced expressions structurally", () => {
    const expression = {
      kind: "group",
      op: "and",
      children: [
        { kind: "condition", column: "owner", operator: "contains", value: "NOC" },
        {
          kind: "not",
          child: {
            kind: "group",
            op: "or",
            children: [
              { kind: "condition", column: "amount", operator: "gt", value: 10 },
              { kind: "condition", column: "amount", operator: "lt", value: 100 },
            ],
          },
        },
      ],
    }

    expect(normalizeDataGridServerAdvancedExpression(expression as never)).toEqual(expression)
  })

  it("returns null for null or non-json-safe expressions", () => {
    expect(normalizeDataGridServerAdvancedExpression(null)).toBeNull()
    expect(normalizeDataGridServerAdvancedExpression({
      kind: "condition",
      column: "amount",
      operator: "equals",
      value: Number.NaN,
    } as never)).toBeNull()
  })

  it("strips undefined object fields before the JSON-safe check", () => {
    expect(normalizeDataGridServerAdvancedExpression({
      kind: "condition",
      key: "analysisCategory",
      type: undefined,
      operator: "contains",
      value: "недвижимость",
      meta: {
        source: "toolbar",
        empty: undefined,
      },
    } as never)).toEqual({
      kind: "condition",
      key: "analysisCategory",
      operator: "contains",
      value: "недвижимость",
      meta: {
        source: "toolbar",
      },
    })
  })
})

describe("normalizeDataGridServerAdvancedFilters", () => {
  it("preserves legacy advanced filters by default", () => {
    expect(normalizeDataGridServerAdvancedFilters({
      owner: {
        type: "text",
        clauses: [
          { operator: "contains", value: "NOC" },
        ],
      },
    })).toEqual({
      owner: {
        type: "text",
        clauses: [
          { operator: "contains", value: "NOC" },
        ],
      },
    })
  })

  it("can drop legacy advanced filters and maps column ids when preserved", () => {
    const filters = {
      owner: {
        type: "text",
        clauses: [
          { operator: "contains", value: "NOC" },
        ],
      },
    } as const

    expect(normalizeDataGridServerAdvancedFilters(filters, {
      legacyAdvancedFilters: "drop",
      columnIdMap: { owner: "owner_name" },
    })).toBeNull()
    expect(normalizeDataGridServerAdvancedFilters(filters, {
      columnIdMap: { owner: "owner_name" },
    })).toEqual({
      owner_name: filters.owner,
    })
  })
})

describe("normalizeDataGridServerColumnFilters", () => {
  it("normalizes value-set filters and preserves stable column order", () => {
    expect(normalizeDataGridServerColumnFilters({
      owner: { kind: "valueSet", tokens: [" string:noc ", "", "string:noc", "string:payments"] },
      empty: { kind: "valueSet", tokens: [] },
    })).toEqual({
      owner: {
        kind: "valueSet",
        tokens: ["string:noc", "string:payments"],
      },
    })
  })

  it("normalizes predicate filters and drops unusable predicates", () => {
    expect(normalizeDataGridServerColumnFilters({
      amount: { kind: "predicate", operator: " between ", value: 10, value2: 20 },
      name: { kind: "predicate", operator: "contains", value: "NOC", caseSensitive: true },
      invalid: { kind: "predicate", operator: "contains" },
      empty: { kind: "predicate", operator: " isEmpty " },
      nan: { kind: "predicate", operator: "equals", value: Number.NaN },
    })).toEqual({
      amount: {
        kind: "predicate",
        operator: "between",
        value: 10,
        value2: 20,
      },
      name: {
        kind: "predicate",
        operator: "contains",
        value: "NOC",
        caseSensitive: true,
      },
      empty: {
        kind: "predicate",
        operator: "isEmpty",
      },
    })
  })

  it("normalizes style filters and supports column id mapping", () => {
    expect(normalizeDataGridServerColumnFilters({
      status: { kind: "styleValueSet", styleKey: " bg ", tokens: [" #fff ", "#fff", "#000"] },
      ignored: { kind: "styleValueSet", styleKey: " ", tokens: ["#fff"] },
    }, {
      columnIdMap: {
        status: "status_code",
      },
    })).toEqual({
      status_code: {
        kind: "styleValueSet",
        styleKey: "bg",
        tokens: ["#fff", "#000"],
      },
    })
  })
})

describe("normalizeDataGridServerRange", () => {
  it("normalizes viewport range to exclusive backend rows", () => {
    expect(normalizeDataGridServerRange({ start: 2.8, end: 5.9 })).toEqual({
      startRow: 2,
      endRow: 6,
    })
    expect(normalizeDataGridServerRange({ start: -4, end: -1 })).toEqual({
      startRow: 0,
      endRow: 0,
    })
    expect(normalizeDataGridServerRange({ start: 6, end: 3 })).toEqual({
      startRow: 6,
      endRow: 6,
    })
  })
})

describe("normalizeDataGridServerSortModel", () => {
  it("drops invalid entries and maps stable column ids", () => {
    expect(normalizeDataGridServerSortModel([
      { key: " owner ", direction: "asc" },
      { key: "", direction: "desc" },
      { key: "amount", direction: "bad" as "asc" },
    ], {
      columnIdMap: { owner: "owner_name" },
    })).toEqual([
      { colId: "owner_name", sort: "asc" },
    ])
  })
})

describe("normalizeDataGridServerPagination", () => {
  it("normalizes optional pagination input", () => {
    expect(normalizeDataGridServerPagination({ pageSize: 25.9, currentPage: 2.2 })).toEqual({
      pageSize: 25,
      currentPage: 2,
    })
    expect(normalizeDataGridServerPagination({ enabled: false, pageSize: 25, currentPage: 2 })).toBeNull()
    expect(normalizeDataGridServerPagination({ pageSize: Number.NaN, currentPage: 2 })).toBeNull()
  })
})

describe("normalizeDataGridServerGroupBy", () => {
  it("normalizes group fields with stable dedupe and mapping", () => {
    expect(normalizeDataGridServerGroupBy({
      fields: [" owner ", "", "service", "owner"],
      expandedByDefault: false,
    }, {
      columnIdMap: { owner: "owner_name" },
    })).toEqual({
      fields: ["owner_name", "service"],
      expandedByDefault: false,
    })
  })

  it("drops empty group specs", () => {
    expect(normalizeDataGridServerGroupBy(null)).toBeNull()
    expect(normalizeDataGridServerGroupBy({ fields: [] })).toBeNull()
  })
})

describe("normalizeDataGridServerQuery", () => {
  it("builds a deterministic normalized backend query without mutating the request", () => {
    const request = createPullRequest({
      range: { start: 10, end: 19 },
      sortModel: [
        { key: " owner ", direction: "asc" },
        { key: "amount", direction: "desc" },
      ],
      filterModel: {
        columnFilters: {
          owner: { kind: "valueSet", tokens: [" string:noc ", "string:noc"] },
        },
        columnStyleFilters: {
          status: { kind: "styleValueSet", styleKey: " bg ", tokens: [" #fff "] },
        },
        advancedFilters: {
          amount: {
            type: "number",
            clauses: [{ operator: "gt", value: 10 }],
          },
        },
        advancedExpression: {
          kind: "condition",
          key: "amount",
          operator: "gt",
          value: 10,
        },
        quickFilter: {
          query: " platform ",
          columns: [" owner ", "owner", "service"],
          mode: "tokens",
        },
      },
      groupBy: {
        fields: [" owner ", "service", "owner"],
        expandedByDefault: true,
      },
      groupExpansion: {
        expandedByDefault: false,
        toggledGroupKeys: [" owner=alice ", "", "service=platform"],
      },
      treeData: {
        operation: "toggle-group",
        scope: "branch",
        groupKeys: [" owner=alice "],
      },
      pagination: {
        snapshot: {
          enabled: true,
          pageSize: 25,
          currentPage: 2,
          pageCount: 5,
          totalRowCount: 120,
          startIndex: 50,
          endIndex: 74,
        },
        cursor: "cursor:2",
      },
    })

    const normalized = normalizeDataGridServerQuery(request, {
      columnIdMap: { owner: "owner_name", status: "status_code" },
    })

    expect(Object.keys(normalized)).toEqual([
      "range",
      "sortModel",
      "filterModel",
      "groupBy",
      "groupExpansion",
      "treeData",
      "pagination",
    ])
    expect(normalized).toEqual({
      range: { startRow: 10, endRow: 20 },
      sortModel: [
        { colId: "owner_name", sort: "asc" },
        { colId: "amount", sort: "desc" },
      ],
      filterModel: {
        columnFilters: {
          owner_name: { kind: "valueSet", tokens: ["string:noc"] },
        },
        columnStyleFilters: {
          status_code: { kind: "styleValueSet", styleKey: "bg", tokens: ["#fff"] },
        },
        advancedFilters: {
          amount: {
            type: "number",
            clauses: [{ operator: "gt", value: 10 }],
          },
        },
        advancedExpression: {
          kind: "condition",
          key: "amount",
          operator: "gt",
          value: 10,
        },
        quickFilter: {
          query: "platform",
          columns: ["owner", "service"],
          mode: "tokens",
        },
      },
      groupBy: {
        fields: ["owner_name", "service"],
        expandedByDefault: true,
      },
      groupExpansion: {
        expandedByDefault: false,
        toggledGroupKeys: ["owner=alice", "service=platform"],
      },
      treeData: {
        operation: "toggle-group",
        scope: "branch",
        groupKeys: ["owner=alice"],
      },
      pagination: {
        pageSize: 25,
        currentPage: 2,
      },
    })
    expect(request.filterModel?.quickFilter?.query).toBe(" platform ")
    expect(request.groupBy?.fields).toEqual([" owner ", "service", "owner"])
  })

  it("normalizes group expansion and tree pull context", () => {
    expect(normalizeDataGridServerGroupExpansion({
      expandedByDefault: true,
      toggledGroupKeys: [" group:a ", "", "group:b"],
    })).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: ["group:a", "group:b"],
    })
    expect(normalizeDataGridServerTreeData({
      operation: "expand-group",
      scope: "branch",
      groupKeys: [" group:a "],
    })).toEqual({
      operation: "expand-group",
      scope: "branch",
      groupKeys: ["group:a"],
    })
    expect(normalizeDataGridServerTreeData(null)).toBeNull()
  })

  it("prunes empty optional models while preserving explicit null filter state", () => {
    expect(normalizeDataGridServerQuery(createPullRequest())).toEqual({
      range: { startRow: 0, endRow: 10 },
      filterModel: null,
    })

    expect(normalizeDataGridServerQuery(createPullRequest({
      filterModel: {
        columnFilters: {},
        advancedFilters: {},
        quickFilter: { query: "   " },
      },
    }))).toEqual({
      range: { startRow: 0, endRow: 10 },
      filterModel: null,
    })
  })
})

describe("createAffinoDatasource query mapping", () => {
  it("uses the normalized server query codec by default", async () => {
    const { bodies, fetchImpl } = createFetchRecorder()
    const datasource = createAffinoDatasource({
      baseUrl: "https://api.test",
      tableId: "orders",
      fetchImpl,
      queryCodec: {
        columnIdMap: { owner: "owner_name" },
      },
    })

    await datasource.pull(createPullRequest({
      range: { start: 3, end: 7 },
      sortModel: [{ key: " owner ", direction: "asc" }],
      filterModel: {
        columnFilters: {},
        advancedFilters: {},
        quickFilter: {
          query: " platform ",
          columns: [" owner "],
        },
      },
      groupBy: {
        fields: ["owner"],
      },
      groupExpansion: {
        expandedByDefault: false,
        toggledGroupKeys: ["owner=alice"],
      },
      treeData: {
        operation: "expand-group",
        scope: "branch",
        groupKeys: ["owner=alice"],
      },
      pagination: {
        snapshot: {
          enabled: true,
          pageSize: 50,
          currentPage: 1,
          pageCount: 3,
          totalRowCount: 125,
          startIndex: 50,
          endIndex: 99,
        },
        cursor: null,
      },
    }))

    expect(bodies[0]).toEqual({
      range: { startRow: 3, endRow: 8 },
      sortModel: [{ colId: "owner_name", sort: "asc" }],
      filterModel: {
        quickFilter: {
          query: "platform",
          columns: ["owner"],
          mode: "contains",
        },
      },
      groupBy: {
        fields: ["owner_name"],
      },
      groupExpansion: {
        expandedByDefault: false,
        toggledGroupKeys: ["owner=alice"],
      },
      treeData: {
        operation: "expand-group",
        scope: "branch",
        groupKeys: ["owner=alice"],
      },
      pagination: {
        pageSize: 50,
        currentPage: 1,
      },
    })
  })

  it("supports normalized mapQuery and raw mapPullRequest escape hatches", async () => {
    const mapped = createFetchRecorder()
    const mappedDatasource = createAffinoDatasource({
      baseUrl: "https://api.test",
      tableId: "orders",
      fetchImpl: mapped.fetchImpl,
      mapQuery: query => ({ query, tenantId: "tenant-1" }),
    })

    await mappedDatasource.pull(createPullRequest({ range: { start: 1, end: 1 } }))

    expect(mapped.bodies[0]).toEqual({
      query: {
        range: { startRow: 1, endRow: 2 },
        filterModel: null,
      },
      tenantId: "tenant-1",
    })

    const raw = createFetchRecorder()
    const rawDatasource = createAffinoDatasource({
      baseUrl: "https://api.test",
      tableId: "orders",
      fetchImpl: raw.fetchImpl,
      mapPullRequest: request => ({ rawStart: request.range.start }),
    })

    await rawDatasource.pull(createPullRequest({ range: { start: 4, end: 6 } }))

    expect(raw.bodies[0]).toEqual({ rawStart: 4 })
  })

  it("preserves commit metadata and publishes history status", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      operationId: "op-1",
      datasetVersion: 7,
      revision: "rev-7",
      rows: [{ rowId: "r1", index: 0, row: { id: "r1", value: 42 } }],
      updatedRows: [{ rowId: "r2", index: 1, row: { id: "r2", value: 43 } }],
      committed: [{ rowId: "r1", columnId: "value", revision: "row-rev-1" }],
      rejected: [],
      affectedRows: 1,
      affectedCells: 1,
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "op-1",
      latestRedoOperationId: null,
      invalidation: { kind: "range", range: { start: 0, end: 0 }, reason: "commit" },
      warnings: ["normalized"],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
    const datasource = createAffinoDatasource<{ id: string; value: number }>({
      baseUrl: "https://api.test",
      tableId: "orders",
      fetchImpl,
    })
    const statuses: unknown[] = []
    datasource.subscribeHistoryStatus(status => statuses.push(status))

    const result = await datasource.commitEdits!({
      edits: [{ rowId: "r1", data: { value: 42 } }],
    })

    expect(result).toMatchObject({
      operationId: "op-1",
      datasetVersion: 7,
      revision: "rev-7",
      affectedRows: 1,
      affectedCells: 1,
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "op-1",
      latestRedoOperationId: null,
      warnings: ["normalized"],
    })
    expect(result.rows).toEqual([{ rowId: "r1", index: 0, row: { id: "r1", value: 42 } }])
    expect(result.updatedRows).toEqual([{ rowId: "r2", index: 1, row: { id: "r2", value: 43 } }])
    expect(datasource.latestDatasetVersion).toBe(7)
    expect(statuses.at(-1)).toMatchObject({
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "op-1",
      datasetVersion: 7,
    })
  })

  it("includes tableId in change-feed requests", async () => {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async input => {
      urls.push(String(input))
      return new Response(JSON.stringify({ datasetVersion: 1, changes: [], hasMore: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    const datasource = createAffinoDatasource({
      baseUrl: "https://api.test",
      tableId: "orders",
      fetchImpl,
    })

    await datasource.getChangesSinceVersion({ sinceVersion: 0 })

    expect(urls[0]).toBe("https://api.test/api/changes?tableId=orders&sinceVersion=0")
  })
})
