import { describe, expect, it, vi } from "vitest"
import {
  createDataGridColumnModel,
  createClientRowModel,
  createDataSourceBackedRowModel,
  serializeColumnValueToToken,
} from "../../models"
import type { DataGridRowModel } from "../../models"
import type { DataGridSelectionSnapshot } from "../../selection/snapshot"
import {
  DATAGRID_PUBLIC_PACKAGE_VERSION,
  DATAGRID_PUBLIC_PROTOCOL_VERSION,
} from "../../protocol"
import { createDataGridTransactionService } from "../transactionService"
import { createDataGridApi as createDataGridApiFromPublic } from "../../public"
import { createDataGridApi } from "../gridApi"
import { createDataGridCore } from "../gridCore"

describe("data grid api facade contracts", () => {
  const waitForCellRefreshFrame = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 30))
  }

  it("is exported through the stable public entrypoint", () => {
    expect(typeof createDataGridApiFromPublic).toBe("function")
  })

  it("fails fast when required model services are missing", () => {
    const core = createDataGridCore()
    expect(() => createDataGridApi({ core })).toThrow(/rowModel/)
  })

  it("exposes namespaced API only (no legacy unscoped methods)", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1, name: "alpha" }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "name", label: "Name" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })

    const api = createDataGridApi({ core }) as unknown as Record<string, unknown>
    expect(typeof api.rows).toBe("object")
    expect(typeof api.columns).toBe("object")
    expect(typeof api.view).toBe("object")
    expect(typeof api.pivot).toBe("object")
    expect(typeof api.selection).toBe("object")
    expect(typeof api.transaction).toBe("object")
    expect(typeof api.data).toBe("object")
    expect(typeof api.compute).toBe("object")
    expect(typeof api.diagnostics).toBe("object")
    expect(typeof api.meta).toBe("object")
    expect(typeof api.policy).toBe("object")
    expect(typeof api.plugins).toBe("object")
    expect(typeof api.state).toBe("object")
    expect(typeof (api.state as { migrate?: unknown }).migrate).toBe("function")
    expect(typeof api.events).toBe("object")
    expect(typeof api.lifecycle).toBe("object")
    expect(typeof (api.lifecycle as { isBusy?: unknown }).isBusy).toBe("function")
    expect(typeof (api.lifecycle as { whenIdle?: unknown }).whenIdle).toBe("function")
    expect(typeof (api.lifecycle as { runExclusive?: unknown }).runExclusive).toBe("function")
    expect("getRowCount" in api).toBe(false)
    expect("setSortModel" in api).toBe(false)
    expect("setColumnWidth" in api).toBe(false)
    expect("refreshCellsByRowKeys" in api).toBe(false)
  })

  it("routes row/column/filter/sort/refresh through core services", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, name: "alpha" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, name: "beta" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
      ],
    })
    let viewportRange = { start: -1, end: -1 }

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        viewport: {
          name: "viewport",
          setViewportRange(range) {
            viewportRange = { ...range }
          },
        },
      },
    })

    const api = createDataGridApi({ core })

    api.rows.setSortModel([{ key: "id", direction: "asc" }])
    api.rows.setFilterModel({ columnFilters: { name: { kind: "valueSet", tokens: ["string:alpha"] } }, advancedFilters: {} })
    api.rows.setSortAndFilterModel({
      sortModel: [{ key: "id", direction: "desc" }],
      filterModel: { columnFilters: { name: { kind: "valueSet", tokens: ["string:beta"] } }, advancedFilters: {} },
    })
    api.rows.setGroupBy({ fields: ["name"], expandedByDefault: true })
    api.rows.setAggregationModel({ columns: [{ key: "id", op: "count" }] })
    api.rows.setGroupExpansion({ expandedByDefault: true, toggledGroupKeys: [] })
    api.rows.collapseGroup("name=alpha")
    api.rows.setPageSize(1)
    api.rows.setCurrentPage(1)
    api.view.setViewportRange({ start: 0, end: 1 })
    api.columns.setVisibility("id", false)
    api.columns.setWidth("name", 280)
    api.columns.setPin("name", "left")
    api.columns.setOrder(["name", "id"])
    api.view.refresh()

    const rowSnapshot = api.rows.getSnapshot()
    const columnSnapshot = api.columns.getSnapshot()

    expect(rowSnapshot.sortModel).toEqual([{ key: "id", direction: "desc" }])
    expect(rowSnapshot.filterModel).toEqual({
      columnFilters: { name: { kind: "valueSet", tokens: ["string:beta"] } },
      advancedFilters: {},
    })
    expect(rowSnapshot.groupBy).toEqual({
      fields: ["name"],
      expandedByDefault: true,
    })
    expect(api.rows.getAggregationModel()).toEqual({
      columns: [{ key: "id", op: "count" }],
    })
    expect(api.columns.getHistogram("name")).toEqual([
      {
        token: "string:beta",
        value: "beta",
        count: 1,
        text: "beta",
      },
    ])
    expect(rowSnapshot.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: ["name=alpha"],
    })
    expect(rowSnapshot.pagination.enabled).toBe(true)
    expect(rowSnapshot.pagination.pageSize).toBe(1)
    expect(rowSnapshot.pagination.currentPage).toBe(1)
    expect(rowSnapshot.pagination.totalRowCount).toBe(2)
    expect(rowSnapshot.viewportRange).toEqual({ start: 0, end: 0 })
    expect(viewportRange).toEqual({ start: 0, end: 1 })
    expect(api.rows.getCount()).toBe(1)
    expect(api.rows.getPagination().currentPage).toBe(1)
    const maxIndex = Math.max(0, api.rows.getCount() - 1)
    const candidates = api.rows.getRange({ start: 0, end: Math.min(3, maxIndex) })
    const firstLeaf = candidates.find(row => row.kind === "leaf") as { row: { name: string } } | undefined
    expect(firstLeaf?.row.name).toBe("beta")
    expect(columnSnapshot.order).toEqual(["name", "id"])
    expect(api.columns.get("id")?.visible).toBe(false)
    expect(api.columns.get("name")?.pin).toBe("left")
    expect(api.columns.get("name")?.width).toBe(280)
  })

  it("exposes style histograms through the columns namespace", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, team: "A", styles: { status: { backgroundColor: "#ff0000" } } }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, team: "A", styles: { status: { backgroundColor: "#00ff00" } } }, rowId: 2, originalIndex: 1 },
      ],
      readFilterCellStyle: (rowNode, columnKey, styleKey) => {
        return (rowNode.data as {
          styles?: Record<string, Record<string, unknown>>
        }).styles?.[columnKey]?.[styleKey]
      },
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "status", label: "Status" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })

    const api = createDataGridApi({ core })

    api.rows.setFilterModel({
      columnFilters: { team: { kind: "valueSet", tokens: ["string:A"] } },
      columnStyleFilters: {
        status: {
          kind: "styleValueSet",
          styleKey: "backgroundColor",
          tokens: [serializeColumnValueToToken("#ff0000")],
        },
      },
      advancedFilters: {},
    })

    expect(api.columns.getHistogram("status", { styleKey: "backgroundColor", ignoreSelfFilter: true })).toEqual([
      { token: "string:#00ff00", value: "#00ff00", count: 1, text: "#00ff00" },
      { token: "string:#ff0000", value: "#ff0000", count: 1, text: "#ff0000" },
    ])

    rowModel.dispose()
  })

  it("exposes the effective row height through the view namespace", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1, name: "alpha" }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "name", label: "Name" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        viewport: {
          name: "viewport",
          getEffectiveRowHeight() {
            return 44
          },
        },
      },
    })

    const api = createDataGridApi({ core })

    expect(api.view.getEffectiveRowHeight()).toBe(44)
  })

  it("routes explicit group expansion APIs through row model service", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, team: "alpha" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, team: "beta" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel()
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })

    const api = createDataGridApi({ core })
    const alphaGroupKey = JSON.stringify([["team", "alpha"]])
    const betaGroupKey = JSON.stringify([["team", "beta"]])
    api.rows.setGroupBy({ fields: ["team"], expandedByDefault: false })
    api.rows.expandGroup(alphaGroupKey)
    api.rows.collapseGroup(alphaGroupKey)
    api.view.expandAllGroups()
    api.rows.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: [betaGroupKey],
    })

    expect(api.rows.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [betaGroupKey],
    })

    api.view.collapseAllGroups()
    expect(api.rows.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })
  })

  it("routes pivot model through row model service", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, team: "alpha", status: "open" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, team: "alpha", status: "done" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "id", label: "ID" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.pivot.setModel({
      rows: ["team"],
      columns: ["status"],
      values: [{ field: "id", agg: "count" }],
    })

    expect(api.pivot.getModel()).toEqual({
      rows: ["team"],
      columns: ["status"],
      values: [{ field: "id", agg: "count" }],
    })
    expect(api.rows.getSnapshot().pivotModel).toEqual({
      rows: ["team"],
      columns: ["status"],
      values: [{ field: "id", agg: "count" }],
    })
  })

  it("exports and imports pivot layout snapshot with row/column state", () => {
    const rowModel = createClientRowModel({
      rows: [
        {
          row: { id: 1, region: "AMER", team: "core", owner: "NOC", year: "2024", revenue: 1000 },
          rowId: "r1",
          originalIndex: 0,
        },
        {
          row: { id: 2, region: "EMEA", team: "payments", owner: "SRE", year: "2025", revenue: 2000 },
          rowId: "r2",
          originalIndex: 1,
        },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "region", label: "Region" },
        { key: "team", label: "Team" },
        { key: "owner", label: "Owner" },
        { key: "year", label: "Year" },
        { key: "revenue", label: "Revenue" },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setSortAndFilterModel({
      sortModel: [{ key: "revenue", direction: "desc" }],
      filterModel: {
        columnFilters: { region: { kind: "valueSet", tokens: ["string:amer"] } },
        advancedFilters: {},
      },
    })
    api.rows.setGroupBy({ fields: ["region"], expandedByDefault: true })
    api.pivot.setModel({
      rows: ["region", "team"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    })
    api.rows.setAggregationModel({
      columns: [{ key: "revenue", field: "revenue", op: "sum" }],
    })
    api.rows.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: ["pivot:group:6:region4:AMER"],
    })
    api.columns.setOrder(["team", "region", "year", "owner", "revenue"])
    api.columns.setVisibility("owner", false)
    api.columns.setWidth("revenue", 260)
    api.columns.setPin("team", "left")

    const exported = api.pivot.exportLayout()
    const interop = api.pivot.exportInterop()
    expect(interop).not.toBeNull()
    expect(interop?.version).toBe(1)
    expect(interop?.layout.pivotModel).toEqual(exported.pivotModel)
    expect(Array.isArray(interop?.rows)).toBe(true)
    expect((interop?.rows.length ?? 0) > 0).toBe(true)
    expect(Array.isArray(interop?.pivotColumns)).toBe(true)

    api.rows.setSortModel([{ key: "region", direction: "asc" }])
    api.rows.setFilterModel(null)
    api.rows.setGroupBy(null)
    api.pivot.setModel(null)
    api.rows.setAggregationModel(null)
    api.rows.setGroupExpansion({ expandedByDefault: true, toggledGroupKeys: [] })
    api.columns.setOrder(["region", "team", "owner", "year", "revenue"])
    api.columns.setVisibility("owner", true)
    api.columns.setWidth("revenue", 140)
    api.columns.setPin("team", "none")

    api.pivot.importLayout(exported)

    const rowSnapshot = api.rows.getSnapshot()
    const columnSnapshot = api.columns.getSnapshot()

    expect(rowSnapshot.sortModel).toEqual([{ key: "revenue", direction: "desc" }])
    expect(rowSnapshot.filterModel).toEqual({
      columnFilters: { region: { kind: "valueSet", tokens: ["string:amer"] } },
      advancedFilters: {},
    })
    expect(rowSnapshot.groupBy).toEqual({ fields: ["region"], expandedByDefault: true })
    expect(rowSnapshot.pivotModel).toEqual({
      rows: ["region", "team"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    })
    expect(api.rows.getAggregationModel()).toEqual({
      columns: [{ key: "revenue", field: "revenue", op: "sum" }],
    })
    expect(rowSnapshot.groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["pivot:group:6:region4:AMER"],
    })
    expect(columnSnapshot.order).toEqual(["team", "region", "year", "owner", "revenue"])
    expect(api.columns.get("owner")?.visible).toBe(false)
    expect(api.columns.get("revenue")?.width).toBe(260)
    expect(api.columns.get("team")?.pin).toBe("left")
  })

  it("falls back to sequential setFilterModel/setSortModel when row model lacks batched sort+filter capability", () => {
    const clientRowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", score: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, owner: "ops", score: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })
    const { setSortAndFilterModel: _omitBatch, ...rowModelWithoutBatch } = clientRowModel
    const rowModel = rowModelWithoutBatch as unknown as DataGridRowModel<{ id: number; owner: string; score: number }>
    const setSortModelSpy = vi.spyOn(rowModel, "setSortModel")
    const setFilterModelSpy = vi.spyOn(rowModel, "setFilterModel")
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "owner", label: "Owner" },
        { key: "score", label: "Score" },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setSortAndFilterModel({
      filterModel: {
        columnFilters: { owner: { kind: "valueSet", tokens: ["string:noc"] } },
        advancedFilters: {},
      },
      sortModel: [{ key: "score", direction: "desc" }],
    })

    expect(setFilterModelSpy).toHaveBeenCalledTimes(1)
    expect(setSortModelSpy).toHaveBeenCalledTimes(1)
  })

  it("returns empty histogram map when row model does not expose histogram capability", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1, owner: "noc" }, rowId: "r1", originalIndex: 0, displayIndex: 0 }],
    })
    const { getColumnHistogram: _omitHistogram, ...rowModelWithoutHistogram } = clientRowModel
    const rowModel = rowModelWithoutHistogram as unknown as DataGridRowModel<{ id: number; owner: string }>
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.columns.getHistogram("owner")).toEqual([])
  })

  it("exposes rows.patch/rows.applyEdits/view.reapply with Excel-like defaults and optional auto-reapply", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, tested_at: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, tested_at: 300 }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "tested_at", label: "Tested At" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasPatchSupport()).toBe(true)
    expect(api.rows.getAutoReapply()).toBe(false)

    api.rows.setSortModel([{ key: "tested_at", direction: "desc" }])
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])

    // applyEdits defaults to frozen view semantics (no live re-sort/filter/group)
    api.rows.applyEdits([{ rowId: "r1", data: { tested_at: 999 } }])
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])
    expect((api.rows.get(2)?.row as { tested_at?: number })?.tested_at).toBe(999)

    api.rows.setAutoReapply(true)
    expect(api.rows.getAutoReapply()).toBe(true)
    api.rows.applyEdits([{ rowId: "r2", data: { tested_at: 1 } }])
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r3", "r2"])

    api.rows.patch([{ rowId: "r3", data: { tested_at: 2000 } }], { recomputeSort: true })
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    api.rows.patch([{ rowId: "r2", data: { tested_at: 5000 } }], { recomputeSort: false })
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    api.view.reapply()
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r2", "r3", "r1"])
  })

  it("exposes computed field APIs for client row models", () => {
    const rowModel = createClientRowModel<{
      id: number
      price: number
      quantity: number
      fee: number
      total?: number
      grand?: number
    }>({
      rows: [
        { row: { id: 1, price: 10, quantity: 2, fee: 1 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "total", label: "Total" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasComputedSupport()).toBe(true)
    expect(api.rows.hasFormulaSupport()).toBe(true)
    expect(api.rows.hasFormulaFunctionRegistrySupport()).toBe(true)
    api.rows.registerFormulaFunction("double", {
      arity: 1,
      compute: args => Number(args[0] ?? 0) * 2,
    })
    expect(api.rows.getFormulaFunctionNames()).toEqual(["DOUBLE"])
    api.rows.registerComputedField({
      name: "total",
      deps: ["field:price", "field:quantity"],
      compute: context => {
        const row = context.row as { price: number; quantity: number }
        return row.price * row.quantity
      },
    })
    api.rows.registerFormulaField({
      name: "grand",
      formula: "total + fee",
    })
    api.rows.registerFormulaField({
      name: "doubled",
      formula: "DOUBLE(total)",
    })
    expect(api.rows.getComputedFields().map(field => field.name)).toEqual(["total"])
    expect(api.rows.getFormulaFields().map(field => field.name)).toEqual(["grand", "doubled"])
    expect((api.rows.get(0)?.row as { total?: number })?.total).toBe(20)
    expect((api.rows.get(0)?.row as { grand?: number })?.grand).toBe(21)
    expect((api.rows.get(0)?.row as { doubled?: number })?.doubled).toBe(40)

    api.rows.patch([{ rowId: "r1", data: { price: 15 } }], { recomputeSort: false })
    expect((api.rows.get(0)?.row as { total?: number })?.total).toBe(30)
    expect((api.rows.get(0)?.row as { grand?: number })?.grand).toBe(31)
    expect((api.rows.get(0)?.row as { doubled?: number })?.doubled).toBe(60)
    expect(() => api.rows.unregisterFormulaFunction("DOUBLE")).toThrow(/Unknown function/i)
    expect(api.rows.getFormulaFunctionNames()).toEqual(["DOUBLE"])
    expect(api.rows.unregisterFormulaFunction("MISSING")).toBe(false)
    expect(api.rows.recomputeComputedFields()).toBe(0)
  })

  it("reports missing computed field capability for row models without computed runtime", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1, score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 }],
    })
    const {
      registerComputedField: _omitRegisterComputedField,
      getComputedFields: _omitGetComputedFields,
      recomputeComputedFields: _omitRecomputeComputedFields,
      ...rowModelWithoutComputed
    } = clientRowModel
    const rowModel = rowModelWithoutComputed as unknown as DataGridRowModel<{ id: number; score: number }>
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasComputedSupport()).toBe(false)
    expect(api.rows.getComputedFields()).toEqual([])
    expect(() => {
      api.rows.registerComputedField({
        name: "score2",
        deps: ["field:score"],
        compute: context => {
          const row = context.row as { score: number }
          return row.score
        },
      })
    }).toThrow(/computed field capability/i)
  })

  it("reports missing formula field capability for row models without formula runtime", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1, score: 10 }, rowId: "r1", originalIndex: 0, displayIndex: 0 }],
    })
    const {
      registerFormulaField: _omitRegisterFormulaField,
      getFormulaFields: _omitGetFormulaFields,
      recomputeFormulaContext: _omitRecomputeFormulaContext,
      registerFormulaFunction: _omitRegisterFormulaFunction,
      unregisterFormulaFunction: _omitUnregisterFormulaFunction,
      getFormulaFunctionNames: _omitGetFormulaFunctionNames,
      getFormulaExecutionPlan: _omitGetFormulaExecutionPlan,
      ...rowModelWithoutFormula
    } = clientRowModel
    const rowModel = rowModelWithoutFormula as unknown as DataGridRowModel<{ id: number; score: number }>
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasFormulaSupport()).toBe(false)
    expect(api.rows.hasFormulaFunctionRegistrySupport()).toBe(false)
    expect(api.rows.getFormulaFields()).toEqual([])
    expect(api.rows.getFormulaFunctionNames()).toEqual([])
    expect(() => {
      api.rows.registerFormulaField({
        name: "score2",
        formula: "score * 2",
      })
    }).toThrow(/formula field capability/i)
    expect(() => {
      api.rows.registerFormulaFunction("double", args => Number(args[0] ?? 0) * 2)
    }).toThrow(/formula function registry capability/i)
    expect(() => {
      api.rows.unregisterFormulaFunction("double")
    }).toThrow(/formula function registry capability/i)
    expect(() => {
      api.rows.recomputeFormulaContext({ contextKeys: ["pricing"] })
    }).toThrow(/formula field capability/i)
  })

  it("exposes contextual formula recompute through rows api", () => {
    let rate = 2
    const rowModel = createClientRowModel<{
      id: number
      qty: number
      total?: number
    }>({
      rows: [
        { row: { id: 1, qty: 3 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, qty: 4 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "total", label: "Total" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.registerFormulaFunction("RATE", {
      arity: 0,
      contextKeys: ["pricing"],
      compute: () => rate,
    })
    api.rows.registerFormulaField({
      name: "total",
      formula: "qty * RATE()",
    })

    rate = 5
    expect(api.rows.recomputeFormulaContext({ contextKeys: ["pricing"], rowIds: ["r2"] })).toBe(1)
    expect((api.rows.get(0)?.row as { total?: number })?.total).toBe(6)
    expect((api.rows.get(1)?.row as { total?: number })?.total).toBe(20)
    expect(api.diagnostics.getFormulaExplain().formulas).toEqual([
      expect.objectContaining({
        name: "total",
        contextKeys: ["pricing"],
      }),
    ])
  })

  it("reports missing patch capability for non-client row models and fails loudly", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1, tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 }],
    })
    const { patchRows: _omitPatch, ...rowModelWithoutPatch } = clientRowModel
    const rowModel = rowModelWithoutPatch as unknown as DataGridRowModel<{ id: number; tested_at: number }>
    const refreshSpy = vi.spyOn(rowModel, "refresh")
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "tested_at", label: "Tested At" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasPatchSupport()).toBe(false)
    expect(() => {
      api.rows.patch([{ rowId: "r1", data: { tested_at: 200 } }])
    }).toThrow(/patchRows capability/i)
    expect(() => {
      api.rows.applyEdits([{ rowId: "r1", data: { tested_at: 200 } }])
    }).toThrow(/patchRows capability/i)

    api.view.reapply()
    expect(refreshSpy).toHaveBeenCalledWith("reapply")
  })

  it("exposes rows data-mutation methods for models with setRows capability", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r0", score: 0 }, rowId: "r0", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasDataMutationSupport()).toBe(true)
    api.rows.setData([
      { row: { id: "r1", score: 1 }, rowId: "r1", originalIndex: 0 },
      { row: { id: "r2", score: 2 }, rowId: "r2", originalIndex: 1 },
    ])
    expect(api.rows.getCount()).toBe(2)
    expect((api.rows.get(0)?.row as { id?: string })?.id).toBe("r1")

    api.rows.appendData([{ row: { id: "r3", score: 3 }, rowId: "r3", originalIndex: 2 }])
    expect(api.rows.getCount()).toBe(3)
    expect((api.rows.get(2)?.row as { id?: string })?.id).toBe("r3")

    api.rows.prependData([{ row: { id: "r00", score: 0 }, rowId: "r00", originalIndex: 0 }])
    expect(api.rows.getCount()).toBe(4)
    expect((api.rows.get(0)?.row as { id?: string })?.id).toBe("r00")

    expect(api.rows.hasInsertSupport()).toBe(true)
    api.rows.insertDataAt(1, [{ row: { id: "r05", score: 0.5 }, rowId: "r05", originalIndex: 1 }])
    expect(api.rows.getCount()).toBe(5)
    expect((api.rows.get(1)?.row as { id?: string })?.id).toBe("r05")

    api.rows.insertDataBefore("r2", [{ row: { id: "r15", score: 1.5 }, rowId: "r15", originalIndex: 2 }])
    expect(api.rows.getCount()).toBe(6)
    expect((api.rows.get(3)?.row as { id?: string })?.id).toBe("r15")

    api.rows.insertDataAfter("r2", [{ row: { id: "r25", score: 2.5 }, rowId: "r25", originalIndex: 4 }])
    expect(api.rows.getCount()).toBe(7)
    expect((api.rows.get(5)?.row as { id?: string })?.id).toBe("r25")

    api.rows.replaceData([{ row: { id: "rx", score: 9 }, rowId: "rx", originalIndex: 0 }])
    expect(api.rows.getCount()).toBe(1)
    expect((api.rows.get(0)?.row as { id?: string })?.id).toBe("rx")
  })

  it("reports missing data-mutation capability when row model does not expose setRows", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1 }, rowId: 1, originalIndex: 0 }],
    })
    const {
      setRows: _omitSetRows,
      replaceRows: _omitReplaceRows,
      appendRows: _omitAppendRows,
      prependRows: _omitPrependRows,
      ...rowModelWithoutDataMutation
    } = clientRowModel
    const rowModel = rowModelWithoutDataMutation as unknown as DataGridRowModel<{ id: number }>
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "id", label: "ID" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasDataMutationSupport()).toBe(false)
    expect(api.rows.hasInsertSupport()).toBe(false)
    expect(() => api.rows.setData([])).toThrow(/setRows data mutation capability/i)
    expect(() => api.rows.replaceData([])).toThrow(/setRows data mutation capability/i)
    expect(() => api.rows.appendData([])).toThrow(/setRows data mutation capability/i)
    expect(() => api.rows.prependData([])).toThrow(/setRows data mutation capability/i)
    expect(() => api.rows.insertDataAt(0, [])).toThrow(/insertRowsAt data mutation capability/i)
    expect(() => api.rows.insertDataBefore(1, [])).toThrow(/insertRowsBefore data mutation capability/i)
    expect(() => api.rows.insertDataAfter(1, [])).toThrow(/insertRowsAfter data mutation capability/i)
  })

  it("inserts columns through the columns namespace without losing existing layout state", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r1", score: 1 }, rowId: "r1", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID", initialState: { width: 90 } },
        { key: "score", label: "Score", initialState: { pin: "left" } },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.columns.insertAt(1, [{ key: "owner", label: "Owner", initialState: { visible: false } }])
    expect(api.columns.getSnapshot().order).toEqual(["id", "owner", "score"])
    expect(api.columns.get("owner")?.visible).toBe(false)
    expect(api.columns.get("score")?.pin).toBe("left")

    api.columns.insertBefore("id", [{ key: "prefix", label: "Prefix" }])
    expect(api.columns.getSnapshot().order).toEqual(["prefix", "id", "owner", "score"])

    api.columns.insertAfter("score", [{ key: "tail", label: "Tail", initialState: { width: 180 } }])
    expect(api.columns.getSnapshot().order).toEqual(["prefix", "id", "owner", "score", "tail"])
    expect(api.columns.get("tail")?.width).toBe(180)
    expect(api.columns.get("id")?.width).toBe(90)
  })

  it("rejects duplicate rowId across rows mutation entrypoints", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r1", score: 1 }, rowId: "r1", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(() => {
      api.rows.insertDataAfter("r1", [
        { row: { id: "r1-copy", score: 2 }, rowId: "r1", originalIndex: 1 },
      ])
    }).toThrow(/Duplicate rowId/)
    expect(api.rows.getCount()).toBe(1)

    expect(() => {
      api.rows.setData([
        { row: { id: "dup-a", score: 1 }, rowId: "dup", originalIndex: 0 },
        { row: { id: "dup-b", score: 2 }, rowId: "dup", originalIndex: 1 },
      ])
    }).toThrow(/Duplicate rowId/)
    expect(api.rows.getCount()).toBe(1)
  })

  it("exposes compute-mode control and diagnostics through dedicated namespaces", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r1", score: 1 }, rowId: "r1", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.compute.hasSupport()).toBe(true)
    expect(api.compute.getMode()).toBe("sync")
    expect(api.compute.getDiagnostics()?.configuredMode).toBe("sync")
    expect(api.compute.switchMode("worker")).toBe(true)
    expect(api.compute.getMode()).toBe("worker")
    expect(api.compute.getDiagnostics()?.configuredMode).toBe("worker")
    expect(api.compute.switchMode("worker")).toBe(false)

    const diagnostics = api.diagnostics.getAll()
    expect(diagnostics.rowModel.kind).toBe("client")
    expect(diagnostics.compute?.configuredMode).toBe("worker")
    expect(diagnostics.rowModel.projection?.pipeline?.rowCounts.source).toBe(1)
    expect(diagnostics.rowModel.projection?.pipeline?.rowCounts.visible).toBe(1)
    expect(diagnostics.derivedCache).not.toBeNull()
    expect(diagnostics.derivedCache?.sourceColumnCacheSize).toBeGreaterThanOrEqual(0)
    expect(diagnostics.derivedCache?.sourceColumnCacheLimit).toBeNull()
    expect(diagnostics.derivedCache?.sourceColumnCacheEvictions).toBeGreaterThanOrEqual(0)
    if (diagnostics.derivedCache) {
      diagnostics.derivedCache.sourceColumnCacheEvictions = 999
    }
    const diagnosticsAfterMutation = api.diagnostics.getAll()
    expect(diagnosticsAfterMutation.derivedCache?.sourceColumnCacheEvictions).not.toBe(999)
    expect(diagnostics.backpressure).toBeNull()
    expect(api.diagnostics.getFormulaExplain()).toEqual({
      executionPlan: null,
      projectionFormula: null,
      computeStage: null,
    })
  })

  it("exposes formula explain diagnostics snapshot", () => {
    const rowModel = createClientRowModel<{
      id: number
      price: number
      qty: number
      subtotal?: number
      total?: number
    }>({
      rows: [
        { row: { id: 1, price: 10, qty: 2 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
      ],
      initialFormulaFields: [
        { name: "subtotal", formula: "price * qty" },
        { name: "total", formula: "subtotal + 1" },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "total", label: "Total" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    const explain = api.diagnostics.getFormulaExplain()
    expect(explain.executionPlan?.order).toEqual(["subtotal", "total"])
    expect(explain.executionPlan?.levels).toEqual([["subtotal"], ["total"]])
    expect(explain.executionPlan?.nodes).toEqual([
      {
        name: "subtotal",
        field: "subtotal",
        level: 0,
        fieldDeps: ["price", "qty"],
        computedDeps: [],
        dependents: ["total"],
      },
      {
        name: "total",
        field: "total",
        level: 1,
        fieldDeps: ["subtotal"],
        computedDeps: ["subtotal"],
        dependents: [],
      },
    ])
    expect(explain.projectionFormula?.recomputedFields).toEqual(["subtotal", "total"])
    expect(explain.projectionFormula?.runtimeErrorCount).toBe(0)
    expect(explain.computeStage?.rowsTouched).toBeGreaterThan(0)
    expect(explain.computeStage?.changedRows).toBeGreaterThan(0)
    expect(explain.computeStage?.fieldsTouched).toEqual(["subtotal", "total"])
    expect(explain.computeStage?.skippedByObjectIs).toBeGreaterThanOrEqual(0)
    expect(explain.computeStage?.dirtyRows).toBeGreaterThan(0)
    expect(explain.computeStage?.dirtyNodes).toEqual(["subtotal", "total"])
    expect(explain.formulas).toEqual([
      expect.objectContaining({
        name: "subtotal",
        field: "subtotal",
        formula: "price * qty",
        level: 0,
        identifiers: ["price", "qty"],
        dependencies: [
          { identifier: "price", token: "field:price", domain: "field", value: "price" },
          { identifier: "qty", token: "field:qty", domain: "field", value: "qty" },
        ],
        dependents: ["total"],
        dirty: true,
        recomputed: true,
        touched: true,
        dirtyCauses: [{ kind: "all", rows: 1 }],
        tree: expect.objectContaining({ kind: "binary", label: "*" }),
        runtime: expect.objectContaining({
          name: "subtotal",
          field: "subtotal",
          dirty: true,
          touched: true,
          dirtyRows: 1,
        }),
      }),
      expect.objectContaining({
        name: "total",
        field: "total",
        formula: "subtotal + 1",
        level: 1,
        identifiers: ["subtotal"],
        dependencies: [
          {
            identifier: "subtotal",
            token: "computed:subtotal",
            domain: "computed",
            value: "subtotal",
          },
        ],
        dependents: [],
        dirty: true,
        recomputed: true,
        touched: true,
        dirtyCauses: [
          { kind: "all", rows: 1 },
          { kind: "computed", value: "subtotal", rows: 1 },
        ],
        tree: expect.objectContaining({ kind: "binary", label: "+" }),
        runtime: expect.objectContaining({
          name: "total",
          field: "total",
          dirty: true,
          touched: true,
          dirtyRows: 1,
        }),
      }),
    ])
  })

  it("surfaces meta-domain formula dependencies in explain snapshots", () => {
    const rowModel = createClientRowModel<{
      id: number
      label?: string
    }>({
      rows: [
        { row: { id: 1 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
      ],
      initialFormulaFields: [
        { name: "label", formula: "CONCAT(meta.rowId, '-', meta.kind)" },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "label", label: "Label" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    const explain = api.diagnostics.getFormulaExplain()
    expect(explain.formulas).toEqual([
      expect.objectContaining({
        name: "label",
        field: "label",
        identifiers: ["meta.rowId", "meta.kind"],
        dependencies: [
          { identifier: "meta.rowId", token: "meta:rowId", domain: "meta", value: "rowId" },
          { identifier: "meta.kind", token: "meta:kind", domain: "meta", value: "kind" },
        ],
      }),
    ])
  })

  it("surfaces expanded reference syntax in explain snapshots", () => {
    const rowModel = createClientRowModel<{
      id: number
      user: { orders: Array<{ price: number }>; metrics: { "tax.rate": number } }
      total?: number
    }>({
      rows: [
        {
          row: {
            id: 1,
            user: {
              orders: [{ price: 10 }],
              metrics: { "tax.rate": 2 },
            },
          },
          rowId: "r1",
          originalIndex: 0,
          displayIndex: 0,
        },
      ],
      initialFormulaFields: [
        { name: "total", formula: "user.orders[0].price + user.metrics['tax.rate']" },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "total", label: "Total" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    const explain = api.diagnostics.getFormulaExplain()
    expect(explain.formulas).toEqual([
      expect.objectContaining({
        name: "total",
        identifiers: ["user.orders.0.price", 'user.metrics."tax.rate"'],
        dependencies: [
          {
            identifier: "user.orders.0.price",
            token: "field:user.orders.0.price",
            domain: "field",
            value: "user.orders.0.price",
          },
          {
            identifier: 'user.metrics."tax.rate"',
            token: 'field:user.metrics."tax.rate"',
            domain: "field",
            value: 'user.metrics."tax.rate"',
          },
        ],
      }),
    ])
  })

  it("reports compute namespace as unsupported when row model lacks compute capability", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1 }, rowId: 1, originalIndex: 0 }],
    })
    const {
      getComputeMode: _omitGetComputeMode,
      switchComputeMode: _omitSwitchComputeMode,
      getComputeDiagnostics: _omitGetComputeDiagnostics,
      ...rowModelWithoutCompute
    } = clientRowModel
    const rowModel = rowModelWithoutCompute as unknown as DataGridRowModel<{ id: number }>
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "id", label: "ID" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.compute.hasSupport()).toBe(false)
    expect(api.compute.getMode()).toBeNull()
    expect(api.compute.getDiagnostics()).toBeNull()
    expect(() => api.compute.switchMode("worker")).toThrow(/compute mode capability/i)
  })

  it("surfaces datasource backpressure diagnostics via unified diagnostics namespace", () => {
    const dataSourceRows = [
      { id: 1, owner: "noc" },
      { id: 2, owner: "ops" },
    ]
    const rowModel = createDataSourceBackedRowModel({
      initialTotal: dataSourceRows.length,
      dataSource: {
        async pull(request) {
          return {
            rows: dataSourceRows
              .slice(request.range.start, request.range.end + 1)
              .map((row, offset) => ({
                index: request.range.start + offset,
                row,
                rowId: row.id,
              })),
            total: dataSourceRows.length,
          }
        },
      },
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    const diagnostics = api.diagnostics.getAll()
    expect(diagnostics.rowModel.kind).toBe("server")
    expect(diagnostics.compute).toBeNull()
    expect(diagnostics.derivedCache).toBeNull()
    expect(diagnostics.backpressure).not.toBeNull()
    expect(diagnostics.backpressure?.pullRequested).toBeGreaterThanOrEqual(0)
  })

  it("exposes data namespace controls for datasource-backed row models", async () => {
    const pullGates: Array<{ resolve: () => void; promise: Promise<void> }> = []
    let pullCalls = 0
    const rowModel = createDataSourceBackedRowModel({
      initialTotal: 200,
      dataSource: {
        async pull(request) {
          pullCalls += 1
          let resolve!: () => void
          const promise = new Promise<void>(nextResolve => {
            resolve = nextResolve
          })
          pullGates.push({ resolve, promise })
          await promise
          const rows = []
          for (let index = request.range.start; index <= request.range.end; index += 1) {
            rows.push({
              index,
              row: { id: index, owner: `owner-${index}` },
              rowId: index,
            })
          }
          return {
            rows,
            total: 200,
          }
        },
      },
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.data.hasBackpressureControlSupport()).toBe(true)
    expect(api.data.pause()).toBe(true)
    expect(api.data.pause()).toBe(false)

    api.view.setViewportRange({ start: 0, end: 20 })
    await Promise.resolve()
    expect(pullCalls).toBe(0)
    expect(api.diagnostics.getAll().backpressure?.paused).toBe(true)
    expect(api.diagnostics.getAll().backpressure?.hasPendingPull).toBe(true)

    expect(api.data.resume()).toBe(true)
    expect(api.data.resume()).toBe(false)
    await Promise.resolve()
    expect(pullCalls).toBe(1)
    expect(api.diagnostics.getAll().backpressure?.paused).toBe(false)

    pullGates[0]?.resolve()
    await api.data.flush()
    expect(api.diagnostics.getAll().backpressure?.inFlight).toBe(false)
  })

  it("reports data namespace as unsupported when row model lacks backpressure controls", async () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r1", score: 1 }, rowId: "r1", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.data.hasBackpressureControlSupport()).toBe(false)
    expect(() => api.data.pause()).toThrow(/backpressure control capability/i)
    expect(() => api.data.resume()).toThrow(/backpressure control capability/i)
    await expect(api.data.flush()).rejects.toThrow(/backpressure control capability/i)
  })

  it("exposes meta schema/capabilities/runtime info without requiring direct model access", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r1", owner: "noc" }, rowId: "r1", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "owner", label: "Owner", meta: { formatter: "text", category: "identity" } },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    const schema = api.meta.getSchema()
    const capabilities = api.meta.getCapabilities()
    const runtime = api.meta.getRuntimeInfo()

    expect(schema.rowModelKind).toBe("client")
    expect(api.meta.getRowModelKind()).toBe("client")
    expect(schema.columns).toEqual([
      {
        key: "owner",
        label: "Owner",
        visible: true,
        pin: "none",
        width: null,
        hasMeta: true,
        metaKeys: ["category", "formatter"],
      },
    ])
    expect(capabilities.patch).toBe(true)
    expect(capabilities.dataMutation).toBe(true)
    expect(capabilities.backpressureControl).toBe(false)
    expect(capabilities.compute).toBe(true)
    expect(runtime.lifecycleState).toBe("idle")
    expect(api.meta.getApiVersion()).toBe(DATAGRID_PUBLIC_PACKAGE_VERSION)
    expect(api.meta.getProtocolVersion()).toBe(DATAGRID_PUBLIC_PROTOCOL_VERSION)
    expect(runtime.apiVersion).toBe(DATAGRID_PUBLIC_PACKAGE_VERSION)
    expect(runtime.protocolVersion).toBe(DATAGRID_PUBLIC_PROTOCOL_VERSION)
    expect(runtime.projectionMode).toBe("excel-like")
    expect(runtime.computeMode).toBe("sync")
  })

  it("applies projection policy mode and blocks data mutation in immutable mode", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: "r1", score: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: "r2", score: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.policy.getProjectionMode()).toBe("excel-like")
    expect(api.rows.getAutoReapply()).toBe(false)

    expect(api.policy.setProjectionMode("mutable")).toBe("mutable")
    expect(api.rows.getAutoReapply()).toBe(true)

    expect(api.policy.setProjectionMode("immutable")).toBe("immutable")
    expect(api.rows.getAutoReapply()).toBe(false)
    expect(() => api.rows.patch([{ rowId: "r1", data: { score: 999 } }])).toThrow(/immutable/)
    expect(() => api.rows.setData([])).toThrow(/immutable/)

    expect(api.policy.setProjectionMode("excel-like")).toBe("excel-like")
    expect(api.rows.getAutoReapply()).toBe(false)
    api.rows.patch([{ rowId: "r1", data: { score: 999 } }], { recomputeSort: false })
    expect((api.rows.get(0)?.row as { score?: number })?.score).toBe(999)
  })

  it("supports rows.batch and lifecycle exclusivity guards with typed error events", async () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r1", score: 1 }, rowId: "r1", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    let marker = 0
    const beforeRevision = api.rows.getSnapshot().revision ?? 0
    const rowsEvents: number[] = []
    const projectionEvents: number[] = []
    const unsubscribeRows = api.events.on("rows:changed", payload => {
      rowsEvents.push(payload.snapshot.revision ?? -1)
    })
    const unsubscribeProjection = api.events.on("projection:recomputed", payload => {
      projectionEvents.push(payload.nextVersion)
    })
    const batchedResult = api.rows.batch(() => {
      marker = 7
      api.rows.setSortModel([{ key: "score", direction: "asc" }])
      api.rows.setSortModel([{ key: "score", direction: "desc" }])
      return marker * 2
    })
    expect(marker).toBe(7)
    expect(batchedResult).toBe(14)
    expect((api.rows.getSnapshot().revision ?? 0)).toBeGreaterThan(beforeRevision)
    expect(rowsEvents.length).toBe(1)
    expect(projectionEvents.length).toBe(1)
    unsubscribeRows()
    unsubscribeProjection()

    expect(api.lifecycle.isBusy()).toBe(false)
    const pendingExclusive = api.lifecycle.runExclusive(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(api.lifecycle.isBusy()).toBe(true)

    let errorEvent: { code: string; operation: string } | null = null
    const unsubscribe = api.events.on("error", payload => {
      errorEvent = { code: payload.code, operation: payload.operation }
    })

    expect(() => api.compute.switchMode("worker")).toThrow(/exclusive lifecycle operation/i)
    await pendingExclusive
    await api.lifecycle.whenIdle()
    expect(api.lifecycle.isBusy()).toBe(false)
    unsubscribe()

    expect(errorEvent).toEqual({
      code: "lifecycle-conflict",
      operation: "compute.switchMode",
    })
  })

  it("registers plugins from constructor/options and dispatches facade events", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: "r1", score: 1 }, rowId: "r1", originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "score", label: "Score" }],
    })
    const events: string[] = []
    const disposed: string[] = []

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({
      core,
      plugins: [
        {
          id: "boot",
          onEvent(event) {
            events.push(`boot:${event}`)
          },
          onDispose() {
            disposed.push("boot")
          },
        },
      ],
    })

    expect(api.plugins.list()).toEqual(["boot"])
    expect(api.plugins.has("boot")).toBe(true)

    expect(api.plugins.register({
      id: "runtime",
      onEvent(event) {
        events.push(`runtime:${event}`)
      },
      onDispose() {
        disposed.push("runtime")
      },
    })).toBe(true)
    expect(api.plugins.register({ id: "runtime" })).toBe(false)

    api.rows.setSortModel([{ key: "score", direction: "desc" }])
    expect(events.some(event => event.includes("rows:changed"))).toBe(true)

    expect(api.plugins.unregister("runtime")).toBe(true)
    expect(api.plugins.unregister("runtime")).toBe(false)
    api.plugins.clear()
    expect(api.plugins.list()).toEqual([])
    expect(disposed).toContain("runtime")
    expect(disposed).toContain("boot")
  })

  it("batches cell refresh for large row-key sets without triggering full row-model refresh", async () => {
    const rows = Array.from({ length: 1_500 }, (_unused, index) => ({
      row: {
        rowId: `r${index}`,
        tested_at: `2026-02-${String((index % 28) + 1).padStart(2, "0")}`,
      },
      rowId: `r${index}`,
      originalIndex: index,
    }))
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "tested_at", label: "Tested At" },
        { key: "control", label: "Control" },
      ],
    })

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    api.view.setViewportRange({ start: 0, end: 49 })

    const refreshSpy = vi.spyOn(rowModel, "refresh")
    const batches: Array<{ cells: number }> = []
    const unsubscribe = api.view.onCellsRefresh(batch => {
      batches.push({ cells: batch.cells.length })
    })

    api.view.refreshCellsByRowKeys(
      Array.from({ length: 1_200 }, (_unused, index) => `r${index}`),
      ["tested_at"],
    )
    await waitForCellRefreshFrame()

    unsubscribe()
    expect(refreshSpy).not.toHaveBeenCalled()
    expect(batches).toHaveLength(1)
    expect(batches[0]?.cells).toBe(50)
  })

  it("does not emit repaint entries for rows outside current viewport", async () => {
    const rows = Array.from({ length: 300 }, (_unused, index) => ({
      row: { rowId: `r${index}`, tested_at: `T-${index}` },
      rowId: `r${index}`,
      originalIndex: index,
    }))
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "tested_at", label: "Tested At" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    api.view.setViewportRange({ start: 0, end: 19 })

    let emitted = 0
    const unsubscribe = api.view.onCellsRefresh(() => {
      emitted += 1
    })

    api.view.refreshCellsByRowKeys(["r120", "r121", "r122"], ["tested_at"])
    await waitForCellRefreshFrame()

    unsubscribe()
    expect(emitted).toBe(0)
  })

  it("includes pinned left/right metadata in viewport refresh batches", async () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { rowId: "r1", tested_at: "2026-02-20", control: "alpha" }, rowId: "r1", originalIndex: 0 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "tested_at", label: "Tested At", initialState: { pin: "left" } },
        { key: "control", label: "Control", initialState: { pin: "right" } },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    api.view.setViewportRange({ start: 0, end: 0 })

    let latestBatch:
      | {
          cells: Array<{ columnKey: string; pin: "left" | "right" | "none" }>
        }
      | null = null
    const unsubscribe = api.view.onCellsRefresh(batch => {
      latestBatch = {
        cells: batch.cells.map(cell => ({ columnKey: cell.columnKey, pin: cell.pin })),
      }
    })

    api.view.refreshCellsByRanges([
      {
        rowKey: "r1",
        columnKeys: ["tested_at", "control"],
      },
    ])
    await waitForCellRefreshFrame()

    unsubscribe()
    if (!latestBatch) {
      throw new Error("Expected refresh batch to be emitted")
    }
    expect(latestBatch).toEqual({
      cells: [
        { columnKey: "tested_at", pin: "left" },
        { columnKey: "control", pin: "right" },
      ],
    })
  })

  it("exposes selection capability checks and fails loudly for missing capability methods", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: { name: "selection" },
      },
    })

    const api = createDataGridApi({ core })

    expect(api.selection.hasSupport()).toBe(false)
    expect(api.selection.getSnapshot()).toBeNull()
    expect(() => api.selection.clear()).toThrow(/selection/)
  })

  it("delegates selection APIs when selection capability is implemented", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()
    let selectionSnapshot: DataGridSelectionSnapshot | null = null
    let clearCount = 0

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
            clearCount += 1
          },
        },
      },
    })

    const api = createDataGridApi({ core })
    const snapshot = {
      ranges: [],
      activeRangeIndex: -1,
      activeCell: null,
    } satisfies DataGridSelectionSnapshot

    api.selection.setSnapshot(snapshot)
    expect(api.selection.hasSupport()).toBe(true)
    expect(api.selection.getSnapshot()).toBe(snapshot)

    api.selection.clear()
    expect(clearCount).toBe(1)
    expect(api.selection.getSnapshot()).toBeNull()
  })

  it("computes selection summary through api facade when selection capability is present", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", latencyMs: 120 }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, owner: "ops", latencyMs: 80 }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "owner", label: "Owner" },
        { key: "latencyMs", label: "Latency" },
      ],
    })
    let selectionSnapshot: DataGridSelectionSnapshot | null = {
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 0,
          endCol: 1,
          startRowId: 1,
          endRowId: 2,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 1, colIndex: 1, rowId: 2 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 1, rowId: 2 },
    }

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
          },
        },
      },
    })

    const api = createDataGridApi({ core })
    const summary = api.selection.summarize({
      columns: [
        { key: "owner", aggregations: ["countDistinct"] },
        { key: "latencyMs", aggregations: ["sum", "max"] },
      ],
    })

    expect(summary?.selectedCells).toBe(4)
    expect(summary?.columns.owner.metrics.countDistinct).toBe(2)
    expect(summary?.columns.latencyMs.metrics.sum).toBe(200)
    expect(summary?.columns.latencyMs.metrics.max).toBe(120)
  })

  it("roundtrips row/column/filter/pagination/group/selection snapshots deterministically", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", status: "open" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, owner: "ops", status: "open" }, rowId: 2, originalIndex: 1 },
        { row: { id: 3, owner: "qa", status: "closed" }, rowId: 3, originalIndex: 2 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID", initialState: { width: 90 } },
        { key: "owner", label: "Owner", initialState: { width: 160 } },
        { key: "status", label: "Status", initialState: { width: 140 } },
      ],
    })
    let selectionSnapshot: DataGridSelectionSnapshot | null = null

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
          },
        },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setSortModel([{ key: "owner", direction: "asc" }])
    api.rows.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:open"] } },
      advancedFilters: {},
    })
    api.rows.setGroupBy({ fields: ["status"], expandedByDefault: true })
    api.rows.toggleGroup(`[["status","open"]]`)
    api.rows.setPagination({ pageSize: 2, currentPage: 0 })
    api.view.setViewportRange({ start: 0, end: 1 })
    api.columns.setOrder(["status", "owner", "id"])
    api.columns.setVisibility("id", false)
    api.columns.setPin("owner", "left")
    api.columns.setWidth("status", 220)
    api.selection.setSnapshot({
      ranges: [
        {
          startRow: 0,
          endRow: 0,
          startCol: 0,
          endCol: 1,
          startRowId: 1,
          endRowId: 1,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 0, colIndex: 1, rowId: 1 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 1, rowId: 1 },
    })

    const expectedRow = api.rows.getSnapshot()
    const expectedColumns = api.columns.getSnapshot()
    const expectedSelection = api.selection.getSnapshot()

    api.rows.setSortModel([{ key: "status", direction: "desc" }])
    api.rows.setFilterModel({ columnFilters: {}, advancedFilters: {} })
    api.rows.setGroupBy(null)
    api.rows.setPagination({ pageSize: 1, currentPage: 1 })
    api.view.setViewportRange({ start: 1, end: 1 })
    api.columns.setOrder(["id", "owner", "status"])
    api.columns.setVisibility("id", true)
    api.columns.setPin("owner", "none")
    api.columns.setWidth("status", 100)
    api.selection.clear()

    api.rows.setSortModel(expectedRow.sortModel)
    api.rows.setFilterModel(expectedRow.filterModel)
    api.rows.setGroupBy(expectedRow.groupBy)
    api.rows.setGroupExpansion(expectedRow.groupExpansion)
    api.rows.setPagination({
      pageSize: expectedRow.pagination.pageSize,
      currentPage: expectedRow.pagination.currentPage,
    })
    api.view.setViewportRange(expectedRow.viewportRange)
    api.columns.setOrder(expectedColumns.order)
    for (const column of expectedColumns.columns) {
      api.columns.setVisibility(column.key, column.visible)
      api.columns.setPin(column.key, column.pin)
      api.columns.setWidth(column.key, column.width)
    }
    if (expectedSelection) {
      api.selection.setSnapshot(expectedSelection)
    }

    const rowRoundtrip = api.rows.getSnapshot()
    const columnsRoundtrip = api.columns.getSnapshot()
    const selectionRoundtrip = api.selection.getSnapshot()

    expect(rowRoundtrip.sortModel).toEqual(expectedRow.sortModel)
    expect(rowRoundtrip.filterModel).toEqual(expectedRow.filterModel)
    expect(rowRoundtrip.groupBy).toEqual(expectedRow.groupBy)
    expect(rowRoundtrip.groupExpansion).toEqual(expectedRow.groupExpansion)
    expect(rowRoundtrip.pagination).toEqual(expectedRow.pagination)
    expect(rowRoundtrip.viewportRange).toEqual(expectedRow.viewportRange)

    expect(columnsRoundtrip.order).toEqual(expectedColumns.order)
    expect(
      columnsRoundtrip.columns.map(column => ({
        key: column.key,
        visible: column.visible,
        pin: column.pin,
        width: column.width,
      })),
    ).toEqual(
      expectedColumns.columns.map(column => ({
        key: column.key,
        visible: column.visible,
        pin: column.pin,
        width: column.width,
      })),
    )

    expect(selectionRoundtrip).toEqual(expectedSelection)
  })

  it("exposes transaction capability checks and fails loudly for missing methods", async () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        transaction: { name: "transaction" },
      },
    })

    const api = createDataGridApi({ core })

    expect(api.transaction.hasSupport()).toBe(false)
    expect(api.transaction.getSnapshot()).toBeNull()
    await expect(api.transaction.undo()).rejects.toThrow(/transaction/)
  })

  it("emits explicit state import begin/end boundaries around state.set", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1, owner: "noc" }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    const state = api.state.get()
    const events: string[] = []

    const unsubBegin = api.events.on("state:import:begin", () => {
      events.push("begin")
    })
    const unsubEnd = api.events.on("state:import:end", () => {
      events.push("end")
    })
    const unsubImported = api.events.on("state:imported", () => {
      events.push("imported")
    })

    api.state.set(state)

    unsubBegin()
    unsubEnd()
    unsubImported()

    expect(events).toEqual(["begin", "imported", "end"])
  })

  it("supports state migration hook with strict and non-strict behavior", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1, owner: "noc" }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    const state = api.state.get()

    const migrated = api.state.migrate(state, { strict: true })
    expect(migrated).toEqual(state)
    expect(migrated).not.toBe(state)

    expect(api.state.migrate({ version: 999 })).toBeNull()
    expect(() => api.state.migrate({ version: 999 }, { strict: true })).toThrow(/Unsupported state version/)
  })

  it("isolates plugin event-handler failures from core event dispatch", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1, owner: "noc" }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    let goodPluginRowsChanged = 0

    expect(api.plugins.register({
      id: "bad-plugin",
      onEvent() {
        throw new Error("plugin failure")
      },
    })).toBe(true)
    expect(api.plugins.register({
      id: "good-plugin",
      onEvent(event) {
        if (event === "rows:changed") {
          goodPluginRowsChanged += 1
        }
      },
    })).toBe(true)

    expect(() => {
      api.rows.setSortModel([{ key: "owner", direction: "asc" }])
    }).not.toThrow()
    expect(goodPluginRowsChanged > 0).toBe(true)
  })

  it("delegates transaction APIs when transaction capability is implemented", async () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()
    const values: Record<string, number> = {}
    const transactionService = createDataGridTransactionService({
      execute(command) {
        if (command.type !== "set") {
          return
        }
        const payload = command.payload as { key: string; value: number }
        values[payload.key] = payload.value
      },
    })

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        transaction: {
          name: "transaction",
          getTransactionSnapshot: transactionService.getSnapshot,
          beginTransactionBatch: transactionService.beginBatch,
          commitTransactionBatch: transactionService.commitBatch,
          rollbackTransactionBatch: transactionService.rollbackBatch,
          applyTransaction: transactionService.applyTransaction,
          canUndoTransaction: transactionService.canUndo,
          canRedoTransaction: transactionService.canRedo,
          undoTransaction: transactionService.undo,
          redoTransaction: transactionService.redo,
        },
      },
    })

    const api = createDataGridApi({ core })
    await api.transaction.apply({
      commands: [
        {
          type: "set",
          payload: { key: "a", value: 1 },
          rollbackPayload: { key: "a", value: 0 },
        },
      ],
    })
    expect(api.transaction.hasSupport()).toBe(true)
    expect(api.transaction.canUndo()).toBe(true)
    expect(values.a).toBe(1)

    await api.transaction.undo()
    expect(values.a).toBe(0)
    expect(api.transaction.canRedo()).toBe(true)
  })

  it("supports unified state get/set roundtrip for rows/columns/selection", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", status: "open" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, owner: "ops", status: "open" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID", initialState: { width: 90 } },
        { key: "owner", label: "Owner", initialState: { width: 160 } },
        { key: "status", label: "Status", initialState: { width: 140 } },
      ],
    })
    let selectionSnapshot: DataGridSelectionSnapshot | null = null

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
          },
        },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setSortModel([{ key: "owner", direction: "desc" }])
    api.rows.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:open"] } },
      advancedFilters: {},
    })
    api.rows.setGroupBy({ fields: ["status"], expandedByDefault: true })
    api.rows.setPagination({ pageSize: 1, currentPage: 0 })
    api.view.setViewportRange({ start: 0, end: 0 })
    api.rows.setAggregationModel({ columns: [{ key: "id", op: "count" }] })
    api.columns.setOrder(["status", "owner", "id"])
    api.columns.setVisibility("id", false)
    api.columns.setPin("owner", "left")
    api.columns.setWidth("status", 220)
    api.selection.setSnapshot({
      ranges: [
        {
          startRow: 0,
          endRow: 0,
          startCol: 0,
          endCol: 1,
          startRowId: 1,
          endRowId: 1,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 0, colIndex: 1, rowId: 1 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 1, rowId: 1 },
    })

    const saved = api.state.get()

    api.rows.setSortModel([{ key: "id", direction: "asc" }])
    api.rows.setFilterModel({ columnFilters: {}, advancedFilters: {} })
    api.rows.setGroupBy(null)
    api.rows.setAggregationModel(null)
    api.rows.setPagination({ pageSize: 2, currentPage: 0 })
    api.view.setViewportRange({ start: 0, end: 1 })
    api.columns.setOrder(["id", "owner", "status"])
    api.columns.setVisibility("id", true)
    api.columns.setPin("owner", "none")
    api.columns.setWidth("status", 100)
    api.selection.clear()

    api.state.set(saved)

    expect(api.rows.getSnapshot().sortModel).toEqual(saved.rows.snapshot.sortModel)
    expect(api.rows.getSnapshot().filterModel).toEqual(saved.rows.snapshot.filterModel)
    expect(api.rows.getSnapshot().groupBy).toEqual(saved.rows.snapshot.groupBy)
    expect(api.rows.getSnapshot().groupExpansion).toEqual(saved.rows.snapshot.groupExpansion)
    expect(api.rows.getSnapshot().pagination.pageSize).toBe(saved.rows.snapshot.pagination.pageSize)
    expect(api.rows.getSnapshot().pagination.currentPage).toBe(saved.rows.snapshot.pagination.currentPage)
    expect(api.rows.getSnapshot().viewportRange).toEqual(saved.rows.snapshot.viewportRange)
    expect(api.rows.getAggregationModel()).toEqual(saved.rows.aggregationModel)
    expect(api.columns.getSnapshot().order).toEqual(saved.columns.order)
    expect(api.selection.getSnapshot()).toEqual(saved.selection)
  })

  it("roundtrips serializable column style filters through unified state", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, styles: { status: { backgroundColor: "#ff0000" } } }, rowId: "r1", originalIndex: 0 },
        { row: { id: 2, styles: { status: { backgroundColor: "#00ff00" } } }, rowId: "r2", originalIndex: 1 },
      ],
      readFilterCellStyle: (rowNode, columnKey, styleKey) => {
        return (rowNode.data as {
          styles?: Record<string, Record<string, unknown>>
        }).styles?.[columnKey]?.[styleKey]
      },
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "status", label: "Status" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setFilterModel({
      columnFilters: {},
      columnStyleFilters: {
        status: {
          kind: "styleValueSet",
          styleKey: "backgroundColor",
          tokens: [serializeColumnValueToToken("#ff0000")],
        },
      },
      advancedFilters: {},
    })

    const exported = api.state.get()
    expect(exported?.rows.snapshot.filterModel).toEqual({
      columnFilters: {},
      columnStyleFilters: {
        status: {
          kind: "styleValueSet",
          styleKey: "backgroundColor",
          tokens: [serializeColumnValueToToken("#ff0000")],
        },
      },
      advancedFilters: {},
    })

    api.rows.setFilterModel(null)
    expect(api.rows.getSnapshot().rowCount).toBe(2)

    api.state.set(exported ?? null)
    expect(api.rows.getSnapshot().rowCount).toBe(1)

    rowModel.dispose()
  })

  it("emits facade events for rows/columns/projection/selection/transaction/state", async () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", score: 100 }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, owner: "ops", score: 200 }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "owner", label: "Owner" },
        { key: "score", label: "Score" },
      ],
    })
    let selectionSnapshot: DataGridSelectionSnapshot | null = null
    const values: Record<string, number> = {}
    const transactionService = createDataGridTransactionService({
      execute(command, context) {
        if (command.type === "set") {
          const payload = (
            context.direction === "apply" || context.direction === "redo"
              ? command.payload
              : command.rollbackPayload
          ) as { key: string; value: number }
          values[payload.key] = payload.value
        }
      },
    })

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
          },
        },
        transaction: {
          name: "transaction",
          getTransactionSnapshot: transactionService.getSnapshot,
          beginTransactionBatch: transactionService.beginBatch,
          commitTransactionBatch: transactionService.commitBatch,
          rollbackTransactionBatch: transactionService.rollbackBatch,
          applyTransaction: transactionService.applyTransaction,
          canUndoTransaction: transactionService.canUndo,
          canRedoTransaction: transactionService.canRedo,
          undoTransaction: transactionService.undo,
          redoTransaction: transactionService.redo,
        },
      },
    })
    const api = createDataGridApi({ core })

    const counters = {
      rows: 0,
      columns: 0,
      projection: 0,
      selection: 0,
      transaction: 0,
      viewport: 0,
      pivot: 0,
      imported: 0,
      error: 0,
    }
    const unsubs = [
      api.events.on("rows:changed", () => {
        counters.rows += 1
      }),
      api.events.on("columns:changed", () => {
        counters.columns += 1
      }),
      api.events.on("projection:recomputed", () => {
        counters.projection += 1
      }),
      api.events.on("selection:changed", () => {
        counters.selection += 1
      }),
      api.events.on("transaction:changed", () => {
        counters.transaction += 1
      }),
      api.events.on("viewport:changed", () => {
        counters.viewport += 1
      }),
      api.events.on("pivot:changed", () => {
        counters.pivot += 1
      }),
      api.events.on("state:imported", () => {
        counters.imported += 1
      }),
      api.events.on("error", () => {
        counters.error += 1
      }),
    ]

    api.rows.setSortModel([{ key: "score", direction: "desc" }])
    api.columns.setWidth("score", 220)
    api.view.setViewportRange({ start: 0, end: 1 })
    api.pivot.setModel({
      rows: ["owner"],
      columns: ["score"],
      values: [{ field: "score", agg: "count" }],
    })
    api.selection.setSnapshot({
      ranges: [],
      activeRangeIndex: -1,
      activeCell: null,
    })
    await api.transaction.apply({
      commands: [
        {
          type: "set",
          payload: { key: "x", value: 1 },
          rollbackPayload: { key: "x", value: 0 },
        },
      ],
    })
    expect(values.x).toBe(1)
    api.state.set(api.state.get())

    for (const unsub of unsubs) {
      unsub()
    }

    expect(counters.rows).toBeGreaterThan(0)
    expect(counters.columns).toBeGreaterThan(0)
    expect(counters.projection).toBeGreaterThan(0)
    expect(counters.selection).toBeGreaterThan(0)
    expect(counters.transaction).toBeGreaterThan(0)
    expect(counters.viewport).toBeGreaterThan(0)
    expect(counters.pivot).toBeGreaterThan(0)
    expect(counters.imported).toBeGreaterThan(0)
    expect(counters.error).toBeGreaterThanOrEqual(0)
  })
})
