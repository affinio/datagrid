// Regression coverage for identity defects documented in the companion audit.
import { afterAll, describe, expect, it, vi } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"
import { createAdvancedClientRowModel } from "../../../packages/datagrid-core/src/models/clientRowModel"
import { createDataGridEditModel } from "../../../packages/datagrid-core/src/models/editModel"
import { createDataGridColumnModel } from "../../../packages/datagrid-core/src/models/columnModel"
import { createDataGridCore } from "../../../packages/datagrid-core/src/core/gridCore"
import { createDataGridApi } from "../../../packages/datagrid-core/src/core/gridApi"
import { createDataSourceBackedRowModel } from "../../../packages/datagrid-core/src/models/dataSourceBackedRowModel"
import { createDataGridSpreadsheetWorkbookModel } from "../../../packages/datagrid-core/src/spreadsheet/workbookModel"
import { useDataGridRuntimeService } from "../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService"
import { useDataGridGroupMetaOrchestration, resolveDataGridGroupBadgeText } from "../../../packages/datagrid-orchestration/src/grouping/useDataGridGroupMetaOrchestration"

const results: Record<string, unknown> = {}
const output = process.env.IDENTITY_OUTPUT ?? "/tmp/affino-identity-audit"
afterAll(() => { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/headless.json`, JSON.stringify(results, null, 2)) })
const model = (rows: any[], options: any = {}) => createAdvancedClientRowModel<any>({ rows, resolveRowId: r => r.id, ...options })
const rows = (m: ReturnType<typeof model>) => m.getRowsInRange({ start: 0, end: 100 })
const ticks = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
function apiFor(m: ReturnType<typeof model>, columns: any[] = [{ key: "v" }]) {
  let selection: any = null
  let cells: any = null
  const core = createDataGridCore({ services: {
    rowModel: { name: "rowModel", model: m },
    columnModel: { name: "columnModel", model: createDataGridColumnModel({ columns }) },
    selection: {
      name: "selection", getRowSelectionSnapshot: () => selection, setRowSelectionSnapshot: s => { selection = s }, clearRowSelection: () => { selection = null },
      getSelectionSnapshot: () => cells, setSelectionSnapshot: s => { cells = s }, clearSelection: () => { cells = null },
      getFocusedRow: () => selection?.focusedRow ?? null, setFocusedRow: id => { selection = { ...selection, selectedRows: selection?.selectedRows ?? [], focusedRow: id } },
      getSelectedRows: () => selection?.selectedRows ?? [], isRowSelected: id => selection?.selectedRows.includes(id) ?? false,
      setRowSelected: (id, selected) => { const ids = new Set(selection?.selectedRows ?? []); if (selected) ids.add(id); else ids.delete(id); selection = { focusedRow: selection?.focusedRow ?? null, selectedRows: [...ids] } },
      selectRows: ids => { selection = { focusedRow: selection?.focusedRow ?? null, selectedRows: [...new Set([...(selection?.selectedRows ?? []), ...ids])] } },
      deselectRows: ids => { const removed = new Set(ids); selection = { focusedRow: selection?.focusedRow ?? null, selectedRows: (selection?.selectedRows ?? []).filter((id: any) => !removed.has(id)) } },
      clearSelectedRows: () => { selection = { focusedRow: selection?.focusedRow ?? null, selectedRows: [] } },
    },
  } })
  return createDataGridApi({ core })
}

describe("identity audit: headless", () => {
  it("typed source IDs remain distinct for lookup, mutation and row selection", async () => {
    const m = model([{ id: 1, v: 10 }, { id: "1", v: 20 }]); const api = apiFor(m)
    api.rows.patch([{ rowId: 1, data: { v: 30 } }])
    api.rowSelection.setSnapshot({ focusedRow: 1, selectedRows: [1, "1"] })
    expect(api.rows.getById(1)?.row.v).toBe(30); expect(api.rows.getById("1")?.row.v).toBe(20)
    expect(api.rowSelection.getSelectedRows()).toEqual([1, "1"])
    results.typedSourceIds = { number: 30, string: 20, selected: [1, "1"] }; await api.dispose()
  })

  it("keeps grouped-value cache entries separate for number and string IDs", () => {
    const m = model([{ id: 1, g: "A" }, { id: "1", g: "B" }], { initialGroupBy: { fields: ["g"], expandedByDefault: true } })
    const actual = rows(m).filter(r => r.kind === "group").map(r => ({ value: r.groupMeta?.groupValue, count: r.groupMeta?.childrenCount }))
    expect(actual).toEqual([{ value: "A", count: 1 }, { value: "B", count: 1 }])
    results.groupTypedIds = { source: [{ id: 1, g: "A" }, { id: "1", g: "B" }], expectedGroups: ["A", "B"], actual }; m.dispose()
  })

  it("keeps grouped-value cache entries separate for delimiter-containing tuples", () => {
    const m = model([{ id: "a", "b::c": "parent-A", c: "child-A" }, { id: "a::b", "b::c": "parent-B", c: "child-B" }], { initialGroupBy: { fields: ["b::c", "c"], expandedByDefault: true } })
    const children = rows(m).filter(r => r.kind === "group" && r.groupMeta?.level === 1).map(r => r.groupMeta?.groupValue)
    expect(children).toEqual(["child-A", "child-B"])
    results.groupCompositeKeys = { actual: children, expected: ["child-A", "child-B"], collidingKey: "a::b::c" }; m.dispose()
  })

  it("keeps delimiter-containing edit identities distinct", () => {
    const edit = createDataGridEditModel()
    edit.setEdit({ rowId: "a", columnKey: "b::c", value: "first" })
    edit.setEdit({ rowId: "a::b", columnKey: "c", value: "second" })
    expect(edit.getSnapshot().edits).toHaveLength(2)
    expect(edit.getEdit("a", "b::c")?.value).toBe("first")
    expect(edit.getEdit("a::b", "c")?.value).toBe("second")
    results.editComposite = { expectedEdits: 2, actual: edit.getSnapshot().edits, firstLookup: edit.getEdit("a", "b::c") }; edit.dispose()
  })

  it("compares sort descriptors as unambiguous tuples", () => {
    const data = [{ id: "r1", c: 1, "b:c": 9 }, { id: "r2", c: 2, "b:c": 0 }]
    const m = model(data)
    m.setSortModel([{ key: "a:b", field: "c", direction: "asc" }])
    m.setSortModel([{ key: "a", field: "b:c", direction: "asc" }])
    const fresh = model(data, { initialSortModel: [{ key: "a", field: "b:c", direction: "asc" }] })
    expect(rows(m).map(r => r.rowId)).toEqual(["r2", "r1"])
    expect(rows(fresh).map(r => r.rowId)).toEqual(["r2", "r1"])
    results.sortTuple = { actual: rows(m).map(r => r.rowId), expected: rows(fresh).map(r => r.rowId), retainedSort: m.getSnapshot().sortModel }; m.dispose(); fresh.dispose()
  })

  it("keeps typed parent IDs on separate tree expansion keys", () => {
    const m = model([{ id: 1, parent: null }, { id: "n", parent: 1 }, { id: "1", parent: null }, { id: "s", parent: "1" }], {
      initialTreeData: { mode: "parent", getParentId: (r: any) => r.parent, expandedByDefault: true },
    })
    const keys = rows(m).filter(r => r.kind === "group").map(r => r.groupMeta?.groupKey)
    expect(keys).toEqual(["tree:parent:number:1:1", "tree:parent:string:1:1"])
    m.collapseGroup(keys[0]!)
    const remaining = rows(m).map(r => r.rowId)
    expect(remaining).toEqual([1, "1", "s"])
    m.refresh()
    const afterRefresh = rows(m).map(r => r.rowId)
    results.treeTypedIds = { groupKeys: keys, targetedParent: 1, actualCollapsedRows: remaining, afterRefresh, expectedCollapsedRows: [1, "1", "s"] }; m.dispose()
  })

  it("continues to resolve an unambiguous legacy tree expansion key", () => {
    const m = model([{ id: 1, parent: null }, { id: "child", parent: 1 }], {
      initialTreeData: { mode: "parent", getParentId: (r: any) => r.parent, expandedByDefault: true },
    })
    m.setGroupExpansion({ expandedByDefault: true, toggledGroupKeys: ["tree:parent:1"] })
    expect(rows(m).map(row => row.rowId)).toEqual([1])
    results.treeLegacyExpansion = { key: "tree:parent:1", uniqueOwner: 1, collapsed: rows(m).map(row => row.rowId) }; m.dispose()
  })

  it("keeps generated group row IDs distinct from authored source IDs", () => {
    const m = model([{ id: "group:1:g1:A", g: "A" }], { initialGroupBy: { fields: ["g"], expandedByDefault: true } })
    const projected = rows(m)
    expect(new Set(projected.map(row => row.rowId)).size).toBe(projected.length)
    expect(projected[1]?.rowId).toBe("group:1:g1:A")
    results.groupNamespace = { generated: projected[0]?.rowId, source: projected[1]?.rowId }; m.dispose()
  })

  it("rejects authored columns that collide with generated pivot keys", async () => {
    const data = [{ rowId: "r1", team: "A", year: 2024, revenue: 10, note: "authored" }]
    const pivot = { rows: ["team"], columns: ["year"], values: [{ field: "revenue", agg: "sum" as const }] }
    const probe = useDataGridRuntimeService({ rows: data, columns: [{ key: "team" }, { key: "revenue" }] })
    probe.api.pivot.setModel(pivot); const generatedKey = probe.api.rows.getSnapshot().pivotColumns[0]!.id; await probe.stop()
    const runtime = useDataGridRuntimeService({ rows: data, columns: [{ key: "team" }, { key: generatedKey, field: "note" }, { key: "revenue" }] })
    expect(() => runtime.api.pivot.setModel(pivot)).toThrow(/Generated column key collides with an authored column key/)
    expect(runtime.api.rows.getSnapshot().pivotModel ?? null).toBeNull()
    expect(runtime.getColumnSnapshot().byKey[generatedKey]?.column.field).toBe("note")
    results.pivotAuthoredCollision = { generatedKey, outcome: "collision is reported rather than hiding the authored field and suppressing the metric" }; await runtime.stop()
  })

  it("preserves callback-only source schema replacement through pivot roundtrip", async () => {
    const oldGetter = () => "old", newGetter = () => "new"
    const runtime = useDataGridRuntimeService({ rows: [{ rowId: "r", team: "A", year: 2024, revenue: 10 }], columns: [{ key: "team" }, { key: "v", valueGetter: oldGetter }] })
    runtime.api.columns.setAll([{ key: "team" }, { key: "v", valueGetter: newGetter }])
    expect(runtime.getColumnSnapshot().byKey.v?.column.valueGetter).toBe(newGetter)
    runtime.api.pivot.setModel({ rows: ["team"], columns: ["year"], values: [{ field: "revenue", agg: "sum" }] })
    runtime.api.pivot.setModel(null)
    expect(runtime.getColumnSnapshot().byKey.v?.column.valueGetter).toBe(newGetter)
    results.getterRoundtrip = { acceptedGetter: "new", afterPivotRoundtrip: "old", previousFindingRef: "consistency #6 incomplete callback identity coverage" }; await runtime.stop()
  })

  it("keeps typed row IDs distinct in group metadata", () => {
    const snapshot = useDataGridGroupMetaOrchestration({ rows: [{ id: 1, g: "A" }, { id: "1", g: "B" }], groupBy: "g", resolveRowId: r => r.id, resolveGroupValue: r => r.g })
    expect(snapshot.groups).toBe(2)
    expect(resolveDataGridGroupBadgeText(snapshot, 1)).toBe("A (1)")
    results.legacyGroupMeta = { expectedGroups: 2, actualGroups: snapshot.groups, badgeForNumberOne: resolveDataGridGroupBadgeText(snapshot, 1) }
  })

  it("same-ID replacement and remove/readd recompute formulas from current source", () => {
    const m = model([{ id: 42, v: 2 }]); m.registerFormulaField({ name: "double", formula: "v * 2" })
    m.setRows([{ id: 42, v: 8 }]); expect(m.getRow(0)?.data.double).toBe(16)
    m.removeRows([42]); m.appendRows([{ id: 42, v: 3 }]); expect(m.getRow(0)?.data.double).toBe(6)
    m.unregisterFormulaField("double"); m.registerFormulaField({ name: "double", formula: "v * 3" }); expect(m.getRow(0)?.data.double).toBe(9)
    results.formulaIdentityRoundtrip = { replace: 16, removeReadd: 6, unregisterReregister: 9 }; m.dispose()
  })

  it("explicit selection and ID height overrides survive filtering and deliberate ID reuse", async () => {
    const m = model([{ id: 42, v: 2 }, { id: 43, v: 3 }]); const api = apiFor(m)
    api.rowSelection.setSnapshot({ focusedRow: 42, selectedRows: [42] }); api.view.setRowHeightOverrideById(42, 60)
    m.setFilterModel({ columnFilters: { v: { kind: "valueSet", tokens: ["number:3"] } } })
    expect(api.rowSelection.getSelectedRows()).toEqual([42]); expect(api.view.getRowHeightOverrideById(42)).toBe(60)
    m.setFilterModel(null); m.removeRows([42]); m.appendRows([{ id: 42, v: 9 }])
    expect(api.view.getRowHeightOverrideById(42)).toBe(60)
    results.retentionPolicy = { hiddenSelected: [42], heightAfterIdReuse: 60, classification: "documented override retention; explicit ID selection capability owns lifecycle" }; await api.dispose()
  })

  it("all-selection becomes stale on source replacement and explicit restore deliberately rebinds scope", async () => {
    const m = model([{ id: 42, v: 2 }], { initialSortModel: [{ key: "v", direction: "asc" }] }); const api = apiFor(m)
    api.rowSelection.setSnapshot({ focusedRow: null, selectedRows: [], mode: "all", excludedRows: [] })
    const state = api.state.get(); m.setRows([{ id: 43, v: 20 }])
    expect(api.rowSelection.getScopeStatus()).toBe("stale")
    const report = api.state.validate(state, { strict: true }); expect(report.valid).toBe(true)
    api.state.set(state, { strict: true, applyRows: false })
    expect(api.rowSelection.getScopeStatus()).toBe("current")
    results.restoreDatasetPolicy = { validation: report, classification: "explicit restore rebinds; no source dataset compatibility token in V1 state" }; await api.dispose()
  })

  it("field/type replacement with a retained column key resolves the current source", async () => {
    const m = model([{ id: 42, old: 2, next: "new" }]); const api = apiFor(m, [{ key: "v", field: "old", dataType: "number" }])
    api.columns.setAll([{ key: "v", field: "next", dataType: "text" }])
    const value = api.cells.resolveValue({ rowId: 42, columnKey: "v", purpose: "source" })
    expect(JSON.stringify(value)).toContain("new")
    api.columns.setAll([]); api.columns.setAll([{ key: "v", field: "old" }])
    expect(JSON.stringify(api.cells.resolveValue({ rowId: 42, columnKey: "v", purpose: "source" }))).toContain("2")
    results.columnRoundtrip = { sameKeyNewField: value, removeReadd: "old source field" }; await api.dispose()
  })

  it("rejects partial restore when a saved logical cell targets a different row", async () => {
    const m = model([{ id: "A", v: 1 }], { initialSortModel: [{ key: "v", direction: "asc" }] }); const api = apiFor(m)
    const point = { rowIndex: 0, colIndex: 0, rowId: "A" }
    api.selection.setSnapshot({ activeCell: point, activeRangeIndex: 0, ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0, startRowId: "A", endRowId: "A", anchor: point, focus: point }] })
    const saved = api.state.get(); m.setRows([{ id: "B", v: 2 }])
    expect(api.selection.getSnapshotStatus()).toBe("stale")
    const validation = api.state.validate(saved, { strict: true, applyRows: false })
    expect(validation.valid).toBe(false)
    expect(validation.issues).toContainEqual({ section: "selection", reason: "saved-row-target-does-not-match-current-projection" })
    expect(() => api.state.set(saved, { strict: true, applyRows: false, applyColumns: false, applyViewport: false })).toThrow()
    api.state.set(saved, { applyRows: false, applyColumns: false, applyViewport: false })
    expect(api.selection.getSnapshotStatus()).toBe("stale")
    expect(api.selection.getSnapshot()).toBeNull()
    expect(api.rows.get(0)?.rowId).toBe("B")
    results.restoreMissingLogicalCell = { validation, snapshot: api.selection.getSnapshot(), status: api.selection.getSnapshotStatus(), actualRowAtIndexZero: api.rows.get(0)?.rowId }; await api.dispose()
  })

  it("marks selections stale when a pass-through replacement changes row identity", async () => {
    const m = model([{ id: "A", v: 1 }]); const api = apiFor(m)
    const point = { rowIndex: 0, colIndex: 0, rowId: "A" }
    api.selection.setSnapshot({ activeCell: point, activeRangeIndex: 0, ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0, startRowId: "A", endRowId: "A", anchor: point, focus: point }] })
    api.rowSelection.setSnapshot({ focusedRow: null, selectedRows: [], mode: "all" })
    const before = m.getSnapshot(); m.setRows([{ id: "B", v: 2 }]); m.refresh(); const after = m.getSnapshot()
    expect(api.selection.getSnapshotStatus()).toBe("stale"); expect(api.rowSelection.getScopeStatus()).toBe("stale")
    expect(api.selection.getSnapshot()).toBeNull(); expect(api.rows.get(0)?.rowId).toBe("B")
    results.passThroughIdentity = { before: { revision: before.revision, projection: before.projection }, after: { revision: after.revision, projection: after.projection }, cellStatus: api.selection.getSnapshotStatus(), allStatus: api.rowSelection.getScopeStatus(), selection: api.selection.getSnapshot(), actualRowAtZero: api.rows.get(0)?.rowId }; await api.dispose()
  })

  it("group path encodings preserve delimiters and Unicode while values use implemented text normalization", () => {
    const values = ["a|b", "a:b", "", null, "雪", 1, "1"]
    const m = model(values.map((g, i) => ({ id: i, g })), { initialGroupBy: { fields: ["g"], expandedByDefault: true } })
    const groups = rows(m).filter(r => r.kind === "group").map(r => ({ key: r.rowId, value: r.groupMeta?.groupValue, count: r.groupMeta?.childrenCount }))
    expect(new Set(groups.map(g => g.key)).size).toBe(5)
    expect(groups.find(g => g.value === "")?.count).toBe(2); expect(groups.find(g => g.value === "1")?.count).toBe(2)
    results.groupValues = { groups, note: "implemented normalization merges null/empty and number/string axis values; typed source IDs are separate; raw-type grouping policy not explicitly documented" }; m.dispose()
  })

  it("a late old-query pull cannot replace current rows or datasetVersion", async () => {
    const gates: ReturnType<typeof deferred<any>>[] = []
    const m = createDataSourceBackedRowModel<any>({ initialTotal: 1, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: { pull() { const g = deferred<any>(); gates.push(g); return g.promise } } })
    const old = m.refresh(); m.setSortModel([{ key: "v", direction: "desc" }]); await ticks()
    gates.at(-1)!.resolve({ total: 1, datasetVersion: 20, rows: [{ index: 0, row: { id: 42, v: "new" } }] }); await ticks()
    gates[0]!.resolve({ total: 1, datasetVersion: 1, rows: [{ index: 0, row: { id: 42, v: "old" } }] }); await old; await ticks()
    expect(m.getRow(0)?.data.v).toBe("new"); expect(m.getSnapshot().datasetVersion).toBe(20)
    results.querySupersession = { pulls: gates.length, actual: m.getRow(0)?.data, datasetVersion: m.getSnapshot().datasetVersion }; m.dispose()
  })

  it("rolls back optimistic edits at the row's current query position", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {})
    const commit = deferred<any>()
    const data = [{ id: "A", v: 10 }, { id: "B", v: 20 }]
    const m = createDataSourceBackedRowModel<any>({ initialTotal: 2, resolveRowId: r => r.id, prefetch: { enabled: false }, dataSource: {
      async pull(request) { const ordered = request.sortModel[0]?.direction === "desc" ? [...data].reverse() : data; return { total: 2, rows: ordered.map((row, index) => ({ index, row })) } },
      commitEdits: () => commit.promise,
    } })
    m.setViewportRange({ start: 0, end: 1 }); await ticks()
    const outcome = Promise.resolve(m.patchRows!([{ rowId: "A", data: { v: 99 } }])).then(() => "fulfilled", () => "rejected")
    await ticks(); m.setSortModel([{ key: "v", direction: "desc" }]); await ticks()
    const beforeReject = m.getRowsInRange({ start: 0, end: 1 }).map(r => ({ id: r.rowId, v: r.data.v }))
    expect(beforeReject).toEqual([{ id: "B", v: 20 }, { id: "A", v: 99 }])
    commit.reject(Error("server rejected")); expect(await outcome).toBe("rejected")
    const afterReject = m.getRowsInRange({ start: 0, end: 1 }).map(r => ({ id: r.rowId, v: r.data.v }))
    expect(afterReject).toEqual([{ id: "B", v: 20 }, { id: "A", v: 10 }])
    results.optimisticQueryRollback = { initial: data, beforeReject, afterReject, expectedAfterReject: [{ id: "B", v: 20 }, { id: "A", v: 10 }] }
    m.dispose(); silence.mockRestore()
  })

  it("tree-path keys preserve separators and Unicode", () => {
    const paths = [["a", "b|c"], ["a|b", "c"], ["a:b", "雪"], ["a", "b:c"]]
    const m = model(paths.map((path, i) => ({ id: i, path })), { initialTreeData: { mode: "path", getDataPath: (r: any) => r.path, expandedByDefault: true } })
    expect(rows(m).filter(r => r.kind === "leaf").map(r => r.rowId)).toHaveLength(4)
    const groupKeys = rows(m).filter(r => r.kind === "group").map(r => r.rowId)
    expect(new Set(groupKeys).size).toBe(groupKeys.length)
    results.treePathEncoding = { paths, groupKeys }; m.dispose()
  })

  it("sheet removal/re-addition does not resurrect its old cells and duplicate canonical IDs reject", () => {
    const wb = createDataGridSpreadsheetWorkbookModel({ sheets: [{ id: "same", name: "Same", sheetModelOptions: { columns: [{ key: "v" }], rows: [{ id: 42, cells: { v: 2 } }] } }] })
    expect(() => wb.addSheet({ id: "SAME", name: "Other", sheetModelOptions: { columns: [], rows: [] } })).toThrow(/already exists/)
    expect(wb.removeSheet("same")).toBe(true)
    wb.addSheet({ id: "same", name: "Same", sheetModelOptions: { columns: [{ key: "v" }], rows: [{ id: 42, cells: { v: 7 } }] } })
    expect(wb.getSheet("same")?.sheetModel.getCellById(42, "v")?.rawInput).toBe("7")
    results.sheetReuse = { canonicalCollisionRejected: true, old: "2", new: "7" }; wb.dispose()
  })

  it("independent model and workbook scopes do not share same-ID cells", () => {
    const a = model([{ id: 42, v: 2 }]), b = model([{ id: 42, v: 7 }]); a.registerFormulaField({ name: "double", formula: "v * 2" })
    expect(b.getRow(0)?.data.double).toBeUndefined()
    const makeWorkbook = (value: number) => createDataGridSpreadsheetWorkbookModel({ sheets: [{ id: "s", name: "Sheet", sheetModelOptions: { columns: [{ key: "v" }], rows: [{ id: 42, cells: { v: value } }] } }] })
    const wa = makeWorkbook(2), wb = makeWorkbook(7)
    expect(wa.getSheet("s")?.sheetModel.getCellById(42, "v")?.rawInput).toBe("2")
    expect(wb.getSheet("s")?.sheetModel.getCellById(42, "v")?.rawInput).toBe("7")
    results.independentScopes = { modelAComputed: 4, modelBUndefined: true, workbookA: 2, workbookB: 7 }; a.dispose(); b.dispose(); wa.dispose(); wb.dispose()
  })
})
